import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// Check if user has access to event forum
async function hasForumAccess(userId, role, eventId) {
    if (role === "admin") return true;
    if (role === "organizer") {
        const org = await collections.organizers.findOne({ userId: new ObjectId(userId) });
        if (!org) return false;
        const event = await collections.events.findOne({ _id: eventId, organizerId: org._id });
        return !!event;
    }
    if (role === "participant") {
        const reg = await collections.registrations.findOne({
            eventId,
            participantId: new ObjectId(userId),
        });
        if (reg) return true;
        // Also check merch orders
        const order = await collections.merch_orders.findOne({
            eventId,
            participantId: new ObjectId(userId),
            status: "APPROVED",
        });
        return !!order;
    }
    return false;
}

// GET /api/forum/events/:eventId/messages
router.get(
    "/events/:eventId/messages",
    authRequired,
    async (req, res, next) => {
        try {
            const eventId = new ObjectId(req.params.eventId);
            const allowed = await hasForumAccess(req.user.userId, req.user.role, eventId);
            if (!allowed)
                return res.status(403).json({ error: "You must be registered to access the forum" });

            const limit = parseInt(req.query.limit, 10) || 50;
            const before = req.query.before;

            const filter = { eventId, deleted: { $ne: true } };
            if (before) filter.createdAt = { $lt: new Date(before) };

            const messages = await collections.forum_messages
                .find(filter)
                .sort({ createdAt: -1 })
                .limit(limit)
                .toArray();

            res.json(messages.reverse());
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/forum/events/:eventId/messages
router.post(
    "/events/:eventId/messages",
    authRequired,
    async (req, res, next) => {
        try {
            const eventId = new ObjectId(req.params.eventId);
            const allowed = await hasForumAccess(req.user.userId, req.user.role, eventId);
            if (!allowed)
                return res.status(403).json({ error: "You must be registered to post" });

            const { text, parentId } = req.body;
            if (!text || !text.trim())
                return res.status(400).json({ error: "Message text required" });

            const userId = new ObjectId(req.user.userId);
            const role = req.user.role;

            let senderName = "User";
            if (role === "participant") {
                const p = await collections.participant_profiles.findOne({ userId });
                senderName = `${p?.firstName || ""} ${p?.lastName || ""}`.trim() || "Participant";
            } else if (role === "organizer") {
                const o = await collections.organizers.findOne({ userId });
                senderName = o?.name || "Organizer";
            } else if (role === "admin") {
                senderName = "Admin";
            }

            const now = new Date();
            const message = {
                eventId,
                userId,
                role,
                senderName,
                text: text.trim(),
                parentId: parentId ? new ObjectId(parentId) : null,
                pinned: false,
                deleted: false,
                createdAt: now,
            };

            const result = await collections.forum_messages.insertOne(message);
            message._id = result.insertedId;

            const io = req.app.get("io");
            if (io) {
                io.to(`forum:${req.params.eventId}`).emit("forum:message", message);
            }

            res.status(201).json(message);
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/forum/messages/:messageId/pin
// Organizer/admin only
router.post(
    "/messages/:messageId/pin",
    authRequired,
    async (req, res, next) => {
        try {
            const msg = await collections.forum_messages.findOne({
                _id: new ObjectId(req.params.messageId),
            });
            if (!msg) return res.status(404).json({ error: "Message not found" });

            // Verify organizer owns event
            const role = req.user.role;
            if (role === "organizer") {
                const org = await collections.organizers.findOne({
                    userId: new ObjectId(req.user.userId),
                });
                if (!org) return res.status(403).json({ error: "Not authorized" });
                const event = await collections.events.findOne({
                    _id: msg.eventId,
                    organizerId: org._id,
                });
                if (!event) return res.status(403).json({ error: "Not your event" });
            } else if (role !== "admin") {
                return res.status(403).json({ error: "Only organizers and admins can pin messages" });
            }

            const newPinned = !msg.pinned;
            await collections.forum_messages.updateOne(
                { _id: msg._id },
                { $set: { pinned: newPinned } }
            );

            const io = req.app.get("io");
            if (io) {
                io.to(`forum:${msg.eventId.toString()}`).emit("forum:pin", {
                    messageId: msg._id.toString(),
                    pinned: newPinned,
                });
            }

            res.json({ message: newPinned ? "Message pinned" : "Message unpinned", pinned: newPinned });
        } catch (err) {
            next(err);
        }
    }
);

// DELETE /api/forum/messages/:messageId
// Soft delete - organizer/admin or own message
router.delete(
    "/messages/:messageId",
    authRequired,
    async (req, res, next) => {
        try {
            const msg = await collections.forum_messages.findOne({
                _id: new ObjectId(req.params.messageId),
            });
            if (!msg) return res.status(404).json({ error: "Message not found" });

            const userId = req.user.userId;
            const role = req.user.role;
            const isOwn = msg.userId.toString() === userId;
            let isEventOrganizer = false;

            if (role === "organizer") {
                const org = await collections.organizers.findOne({
                    userId: new ObjectId(userId),
                });
                if (org) {
                    const event = await collections.events.findOne({
                        _id: msg.eventId,
                        organizerId: org._id,
                    });
                    isEventOrganizer = !!event;
                }
            }

            if (!isOwn && !isEventOrganizer && role !== "admin")
                return res.status(403).json({ error: "Cannot delete this message" });

            // Soft delete
            await collections.forum_messages.updateOne(
                { _id: msg._id },
                { $set: { deleted: true, deletedAt: new Date(), deletedBy: new ObjectId(userId) } }
            );

            const io = req.app.get("io");
            if (io) {
                io.to(`forum:${msg.eventId.toString()}`).emit("forum:delete", {
                    messageId: msg._id.toString(),
                });
            }

            res.json({ message: "Message deleted" });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
