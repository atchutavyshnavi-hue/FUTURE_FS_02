// db.js
// MongoDB connection layer. Replaces the old lowdb (JSON file) setup so
// data survives restarts/redeploys on hosts with ephemeral disks (e.g.
// Render's free tier). Uses your own uuid "id" field (not Mongo's _id)
// on every document, so route logic barely changes from the old version.

const { MongoClient } = require("mongodb");

let client;
let dbInstance;

async function initDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to your .env file (or Render Environment tab)."
    );
  }

  client = new MongoClient(uri);
  await client.connect();

  // Explicitly named so it works even with Atlas's default connection string,
  // which doesn't include a database name. Mongo creates it automatically
  // the first time something is written to it - no manual setup needed.
  dbInstance = client.db("minicrm");

  // Helpful indexes - safe to run every startup, MongoDB just no-ops if they exist.
  await dbInstance.collection("admins").createIndex({ email: 1 }, { unique: true });
  await dbInstance.collection("leads").createIndex({ id: 1 }, { unique: true });
  await dbInstance.collection("leads").createIndex({ createdAt: -1 });

  console.log("Connected to MongoDB.");
  return dbInstance;
}

function getDb() {
  if (!dbInstance) {
    throw new Error("Database not initialized yet. Make sure initDb() ran before this was called.");
  }
  return dbInstance;
}

module.exports = { initDb, getDb };