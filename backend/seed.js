// seed.js
// Creates the first admin account (from .env) and a few sample leads,
// so the dashboard isn't empty the first time you open it.
// Safe to re-run: it only adds what's missing.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const { initDb, getDb } = require("./db");

async function seed() {
  await initDb();
  const db = getDb();
  const admins = db.collection("admins");
  const leads = db.collection("leads");

  // --- Admin account -------------------------------------------------
  const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || "admin@miniCRM.com").toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "ChangeMe123!";

  const existingAdmin = await admins.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await admins.insertOne({
      id: uuid(),
      name: "Admin",
      email: adminEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    console.log(`Created admin account: ${adminEmail}`);
  } else {
    console.log(`Admin account already exists: ${adminEmail}`);
  }

  // --- Sample leads ----------------------------------------------------
  const leadCount = await leads.countDocuments();
  if (leadCount === 0) {
    const now = Date.now();
    const sampleLeads = [
      {
        id: uuid(),
        name: "Priya Nair",
        email: "priya.nair@example.com",
        phone: "+91 98765 43210",
        company: "Nair Retail Co.",
        message: "Interested in a landing page redesign for our store.",
        source: "Website Contact Form",
        status: "new",
        notes: [],
        createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
        updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: uuid(),
        name: "Daniel Okafor",
        email: "daniel.okafor@example.com",
        phone: "+234 802 123 4567",
        company: "Okafor Logistics",
        message: "Need a quote for a fleet-tracking dashboard.",
        source: "Referral",
        status: "contacted",
        notes: [
          {
            id: uuid(),
            text: "Called on Tuesday, sent pricing sheet. Follow up Friday.",
            createdAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
          },
        ],
        createdAt: new Date(now - 1000 * 60 * 60 * 30).toISOString(),
        updatedAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
      },
      {
        id: uuid(),
        name: "Mei Lin",
        email: "mei.lin@example.com",
        phone: "+65 8123 4567",
        company: "Lin & Co Design",
        message: "Signed off on the proposal, ready to start onboarding.",
        source: "LinkedIn",
        status: "converted",
        notes: [
          {
            id: uuid(),
            text: "Contract signed. Kickoff call scheduled for next Monday.",
            createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
          },
        ],
        createdAt: new Date(now - 1000 * 60 * 60 * 72).toISOString(),
        updatedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
      },
    ];
    await leads.insertMany(sampleLeads);
    console.log(`Added ${sampleLeads.length} sample leads.`);
  } else {
    console.log("Leads already exist, skipping sample data.");
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});