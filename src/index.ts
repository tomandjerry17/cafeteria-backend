import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
dotenv.config();
import { setupSwagger } from "./docs/swagger.js";
import authRoutes from "./routes/auth.js";

const app = express();
app.use("/auth", authRoutes);
setupSwagger(app);

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => res.send("Cafeteria backend running"));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server ${PORT}`));
