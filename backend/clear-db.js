import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import fs from "fs";

// Load environment variables from .env
const envConfig = dotenv.parse(fs.readFileSync(".env"));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const dbName = process.env.DB_NAME || "felicity";

async function clearData() {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db(dbName);
        console.log(`Connected to database: ${dbName}`);

        // Delete all events, registrations, tickets, orders, and forms
        await db.collection("events").deleteMany({});
        console.log("Cleared events");

        await db.collection("registrations").deleteMany({});
        console.log("Cleared registrations");

        await db.collection("tickets").deleteMany({});
        console.log("Cleared tickets");

        await db.collection("merch_orders").deleteMany({});
        console.log("Cleared merch_orders");

        await db.collection("form_responses").deleteMany({});
        await db.collection("forms").deleteMany({});
        console.log("Cleared forms and responses");

        // Delete organizers
        await db.collection("organizers").deleteMany({});
        console.log("Cleared organizers profile data");

        // Delete participants
        await db.collection("participant_profiles").deleteMany({});
        console.log("Cleared participant profile data");

        // Delete users but keep the admin
        const result = await db.collection("users").deleteMany({ role: { $ne: "admin" } });
        console.log(`Deleted ${result.deletedCount} user accounts (participants/organizers). Admin accounts were preserved.`);

        console.log("✅ Database successfully wiped clean!");

    } catch (err) {
        console.error("Error clearing database:", err);
    } finally {
        await client.close();
    }
}

clearData();
