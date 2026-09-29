const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function parseResponse(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Une erreur est survenue");
  return data;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options);
  return parseResponse(response);
}

export const getProducts = () => request("/products");

export const createOrder = (payload) =>
  request("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const adminLogin = (username, password) =>
  request("/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

function adminHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export const getAdminSummary = (token) =>
  request("/admin/summary", { headers: adminHeaders(token) });

export const getAdminProducts = (token) =>
  request("/admin/products", { headers: adminHeaders(token) });

export const createAdminProduct = (token, payload) =>
  request("/admin/products", {
    method: "POST",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const updateAdminProduct = (token, id, payload) =>
  request(`/admin/products/${id}`, {
    method: "PUT",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

export const archiveAdminProduct = (token, id) =>
  request(`/admin/products/${id}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });

export const restoreAdminProduct = (token, id) =>
  request(`/admin/products/${id}/restore`, {
    method: "PATCH",
    headers: adminHeaders(token),
  });

export const getAdminOrders = (token, status = "") =>
  request(`/admin/orders${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
    headers: adminHeaders(token),
  });

export const getAdminOrder = (token, id) =>
  request(`/admin/orders/${id}`, { headers: adminHeaders(token) });

export const updateOrderStatus = (token, id, status, note = "") =>
  request(`/admin/orders/${id}/status`, {
    method: "PATCH",
    headers: { ...adminHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ status, note }),
  });
