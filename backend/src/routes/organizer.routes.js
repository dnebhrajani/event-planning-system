import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { validateEventInput } from "../utils/validators.js";

const router = Router();

// All organiser routes need login + organizer role
router.use(authRequired, requireRole(["organizer"]));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute event status from dates + optional override field.
 */
function computeStatus(event) {
    if (event.statusOverride) return event.statusOverride;
    if (!event.publishedAt) return "Draft";
    const now = new Date();
    if (now < new Date(event.startDate)) return "Published";
    if (now >= new Date(event.startDate) && now <= new Date(event.endDate))
        return "Ongoing";
    return "Completed";
}

// ─── GET /api/organizer/events ──────────────────────────────────────────────
// List own events
router.get("/events", async (req, res, next) => {
    try {
        // Find organizer profile to get organizerId
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const events = await collections.events
            .find({ organizerId: orgProfile._id })
            .sort({ createdAt: -1 })
            .toArray();

        const result = events.map((e) => ({ ...e, status: computeStatus(e) }));
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/organizer/events ─────────────────────────────────────────────
// Create a draft event
router.post("/events", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const {
            name,
            description,
            type,
            eligibility,
            registrationDeadline,
            startDate,
            endDate,
            registrationLimit,
            registrationFee,
            tags,
        } = req.body;

        const error = validateEventInput(req.body);
        if (error) return res.status(400).json({ error });

        const now = new Date();
        const event = {
            name,
            description: description || "",
            type,
            eligibility: eligibility || "ALL",
            registrationDeadline: registrationDeadline
                ? new Date(registrationDeadline)
                : null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            registrationLimit: registrationLimit
                ? parseInt(registrationLimit, 10)
                : null,
            registrationFee: registrationFee
                ? parseFloat(registrationFee)
                : 0,
            organizerId: orgProfile._id,
            organizerName: orgProfile.name,
            tags: Array.isArray(tags) ? tags : [],
            statusOverride: null,
            publishedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        const result = await collections.events.insertOne(event);
        res.status(201).json({
            ...event,
            _id: result.insertedId,
            status: "Draft",
        });
    } catch (err) {
        next(err);
    }
});

// ─── PATCH /api/organizer/events/:eventId ───────────────────────────────────
// Edit event – rules vary by current status
router.patch("/events/:eventId", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const status = computeStatus(event);
        const updates = {};
        const now = new Date();

        if (status === "Draft") {
            // Full edits allowed
            const allowed = [
                "name", "description", "type", "eligibility",
                "registrationDeadline", "startDate", "endDate",
                "registrationLimit", "registrationFee", "tags",
            ];
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    if (["registrationDeadline", "startDate", "endDate"].includes(key)) {
                        updates[key] = new Date(req.body[key]);
                    } else if (key === "registrationLimit") {
                        updates[key] = parseInt(req.body[key], 10);
                    } else if (key === "registrationFee") {
                        updates[key] = parseFloat(req.body[key]);
                    } else {
                        updates[key] = req.body[key];
                    }
                }
            }
        } else if (status === "Published") {
            // Limited edits
            const allowed = [
                "description", "registrationDeadline",
                "registrationLimit", "statusOverride",
            ];
            for (const key of allowed) {
                if (req.body[key] !== undefined) {
                    if (key === "registrationDeadline") {
                        updates[key] = new Date(req.body[key]);
                    } else if (key === "registrationLimit") {
                        updates[key] = parseInt(req.body[key], 10);
                    } else {
                        updates[key] = req.body[key];
                    }
                }
            }
        } else if (status === "Ongoing" || status === "Completed") {
            // Only status change
            if (req.body.statusOverride !== undefined) {
                updates.statusOverride = req.body.statusOverride;
            } else {
                return res
                    .status(400)
                    .json({ error: `Cannot edit a ${status} event (only statusOverride allowed)` });
            }
        }

        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "No valid fields to update" });

        updates.updatedAt = now;
        await collections.events.updateOne(
            { _id: event._id },
            { $set: updates }
        );

        const updated = await collections.events.findOne({ _id: event._id });
        res.json({ ...updated, status: computeStatus(updated) });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/organizer/events/:eventId/publish ────────────────────────────
router.post("/events/:eventId/publish", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const status = computeStatus(event);
        if (status !== "Draft")
            return res
                .status(400)
                .json({ error: `Cannot publish an event that is ${status}` });

        // Validate required fields for publishing
        const error = validateEventInput(event, true);
        if (error) return res.status(400).json({ error });

        const now = new Date();
        await collections.events.updateOne(
            { _id: event._id },
            {
                $set: {
                    publishedAt: now,
                    statusOverride: null,
                    updatedAt: now,
                },
            }
        );

        const updated = await collections.events.findOne({ _id: event._id });

        // --- Discord Webhook Notification ---
        if (orgProfile.discordWebhookUrl) {
            try {
                const message = {
                    content: `**New Event Published by ${orgProfile.name}!**\n\n**${updated.name}**\n*${updated.type} Event*\n\n${updated.description || ""}\n\nStarts: ${updated.startDate ? new Date(updated.startDate).toDateString() : "TBA"}\nEligibility: ${updated.eligibility}`
                };
                await fetch(orgProfile.discordWebhookUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(message)
                });
            } catch (webhookErr) {
                console.warn("Discord webhook failed:", webhookErr.message);
            }
        }

        res.json({
            ...updated,
            status: computeStatus(updated),
            message: "Event published successfully",
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/profile ─────────────────────────────────────────────
router.get("/profile", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const user = await collections.users.findOne({
            _id: new ObjectId(req.user.userId),
        });

        res.json({
            ...orgProfile,
            email: user?.email,
        });
    } catch (err) {
        next(err);
    }
});

// ─── PATCH /api/organizer/profile ───────────────────────────────────────────
router.patch("/profile", async (req, res, next) => {
    try {
        const allowed = ["name", "category", "subCategory", "description", "contactEmail", "discordWebhookUrl"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "No valid fields to update" });

        updates.updatedAt = new Date();
        await collections.organizers.updateOne(
            { userId: new ObjectId(req.user.userId) },
            { $set: updates }
        );

        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        res.json(orgProfile);
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/overview ────────────────────────────────────────────
router.get("/overview", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const events = await collections.events
            .find({ organizerId: orgProfile._id })
            .toArray();

        let totalRegistrations = 0;
        const eventIds = events.map((e) => e._id);
        if (eventIds.length > 0) {
            totalRegistrations = await collections.registrations.countDocuments({
                eventId: { $in: eventIds },
            });
        }

        const drafts = events.filter((e) => !e.publishedAt).length;
        const published = events.filter((e) => {
            const s = computeStatus(e);
            return s === "Published" || s === "Ongoing";
        }).length;
        const completed = events.filter((e) => computeStatus(e) === "Completed").length;

        res.json({
            totalEvents: events.length,
            drafts,
            published,
            completed,
            totalRegistrations,
            recentEvents: events.slice(0, 5).map((e) => ({ ...e, status: computeStatus(e) })),
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/events/:eventId ─────────────────────────────────────
// Single event with overview data
router.get("/events/:eventId", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const registrationCount = await collections.registrations.countDocuments({
            eventId: event._id,
        });

        res.json({
            ...event,
            status: computeStatus(event),
            registrationCount,
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/events/:eventId/participants ────────────────────────
router.get("/events/:eventId/participants", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const registrations = await collections.registrations
            .find({ eventId: event._id })
            .sort({ createdAt: -1 })
            .toArray();

        const participantIds = registrations.map((r) => r.participantId);
        const profiles = await collections.participant_profiles
            .find({ userId: { $in: participantIds } })
            .toArray();
        const profileMap = new Map(
            profiles.map((p) => [p.userId.toString(), p])
        );

        const users = await collections.users
            .find({ _id: { $in: participantIds } })
            .toArray();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        // Check attendance if collection exists
        let attendanceSet = new Set();
        if (collections.attendance) {
            const attended = await collections.attendance
                .find({ eventId: event._id })
                .toArray();
            attendanceSet = new Set(attended.map((a) => a.participantId.toString()));
        }

        let result = registrations.map((reg) => {
            const profile = profileMap.get(reg.participantId.toString()) || {};
            const user = userMap.get(reg.participantId.toString()) || {};
            return {
                registrationId: reg._id,
                ticketId: reg.ticketId,
                participantId: reg.participantId,
                firstName: profile.firstName || "",
                lastName: profile.lastName || "",
                email: user.email || "",
                participantType: profile.participantType || "",
                contact: profile.contact || "",
                collegeOrOrg: profile.collegeOrOrg || "",
                registeredAt: reg.createdAt,
                attended: attendanceSet.has(reg.participantId.toString()),
            };
        });

        // Apply filters
        const { participantType, attendance } = req.query;
        if (participantType) {
            result = result.filter((r) => r.participantType === participantType);
        }
        if (attendance === "attended") {
            result = result.filter((r) => r.attended);
        } else if (attendance === "not_attended") {
            result = result.filter((r) => !r.attended);
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/events/:eventId/export-participants.csv ─────────────
router.get("/events/:eventId/export-participants.csv", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const registrations = await collections.registrations
            .find({ eventId: event._id })
            .sort({ createdAt: -1 })
            .toArray();

        const participantIds = registrations.map((r) => r.participantId);
        const profiles = await collections.participant_profiles
            .find({ userId: { $in: participantIds } })
            .toArray();
        const profileMap = new Map(
            profiles.map((p) => [p.userId.toString(), p])
        );
        const users = await collections.users
            .find({ _id: { $in: participantIds } })
            .toArray();
        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const header = "TicketID,FirstName,LastName,Email,Type,Contact,College,RegisteredAt\n";
        const rows = registrations.map((reg) => {
            const p = profileMap.get(reg.participantId.toString()) || {};
            const u = userMap.get(reg.participantId.toString()) || {};
            return [
                reg.ticketId,
                p.firstName || "",
                p.lastName || "",
                u.email || "",
                p.participantType || "",
                p.contact || "",
                `"${(p.collegeOrOrg || "").replace(/"/g, '""')}"`,
                reg.createdAt?.toISOString() || "",
            ].join(",");
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${event.name}-participants.csv"`);
        res.send(header + rows.join("\n"));
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/organizer/events/:eventId/analytics ───────────────────────────
router.get("/events/:eventId/analytics", async (req, res, next) => {
    try {
        const orgProfile = await collections.organizers.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!orgProfile)
            return res.status(404).json({ error: "Organizer profile not found" });

        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
            organizerId: orgProfile._id,
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const totalRegistrations = await collections.registrations.countDocuments({
            eventId: event._id,
        });

        let attendedCount = 0;
        if (collections.attendance) {
            attendedCount = await collections.attendance.countDocuments({
                eventId: event._id,
            });
        }

        // Type breakdown
        const registrations = await collections.registrations
            .find({ eventId: event._id })
            .toArray();
        const participantIds = registrations.map((r) => r.participantId);
        let iiitCount = 0;
        let nonIiitCount = 0;
        if (participantIds.length > 0) {
            const profiles = await collections.participant_profiles
                .find({ userId: { $in: participantIds } })
                .toArray();
            for (const p of profiles) {
                if (p.participantType === "IIIT") iiitCount++;
                else nonIiitCount++;
            }
        }

        const registrationRevenue = totalRegistrations * (event.registrationFee || 0);

        // Merch analytics
        let merchOrdersTotal = 0;
        let merchOrdersPending = 0;
        let merchOrdersApproved = 0;
        let merchOrdersRejected = 0;
        let merchRevenue = 0;
        if (collections.merch_orders) {
            const merchOrders = await collections.merch_orders
                .find({ eventId: event._id })
                .toArray();
            merchOrdersTotal = merchOrders.length;
            for (const o of merchOrders) {
                if (o.status === "PENDING") merchOrdersPending++;
                else if (o.status === "APPROVED") {
                    merchOrdersApproved++;
                    merchRevenue += o.totalAmount || 0;
                } else if (o.status === "REJECTED") merchOrdersRejected++;
            }
        }

        res.json({
            totalRegistrations,
            attendedCount,
            completionRate: totalRegistrations > 0 ? Math.round((attendedCount / totalRegistrations) * 100) : 0,
            iiitCount,
            nonIiitCount,
            registrationRevenue,
            merchOrdersTotal,
            merchOrdersPending,
            merchOrdersApproved,
            merchOrdersRejected,
            merchRevenue,
            totalRevenue: registrationRevenue + merchRevenue,
            registrationLimit: event.registrationLimit || null,
            fillRate: event.registrationLimit ? Math.round((totalRegistrations / event.registrationLimit) * 100) : null,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
