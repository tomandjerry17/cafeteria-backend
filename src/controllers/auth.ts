import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { sendEmail } from "../utils/mailer";
import { AuthRequest } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// Generate 4-digit verification code
const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString();

// Staff Register
export const registerStaff = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: "staff",
        approved: false, // 👈 Must be approved by admin
      },
    });

    // ✉️ Optional: send mail (if nodemailer is configured)
    try {
      await sendEmail(
        email,
        "Registration Received",
        `Hi ${fullName}, your staff registration is pending admin approval. You’ll receive an email once approved.`,
      );
    } catch (mailErr) {
      console.warn("Email sending failed:", mailErr);
    }

    // Don’t issue token — must be approved first
    return res.status(201).json({
      message: "Registration successful. Please wait for admin approval.",
    });
  } catch (err) {
    console.error("Staff register error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// REGISTER
export async function register(req: Request, res: Response) {
  try {
    const { fullName, email, password, studentId, contact, role } = req.body;
    if (!fullName || !email || !password || !studentId || !contact) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationCode = generateCode();

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        studentId,
        contact,
        role: role || "student",
        verificationCode,
      },
    });

    // Send verification email
    await sendEmail(
      email,
      "Your Verification Code",
      `Hello ${fullName},\n\nYour verification code is: ${verificationCode}`
    );

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        studentId: user.studentId,
        contact: user.contact,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// RESEND CODE
export async function resendCode(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    const verificationCode = generateCode();
    await prisma.user.update({ where: { email }, data: { verificationCode } });

    await sendEmail(
      email,
      "Your Verification Code",
      `Hello ${user.fullName},\n\nYour new verification code is: ${verificationCode}`
    );

    return res.json({ message: "Verification code sent" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}

// VERIFY CODE
export async function verifyCode(req: Request, res: Response) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    if (user.verificationCode !== code) return res.status(400).json({ error: "Invalid code" });

    await prisma.user.update({ where: { email }, data: { emailVerified: true, verificationCode: null } });

    return res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}


// Forgot Password
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "No account found" });

    // generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: token, resetPasswordExpires: expiry },
    });

    // use path param style link now
    const resetLink = `${process.env.FRONTEND_URL}/reset/${token}`;

    await sendEmail(
      user.email,
      "Password Reset Request",
      `Click here to reset your password: ${resetLink}`
    );

    return res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// Reset Password
export async function resetPassword(req: Request, res: Response) {
  try {
    const token = req.params.token as string; // force token to string
    const { newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Missing token or new password" });
    }

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token, // now guaranteed string
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
}


export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("getCurrentUser error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};