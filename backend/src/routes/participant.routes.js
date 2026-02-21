import { Router } from "express";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { sendMail } from "../utils/email.js";

const router = Router();

// All participant routes need login + participant role
router.use(authRequired, requireRole(["participant"]));

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeStatus(event) {
    if (event.statusOverride) return event.statusOverride;
    if (!event.publishedAt) return "Draft";
    const now = new Date();
    if (now < new Date(event.startDate)) return "Published";
    if (now >= new Date(event.startDate) && now <= new Date(event.endDate))
        return "Ongoing";
    return "Completed";
}

function generateTicketId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `FEL-${ts}-${rand}`;
}

// ─── GET /api/participant/events ────────────────────────────────────────────
// Browse published events with search, filters, and preference-based ordering
router.get("/events", async (req, res, next) => {
    try {
        const {
            search,
            eventType,
            eligibility,
            startAfter,
            endBefore,
            followedOnly,
            sort,
        } = req.query;

        // Get participant profile for preferences
        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });

        // Only show published / ongoing events
        const filter = {
            publishedAt: { $ne: null },
        };

        if (search) {
            const regex = { $regex: search, $options: "i" };
            filter.$or = [{ name: regex }, { organizerName: regex }];
        }

        if (eventType) filter.type = eventType;

        if (eligibility && eligibility !== "ALL") {
            filter.eligibility = eligibility;
        }

        if (startAfter) {
            filter.startDate = { ...(filter.startDate || {}), $gte: new Date(startAfter) };
        }
        if (endBefore) {
            filter.endDate = { ...(filter.endDate || {}), $lte: new Date(endBefore) };
        }

        // Apply followed clubs filter
        if (followedOnly === "true") {
            if (profile?.followedOrganizers?.length > 0) {
                // Ensure objects IDs are mapped safely
                const orgIds = profile.followedOrganizers.map((id) =>
                    typeof id === "string" ? new ObjectId(id) : id
                );
                filter.organizerId = { $in: orgIds };
            } else {
                // Following no one, return empty
                return res.json([]);
            }
        }

        let events = await collections.events.find(filter).toArray();

        // Compute registration counts
        const eventIds = events.map((e) => e._id);
        const regCounts = await collections.registrations
            .aggregate([
                { $match: { eventId: { $in: eventIds } } },
                { $group: { _id: "$eventId", count: { $sum: 1 } } },
            ])
            .toArray();
        const regMap = new Map(regCounts.map((r) => [r._id.toString(), r.count]));

        // Calculate preference scores for intelligent ordering
        const interests = new Set(profile?.areasOfInterest || []);
        const followedOrgs = new Set(
            (profile?.followedOrganizers || []).map((id) => id.toString())
        );

        events = events.map((e) => {
            let prefScore = 0;
            if (followedOrgs.has(e.organizerId?.toString())) prefScore += 2;

            if (e.tags && Array.isArray(e.tags)) {
                for (const tag of e.tags) {
                    if (interests.has(tag)) prefScore += 1;
                }
            }

            return {
                ...e,
                status: computeStatus(e),
                registrationCount: regMap.get(e._id.toString()) || 0,
                __prefScore: prefScore, // strictly internal score used for sorting
            };
        });

        // Sorting Matrix
        if (sort === "registrations") {
            events.sort((a, b) => b.registrationCount - a.registrationCount);
        } else {
            // Default: primary sort by matched preferences, secondary by standard chronological date
            events.sort((a, b) => {
                if (b.__prefScore !== a.__prefScore) {
                    return b.__prefScore - a.__prefScore;
                }
                const aDate = a.startDate ? new Date(a.startDate).getTime() : Infinity;
                const bDate = b.startDate ? new Date(b.startDate).getTime() : Infinity;
                return aDate - bDate;
            });
        }

        // Cleanup private variable
        events.forEach(e => delete e.__prefScore);

        res.json(events);
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/events/trending ───────────────────────────────────
router.get("/events/trending", async (req, res, next) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const top = await collections.registrations
            .aggregate([
                { $match: { createdAt: { $gte: since } } },
                { $group: { _id: "$eventId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ])
            .toArray();

        if (top.length === 0) return res.json([]);

        const eventIds = top.map((t) => t._id);
        const events = await collections.events
            .find({ _id: { $in: eventIds }, publishedAt: { $ne: null } })
            .toArray();
        const eventMap = new Map(events.map((e) => [e._id.toString(), e]));
        const countMap = new Map(top.map((t) => [t._id.toString(), t.count]));

        const result = top
            .map((t) => {
                const e = eventMap.get(t._id.toString());
                if (!e) return null;
                return {
                    ...e,
                    status: computeStatus(e),
                    recentRegistrations: countMap.get(t._id.toString()) || 0,
                };
            })
            .filter(Boolean);

        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/events/:eventId ───────────────────────────────────
// Full event details + eligibility + registration state
router.get("/events/:eventId", async (req, res, next) => {
    try {
        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const status = computeStatus(event);

        // Count registrations
        const registrationCount = await collections.registrations.countDocuments({
            eventId: event._id,
        });

        // Check if participant is already registered
        const existingReg = await collections.registrations.findOne({
            eventId: event._id,
            participantId: new ObjectId(req.user.userId),
        });

        // Get participant profile for eligibility check
        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        const participantType = profile?.participantType || "NON_IIIT";

        const eligible =
            event.eligibility === "ALL" ||
            event.eligibility === participantType;

        const now = new Date();
        const registrationOpen =
            status === "Published" &&
            eligible &&
            !existingReg &&
            (event.registrationDeadline ? now <= new Date(event.registrationDeadline) : true) &&
            (event.registrationLimit ? registrationCount < event.registrationLimit : true);

        res.json({
            ...event,
            status,
            registrationCount,
            eligible,
            alreadyRegistered: !!existingReg,
            registrationOpen,
        });
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/participant/events/:eventId/register ─────────────────────────
router.post("/events/:eventId/register", async (req, res, next) => {
    try {
        const event = await collections.events.findOne({
            _id: new ObjectId(req.params.eventId),
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const status = computeStatus(event);
        if (status !== "Published")
            return res.status(400).json({ error: "Event is not open for registration" });

        const now = new Date();
        if (event.registrationDeadline && now > new Date(event.registrationDeadline))
            return res.status(400).json({ error: "Registration deadline has passed" });

        const registrationCount = await collections.registrations.countDocuments({
            eventId: event._id,
        });
        if (event.registrationLimit && registrationCount >= event.registrationLimit)
            return res.status(400).json({ error: "Registration limit reached" });

        // Eligibility check
        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!profile)
            return res.status(400).json({ error: "Participant profile not found" });

        if (
            event.eligibility !== "ALL" &&
            event.eligibility !== profile.participantType
        ) {
            return res
                .status(403)
                .json({ error: "You are not eligible for this event" });
        }

        // ── Form answers (backward compatible) ──────────────────────────────
        // If this event has a form schema, validate the submitted answers.
        // If no form schema, registration works exactly as before.
        const formSchema = await collections.forms.findOne({ eventId: event._id });
        let formAnswers = null;

        if (formSchema && formSchema.fields.length > 0) {
            const answers = req.body.formAnswers || {};
            // Validate required fields
            for (const field of formSchema.fields) {
                if (field.required) {
                    const val = answers[field.label];
                    if (val === undefined || val === null || val === "") {
                        return res.status(400).json({
                            error: `Required field "${field.label}" is missing`,
                        });
                    }
                }
                // Validate select field values
                if (field.type === "select" && answers[field.label]) {
                    if (!field.options.includes(answers[field.label])) {
                        return res.status(400).json({
                            error: `Invalid option for "${field.label}"`,
                        });
                    }
                }
            }
            formAnswers = answers;
        }

        // Create registration (unique index prevents duplicates)
        const ticketId = generateTicketId();
        const registration = {
            eventId: event._id,
            participantId: new ObjectId(req.user.userId),
            ticketId,
            status: "registered",
            createdAt: now,
        };

        try {
            await collections.registrations.insertOne(registration);
        } catch (dupErr) {
            if (dupErr.code === 11000) {
                return res
                    .status(409)
                    .json({ error: "You are already registered for this event" });
            }
            throw dupErr;
        }

        // Store form answers if present (after successful registration)
        if (formAnswers) {
            await collections.form_responses.insertOne({
                eventId: event._id,
                participantId: new ObjectId(req.user.userId),
                answers: formAnswers,
                createdAt: now,
            });
        }

        // Build QR payload
        const qrPayload = JSON.stringify({
            ticketId,
            eventId: event._id.toString(),
            participantId: req.user.userId,
        });

        // Store ticket
        const ticket = {
            ticketId,
            registrationId: registration._id,
            eventId: event._id,
            participantId: new ObjectId(req.user.userId),
            eventName: event.name,
            participantName: `${profile.firstName} ${profile.lastName}`,
            participantEmail: (
                await collections.users.findOne({
                    _id: new ObjectId(req.user.userId),
                })
            )?.email,
            qrPayload,
            createdAt: now,
        };
        await collections.tickets.insertOne(ticket);

        // Try to send email (don't crash on failure)
        let emailSent = false;
        try {
            await sendMail({
                to: ticket.participantEmail,
                subject: `Ticket Confirmation — ${event.name}`,
                text: [
                    `Hi ${profile.firstName},`,
                    ``,
                    `You have successfully registered for "${event.name}".`,
                    ``,
                    `Ticket ID: ${ticketId}`,
                    `Event: ${event.name}`,
                    `Date: ${event.startDate ? new Date(event.startDate).toDateString() : "TBA"}`,
                    ``,
                    `Present this Ticket ID or QR code at the venue.`,
                    ``,
                    `— Event Management Platform`,
                ].join("\n"),
            });
            emailSent = true;
        } catch (_emailErr) {
            console.warn("Email dispatch failed:", _emailErr.message);
        }

        res.status(201).json({
            message: "Registration successful",
            ticketId,
            qrPayload,
            emailSent,
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/my-events ─────────────────────────────────────────
// Return categorised data: upcoming, normal, merch, completed, cancelled
router.get("/my-events", async (req, res, next) => {
    try {
        const userId = new ObjectId(req.user.userId);
        const now = new Date();

        // Normal registrations
        const registrations = await collections.registrations
            .find({ participantId: userId })
            .sort({ createdAt: -1 })
            .toArray();

        // Merch orders
        const merchOrders = await collections.merch_orders
            .find({ participantId: userId })
            .sort({ createdAt: -1 })
            .toArray();

        // Collect all event IDs
        const allEventIds = [
            ...registrations.map((r) => r.eventId),
            ...merchOrders.map((o) => o.eventId),
        ];
        const uniqueIds = [...new Set(allEventIds.map((id) => id.toString()))].map(
            (id) => new ObjectId(id)
        );
        const events = await collections.events
            .find({ _id: { $in: uniqueIds } })
            .toArray();
        const eventMap = new Map(events.map((e) => [e._id.toString(), e]));

        const upcoming = [];
        const normal = [];
        const merch = [];
        const completed = [];
        const cancelled = [];

        // Process normal registrations
        for (const reg of registrations) {
            const event = eventMap.get(reg.eventId.toString()) || {};
            const status = computeStatus(event);
            const entry = {
                registrationId: reg._id,
                ticketId: reg.ticketId,
                status: reg.status,
                registeredAt: reg.createdAt,
                event: {
                    _id: event._id,
                    name: event.name,
                    type: event.type || "NORMAL",
                    startDate: event.startDate,
                    endDate: event.endDate,
                    organizerName: event.organizerName,
                    status,
                },
            };

            if (status === "Completed") {
                completed.push(entry);
            } else if (reg.status === "cancelled" || reg.status === "rejected") {
                cancelled.push(entry);
            } else if (event.startDate && new Date(event.startDate) > now) {
                upcoming.push(entry);
            }
            // Always add to normal tab
            if (reg.status !== "cancelled" && reg.status !== "rejected") {
                normal.push(entry);
            }
        }

        // Process merch orders
        for (const order of merchOrders) {
            const event = eventMap.get(order.eventId.toString()) || {};
            const entry = {
                orderId: order.orderId,
                _id: order._id,
                items: order.items,
                totalAmount: order.totalAmount,
                status: order.status,
                ticketId: order.ticketId || null,
                createdAt: order.createdAt,
                event: {
                    _id: event._id,
                    name: event.name,
                    type: "MERCH",
                    startDate: event.startDate,
                    endDate: event.endDate,
                    organizerName: event.organizerName,
                },
            };
            merch.push(entry);
            if (order.status === "REJECTED") {
                cancelled.push(entry);
            }
        }

        res.json({ upcoming, normal, merch, completed, cancelled });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/profile ───────────────────────────────────────────
router.get("/profile", async (req, res, next) => {
    try {
        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const user = await collections.users.findOne({
            _id: new ObjectId(req.user.userId),
        });

        // Resolve followed organizer names
        let followedDetails = [];
        if (profile.followedOrganizers && profile.followedOrganizers.length > 0) {
            const orgIds = profile.followedOrganizers.map((id) =>
                typeof id === "string" ? new ObjectId(id) : id
            );
            const orgs = await collections.organizers
                .find({ _id: { $in: orgIds } })
                .toArray();
            followedDetails = orgs.map((o) => ({
                _id: o._id,
                name: o.name,
                category: o.category,
            }));
        }

        res.json({
            ...profile,
            email: user?.email,
            followedDetails,
        });
    } catch (err) {
        next(err);
    }
});

// ─── PATCH /api/participant/profile ─────────────────────────────────────────
router.patch("/profile", async (req, res, next) => {
    try {
        const allowed = ["firstName", "lastName", "contact", "collegeOrOrg", "areasOfInterest"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0)
            return res.status(400).json({ error: "No valid fields to update" });

        updates.updatedAt = new Date();
        await collections.participant_profiles.updateOne(
            { userId: new ObjectId(req.user.userId) },
            { $set: updates }
        );

        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        res.json(profile);
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/participant/follow/:organizerId ──────────────────────────────
router.post("/follow/:organizerId", async (req, res, next) => {
    try {
        const orgId = new ObjectId(req.params.organizerId);
        const org = await collections.organizers.findOne({ _id: orgId });
        if (!org) return res.status(404).json({ error: "Organizer not found" });

        await collections.participant_profiles.updateOne(
            { userId: new ObjectId(req.user.userId) },
            { $addToSet: { followedOrganizers: orgId }, $set: { updatedAt: new Date() } }
        );
        res.json({ message: "Followed" });
    } catch (err) {
        next(err);
    }
});

// ─── DELETE /api/participant/follow/:organizerId ────────────────────────────
router.delete("/follow/:organizerId", async (req, res, next) => {
    try {
        const orgId = new ObjectId(req.params.organizerId);
        await collections.participant_profiles.updateOne(
            { userId: new ObjectId(req.user.userId) },
            { $pull: { followedOrganizers: orgId }, $set: { updatedAt: new Date() } }
        );
        res.json({ message: "Unfollowed" });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/organizers ─────────────────────────────────────────
router.get("/organizers", async (req, res, next) => {
    try {
        const { search, category } = req.query;
        const filter = {};
        if (search) filter.name = { $regex: search, $options: "i" };
        if (category) filter.category = category;

        const orgs = await collections.organizers.find(filter).toArray();

        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        const followedSet = new Set(
            (profile?.followedOrganizers || []).map((id) => id.toString())
        );

        const result = orgs.map((o) => ({
            _id: o._id,
            name: o.name,
            category: o.category,
            description: o.description || "",
            contactEmail: o.contactEmail || "",
            isFollowed: followedSet.has(o._id.toString()),
        }));
        res.json(result);
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/participant/organizers/:organizerId ───────────────────────────
router.get("/organizers/:organizerId", async (req, res, next) => {
    try {
        const org = await collections.organizers.findOne({
            _id: new ObjectId(req.params.organizerId),
        });
        if (!org) return res.status(404).json({ error: "Organizer not found" });

        const profile = await collections.participant_profiles.findOne({
            userId: new ObjectId(req.user.userId),
        });
        const followedSet = new Set(
            (profile?.followedOrganizers || []).map((id) => id.toString())
        );

        // Get published events by this organizer
        const events = await collections.events
            .find({ organizerId: org._id, publishedAt: { $ne: null } })
            .sort({ startDate: 1 })
            .toArray();

        const now = new Date();
        const upcoming = [];
        const past = [];
        for (const e of events) {
            const s = computeStatus(e);
            const item = { ...e, status: s };
            if (s === "Completed") past.push(item);
            else upcoming.push(item);
        }

        res.json({
            _id: org._id,
            name: org.name,
            category: org.category,
            description: org.description || "",
            contactEmail: org.contactEmail || "",
            isFollowed: followedSet.has(org._id.toString()),
            upcoming,
            past,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
