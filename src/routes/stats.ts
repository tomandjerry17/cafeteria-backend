import { Router } from "express";
import { prisma } from "../db";

const router = Router();

router.get(
  "/overview",
  async (req, res) => {
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [activeStaff, dailyOrders, menuItems, studentUsers] =
        await Promise.all([
          prisma.user.count({
            where: { role: "staff", approved: true },
          }),

          prisma.order.count({
            where: { createdAt: { gte: startOfToday } },
          }),

          prisma.menuItem.count(),

          prisma.user.count({
            where: { role: "student" },
          }),
        ]);

      res.json({
        activeStaff,
        dailyOrders,
        menuItems,
        studentUsers,
      });
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ error: "Failed to load stats" });
    }
  }
);

export default router;
