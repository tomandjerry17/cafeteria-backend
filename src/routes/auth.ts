import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { sendEmail } from "../utils/mailer";
import { forgotPassword, resetPassword, changePassword } from "../controllers/auth";
import { getCurrentUser } from "../controllers/auth";
import { authenticateToken, requireRole } from "../middleware/auth";
import { registerStaff } from "../controllers/auth";
import type { AuthRequest } from "../middleware/auth";


const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret"; // use env var in prod

// Generate 4-digit code
const generateCode = () => Math.floor(1000 + Math.random() * 9000).toString();

router.get("/me", authenticateToken, getCurrentUser);

// Staff registration
router.post("/register-staff", registerStaff);

// Get all pending staff accounts
router.get(
  "/pending-staff",
  authenticateToken,
  requireRole(["admin"]), // only admin can view
  async (req, res) => {
    try {
      const pendingStaff = await prisma.user.findMany({
        where: { role: "staff", approved: false },
      });

      res.json(pendingStaff);
    } catch (err) {
      console.error("Error fetching pending staff:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Approve a specific staff
router.post(
  "/approve-staff/:id",
  authenticateToken,
  requireRole(["admin"]), // only admin can approve
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Missing staff ID" });
      }

      const staff = await prisma.user.update({
        where: { id: String(id) }, // 👈 Ensure it's a string
        data: { approved: true },
      });

      // optional email notification
      try {
        await sendEmail(
          staff.email,
          "Account Approved",
          `Hi ${staff.fullName}, your staff account has been approved! You can now log in.`,
        );
      } catch (mailErr) {
        console.warn("Email sending failed:", mailErr);
      }

      res.json({ message: "Staff approved successfully", staff });
    } catch (err) {
      console.error("Approve staff error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// Get staff statistics
router.get(
  "/staff-stats",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const [total, approved, pending] = await Promise.all([
        prisma.user.count({ where: { role: "staff" } }),
        prisma.user.count({ where: { role: "staff", approved: true } }),
        prisma.user.count({ where: { role: "staff", approved: false } }),
      ]);

      res.json({ total, approved, pending });
    } catch (err) {
      console.error("Error fetching staff stats:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// ===============================
// REGISTER
// ===============================
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, contact, studentId } = req.body;

    if (!fullName || !email || !password || !contact || !studentId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already used" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = generateCode();

    const newUser = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash: hashedPassword,
        role: "student",
        contact,
        studentId,
        verificationCode,
      },
    });

    // Send verification code email
    await sendEmail(email, "Your Verification Code", `Hello ${fullName}, your code is ${verificationCode}`);

    const token = jwt.sign({ userId: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: "1d" });

    res.json({
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ===============================
// RESEND VERIFICATION CODE
// ===============================
router.post("/send-code", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });

    const verificationCode = generateCode();
    await prisma.user.update({ where: { email }, data: { verificationCode } });

    await sendEmail(email, "Your Verification Code", `Hello ${user.fullName}, your new code is ${verificationCode}`);

    res.json({ message: "Verification code sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// VERIFY CODE
// ===============================
router.post("/verify-code", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.emailVerified) return res.status(400).json({ error: "Email already verified" });
    if (user.verificationCode !== code) return res.status(400).json({ error: "Invalid code" });

    await prisma.user.update({ where: { email }, data: { emailVerified: true, verificationCode: null } });

    res.json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ===============================
// LOGIN
// ===============================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    // compare password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: "Invalid email or password" });

    // issue JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

router.post("/login-staff", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Role check
    if (user.role !== "staff" && user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: staff only" });
    }

    // 🚫 Check approval
    if (user.role === "staff" && !user.approved) {
      return res.status(403).json({ error: "Your account is pending admin approval." });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ===============================
// GET CURRENT USER
// ===============================
router.get("/user", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Invalid token format" });

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        contact: true,
        studentId: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// forgot + reset
router.post("/forgot", forgotPassword);
router.post("/reset/:token", resetPassword);
router.patch("/change-password", authenticateToken, changePassword);


router.put("/update", authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Extract authenticated user's ID
    const { userId } = req.user!;

    const { fullName, contact, studentId } = req.body;

    // Update user in the database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        contact,
        studentId,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        contact: true,
        studentId: true,
      },
    });

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;