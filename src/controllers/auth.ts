// src/controllers/auth.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret"; // fallback if missing

// REGISTER
export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, studentId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hash, studentId },
    });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
