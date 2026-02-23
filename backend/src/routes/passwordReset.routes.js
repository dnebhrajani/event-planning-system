import { Router } from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { sendMail } from "../utils/email.js";

const router = Router();

// POST /api/password-reset/request
router.post(
    "/request",
    authRequired,
    requireRole(["organizer", "participant"]),
    async (req, res, next) => {
        try {
            const existing = await collections.reset_requests.findOne({
                organizerUserId: new ObjectId(req.user.userId),
                status: "pending",
            });
            if (existing)
                return res.status(400).json({ error: "You already have a pending reset request" });

            const { reason } = req.body || {};
            const now = new Date();
            await collections.reset_requests.insertOne({
                organizerUserId: new ObjectId(req.user.userId),
                reason: reason || "",
                status: "pending",
                createdAt: now,
                updatedAt: now,
            });

            res.status(201).json({ message: "Password reset request submitted" });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/password-reset/my-request
router.get(
    "/my-request",
    authRequired,
    requireRole(["organizer", "participant"]),
    async (req, res, next) => {
        try {
            const requests = await collections.reset_requests
                .find({ organizerUserId: new ObjectId(req.user.userId) })
                .sort({ createdAt: -1 })
                .toArray();
            res.json(requests);
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/password-reset/requests (admin)
router.get(
    "/requests",
    authRequired,
    requireRole(["admin"]),
    async (req, res, next) => {
        try {
            const requests = await collections.reset_requests
                .find({})
                .sort({ createdAt: -1 })
                .toArray();

            const userIds = requests.map((r) => r.organizerUserId);
            const users = await collections.users.find({ _id: { $in: userIds } }).toArray();
            const uMap = new Map(users.map((u) => [u._id.toString(), u]));
            const orgs = await collections.organizers.find({ userId: { $in: userIds } }).toArray();
            const oMap = new Map(orgs.map((o) => [o.userId.toString(), o]));
            const parts = await collections.participant_profiles.find({ userId: { $in: userIds } }).toArray();
            const pMap = new Map(parts.map((p) => [p.userId.toString(), p]));

            const result = requests.map((r) => {
                const u = uMap.get(r.organizerUserId.toString()) || {};
                const o = oMap.get(r.organizerUserId.toString());
                const p = pMap.get(r.organizerUserId.toString());
                return {
                    ...r,
                    email: u.email || "",
                    organizerName: o?.name || p?.name || "",
                    role: u.role || "",
                };
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// PATCH /api/password-reset/requests/:requestId
router.patch(
    "/requests/:requestId",
    authRequired,
    requireRole(["admin"]),
    async (req, res, next) => {
        try {
            const { action, comment } = req.body;
            if (!["approve", "reject"].includes(action))
                return res.status(400).json({ error: "action must be approve or reject" });

            const request = await collections.reset_requests.findOne({
                _id: new ObjectId(req.params.requestId),
            });
            if (!request) return res.status(404).json({ error: "Request not found" });
            if (request.status !== "pending")
                return res.status(400).json({ error: "Request already processed" });

            if (action === "approve") {
                const newPassword = crypto.randomBytes(6).toString("hex");
                const hash = await bcrypt.hash(newPassword, 10);

                await collections.users.updateOne(
                    { _id: request.organizerUserId },
                    { $set: { passwordHash: hash, updatedAt: new Date() } }
                );

                await collections.reset_requests.updateOne(
                    { _id: request._id },
                    {
                        $set: {
                            status: "approved",
                            resolvedAt: new Date(),
                            adminComment: comment || "",
                            updatedAt: new Date(),
                        },
                    }
                );

                // Email the new password to the appropriate address
                try {
                    const user = await collections.users.findOne({ _id: request.organizerUserId });
                    let targetEmail = user?.email || "";

                    if (user?.role === "organizer") {
                        const orgProfile = await collections.organizers.findOne({ userId: user._id });
                        if (orgProfile?.contactEmail) targetEmail = orgProfile.contactEmail;
                    }

                    if (targetEmail) {
                        await sendMail({
                            to: targetEmail,
                            subject: "Your Password Has Been Reset",
                            text: `Your password has been reset by the admin.\n\nYour new password is: ${newPassword}\n\nPlease log in and change it as soon as possible.`,
                            html: `<p>Your password has been reset by the admin.</p><p>Your new password is: <strong>${newPassword}</strong></p><p>Please log in and change it as soon as possible.</p>`,
                        });
                    }
                } catch (emailErr) {
                    console.warn("Password reset email failed:", emailErr.message);
                }

                res.json({ message: "Password reset approved", newPassword });
            } else {
                await collections.reset_requests.updateOne(
                    { _id: request._id },
                    {
                        $set: {
                            status: "rejected",
                            resolvedAt: new Date(),
                            adminComment: comment || "",
                            updatedAt: new Date(),
                        },
                    }
                );
                res.json({ message: "Password reset rejected" });
            }
        } catch (err) {
            next(err);
        }
    }
);

export default router;
