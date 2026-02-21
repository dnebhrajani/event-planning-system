import { Router } from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validateOrganizerInput, normalizeEmail } from "../utils/validators.js";
import { slugify } from "../utils/slug.js";
import { sendMail } from "../utils/email.js";

const router = Router();
const SALT_ROUNDS = 10;

// All admin routes require authentication + admin role
router.use(authRequired, requireRole(["admin"]));

// ─── GET /api/admin/organizers ──────────────────────────────────────────────
// List all organizers, joined with user email and isDisabled status.
router.get("/organizers", async (_req, res, next) => {
    try {
        const organizers = await collections.organizers.find().toArray();

        if (organizers.length === 0) return res.json([]);

        // Manual join: fetch linked user documents
        const userIds = organizers.map((o) => o.userId);
        const users = await collections.users
            .find({ _id: { $in: userIds } })
            .toArray();

        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const result = organizers.map((o) => {
            const user = userMap.get(o.userId.toString()) || {};
            return {
                ...o,
                email: user.email,
                isDisabled: user.isDisabled ?? false,
            };
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/admin/organizers ─────────────────────────────────────────────
// Create a new organizer with a deterministic login email.
router.post("/organizers", async (req, res, next) => {
    try {
        const { name, category, subCategory, description, contactEmail } = req.body;

        const error = validateOrganizerInput(req.body);
        if (error) return res.status(400).json({ error });

        // Deterministic organizer email from slug
        const slug = slugify(name);
        const organizerEmail = `${slug}-iiit@clubs.iiit.ac.in`;

        // Check for existing user with that email
        const existing = await collections.users.findOne({
            email: organizerEmail,
        });
        if (existing) {
            return res
                .status(409)
                .json({ error: "An organizer with this name already exists" });
        }

        // Generate random password (at least 10 chars)
        const generatedPassword = crypto.randomBytes(8).toString("hex"); // 16 hex chars

        const now = new Date();
        const passwordHash = await bcrypt.hash(generatedPassword, SALT_ROUNDS);

        // Create user document
        const userResult = await collections.users.insertOne({
            email: organizerEmail,
            passwordHash,
            role: "organizer",
            isDisabled: false,
            createdAt: now,
            updatedAt: now,
        });

        // Create organizer profile
        const orgResult = await collections.organizers.insertOne({
            userId: userResult.insertedId,
            name,
            category,
            ...(subCategory && { subCategory }),
            ...(description && { description }),
            ...(contactEmail && { contactEmail }),
            createdAt: now,
            updatedAt: now,
        });

        res.status(201).json({
            _id: orgResult.insertedId,
            userId: userResult.insertedId,
            name,
            category,
            subCategory: subCategory || null,
            description: description || null,
            contactEmail: contactEmail || null,
            email: organizerEmail,
            generatedPassword, // shown exactly once
        });
    } catch (err) {
        next(err);
    }
});

// ─── PATCH /api/admin/organizers/:organizerId/disable ───────────────────────
// Enable or disable an organizer account.
router.patch("/organizers/:organizerId/disable", async (req, res, next) => {
    try {
        const { organizerId } = req.params;
        const { isDisabled } = req.body;

        if (typeof isDisabled !== "boolean") {
            return res
                .status(400)
                .json({ error: "isDisabled must be a boolean value" });
        }

        const organizer = await collections.organizers.findOne({
            _id: new ObjectId(organizerId),
        });
        if (!organizer) {
            return res.status(404).json({ error: "Organizer not found" });
        }

        await collections.users.updateOne(
            { _id: organizer.userId },
            { $set: { isDisabled, updatedAt: new Date() } }
        );

        res.json({ message: `Organizer ${isDisabled ? "disabled" : "enabled"} successfully`, isDisabled });
    } catch (err) {
        next(err);
    }
});

// ─── DELETE /api/admin/organizers/:organizerId ──────────────────────────────
// Delete an organizer profile, linked user, and cascade-delete all their events.
router.delete("/organizers/:organizerId", async (req, res, next) => {
    try {
        const { organizerId } = req.params;

        const organizer = await collections.organizers.findOne({
            _id: new ObjectId(organizerId),
        });
        if (!organizer) {
            return res.status(404).json({ error: "Organizer not found" });
        }

        const orgId = organizer._id;

        // Find all events by this organizer
        const events = await collections.events.find({ organizerId: orgId }).toArray();
        const eventIds = events.map(e => e._id);
        const eventIdStrs = eventIds.map(id => id.toString());
        const allEventIdsIdAndStr = [...eventIds, ...eventIdStrs];

        if (eventIds.length > 0) {
            // Cascade delete event-related data matching either ObjectId or string
            await collections.events.deleteMany({ organizerId: orgId });
            await collections.tickets.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.registrations.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.merch_orders?.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.forms?.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.form_responses?.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.attendance?.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
            await collections.forum_messages?.deleteMany({ eventId: { $in: allEventIdsIdAndStr } });
        }

        // Delete password reset requests
        await collections.reset_requests?.deleteMany({ organizerUserId: organizer.userId });

        // Delete organizer profile and linked user
        await collections.organizers.deleteOne({ _id: orgId });
        await collections.users.deleteOne({ _id: organizer.userId });

        res.json({ message: "Organizer and all associated events deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/admin/test-email ─────────────────────────────────────────────
// Send a test email to verify SMTP configuration.
router.post("/test-email", async (req, res, next) => {
    try {
        const { to } = req.body;
        if (!to) return res.status(400).json({ error: "Recipient (to) is required" });

        await sendMail({
            to,
            subject: "Test Email — Event Management Platform",
            text: "If you received this, SMTP is configured correctly!",
        });

        res.json({ message: `Test email sent to ${to}` });
    } catch (err) {
        next(err);
    }
});

export default router;
