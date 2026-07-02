// routes/leads.js
// Everything here requires a valid admin session (see server.js where
// requireAuth is applied to this whole router).

const express = require("express");
const { v4: uuid } = require("uuid");
const { getDb } = require("../db");

const router = express.Router();

const VALID_STATUSES = ["new", "contacted", "converted"];
const NO_ID = { projection: { _id: 0 } }; // never leak Mongo's internal _id in API responses

// GET /api/leads?search=&status=&sort=newest|oldest
router.get("/", async (req, res) => {
  const { search = "", status = "", sort = "newest" } = req.query;
  const leadsCol = getDb().collection("leads");

  const query = {};
  if (status && VALID_STATUSES.includes(status)) {
    query.status = status;
  }
  if (search && search.trim()) {
    const q = search.trim();
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // escape regex special chars
    query.$or = [{ name: re }, { email: re }, { company: re }, { source: re }];
  }

  const leads = await leadsCol
    .find(query, NO_ID)
    .sort({ createdAt: sort === "oldest" ? 1 : -1 })
    .toArray();

  res.json({ leads, total: leads.length });
});

// GET /api/leads/analytics/summary  (defined before /:id so it isn't swallowed by it)
router.get("/analytics/summary", async (req, res) => {
  const leadsCol = getDb().collection("leads");
  const leads = await leadsCol.find({}, NO_ID).toArray();

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
router.get("/:id", async (req, res) => {
  const lead = await getDb().collection("leads").findOne({ id: req.params.id }, NO_ID);
  if (!lead) return res.status(404).json({ error: "Lead not found." });
  res.json({ lead });
});

// PATCH /api/leads/:id/status  { status: "new" | "contacted" | "converted" }
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }

  const leadsCol = getDb().collection("leads");
  const result = await leadsCol.findOneAndUpdate(
    { id: req.params.id },
    { $set: { status, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } }
  );

  const lead = result && result.value ? result.value : result; // driver-version-safe
  if (!lead) return res.status(404).json({ error: "Lead not found." });

  res.json({ lead });
});

// POST /api/leads/:id/notes  { text: "..." }
router.post("/:id/notes", async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Note text is required." });
  }

  const note = { id: uuid(), text: text.trim().slice(0, 2000), createdAt: new Date().toISOString() };
  const leadsCol = getDb().collection("leads");

  const result = await leadsCol.findOneAndUpdate(
    { id: req.params.id },
    { $push: { notes: note }, $set: { updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } }
  );

  const lead = result && result.value ? result.value : result;
  if (!lead) return res.status(404).json({ error: "Lead not found." });

  res.status(201).json({ lead });
});

// DELETE /api/leads/:id
router.delete("/:id", async (req, res) => {
  const result = await getDb().collection("leads").deleteOne({ id: req.params.id });
  if (result.deletedCount === 0) return res.status(404).json({ error: "Lead not found." });
  res.json({ message: "Lead deleted." });
});

module.exports = router;