// server.js
// Entry point: sets up Express, middleware, routes, and starts the API.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { initDb } = require("./db");
const { requireAuth } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const leadsRoutes = require("./routes/leads");
const publicRoutes = require("./routes/public");

const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---------------------------------------------------------
const allowedOrigins = (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins.includes("*") ? true : allowedOrigins,
  })
);
app.use(express.json({ limit: "1mb" }));

// --- Routes --------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api/public", publicRoutes);          // no auth: contact form submissions
app.use("/api/auth", authRoutes);               // no auth: admin login
app.use("/api/leads", requireAuth, leadsRoutes); // auth required: everything else

// Optionally serve the static frontend from the same server/port
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));

// --- 404 for unknown API routes ------------------------------------------
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

// --- Error handler ---------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// --- Start -----------------------------------------------------------------
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Mini CRM API running on http://localhost:${PORT}`);
    console.log(`Dashboard (if serving statically): http://localhost:${PORT}/index.html`);
  });
});