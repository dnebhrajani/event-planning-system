import { Router } from "express";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { sendMail } from "../utils/mailer.js";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────────────────── */
function computeStatus(event) {
    if (event.statusOverride) return event.statusOverride;
    if (!event.publishedAt) return "Draft";
    const now = new Date();
    if (now < new Date(event.startDate)) return "Published";
    if (now >= new Date(event.startDate) && now <= new Date(event.endDate)) return "Ongoing";
    return "Completed";
}

function genOrderId() {
    return `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

function genTicketId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
    return `TKT-${ts}-${rand}`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Participant endpoints                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

// GET /api/merch/events/:eventId
// Browse merch event details + remaining purchase quota for the logged-in user
router.get(
    "/events/:eventId",
    authRequired,
    requireRole(["participant"]),
    async (req, res, next) => {
        try {
            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
            });
            if (!event) return res.status(404).json({ error: "Event not found" });
            if (event.type !== "MERCH")
                return res.status(400).json({ error: "Not a merchandise event" });

            // Calculate per-user purchase totals (APPROVED orders only count toward limit)
            const userOrders = await collections.merch_orders
                .find({
                    eventId: event._id,
                    participantId: new ObjectId(req.user.userId),
                    status: { $in: ["PENDING", "APPROVED"] },
                })
                .toArray();

            const purchasedQty = {};
            for (const order of userOrders) {
                for (const it of order.items) {
                    purchasedQty[it.name] = (purchasedQty[it.name] || 0) + it.quantity;
                }
            }

            const merchItems = (event.merchItems || []).map((m) => ({
                ...m,
                userPurchased: purchasedQty[m.name] || 0,
                remaining: m.perUserLimit ? Math.max(0, m.perUserLimit - (purchasedQty[m.name] || 0)) : null,
            }));

            res.json({
                _id: event._id,
                name: event.name,
                description: event.description,
                status: computeStatus(event),
                organizerName: event.organizerName,
                startDate: event.startDate,
                endDate: event.endDate,
                merchItems,
            });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/merch/events/:eventId/order
// Create PENDING order. Enforce per-user limits. Do NOT decrement stock.
router.post(
    "/events/:eventId/order",
    authRequired,
    requireRole(["participant"]),
    async (req, res, next) => {
        try {
            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
            });
            if (!event) return res.status(404).json({ error: "Event not found" });
            if (event.type !== "MERCH")
                return res.status(400).json({ error: "Not a merchandise event" });

            const status = computeStatus(event);
            if (status !== "Published" && status !== "Ongoing")
                return res.status(400).json({ error: "Event is not accepting orders" });

            const { items, paymentProofUrl } = req.body;
            if (!items || !Array.isArray(items) || items.length === 0)
                return res.status(400).json({ error: "items array is required" });
            if (!paymentProofUrl)
                return res.status(400).json({ error: "paymentProofUrl is required" });

            const merchItems = event.merchItems || [];
            const participantId = new ObjectId(req.user.userId);

            // Get existing user orders for limit check
            const existingOrders = await collections.merch_orders
                .find({
                    eventId: event._id,
                    participantId,
                    status: { $in: ["PENDING", "APPROVED"] },
                })
                .toArray();

            const existingQty = {};
            for (const o of existingOrders) {
                for (const it of o.items) {
                    existingQty[it.name] = (existingQty[it.name] || 0) + it.quantity;
                }
            }

            // Validate items and enforce limits
            let totalAmount = 0;
            const orderItems = [];
            for (const item of items) {
                const merch = merchItems.find((m) => m.name === item.name);
                if (!merch)
                    return res.status(400).json({ error: `Item not found: ${item.name}` });

                const qty = parseInt(item.quantity, 10) || 1;

                // Per-user limit check
                if (merch.perUserLimit) {
                    const alreadyOrdered = existingQty[merch.name] || 0;
                    if (alreadyOrdered + qty > merch.perUserLimit) {
                        return res.status(400).json({
                            error: `Per-user limit exceeded for "${merch.name}". Limit: ${merch.perUserLimit}, already ordered: ${alreadyOrdered}`,
                        });
                    }
                }

                // Stock check (rough check; final check at approval time)
                if (merch.stockQty !== undefined && merch.stockQty !== null) {
                    if (qty > merch.stockQty) {
                        return res.status(400).json({
                            error: `Insufficient stock for "${merch.name}"`,
                        });
                    }
                }

                totalAmount += merch.price * qty;
                orderItems.push({
                    name: merch.name,
                    price: merch.price,
                    quantity: qty,
                    variant: item.variant || null,
                });
            }

            const now = new Date();
            const order = {
                orderId: genOrderId(),
                eventId: event._id,
                participantId,
                items: orderItems,
                totalAmount,
                paymentProofUrl,
                status: "PENDING",
                createdAt: now,
                updatedAt: now,
            };

            await collections.merch_orders.insertOne(order);
            res.status(201).json(order);
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/merch/my-orders
// Participant: list own orders with event names and ticket info
router.get(
    "/my-orders",
    authRequired,
    requireRole(["participant"]),
    async (req, res, next) => {
        try {
            const orders = await collections.merch_orders
                .find({ participantId: new ObjectId(req.user.userId) })
                .sort({ createdAt: -1 })
                .toArray();

            const eventIds = [...new Set(orders.map((o) => o.eventId.toString()))].map(
                (id) => new ObjectId(id)
            );
            const events = await collections.events
                .find({ _id: { $in: eventIds } })
                .toArray();
            const eventMap = new Map(events.map((e) => [e._id.toString(), e]));

            const result = orders.map((o) => {
                const ev = eventMap.get(o.eventId.toString()) || {};
                return { ...o, eventName: ev.name || "Unknown" };
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

/* ────────────────────────────────────────────────────────────────────────── */
/*  Organizer endpoints                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

// PUT /api/merch/events/:eventId/items
// Set merch items for an event
router.put(
    "/events/:eventId/items",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer not found" });

            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(404).json({ error: "Event not found" });

            const { merchItems } = req.body;
            if (!Array.isArray(merchItems))
                return res.status(400).json({ error: "merchItems must be an array" });

            // Validate items
            for (const m of merchItems) {
                if (!m.name || m.price === undefined)
                    return res.status(400).json({ error: "Each item needs name and price" });
            }

            await collections.events.updateOne(
                { _id: event._id },
                { $set: { merchItems, type: "MERCH", updatedAt: new Date() } }
            );

            res.json({ message: "Merch items updated" });
        } catch (err) {
            next(err);
        }
    }
);

// GET /api/merch/events/:eventId/orders
// Organizer: list orders for their event, optionally filter by status
router.get(
    "/events/:eventId/orders",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer not found" });

            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(404).json({ error: "Event not found" });

            const filter = { eventId: event._id };
            if (req.query.status) filter.status = req.query.status;

            const orders = await collections.merch_orders
                .find(filter)
                .sort({ createdAt: -1 })
                .toArray();

            // Enrich with participant names
            const pIds = [...new Set(orders.map((o) => o.participantId.toString()))].map(
                (id) => new ObjectId(id)
            );
            const profiles = await collections.participant_profiles
                .find({ userId: { $in: pIds } })
                .toArray();
            const pMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

            const result = orders.map((o) => {
                const p = pMap.get(o.participantId.toString()) || {};
                return {
                    ...o,
                    participantName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
                };
            });

            res.json(result);
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/merch/orders/:orderId/approve
// Approve order: verify stock, atomically decrement, generate ticket + QR
router.post(
    "/orders/:orderId/approve",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const order = await collections.merch_orders.findOne({
                _id: new ObjectId(req.params.orderId),
            });
            if (!order) return res.status(404).json({ error: "Order not found" });
            if (order.status !== "PENDING")
                return res.status(400).json({ error: `Order already ${order.status}` });

            // Verify organizer owns event
            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer not found" });

            const event = await collections.events.findOne({
                _id: order.eventId,
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(403).json({ error: "Not your event" });

            // Atomic stock decrement for each item
            const merchItems = event.merchItems || [];
            for (const orderItem of order.items) {
                const idx = merchItems.findIndex((m) => m.name === orderItem.name);
                if (idx === -1) {
                    return res.status(400).json({ error: `Item "${orderItem.name}" no longer exists` });
                }
                const merch = merchItems[idx];
                if (merch.stockQty !== undefined && merch.stockQty !== null) {
                    if (merch.stockQty < orderItem.quantity) {
                        return res.status(400).json({
                            error: `Insufficient stock for "${merch.name}". Available: ${merch.stockQty}, requested: ${orderItem.quantity}`,
                        });
                    }
                    // Atomic decrement using positional update
                    const updateResult = await collections.events.updateOne(
                        {
                            _id: event._id,
                            "merchItems.name": orderItem.name,
                            "merchItems.stockQty": { $gte: orderItem.quantity },
                        },
                        {
                            $inc: { "merchItems.$.stockQty": -orderItem.quantity },
                            $set: { updatedAt: new Date() },
                        }
                    );
                    if (updateResult.modifiedCount === 0) {
                        return res.status(409).json({
                            error: `Stock depleted for "${orderItem.name}" (concurrent order)`,
                        });
                    }
                }
            }

            // Generate ticket
            const ticketId = genTicketId();
            const qrPayload = JSON.stringify({
                ticketId,
                eventId: event._id.toString(),
                participantId: order.participantId.toString(),
                type: "MERCH",
            });

            const now = new Date();
            await collections.tickets.insertOne({
                ticketId,
                eventId: event._id,
                participantId: order.participantId,
                orderId: order._id,
                eventName: event.name,
                qrPayload,
                type: "MERCH",
                createdAt: now,
            });

            // Update order
            await collections.merch_orders.updateOne(
                { _id: order._id },
                { $set: { status: "APPROVED", ticketId, updatedAt: now } }
            );

            // Try email (don't hang the request)
            let emailSent = false;
            try {
                const user = await collections.users.findOne({ _id: order.participantId });
                const profile = await collections.participant_profiles.findOne({
                    userId: order.participantId,
                });
                if (user?.email) {
                    sendMail({
                        to: user.email,
                        subject: `Order Approved - ${event.name}`,
                        text: [
                            `Hi ${profile?.firstName || ""},`,
                            "",
                            `Your merch order (${order.orderId}) for "${event.name}" has been approved.`,
                            `Ticket ID: ${ticketId}`,
                            "",
                            "Present this ticket at the venue.",
                            "",
                            "-- Event Management Platform",
                        ].join("\n"),
                    }).catch(err => console.warn("Async email failed:", err.message));
                    emailSent = true;
                }
            } catch (_) {
                // SMTP optional
            }

            res.json({
                message: "Order approved",
                ticketId,
                qrPayload,
                emailSent,
            });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/merch/orders/:orderId/reject
router.post(
    "/orders/:orderId/reject",
    authRequired,
    requireRole(["organizer"]),
    async (req, res, next) => {
        try {
            const order = await collections.merch_orders.findOne({
                _id: new ObjectId(req.params.orderId),
            });
            if (!order) return res.status(404).json({ error: "Order not found" });
            if (order.status !== "PENDING")
                return res.status(400).json({ error: `Order already ${order.status}` });

            const orgProfile = await collections.organizers.findOne({
                userId: new ObjectId(req.user.userId),
            });
            if (!orgProfile) return res.status(404).json({ error: "Organizer not found" });

            const event = await collections.events.findOne({
                _id: order.eventId,
                organizerId: orgProfile._id,
            });
            if (!event) return res.status(403).json({ error: "Not your event" });

            const { comment } = req.body;
            await collections.merch_orders.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: "REJECTED",
                        adminOrOrganizerComment: comment || "",
                        updatedAt: new Date(),
                    },
                }
            );

            res.json({ message: "Order rejected" });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
