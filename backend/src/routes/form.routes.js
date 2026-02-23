import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import os from "os";
import path from "path";

const router = Router();

// ─── Organizer: Set form schema ─────────────────────────────────────────────
// PUT /api/forms/events/:eventId
router.put(
    "/events/:eventId",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer profile not found" });

            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(404).json({ error: "Event not found or not yours" });

            // Schema locking: reject edits if at least one registration exists
            const regCount = await collections.registrations.countDocuments({
                eventId: event._id,
                status: { $nin: ["cancelled", "rejected"] }
            });
            if (regCount > 0) {
                return res.status(409).json({
                    error: "Cannot edit form: registrations already exist for this event",
                });
            }

            const { fields } = req.body;
            if (!Array.isArray(fields))
                return res.status(400).json({ error: "fields must be an array" });

            // Validate each field
            for (const f of fields) {
                if (!f.label || !f.type)
                    return res.status(400).json({ error: "Each field must have label and type" });
                if (!["text", "textarea", "number", "select", "checkbox", "file"].includes(f.type))
                    return res.status(400).json({ error: `Invalid field type: ${f.type}` });
                if (f.type === "select" && (!Array.isArray(f.options) || f.options.length === 0))
                    return res.status(400).json({ error: `Select field "${f.label}" must have options` });
            }

            const now = new Date();
            await collections.forms.updateOne(
                { eventId: event._id },
                {
                    $set: { fields, updatedAt: now },
                    $setOnInsert: { eventId: event._id, createdAt: now },
                },
                { upsert: true }
            );

            const form = await collections.forms.findOne({ eventId: event._id });
            res.json(form);
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET form schema ────────────────────────────────────────────────────────
// GET /api/forms/events/:eventId
router.get(
    "/events/:eventId",
    authRequired,
    async (req, res, next) => {
        try {
            const eventId = new ObjectId(req.params.eventId);
            const form = await collections.forms.findOne({ eventId });

            // If the requester is an organizer, include lock status
            let locked = false;
            if (req.user.role === "organizer") {
                const regCount = await collections.registrations.countDocuments({
                    eventId,
                    status: { $nin: ["cancelled", "rejected"] }
                });
                locked = regCount > 0;
            }

            res.json({ fields: form?.fields || [], locked });
        } catch (err) {
            next(err);
        }
    }
);

// ─── Organizer: View responses ──────────────────────────────────────────────
// GET /api/forms/events/:eventId/responses
router.get(
    "/events/:eventId/responses",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer profile not found" });

            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(404).json({ error: "Event not found" });

            const responses = await collections.form_responses
                .find({ eventId: event._id })
                .sort({ createdAt: -1 })
                .toArray();

            // Enrich with participant info
            const pIds = responses.map((r) => r.participantId);
            const profiles = await collections.participant_profiles
                .find({ userId: { $in: pIds } })
                .toArray();
            const pMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

            const result = responses.map((r) => {
                const p = pMap.get(r.participantId.toString()) || {};
                return {
                    ...r,
                    participantName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
                };
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// ─── File upload (base64 over JSON — no extra dependency) ───────────────────
// POST /api/forms/upload
router.post(
    "/upload",
    authRequired,
    async (req, res, next) => {
        try {
            const { filename, data, mimetype } = req.body;
            if (!filename || !data)
                return res.status(400).json({ error: "filename and data (base64) required" });

            if (!mimetype || (!mimetype.startsWith("image/") && mimetype !== "application/pdf")) {
                return res.status(400).json({ error: "Only images and PDFs are allowed." });
            }

            const isPdf = mimetype === "application/pdf";

            const uploadParams = {
                folder: "event_files",
                resource_type: isPdf ? "raw" : "auto"
            };
            if (isPdf) {
                uploadParams.type = "authenticated";
            }

            let uploadRes;
            if (isPdf) {
                // Raw files in Cloudinary don't auto-append extensions from base64 streams.
                // We physically construct a temporary file to bypass corrupted raw deliveries.
                const safeName = filename.replace(/[^a-zA-Z0-9]/g, "_").replace(/_pdf$/i, "");
                uploadParams.public_id = `${safeName}_${Date.now()}.pdf`;

                const tempFilePath = path.join(os.tmpdir(), `upload_${Date.now()}_${safeName}.pdf`);
                // Strip metadata prefix if the frontend sent the complete dataUri instead of raw base64
                const base64Data = data.replace(/^data:[a-zA-Z0-9\/+-]+;base64,/, "");
                const buffer = Buffer.from(base64Data, "base64");
                fs.writeFileSync(tempFilePath, buffer);

                try {
                    uploadRes = await cloudinary.uploader.upload(tempFilePath, uploadParams);
                } finally {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                }
            } else {
                const dataUri = `data:${mimetype};base64,${data}`;
                uploadRes = await cloudinary.uploader.upload(dataUri, uploadParams);
            }

            res.json({ url: uploadRes.secure_url, filename });
        } catch (err) {
            next(err);
        }
    }
);

// ─── Generate Signed URL for Authenticated PDF Delivery ───────────────────
// GET /api/forms/signed-url?url=...
router.get(
    "/signed-url",
    authRequired,
    async (req, res, next) => {
        try {
            const { url } = req.query;
            if (!url) return res.status(400).json({ error: "Cloudinary URL required" });

            // Extract public_id
            // Handles URLs like .../raw/authenticated/v1771783449/event_files/test.pdf
            const match = url.match(/\/v\d+\/(.+)$/);
            if (!match) return res.status(400).json({ error: "Invalid Cloudinary URL formatting" });
            const publicId = match[1];

            const signedUrl = cloudinary.utils.private_download_url(publicId, "pdf", {
                resource_type: "raw",
                type: "authenticated",
                expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiration
            });

            res.json({ signedUrl });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
