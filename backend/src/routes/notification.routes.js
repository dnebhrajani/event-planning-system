import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired } from "../middleware/auth.js";

const router = Router();

// GET /api/notifications — fetch user's notifications (latest 50, unread first)
router.get("/", authRequired, async (req, res, next) => {
    try {
        const userId = new ObjectId(req.user.userId);
        const notifications = await collections.notifications
            .find({ userId })
            .sort({ read: 1, createdAt: -1 })
            .limit(50)
            .toArray();
        const unreadCount = await collections.notifications.countDocuments({ userId, read: false });
        res.json({ notifications, unreadCount });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/notifications/:id/read — mark single notification as read
router.patch("/:id/read", authRequired, async (req, res, next) => {
    try {
        await collections.notifications.updateOne(
            { _id: new ObjectId(req.params.id), userId: new ObjectId(req.user.userId) },
            { $set: { read: true } }
        );
        res.json({ message: "Marked as read" });
    } catch (err) {
        next(err);
    }
});

// PATCH /api/notifications/read-all — mark all notifications as read
router.patch("/read-all", authRequired, async (req, res, next) => {
    try {
        await collections.notifications.updateMany(
            { userId: new ObjectId(req.user.userId), read: false },
            { $set: { read: true } }
        );
        res.json({ message: "All marked as read" });
    } catch (err) {
        next(err);
    }
});

export default router;
