import { useEffect, useMemo, useState } from "react";
import {
  adminLogin,
  archiveAdminProduct,
  createAdminProduct,
  getAdminOrder,
  getAdminOrders,
  getAdminProducts,
  getAdminSummary,
  restoreAdminProduct,
  updateAdminProduct,
  updateOrderStatus,
} from "./api.js";

const statusLabels = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  cancelled: "Annulée",
};

const emptyProduct = {
  name: "",
  description: "",
  price: "",
  image: "",
  category: "",
  stock: 0,
  promo_active: false,
  discount_percent: 0,
  promo_label: "",
};

function money(value) {
  return `${Number(value || 0).toFixed(2)} MAD`;
}

function dateTime(value) {
  if (!value) return "—";
  return new Date(`${value.replace(" ", "T")}Z`).toLocaleString("fr-FR");
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem("admin_token") || "");
  const [credentials, setCredentials] = useState({ username: "admin", password: "admin123" });
  const [tab, setTab] = useState("orders");
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAll(activeToken = token) {
    try {
      const [s, o, p] = await Promise.all([
        getAdminSummary(activeToken),
        getAdminOrders(activeToken, statusFilter),
        getAdminProducts(activeToken),
      ]);
      setSummary(s);
      setOrders(o);
      setProducts(p);
      setError("");
    } catch (err) {
      if (/session/i.test(err.message)) logout();
      else setError(err.message);
    }
  }

  useEffect(() => {
    if (token) loadAll();
  }, [token, statusFilter]);

  async function login(e) {
    e.preventDefault();
    try {
      const result = await adminLogin(credentials.username, credentials.password);
      localStorage.setItem("admin_token", result.token);
      setToken(result.token);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("admin_token");
    setToken("");
    setSelectedOrder(null);
  }

  async function openOrder(id) {
    try {
      setSelectedOrder(await getAdminOrder(token, id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(status) {
    if (!selectedOrder) return;
    try {
      await updateOrderStatus(token, selectedOrder.id, status);
      setSelectedOrder(await getAdminOrder(token, selectedOrder.id));
      await loadAll();
      setMessage("Statut de la commande mis à jour.");
    } catch (err) {
      setError(err.message);
    }
  }

  function editProduct(product) {
    setEditingId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      category: product.category,
      stock: product.stock,
      promo_active: Boolean(product.promo_active),
      discount_percent: product.discount_percent || 0,
      promo_label: product.promo_label || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    setEditingId(null);
    setProductForm(emptyProduct);
  }

  async function saveProduct(e) {
    e.preventDefault();
    try {
      const payload = {
        ...productForm,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
        discount_percent: Number(productForm.discount_percent),
      };
      if (editingId) await updateAdminProduct(token, editingId, payload);
      else await createAdminProduct(token, payload);
      resetProductForm();
      await loadAll();
      setMessage(editingId ? "Produit modifié." : "Produit ajouté.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function archiveProduct(id) {
    if (!confirm("Archiver ce produit ? Il disparaîtra de la boutique mais restera dans l'historique.")) return;
    try {
      await archiveAdminProduct(token, id);
      await loadAll();
      setMessage("Produit archivé.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function restoreProduct(id) {
    try {
      await restoreAdminProduct(token, id);
      await loadAll();
      setMessage("Produit restauré.");
    } catch (err) {
      setError(err.message);
    }
  }

  const lowStockProducts = useMemo(() => products.filter((p) => p.is_active && p.stock <= 5), [products]);

  if (!token) {
    return (
      <main className="admin-login-page">
        <form className="admin-login" onSubmit={login}>
          <a href="/" className="brand">MAISON SUCRÉE</a>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Connexion admin</h1>
          <label>Utilisateur<input value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} /></label>
          <label>Mot de passe<input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} /></label>
          {error && <div className="alert error">{error}</div>}
          <button className="button button-dark full">Se connecter</button>
          <small>Démo : admin / admin123</small>
        </form>
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <a className="brand admin-brand" href="/">MAISON SUCRÉE</a>
        <nav className="admin-nav">
          <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Commandes</button>
          <button className={tab === "products" ? "active" : ""} onClick={() => setTab("products")}>Produits & stock</button>
          <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historique</button>
        </nav>
        <a className="admin-store-link" href="/">Voir la boutique</a>
        <button className="admin-logout" onClick={logout}>Déconnexion</button>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div><p className="eyebrow">TABLEAU DE BORD</p><h1>Administration</h1></div>
        </header>

        {message && <div className="alert success admin-alert" onClick={() => setMessage("")}>{message}</div>}
        {error && <div className="alert error admin-alert" onClick={() => setError("")}>{error}</div>}

        {summary && (
          <section className="stat-grid">
            <article><span>Commandes actives</span><strong>{summary.openOrders}</strong></article>
            <article><span>Produits actifs</span><strong>{summary.activeProducts}</strong></article>
            <article><span>Stock faible</span><strong>{summary.lowStock}</strong></article>
            <article><span>CA hors annulations</span><strong>{money(summary.revenue)}</strong></article>
          </section>
        )}

        {tab === "orders" && (
          <section className="admin-panel">
            <div className="admin-panel-title">
              <div><p className="eyebrow">COMMANDES</p><h2>Suivi des commandes</h2></div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous les statuts</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Total</th><th>Statut</th><th></th></tr></thead>
                <tbody>{orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td><td><strong>{order.customer_name}</strong><small>{order.phone}</small></td><td>{dateTime(order.created_at)}</td><td>{money(order.total)}</td>
                    <td><span className={`status-badge status-${order.status}`}>{statusLabels[order.status]}</span></td>
                    <td><button className="text-button" onClick={() => openOrder(order.id)}>Voir</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "products" && (
          <>
            <section className="admin-panel product-editor">
              <div><p className="eyebrow">{editingId ? "MODIFIER" : "AJOUTER"}</p><h2>{editingId ? "Modifier le produit" : "Nouveau produit"}</h2></div>
              <form className="admin-product-form" onSubmit={saveProduct}>
                <label>Nom<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} required /></label>
                <label>Catégorie<input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></label>
                <label>Prix MAD<input type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} required /></label>
                <label>Stock<input type="number" min="0" step="1" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} required /></label>
                <label className="wide">URL image<input value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} /></label>
                <label className="wide">Description<textarea rows="3" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
                <label>Réduction %<input type="number" min="0" max="100" value={productForm.discount_percent} onChange={(e) => setProductForm({ ...productForm, discount_percent: e.target.value })} /></label>
                <label>Label promo<input value={productForm.promo_label} onChange={(e) => setProductForm({ ...productForm, promo_label: e.target.value })} placeholder="OFFRE DU WEEK-END" /></label>
                <label className="checkbox-label"><input type="checkbox" checked={productForm.promo_active} onChange={(e) => setProductForm({ ...productForm, promo_active: e.target.checked })} /> Promotion active</label>
                <div className="form-actions"><button className="button button-dark">{editingId ? "Enregistrer" : "Ajouter"}</button>{editingId && <button type="button" className="button button-outline" onClick={resetProductForm}>Annuler</button>}</div>
              </form>
            </section>

            {lowStockProducts.length > 0 && <div className="stock-warning">⚠ {lowStockProducts.length} produit(s) ont 5 unités ou moins en stock.</div>}

            <section className="admin-panel">
              <div className="admin-panel-title"><div><p className="eyebrow">INVENTAIRE</p><h2>Produits & stock</h2></div></div>
              <div className="admin-table-wrap">
                <table className="admin-table product-table">
                  <thead><tr><th>Produit</th><th>Prix</th><th>Promo</th><th>Stock</th><th>État</th><th></th></tr></thead>
                  <tbody>{products.map((product) => (
                    <tr key={product.id} className={!product.is_active ? "archived-row" : ""}>
                      <td><strong>{product.name}</strong><small>{product.category}</small></td>
                      <td>{money(product.price)}{product.promo_active ? <small>Promo : {money(product.final_price)}</small> : null}</td>
                      <td>{product.promo_active ? `${product.discount_percent}% · ${product.promo_label || "Promo"}` : "—"}</td>
                      <td><strong className={product.stock <= 5 ? "low-stock" : ""}>{product.stock}</strong></td>
                      <td>{product.is_active ? "Actif" : "Archivé"}</td>
                      <td className="row-actions"><button className="text-button" onClick={() => editProduct(product)}>Modifier</button>{product.is_active ? <button className="text-button danger" onClick={() => archiveProduct(product.id)}>Supprimer</button> : <button className="text-button" onClick={() => restoreProduct(product.id)}>Restaurer</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tab === "history" && (
          <section className="admin-panel">
            <div className="admin-panel-title"><div><p className="eyebrow">HISTORIQUE</p><h2>Toutes les commandes</h2></div></div>
            <div className="history-cards">{orders.map((order) => (
              <button className="history-card" key={order.id} onClick={() => openOrder(order.id)}>
                <span>Commande #{order.id}</span><strong>{order.customer_name}</strong><span>{dateTime(order.created_at)}</span><span className={`status-badge status-${order.status}`}>{statusLabels[order.status]}</span><b>{money(order.total)}</b>
              </button>
            ))}</div>
          </section>
        )}
      </main>

      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <aside className="order-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedOrder(null)}>×</button>
            <p className="eyebrow">COMMANDE #{selectedOrder.id}</p>
            <h2>{selectedOrder.customer_name}</h2>
            <p>{selectedOrder.phone}<br />{selectedOrder.address}</p>
            <div className="drawer-section"><h3>Statut</h3><select value={selectedOrder.status} onChange={(e) => changeStatus(e.target.value)}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="drawer-section"><h3>Produits</h3>{selectedOrder.items.map((item) => <div className="drawer-line" key={item.product_id}><span>{item.name} × {item.quantity}</span><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="drawer-line total-line"><span>Total</span><strong>{money(selectedOrder.total)}</strong></div></div>
            <div className="drawer-section"><h3>Historique du statut</h3><div className="status-history">{selectedOrder.history.map((item, index) => <div key={index}><span>{dateTime(item.changed_at)}</span><strong>{statusLabels[item.new_status] || item.new_status}</strong>{item.note && <small>{item.note}</small>}</div>)}</div></div>
          </aside>
        </div>
      )}
    </div>
  );
}
