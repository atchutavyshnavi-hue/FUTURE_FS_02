// db.js
// Lightweight JSON-file database powered by lowdb.
// Swap this file out for a real MongoDB/MySQL layer later without
// touching the route logic much - the shape of the data is what matters.

const path = require("path");
const fs = require("fs");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultData = {
  admins: [],
  leads: [],
};

const adapter = new JSONFile(DB_FILE);
const db = new Low(adapter, defaultData);

async function initDb() {
  await db.read();
  db.data ||= defaultData;
  db.data.admins ||= [];
  db.data.leads ||= [];
  await db.write();
  return db;
}

module.exports = { db, initDb };