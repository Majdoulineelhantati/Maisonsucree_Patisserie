const Database = require("better-sqlite3");
const path = require("path");

const databasePath = path.join(__dirname, "database.sqlite");
const db = new Database(databasePath);

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

function addColumn(table, definition) {
  const column = definition.trim().split(/\s+/)[0];
  if (!hasColumn(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL CHECK (price >= 0),
    image TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    total REAL NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price REAL NOT NULL CHECK (price >= 0),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

addColumn("products", "discount_percent REAL NOT NULL DEFAULT 0");
addColumn("products", "promo_active INTEGER NOT NULL DEFAULT 0");
addColumn("products", "promo_label TEXT NOT NULL DEFAULT ''");
addColumn("products", "is_active INTEGER NOT NULL DEFAULT 1");
addColumn("products", "updated_at TEXT");
addColumn("orders", "updated_at TEXT");

module.exports = db;
