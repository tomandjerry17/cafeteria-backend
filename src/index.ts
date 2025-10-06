import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { prisma } from "./db";
import authRoutes from "./routes/auth"; // 👈 include .js if using ESM/ts-node
import orderRoutes from "./routes/orders";
import menuRoutes from "./routes/menu";




dotenv.config();

const app = express();

// ✅ Middleware first
app.use(cors({
  origin: [
    "https://cafeteria-auth.vercel.app", // Staff Portal
    "https://e-faspecc.vercel.app", // Student Portal
    "http://localhost:5173",
    "http://localhost:5174",             // ✅ local dev
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

app.use(express.json());

// ✅ Then routes
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/menu", menuRoutes);

app.get("/", (_req, res) => res.send("Cafeteria backend running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server ${PORT}`));
