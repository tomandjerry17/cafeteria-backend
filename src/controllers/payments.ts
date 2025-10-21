import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../db";

// ✅ Create new payment (for student or walk-in)
export const createPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, customerName, customerType, amountReceived } = req.body;

    if (!amountReceived) {
      return res.status(400).json({ error: "Amount received is required." });
    }

    // 🔹 Get the order if linked to one
    let order = null;
    if (orderId) {
      order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        return res.status(404).json({ error: "Order not found." });
      }
    }

    const totalAmount = order ? Number(order.totalPrice) : Number(amountReceived);
    const changeDue = Number(amountReceived) - totalAmount;

    // 🔹 Create the payment record
    const payment = await prisma.payment.create({
      data: {
        orderId: order ? order.id : null,
        processedById: req.user?.id ?? "", // ✅ now valid
        amountReceived: Number(amountReceived),
        amountDue: totalAmount,
        change: changeDue,
        paymentMethod: "cash",
      },
    });

    // 🔹 If linked to an order, update its status and optionally its customer name/type
    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: "paid",
          status: "picked_up",
          ...(customerName ? { customerName } : {}),
          ...(customerType ? { customerType } : {}),
        },
      });
    }

    res.status(201).json(payment);
  } catch (error) {
    console.error("❌ Error creating payment:", error);
    res.status(500).json({ error: "Failed to create payment" });
  }
};

// ✅ Get all payments
export const getPayments = async (req: AuthRequest, res: Response) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            totalPrice: true,
            status: true,
            paymentStatus: true,
            customerName: true,
            customerType: true,
          },
        },
        processedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });
    res.json(payments);
  } catch (error) {
    console.error("❌ Error fetching payments:", error);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
};

// ✅ Get a specific payment
export const getPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing payment ID." });

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
        processedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (error) {
    console.error("❌ Error fetching payment:", error);
    res.status(500).json({ error: "Failed to fetch payment" });
  }
};

// ✅ Delete payment (admin only)
export const deletePayment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing payment ID." });

    await prisma.payment.delete({ where: { id } });
    res.json({ message: "Payment deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting payment:", error);
    res.status(500).json({ error: "Failed to delete payment" });
  }
};
