import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * STUDENT: Create order
 */
router.post(
  "/", 
  authenticateToken, 
  requireRole(["student"]), 
  async (req: AuthRequest, res) => {
    try {
      const { items, pickupTime, pickupType } = req.body;
      const userId = req.user!.userId; // from JWT

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      // Validate menu items
      const itemIds = items.map((i: any) => i.menuId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } }
      });

      for (const it of items) {
        const mi = menuItems.find(m => m.id === it.menuId);
        if (!mi) return res.status(400).json({ error: `Item ${it.menuId} not found` });
        if (!mi.availability) return res.status(400).json({ error: `${mi.name} is not available` });
        if (mi.stockLimit !== null && mi.stockLimit < it.quantity) {
          return res.status(400).json({ error: `${mi.name} has insufficient stock` });
        }
      }

      // Run transaction
      const order = await prisma.$transaction(async (tx) => {
        const totalPrice = items.reduce((sum: number, it: any) => {
          const mi = menuItems.find(m => m.id === it.menuId)!;
          return sum + Number(mi.price) * it.quantity;
        }, 0);

        const newOrder = await tx.order.create({
          data: {
            userId,
            pickupType,
            pickupTime: pickupTime ? new Date(pickupTime) : null,
            totalPrice,
            orderItems: {
              create: items.map((it: any) => ({
                itemId: it.menuId,
                quantity: it.quantity,
                priceAtOrder: menuItems.find(m => m.id === it.menuId)!.price,
              }))
            }
          },
          include: { orderItems: true }
        });

        for (const it of items) {
          const mi = menuItems.find(m => m.id === it.menuId)!;
          if (mi.stockLimit !== null) {
            await tx.menuItem.update({
              where: { id: it.menuId },
              data: { stockLimit: { decrement: it.quantity } }
            });
          }
          await tx.inventoryLog.create({
            data: {
              staffId: null,
              itemId: it.menuId,
              changeType: "deduct",
              quantity: it.quantity,
              note: `Order #${newOrder.id}`
            }
          });
        }

        return newOrder;
      });

      res.json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to create order" });
    }
  }
);

/**
 * STAFF/ADMIN: Update order status
 */
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["staff", "admin"]),
  async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const orderId = req.params.id;

      if (!orderId) return res.status(400).json({ error: "Order ID is required" });

      const allowedStatuses = ["pending", "confirmed", "preparing", "ready", "rejected", "picked_up"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status },
        include: { orderItems: true }
      });

      res.json(updated);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to update status" });
    }
  }
);

/**
 * ANY AUTHENTICATED: Get order by ID (student must own it)
 */
router.get(
  "/:id",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      const order = await prisma.order.findUnique({
        where: { id: String(id) }, // ✅ ensure it's a string
        include: { orderItems: { include: { item: true } } }
      });

      if (!order) return res.status(404).json({ error: "Order not found" });

      if (req.user!.role === "student" && order.userId !== req.user!.userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.json(order);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  }
);

/**
 * STUDENT: Get own orders
 */
router.get(
  "/user/me",
  authenticateToken,
  requireRole(["student"]),
  async (req: AuthRequest, res) => {
    try {
      const orders = await prisma.order.findMany({
        where: { userId: req.user!.userId },
        include: { orderItems: { include: { item: true } } },
        orderBy: { createdAt: "desc" }
      });

      res.json(orders);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * STAFF/ADMIN: Get all orders
 */
router.get(
  "/staff/all",
  authenticateToken,
  requireRole(["staff", "admin"]),
  async (_req, res) => {
    try {
      const orders = await prisma.order.findMany({
        include: { orderItems: { include: { item: true } }, user: true },
        orderBy: { createdAt: "desc" }
      });

      res.json(orders);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch incoming orders" });
    }
  }
);

export default router;
