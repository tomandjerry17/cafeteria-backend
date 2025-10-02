import { Router } from "express";
import { prisma } from "../db";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * =======================
 * CATEGORIES
 * =======================
 */

// Create category (staff only)
router.post(
  "/categories",
  authenticateToken,
  requireRole(["staff"]),
  async (req: AuthRequest, res) => {
    try {
      const { name, description } = req.body;

      if (!name) return res.status(400).json({ error: "Name required" });

      const category = await prisma.menuCategory.create({
        data: { name, description }
      });

      res.json(category);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to create category" });
    }
  }
);

// Get all categories
router.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      include: { items: true }
    });
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch categories" });
  }
});

// Update category
router.put(
  "/categories/:id",
  authenticateToken,
  requireRole(["staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Category ID required" });

      const { name, description } = req.body;

      const updated = await prisma.menuCategory.update({
        where: { id: String(id) },
        data: { name, description }
      });

      res.json(updated);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to update category" });
    }
  }
);

// Delete category
router.delete(
  "/categories/:id",
  authenticateToken,
  requireRole(["staff"]),
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: "Category ID required" });

      await prisma.menuCategory.delete({ where: { id: String(id) } });

      res.json({ message: "Category deleted" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message || "Failed to delete category" });
    }
  }
);

/**
 * =======================
 * MENU ITEMS
 * =======================
 */

// Get all menu items
router.get("/", async (req, res) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: { category: true }
    });
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch menu items" });
  }
});

// Create menu item (staff only)
router.post("/", authenticateToken, requireRole(["staff"]), async (req, res) => {
  try {
    const { name, price, availability, stockLimit, categoryId, description, photoUrl } = req.body;

    const item = await prisma.menuItem.create({
      data: { name, price, availability, stockLimit, categoryId, description, photoUrl }
    });

    res.json(item);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to create menu item" });
  }
});

// Update menu item
router.put("/:id", authenticateToken, requireRole(["staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Menu item ID required" });

    const { name, price, availability, stockLimit, categoryId, description, photoUrl } = req.body;

    const updated = await prisma.menuItem.update({
      where: { id: String(id) },
      data: { name, price, availability, stockLimit, categoryId, description, photoUrl }
    });

    res.json(updated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to update menu item" });
  }
});

// Delete menu item
router.delete("/:id", authenticateToken, requireRole(["staff"]), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Menu item ID required" });

    await prisma.menuItem.delete({ where: { id: String(id) } });

    res.json({ message: "Menu item deleted" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to delete menu item" });
  }
});

export default router;
