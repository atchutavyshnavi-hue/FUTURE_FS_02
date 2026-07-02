// routes/leads.js
// Everything here requires a valid admin session (see server.js where
// requireAuth is applied to this whole router).

const express = require("express");
const { v4: uuid } = require("uuid");
const { db } = require("../db");

const router = express.Router();

const VALID_STATUSES = ["new", "contacted", "converted"];

// GET /api/leads?search=&status=&sort=newest|oldest
router.get("/", (req, res) => {
  const { search = "", status = "", sort = "newest" } = req.query;

  let leads = [...db.data.leads];

  if (status && VALID_STATUSES.includes(status)) {
    leads = leads.filter((l) => l.status === status);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    leads = leads.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.company || "").toLowerCase().includes(q) ||
        (l.source || "").toLowerCase().includes(q)
    );
  }

  leads.sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt);
    return sort === "oldest" ? diff : -diff;
  });

  res.json({ leads, total: leads.length });
});

// GET /api/leads/analytics/summary  (defined before /:id so it isn't swallowed by it)
router.get("/analytics/summary", (req, res) => {
  const leads = db.data.leads;
  const total = leads.length;
  const byStatus = VALID_STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l) => l.status === s).length;
    return acc;
  }, {});
  const conversionRate = total > 0 ? Math.round((byStatus.converted / total) * 100) : 0;

  const bySource = {};
  leads.forEach((l) => {
    const src = l.source || "Unknown";
    bySource[src] = (bySource[src] || 0) + 1;
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = leads.filter((l) => new Date(l.createdAt).getTime() >= sevenDaysAgo).length;

  // Leads received per month, for the last 6 months (oldest -> newest)
  const now = new Date();
  const byMonth = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const count = leads.filter((l) => {
      const created = new Date(l.createdAt);
      return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
    }).length;
    byMonth.push({ label, count });
  }

  res.json({ total, byStatus, conversionRate, bySource, newThisWeek, byMonth });
});

// GET /api/leads/:id
router.get("/:id", (req, res) => {
  const lead = db.data.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  res.json({ lead });
});

// PATCH /api/leads/:id/status  { status: "new" | "contacted" | "converted" }
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const lead = db.data.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });

  lead.status = status;
  lead.updatedAt = new Date().toISOString();
  await db.write();

  res.json({ lead });
});

// POST /api/leads/:id/notes  { text: "..." }
router.post("/:id/notes", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Note text is required." });
  }

  const lead = db.data.leads.find((l) => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found." });

  const note = { id: uuid(), text: text.trim().slice(0, 2000), createdAt: new Date().toISOString() };
  lead.notes.push(note);
  lead.updatedAt = new Date().toISOString();
  await db.write();

  res.status(201).json({ lead });
});

// DELETE /api/leads/:id
router.delete("/:id", async (req, res) => {
  const idx = db.data.leads.findIndex((l) => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Lead not found." });

  db.data.leads.splice(idx, 1);
  await db.write();

  res.json({ message: "Lead deleted." });
});

module.exports = router;