import { Router, Response } from "express";
import { prisma } from "../db";
import { authenticateToken } from "../middleware/auth";
import { AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * ⭐ GET all notifications for logged-in user
 */
router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * ⭐ Mark single notification as "read"
 */
router.patch("/:id/read", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id! },
      data: { status: "read" },
    });

    res.json(notification);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

/**
 * ⭐ Mark ALL notifications as read
 */
router.patch("/mark-all", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, status: "unread" },
      data: { status: "read" },
    });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

/**
 * ⭐ Get unread count (for notification badges)
 */
router.get("/unread-count", authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: { userId: req.user!.id, status: "unread" },
    });

    res.json({ unread: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

export default router;
