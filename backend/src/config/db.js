import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

let db = null;
let client = null;

// Holds references to all collections used by the app
export const collections = {};

/**
 * Connect to MongoDB and initialize collection references + indexes.
 */
export async function connectDb() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME || "event_management";

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);

  // Bind collection references
  collections.users = db.collection("users");
  collections.organizers = db.collection("organizers");
  collections.participant_profiles = db.collection("participant_profiles");
  collections.events = db.collection("events");
  collections.tickets = db.collection("tickets");
  collections.registrations = db.collection("registrations");
  // Phase 2 – Dynamic Forms
  collections.forms = db.collection("forms");
  collections.form_responses = db.collection("form_responses");
  // Phase 3 – Merch orders
  collections.merch_orders = db.collection("merch_orders");
  // Phase 4 – Attendance
  collections.attendance = db.collection("attendance");
  // Phase 5 – Password resets
  collections.reset_requests = db.collection("reset_requests");
  // Phase 6 – Forum
  collections.forum_messages = db.collection("forum_messages");

  // Create unique indexes
  await collections.users.createIndex({ email: 1 }, { unique: true });
  await collections.organizers.createIndex({ userId: 1 }, { unique: true });
  await collections.participant_profiles.createIndex(
    { userId: 1 },
    { unique: true }
  );
  // Day 2 indexes
  await collections.events.createIndex({ organizerId: 1 });
  await collections.tickets.createIndex({ ticketId: 1 }, { unique: true });
  await collections.registrations.createIndex(
    { eventId: 1, participantId: 1 },
    { unique: true }
  );
  // Phase 2-7 indexes
  await collections.forms.createIndex({ eventId: 1 }, { unique: true });
  await collections.form_responses.createIndex(
    { eventId: 1, participantId: 1 },
    { unique: true }
  );
  await collections.merch_orders.createIndex({ eventId: 1, participantId: 1 });
  await collections.merch_orders.createIndex({ orderId: 1 }, { unique: true });
  await collections.attendance.createIndex(
    { eventId: 1, ticketId: 1 },
    { unique: true }
  );
  await collections.reset_requests.createIndex({ organizerUserId: 1 });
  await collections.forum_messages.createIndex({ eventId: 1, createdAt: 1 });

  // Auto-seed Admin if database is completely empty
  const adminExists = await collections.users.findOne({ role: "admin" });
  if (!adminExists) {
    const bcrypt = await import("bcrypt");
    const passwordHash = await bcrypt.hash("admin123", 10);
    const now = new Date();
    await collections.users.insertOne({
      email: "admin@iiit.ac.in",
      passwordHash,
      role: "admin",
      isDisabled: false,
      createdAt: now,
      updatedAt: now,
    });
    console.log("🌱 Root Admin seeded: admin@iiit.ac.in / admin123");
  }

  console.log(`✅ Connected to MongoDB – database: ${dbName}`);
  return db;
}

/**
 * Return the current database instance (call after connectDb).
 */
export function getDb() {
  if (!db) throw new Error("Database not initialised — call connectDb() first");
  return db;
}
