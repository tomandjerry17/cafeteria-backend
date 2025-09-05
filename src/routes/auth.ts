// src/routes/auth.ts
import { Router } from "express";
const router = Router();

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               studentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 */
router.post("/register", (req, res) => {
  res.json({ message: "Register endpoint (mock)" });
});

export default router;
