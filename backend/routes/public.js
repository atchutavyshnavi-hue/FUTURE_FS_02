// routes/public.js
// The ONLY endpoint outside the admin auth wall. This is what a
// business's public website contact form POSTs to. Anyone can call it,
// so it's rate-limited and does not return any existing lead data back.

const express = require("express");
const rateLimit = require("express-rate-limit");
const { v4: uuid } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many submissions from this device. Please try again later." },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/leads", submitLimiter, async (req, res) => {
  const { name, email, phone, company, message, source } = req.body || {};

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!email || !EMAIL_RE.test(String(email).trim())) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const now = new Date().toISOString();
  const lead = {
    id: uuid(),
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    phone: phone ? String(phone).trim().slice(0, 60) : "",
    company: company ? String(company).trim().slice(0, 200) : "",
    message: message ? String(message).trim().slice(0, 2000) : "",
    source: source ? String(source).trim().slice(0, 120) : "Website Contact Form",
    status: "new",
    notes: [],
    createdAt: now,
    updatedAt: now,
  };

  await getDb().collection("leads").insertOne(lead);

  res.status(201).json({ message: "Thanks! We received your message and will be in touch soon." });
});

module.exports = router;