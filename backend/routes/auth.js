// routes/auth.js
// Admin login. There is intentionally no public "register" endpoint -
// admins are created via the seed script / directly in the database,
// so random visitors can never create themselves an account.

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { db } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Slow down brute-force login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});

router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const admin = db.data.admins.find((a) => a.email === String(email).toLowerCase());
  if (!admin) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign(
    { sub: admin.id, email: admin.email, name: admin.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );

  res.json({
    token,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });
});

// Lets the dashboard verify a stored token is still valid on page load
router.get("/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

module.exports = router;