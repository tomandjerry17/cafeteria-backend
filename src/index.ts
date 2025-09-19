import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth"; // 👈 include .js if using ESM/ts-node
import orderRoutes from "./routes/orders";
import menuRoutes from "./routes/menu";




dotenv.config();

const app = express();
const prisma = new PrismaClient();

// ✅ Middleware first
app.use(cors());
app.use(express.json());

// ✅ Then routes
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/menu", menuRoutes);

app.get("/", (_req, res) => res.send("Cafeteria backend running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server ${PORT}`));
