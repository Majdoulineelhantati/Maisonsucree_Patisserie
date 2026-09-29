import { useEffect, useMemo, useState } from "react";
import { createOrder, getProducts } from "./api.js";

const initialCustomer = {
  name: "",
  phone: "",
  address: "",
};

function money(value) {
  return `${Number(value).toFixed(2)} MAD`;
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(initialCustomer);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function refreshProducts() {
    const data = await getProducts();
    setProducts(data);
  }

  useEffect(() => {
    refreshProducts()
      .catch((err) => setError(`API : ${err.message}`))
      .finally(() => setLoading(false));
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.final_price ?? item.price) * item.quantity, 0),
    [cart]
  );

  const totalUnits = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  function addToCart(product) {
    if (product.stock <= 0) return;

    setError("");
    setMessage("");
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (!existing) return [...current, { ...product, quantity: 1 }];
      if (existing.quantity >= product.stock) return current;

      return current.map((item) =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  }

  function changeQuantity(id, delta) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== id) return item;
          const next = Math.min(item.stock, item.quantity + delta);
          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  async function checkout(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!cart.length) {
      setError("Votre panier est vide.");
      return;
    }

    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      setError("Merci de compléter vos informations de livraison.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await createOrder({
        customer,
        items: cart.map((item) => ({
          id: item.id,
          quantity: item.quantity,
        })),
      });

      setMessage(`Commande #${result.order.id} enregistrée avec succès.`);
      setCart([]);
      setCustomer(initialCustomer);
      await refreshProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="header">
        <a className="brand" href="#top">MAISON SUCRÉE</a>
        <nav>
          <a href="#collections">Boutique</a>
          <a href="#maison">Notre Maison</a>
          <a href="#commande">Commander</a>
        </nav>
        <div className="header-actions"><a className="admin-link" href="/admin">Admin</a><a className="cart-pill" href="#commande">Panier · {totalUnits}</a></div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow light">COLLECTION SIGNATURE</p>
            <h1>L'art de la pâtisserie,<br />tout simplement.</h1>
            <p className="hero-copy">
              Entremets, tartes et créations artisanales préparées avec précision.
            </p>
            <a className="button button-light" href="#collections">Découvrir</a>
          </div>
        </section>

        <section className="intro" id="maison">
          <p className="eyebrow">LA MAISON</p>
          <h2>Des créations élégantes, pensées pour chaque occasion.</h2>
          <p>
            Cette démonstration e-commerce utilise React pour le frontend,
            Express pour l'API et SQLite pour stocker les produits et commandes.
          </p>
        </section>

        <section className="shop" id="collections">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NOS CRÉATIONS</p>
              <h2>La collection du moment</h2>
            </div>
            <p>{products.length} références disponibles</p>
          </div>

          {loading && <p className="status">Chargement des produits…</p>}
          {!loading && products.length === 0 && !error && (
            <p className="status">Aucun produit disponible.</p>
          )}

          <div className="product-grid">
            {products.map((product) => (
              <article className="product-card" key={product.id}>
                <div className="image-wrap">
                  <img src={product.image} alt={product.name} />
                  <span className="stock">{product.stock} en stock</span>{product.promo_active ? <span className="promo-badge">-{product.discount_percent}% {product.promo_label}</span> : null}
                </div>
                <p className="category">{product.category}</p>
                <h3>{product.name}</h3>
                <p className="description">{product.description}</p>
                <div className="product-footer">
                  <div className="product-price">{product.promo_active ? (<span className="price-stack"><del>{money(product.price)}</del><strong>{money(product.final_price)}</strong></span>) : <strong>{money(product.price)}</strong>}</div>
                  <button
                    className="button button-dark"
                    disabled={product.stock <= 0}
                    onClick={() => addToCart(product)}
                  >
                    {product.stock > 0 ? "Ajouter" : "Épuisé"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="checkout-section" id="commande">
          <div className="checkout-grid">
            <div>
              <p className="eyebrow">VOTRE PANIER</p>
              <h2>Finaliser la commande</h2>

              <div className="cart-list">
                {!cart.length && <p className="empty-cart">Votre panier est vide.</p>}
                {cart.map((item) => (
                  <div className="cart-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>{money(item.final_price ?? item.price)} / pièce</small>
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => changeQuantity(item.id, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.id, 1)}>+</button>
                    </div>
                    <strong>{money(Number(item.final_price ?? item.price) * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              <div className="cart-total">
                <span>Total</span>
                <strong>{money(total)}</strong>
              </div>
            </div>

            <form className="checkout-form" onSubmit={checkout}>
              <label>
                Nom complet
                <input
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                  placeholder="Votre nom"
                />
              </label>

              <label>
                Téléphone
                <input
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                  placeholder="06 12 34 56 78"
                />
              </label>

              <label>
                Adresse de livraison
                <textarea
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  placeholder="Adresse complète"
                  rows="4"
                />
              </label>

              {error && <div className="alert error">{error}</div>}
              {message && <div className="alert success">{message}</div>}

              <button className="button button-dark full" disabled={submitting || !cart.length}>
                {submitting ? "Enregistrement…" : `Commander · ${money(total)}`}
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer>
        <strong>MAISON SUCRÉE</strong>
        <span>Démo e-commerce React · Express · SQLite</span>
      </footer>
    </div>
  );
}
