import express from "express";
import {
  createPayment,
  getPayments,
  getPaymentById,
  deletePayment,
} from "../controllers/payments";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// ✅ All routes require authentication
router.use(authenticateToken);

// POST /payments
router.post("/", createPayment);

// GET /payments
router.get("/", getPayments);

// GET /payments/:id
router.get("/:id", getPaymentById);

// DELETE /payments/:id
router.delete("/:id", deletePayment);

export default router;
