const db = require("./db");

const products = [
  ["Tarte Framboise", "Sablé amande, crème vanille et framboises fraîches.", 180, "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=1200&q=85", "Tartes", 10, 0, 0, ""],
  ["Entremets Chocolat", "Mousse chocolat noir, biscuit cacao et praliné noisette.", 240, "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85", "Entremets", 8, 10, 1, "OFFRE DÉCOUVERTE"],
  ["Coffret Macarons", "Assortiment de 12 macarons aux parfums de saison.", 160, "https://images.unsplash.com/photo-1569864358642-9d1684040f43?auto=format&fit=crop&w=1200&q=85", "Coffrets", 15, 0, 0, ""],
  ["Cheesecake Vanille", "Biscuit croustillant, crème légère vanille et finition soyeuse.", 210, "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=1200&q=85", "Gâteaux", 6, 0, 0, ""],
  ["Éclair Chocolat", "Pâte à choux, crémeux chocolat et glaçage cacao.", 55, "https://images.unsplash.com/photo-1557925923-cd4648e211a0?auto=format&fit=crop&w=1200&q=85", "Individuels", 20, 15, 1, "PROMO"],
  ["Tarte Citron", "Crème citron, sablé croustillant et meringue légère.", 175, "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=1200&q=85", "Tartes", 9, 0, 0, ""],
];

const reset = db.transaction(() => {
  db.prepare("DELETE FROM order_status_history").run();
  db.prepare("DELETE FROM order_items").run();
  db.prepare("DELETE FROM orders").run();
  db.prepare("DELETE FROM products").run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('products','orders','order_items','order_status_history')").run();

  const insert = db.prepare(`
    INSERT INTO products
    (name, description, price, image, category, stock, discount_percent, promo_active, promo_label, is_active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `);
  for (const product of products) insert.run(...product);
});

reset();
console.log(`Base réinitialisée : ${products.length} produits ajoutés.`);
