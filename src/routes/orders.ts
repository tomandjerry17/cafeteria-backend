import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Create order (only STUDENTS can place orders)
router.post(
  "/", 
  authenticateToken, 
  requireRole(["student"]), 
  async (req: AuthRequest, res) => {
    try {
      const { items, pickupTime, pickupType } = req.body;
      const userId = req.user!.userId; // 🔹 get from JWT instead of body

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      // Validate menu items
      const itemIds = items.map((i: any) => i.menuId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } }
      });

      // Pre-check stock and availability
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
        // Calculate total price from DB to avoid tampering
        const totalPrice = items.reduce((sum: number, it: any) => {
          const mi = menuItems.find(m => m.id === it.menuId)!;
          return sum + Number(mi.price) * it.quantity;
        }, 0);

        // Create order + order items
        const newOrder = await tx.order.create({
          data: {
            userId, // 🔹 taken from JWT, not request body
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

        // Decrement stock + log inventory
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
              staffId: null, // system action
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

// Update order status (STAFF or ADMIN only)
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["staff", "admin"]),
  async (req: AuthRequest, res) => {
    try {
      const { status } = req.body;
      const orderId = req.params.id;

      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      const allowedStatuses = ["pending", "confirmed", "preparing", "ready", "rejected", "picked_up"];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await prisma.order.update({
        where: { id: orderId }, // ✅ TypeScript now knows this is a string
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


export default router;
