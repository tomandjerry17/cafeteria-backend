import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";

// ⭐ Local override of Express.Request inside THIS FILE ONLY
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role?: string;
      email?: string;
    };
  }
}

const router = Router();

// ⭐ CREATE feedback
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be 1–5" });
  }

  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const feedback = await prisma.feedback.create({
      data: {
        rating,
        comment,
        userId: req.user.id,
        itemId: "SYSTEM_FEEDBACK",
      },
    });

    res.json(feedback);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
});

// ⭐ GET feedback of logged-in user
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const feedback = await prisma.feedback.findMany({
      where: { userId: req.user.id },
    });

    res.json(feedback);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

export default router;
