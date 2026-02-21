/**
 * Seed an admin user into the database.
 * Reads ADMIN_EMAIL and ADMIN_PASSWORD from environment variables.
 * Skips creation if an admin user already exists.
 */
import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { connectDb, collections } from "../config/db.js";

const SALT_ROUNDS = 10;

async function seedAdmin() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        console.error("ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
        process.exit(1);
    }

    try {
        await connectDb();

        const existing = await collections.users.findOne({ email });
        if (existing) {
            console.log(`INFO: Admin user already exists (${email}). Skipping.`);
            process.exit(0);
        }

        const now = new Date();
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        await collections.users.insertOne({
            email,
            passwordHash,
            role: "admin",
            isDisabled: false,
            createdAt: now,
            updatedAt: now,
        });

        console.log(`SUCCESS: Admin user created: ${email}`);
        process.exit(0);
    } catch (err) {
        console.error("ERROR: Seed failed:", err);
        process.exit(1);
    }
}

seedAdmin();
