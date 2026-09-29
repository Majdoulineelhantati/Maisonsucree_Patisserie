const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const db = require("./db");
require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const sessions = new Map();

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

function asPositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function publicProduct(product) {
  const discount = product.promo_active ? Number(product.discount_percent || 0) : 0;
  const finalPrice = Math.max(0, Number(product.price) * (1 - discount / 100));
  return { ...product, final_price: Number(finalPrice.toFixed(2)) };
}

function authRequired(req, res, next) {
  const value = String(req.headers.authorization || "");
  const token = value.startsWith("Bearer ") ? value.slice(7) : "";
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return res.status(401).json({ message: "Session admin expirée" });
  }
  next();
}

app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1 AS ok").get();
    res.json({ ok: true, database: "connected", type: "SQLite" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, database: "disconnected" });
  }
});

app.get("/api/products", (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    const search = String(req.query.search || "").trim();
    const where = ["is_active = 1"];
    const values = [];

    if (category) {
      where.push("category = ?");
      values.push(category);
    }
    if (search) {
      where.push("(name LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE)");
      values.push(`%${search}%`, `%${search}%`);
    }

    const products = db.prepare(`
      SELECT * FROM products
      WHERE ${where.join(" AND ")}
      ORDER BY id DESC
    `).all(...values);

    res.json(products.map(publicProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.get("/api/products/:id", (req, res) => {
  try {
    const id = asPositiveInteger(req.params.id);
    if (!id) return res.status(400).json({ message: "ID invalide" });
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(id);
    if (!product) return res.status(404).json({ message: "Produit introuvable" });
    res.json(publicProduct(product));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

const createOrderTransaction = db.transaction((customer, items) => {
  let total = 0;
  const checkedItems = [];

  for (const item of items) {
    const product = db.prepare("SELECT * FROM products WHERE id = ? AND is_active = 1").get(item.id);
    if (!product) {
      const error = new Error(`Produit ${item.id} introuvable`);
      error.status = 404;
      throw error;
    }
    if (product.stock < item.quantity) {
      const error = new Error(`Stock insuffisant pour ${product.name}`);
      error.status = 409;
      throw error;
    }

    const salePrice = publicProduct(product).final_price;
    total += salePrice * item.quantity;
    checkedItems.push({ product, quantity: item.quantity, salePrice });
  }

  const orderResult = db.prepare(`
    INSERT INTO orders (customer_name, phone, address, total, status, updated_at)
    VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
  `).run(customer.name.trim(), customer.phone.trim(), customer.address.trim(), Number(total.toFixed(2)));

  const orderId = orderResult.lastInsertRowid;
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, quantity, price)
    VALUES (?, ?, ?, ?)
  `);
  const updateStock = db.prepare("UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");

  for (const { product, quantity, salePrice } of checkedItems) {
    insertItem.run(orderId, product.id, quantity, salePrice);
    updateStock.run(quantity, product.id);
  }

  db.prepare(`
    INSERT INTO order_status_history (order_id, old_status, new_status, note)
    VALUES (?, NULL, 'pending', 'Commande créée')
  `).run(orderId);

  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
});

app.post("/api/orders", (req, res) => {
  try {
    const { customer, items } = req.body;
    if (
      !customer?.name?.trim() ||
      !customer?.phone?.trim() ||
      !customer?.address?.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ message: "Informations de commande incomplètes" });
    }

    const aggregated = new Map();
    for (const item of items) {
      const id = asPositiveInteger(item.id);
      const quantity = asPositiveInteger(item.quantity);
      if (!id || !quantity) return res.status(400).json({ message: "Produit ou quantité invalide" });
      aggregated.set(id, (aggregated.get(id) || 0) + quantity);
    }

    const normalizedItems = [...aggregated.entries()].map(([id, quantity]) => ({ id, quantity }));
    const order = createOrderTransaction(customer, normalizedItems);
    res.status(201).json({ message: "Commande créée", order });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Impossible de créer la commande" });
  }
});

app.get("/api/orders/:id", (req, res) => {
  try {
    const id = asPositiveInteger(req.params.id);
    if (!id) return res.status(400).json({ message: "ID invalide" });
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) return res.status(404).json({ message: "Commande introuvable" });
    const items = db.prepare(`
      SELECT oi.product_id, p.name, oi.quantity, oi.price
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `).all(id);
    res.json({ ...order, items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Identifiants incorrects" });
  }
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  res.json({ token, expires_in_hours: 8 });
});

app.post("/api/admin/logout", authRequired, (req, res) => {
  const token = String(req.headers.authorization || "").slice(7);
  sessions.delete(token);
  res.status(204).end();
});

app.get("/api/admin/summary", authRequired, (_req, res) => {
  const activeProducts = db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1").get().n;
  const lowStock = db.prepare("SELECT COUNT(*) AS n FROM products WHERE is_active = 1 AND stock <= 5").get().n;
  const openOrders = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status NOT IN ('delivered','cancelled')").get().n;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status != 'cancelled'").get().n;
  res.json({ activeProducts, lowStock, openOrders, revenue });
});

app.get("/api/admin/products", authRequired, (_req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY is_active DESC, id DESC").all();
  res.json(products.map(publicProduct));
});

function validateProductBody(body) {
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const discountPercent = Number(body.discount_percent || 0);
  if (!name || !Number.isFinite(price) || price < 0) return { error: "Nom ou prix invalide" };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock invalide" };
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    return { error: "Promotion invalide (0 à 100 %)" };
  }
  return {
    data: {
      name,
      description: String(body.description || ""),
      price,
      image: String(body.image || ""),
      category: String(body.category || ""),
      stock,
      discount_percent: discountPercent,
      promo_active: body.promo_active ? 1 : 0,
      promo_label: String(body.promo_label || ""),
    },
  };
}

app.post("/api/admin/products", authRequired, (req, res) => {
  try {
    const parsed = validateProductBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const p = parsed.data;
    const result = db.prepare(`
      INSERT INTO products
      (name, description, price, image, category, stock, discount_percent, promo_active, promo_label, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).run(p.name, p.description, p.price, p.image, p.category, p.stock, p.discount_percent, p.promo_active, p.promo_label);
    res.status(201).json(publicProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.put("/api/admin/products/:id", authRequired, (req, res) => {
  try {
    const id = asPositiveInteger(req.params.id);
    if (!id) return res.status(400).json({ message: "ID invalide" });
    const parsed = validateProductBody(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const p = parsed.data;
    const result = db.prepare(`
      UPDATE products SET
        name = ?, description = ?, price = ?, image = ?, category = ?, stock = ?,
        discount_percent = ?, promo_active = ?, promo_label = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(p.name, p.description, p.price, p.image, p.category, p.stock, p.discount_percent, p.promo_active, p.promo_label, id);
    if (!result.changes) return res.status(404).json({ message: "Produit introuvable" });
    res.json(publicProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

app.delete("/api/admin/products/:id", authRequired, (req, res) => {
  const id = asPositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: "ID invalide" });
  const result = db.prepare("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ message: "Produit introuvable" });
  res.status(204).end();
});

app.patch("/api/admin/products/:id/restore", authRequired, (req, res) => {
  const id = asPositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: "ID invalide" });
  const result = db.prepare("UPDATE products SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  if (!result.changes) return res.status(404).json({ message: "Produit introuvable" });
  res.json(publicProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id)));
});

app.get("/api/admin/orders", authRequired, (req, res) => {
  const status = String(req.query.status || "").trim();
  const where = status && ORDER_STATUSES.includes(status) ? "WHERE status = ?" : "";
  const orders = where
    ? db.prepare(`SELECT * FROM orders ${where} ORDER BY id DESC`).all(status)
    : db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
  res.json(orders);
});

app.get("/api/admin/orders/:id", authRequired, (req, res) => {
  const id = asPositiveInteger(req.params.id);
  if (!id) return res.status(400).json({ message: "ID invalide" });
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ message: "Commande introuvable" });
  const items = db.prepare(`
    SELECT oi.product_id, p.name, oi.quantity, oi.price
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ? ORDER BY oi.id
  `).all(id);
  const history = db.prepare(`
    SELECT old_status, new_status, note, changed_at
    FROM order_status_history WHERE order_id = ? ORDER BY id DESC
  `).all(id);
  res.json({ ...order, items, history });
});

const updateStatusTransaction = db.transaction((orderId, nextStatus, note) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) {
    const error = new Error("Commande introuvable");
    error.status = 404;
    throw error;
  }
  if (order.status === nextStatus) return order;

  const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(orderId);

  if (nextStatus === "cancelled" && order.status !== "cancelled") {
    const restock = db.prepare("UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const item of items) restock.run(item.quantity, item.product_id);
  }

  if (order.status === "cancelled" && nextStatus !== "cancelled") {
    const getProduct = db.prepare("SELECT id, name, stock FROM products WHERE id = ?");
    const takeStock = db.prepare("UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
    for (const item of items) {
      const product = getProduct.get(item.product_id);
      if (!product || product.stock < item.quantity) {
        const error = new Error(`Stock insuffisant pour réactiver la commande (${product?.name || item.product_id})`);
        error.status = 409;
        throw error;
      }
    }
    for (const item of items) takeStock.run(item.quantity, item.product_id);
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextStatus, orderId);
  db.prepare(`
    INSERT INTO order_status_history (order_id, old_status, new_status, note)
    VALUES (?, ?, ?, ?)
  `).run(orderId, order.status, nextStatus, String(note || ""));
  return db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
});

app.patch("/api/admin/orders/:id/status", authRequired, (req, res) => {
  try {
    const id = asPositiveInteger(req.params.id);
    const status = String(req.body?.status || "");
    if (!id) return res.status(400).json({ message: "ID invalide" });
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ message: "Statut invalide" });
    const order = updateStatusTransaction(id, status, req.body?.note);
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(error.status || 500).json({ message: error.message || "Erreur serveur" });
  }
});

app.use((_req, res) => res.status(404).json({ message: "Route introuvable" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API disponible sur http://localhost:${PORT}`);
  console.log("Base de données : SQLite");
  console.log("Administration : http://localhost:5173/admin");
});