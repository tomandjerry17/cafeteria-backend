import { Router, Response } from "express";
import { OrderStatus, PickupType, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * 🎯 STUDENT: Create new order
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["student"]),
  async (req: AuthRequest, res) => {
    try {
      const { items, pickupTime, pickupType } = req.body;
      const userId = req.user!.id;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: "No items provided" });
      }

      // ✅ Validate pickup type
      if (!Object.values(PickupType).includes(pickupType)) {
        return res.status(400).json({ error: "Invalid pickup type" });
      }

      // ✅ Validate menu items
      const itemIds = items.map((i: any) => i.menuId);
      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
      });

      for (const it of items) {
        const mi = menuItems.find((m) => m.id === it.menuId);
        if (!mi) return res.status(400).json({ error: `Item ${it.menuId} not found` });
        if (!mi.availability) return res.status(400).json({ error: `${mi.name} is not available` });
        if (mi.stockLimit !== null && mi.stockLimit < it.quantity) {
          return res.status(400).json({ error: `${mi.name} has insufficient stock` });
        }
      }

      // ✅ Create order in transaction
      const order = await prisma.$transaction(async (tx) => {
        const totalPrice = items.reduce((sum: number, it: any) => {
          const mi = menuItems.find((m) => m.id === it.menuId)!;
          return sum + Number(mi.price) * it.quantity;
        }, 0);

        const newOrder = await tx.order.create({
          data: {
            userId,
            pickupType: pickupType as PickupType,
            pickupTime: pickupTime ? new Date(pickupTime) : null,
            totalPrice: new Prisma.Decimal(totalPrice),
            orderItems: {
              create: items.map((it: any) => ({
                itemId: it.menuId,
                quantity: it.quantity,
                priceAtOrder: menuItems.find((m) => m.id === it.menuId)!.price,
              })),
            },
          },
          include: { orderItems: true },
        });

        // ✅ Decrement stock and log inventory changes
        for (const it of items) {
          const mi = menuItems.find((m) => m.id === it.menuId)!;
          if (mi.stockLimit !== null) {
            await tx.menuItem.update({
              where: { id: it.menuId },
              data: { stockLimit: { decrement: it.quantity } },
            });
          }
          await tx.inventoryLog.create({
            data: {
              staffId: null,
              itemId: it.menuId,
              changeType: "deduct",
              quantity: it.quantity,
              note: `Order #${newOrder.id}`,
            },
          });
        }

        return newOrder;
      });

      // After transaction
      await prisma.notification.create({
        data: {
          userId, // the student who made the order
          orderId: order.id,
          message: `Your order #${order.id} has been placed successfully.`,
          status: "unread",
        },
      });


      res.json(order);
    } catch (err: any) {
      console.error("Create Order Error:", err);
      res.status(500).json({ error: err.message || "Failed to create order" });
    }
  }
);

/**
 * 🛠 STAFF/ADMIN: Update order status
 */
router.put(
  "/:id/status",
  authenticateToken,
  requireRole(["staff", "admin"]),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) return res.status(400).json({ error: "Order ID is required" });
      if (!status) return res.status(400).json({ error: "Status is required" });

      const allowedStatuses = Object.values(OrderStatus);
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: { status: status as OrderStatus },
        include: { orderItems: { include: { item: true } }, user: true },
      });

      // ⭐ Notify the student about status update
      await prisma.notification.create({
        data: {
          userId: updated.userId!,
          orderId: updated.id,
          message: `Your order #${updated.id} status is now: ${updated.status}.`,
          status: "unread",
        },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Update Status Error:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  }
);

/**
 * 🔎 ANY AUTHENTICATED: Get specific order
 * (Students can only view their own)
 */
router.get("/:id", authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!id) return res.status(400).json({ error: "Order ID is required" });
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: { include: { item: true } }, user: true },
    });

    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.user!.role === "student" && order.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json(order);
  } catch (err: any) {
    console.error("Get Order Error:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

/**
 * 🌐 UNIVERSAL: Get orders (role-based)
 * - Student: own orders
 * - Staff/Admin: all orders
 */
router.get(
  "/",
  authenticateToken,
  async (req: AuthRequest, res) => {
    try {
      const user = req.user!;
      let orders;

      if (user.role === "student") {
        orders = await prisma.order.findMany({
          where: { userId: user.id },
          include: { orderItems: { include: { item: true } } },
          orderBy: { createdAt: "desc" },
        });
      } else if (user.role === "staff" || user.role === "admin") {
        orders = await prisma.order.findMany({
          include: { orderItems: { include: { item: true } }, user: true },
          orderBy: { createdAt: "desc" },
        });
      } else {
        return res.status(403).json({ error: "Forbidden" });
      }

      res.json(orders);
    } catch (err: any) {
      console.error("Get Orders Error:", err);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  }
);

/**
 * ❌ STAFF/ADMIN: Delete order
 */
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["staff", "admin"]),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Order ID is required" });

      await prisma.orderItem.deleteMany({ where: { orderId: id } });
      await prisma.order.delete({ where: { id } });

      res.json({ success: true, message: "Order deleted successfully" });
    } catch (err: any) {
      console.error("Delete Order Error:", err);
      res.status(500).json({ error: "Failed to delete order" });
    }
  }
);

/**
 * 💳 STUDENT: Confirm payment readiness
 */
router.patch(
  "/:id/confirm-payment",
  authenticateToken,
  requireRole(["student"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      if (!id) return res.status(400).json({ error: "Order ID is required" });

      // ✅ Ensure the order belongs to the student
      const order = await prisma.order.findUnique({ where: { id } });
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.userId !== user.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // ✅ Only allow confirmation when order is 'ready'
      if (order.status !== "ready") {
        return res.status(400).json({ error: "You can only confirm payment when your order is ready." });
      }

      const updated = await prisma.order.update({
        where: { id },
        data: { paymentConfirmed: true },
      });

      res.json({ success: true, message: "Payment confirmed successfully", order: updated });
    } catch (err: any) {
      console.error("Confirm Payment Error:", err);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  }
);

/**
 * 🧍 STUDENT: Cancel own order (if still pending)
 */
router.patch(
  "/:id/cancel",
  authenticateToken,
  requireRole(["student"]),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user!;

      // ✅ Validate ID
      if (!id) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      // ✅ Find order
      const order = await prisma.order.findUnique({
        where: { id: id as string },
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // ✅ Ensure the order belongs to the logged-in student
      if (order.userId !== user.id) {
        return res.status(403).json({ error: "You can only cancel your own orders" });
      }

      // ✅ Only allow cancellation if still pending
      if (order.status !== "pending") {
        return res
          .status(400)
          .json({ error: "Only pending orders can be cancelled" });
      }

      // ✅ Update order to rejected
      const updated = await prisma.order.update({
        where: { id: id as string },
        data: { status: "rejected" },
      });

      return res.json({
        success: true,
        message: "Order cancelled successfully",
        order: updated,
      });
    } catch (err: any) {
      console.error("Cancel Order Error:", err);
      return res.status(500).json({ error: "Failed to cancel order" });
    }
  }
);

export default router;
