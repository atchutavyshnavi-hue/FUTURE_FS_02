// api.js
// Tiny fetch wrapper shared by the login page, dashboard, and contact form.
// Change API_BASE if your backend runs somewhere other than localhost:4000.

const API_BASE = ""; // frontend and backend are always served from the same origin

const TOKEN_KEY = "miniCrmToken";
const ADMIN_KEY = "miniCrmAdmin";

const Session = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  getAdmin: () => JSON.parse(localStorage.getItem(ADMIN_KEY) || "null"),
  save(token, admin) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  },
};

async function apiFetch(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = Session.getToken();
    if (!token) throw new Error("NOT_AUTHENTICATED");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // no JSON body
  }

  if (res.status === 401 && auth) {
    Session.clear();
    window.location.href = "login.html";
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}