import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authRequired, requireRole(["organizer"]));

async function getOrgEvent(userId, eventId) {
    const orgProfile = await collections.organizers.findOne({
        userId: new ObjectId(userId),
    });
    if (!orgProfile) return null;
    return collections.events.findOne({
        _id: new ObjectId(eventId),
        organizerId: orgProfile._id,
    });
}

// Find ticket by ticketId across normal tickets and merch tickets
async function findTicketForEvent(eventId, ticketId) {
    // Check normal registration tickets
    const normalReg = await collections.registrations.findOne({ eventId, ticketId });
    if (normalReg) {
        return { ticketId, participantId: normalReg.participantId, type: "NORMAL" };
    }
    // Check merch tickets
    const merchTicket = await collections.tickets.findOne({ eventId, ticketId });
    if (merchTicket) {
        return { ticketId, participantId: merchTicket.participantId, type: "MERCH" };
    }
    return null;
}

// POST /api/attendance/events/:eventId/scan
router.post("/events/:eventId/scan", async (req, res, next) => {
    try {
        const event = await getOrgEvent(req.user.userId, req.params.eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        const { qrPayload, ticketId: directTicketId } = req.body;
        let ticketId = directTicketId;

        if (qrPayload) {
            try {
                const parsed = JSON.parse(qrPayload);
                ticketId = parsed.ticketId;
            } catch {
                return res.status(400).json({ error: "Invalid QR payload" });
            }
        }

        if (!ticketId) return res.status(400).json({ error: "ticketId or qrPayload required" });

        const ticketInfo = await findTicketForEvent(event._id, ticketId);
        if (!ticketInfo)
            return res.status(404).json({ error: "Ticket not found for this event" });

        const now = new Date();
        try {
            await collections.attendance.insertOne({
                eventId: event._id,
                ticketId,
                participantId: ticketInfo.participantId,
                ticketType: ticketInfo.type,
                scannedAt: now,
                scannedByOrganizerId: new ObjectId(req.user.userId),
                method: "SCAN",
                createdAt: now,
            });
        } catch (dupErr) {
            if (dupErr.code === 11000)
                return res.status(409).json({ error: "Already marked as attended" });
            throw dupErr;
        }

        const profile = await collections.participant_profiles.findOne({
            userId: ticketInfo.participantId,
        });

        res.json({
            message: "Attendance marked",
            ticketId,
            ticketType: ticketInfo.type,
            participantName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim(),
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/attendance/events/:eventId/manual
router.post("/events/:eventId/manual", async (req, res, next) => {
    try {
        const event = await getOrgEvent(req.user.userId, req.params.eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        const { ticketId, note } = req.body;
        if (!ticketId) return res.status(400).json({ error: "ticketId required" });

        const ticketInfo = await findTicketForEvent(event._id, ticketId);
        if (!ticketInfo)
            return res.status(404).json({ error: "Ticket not found for this event" });

        const now = new Date();
        try {
            await collections.attendance.insertOne({
                eventId: event._id,
                ticketId,
                participantId: ticketInfo.participantId,
                ticketType: ticketInfo.type,
                scannedAt: now,
                scannedByOrganizerId: new ObjectId(req.user.userId),
                method: "MANUAL",
                override: true,
                note: note || "",
                createdAt: now,
            });
        } catch (dupErr) {
            if (dupErr.code === 11000)
                return res.status(409).json({ error: "Already marked as attended" });
            throw dupErr;
        }

        res.json({ message: "Attendance marked manually", ticketId });
    } catch (err) {
        next(err);
    }
});

// GET /api/attendance/events/:eventId
// Dashboard: counts + scanned/not-scanned lists
router.get("/events/:eventId", async (req, res, next) => {
    try {
        const event = await getOrgEvent(req.user.userId, req.params.eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // All attendees
        const attendanceRecords = await collections.attendance
            .find({ eventId: event._id })
            .sort({ scannedAt: -1 })
            .toArray();
        const attendedTicketIds = new Set(attendanceRecords.map((a) => a.ticketId));

        // Normal registrations
        const normalRegs = await collections.registrations
            .find({ eventId: event._id })
            .toArray();

        // Merch tickets
        const merchTickets = await collections.tickets
            .find({ eventId: event._id })
            .toArray();

        // Combine all ticket holders
        const allTickets = [];
        for (const r of normalRegs) {
            allTickets.push({
                ticketId: r.ticketId,
                participantId: r.participantId,
                type: "NORMAL",
            });
        }
        for (const t of merchTickets) {
            allTickets.push({
                ticketId: t.ticketId,
                participantId: t.participantId,
                type: "MERCH",
            });
        }

        // Enrich with names
        const pIds = [...new Set(allTickets.map((t) => t.participantId.toString()))].map(
            (id) => new ObjectId(id)
        );
        const profiles = await collections.participant_profiles
            .find({ userId: { $in: pIds } })
            .toArray();
        const pMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

        const scanned = [];
        const notScanned = [];
        for (const t of allTickets) {
            const p = pMap.get(t.participantId.toString()) || {};
            const rec = attendanceRecords.find((a) => a.ticketId === t.ticketId);
            const entry = {
                ticketId: t.ticketId,
                participantId: t.participantId,
                type: t.type,
                participantName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
            };
            if (rec) {
                scanned.push({ ...entry, scannedAt: rec.scannedAt, method: rec.method });
            } else {
                notScanned.push(entry);
            }
        }

        res.json({
            totalTickets: allTickets.length,
            scannedCount: scanned.length,
            notScannedCount: notScanned.length,
            scanned,
            notScanned,
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/attendance/events/:eventId/export.csv
router.get("/events/:eventId/export.csv", async (req, res, next) => {
    try {
        const event = await getOrgEvent(req.user.userId, req.params.eventId);
        if (!event) return res.status(404).json({ error: "Event not found" });

        const records = await collections.attendance
            .find({ eventId: event._id })
            .sort({ scannedAt: -1 })
            .toArray();

        const pIds = [...new Set(records.map((r) => r.participantId.toString()))].map(
            (id) => new ObjectId(id)
        );
        const profiles = await collections.participant_profiles
            .find({ userId: { $in: pIds } })
            .toArray();
        const pMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
        const users = await collections.users.find({ _id: { $in: pIds } }).toArray();
        const uMap = new Map(users.map((u) => [u._id.toString(), u]));

        const header = "TicketID,Name,Email,Type,Method,ScannedAt\n";
        const rows = records.map((r) => {
            const p = pMap.get(r.participantId.toString()) || {};
            const u = uMap.get(r.participantId.toString()) || {};
            return [
                r.ticketId,
                `"${(p.firstName || "")} ${(p.lastName || "")}".trim()`,
                u.email || "",
                r.ticketType || "NORMAL",
                r.method || "",
                r.scannedAt?.toISOString() || "",
            ].join(",");
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="attendance-${event.name}.csv"`
        );
        res.send(header + rows.join("\n"));
    } catch (err) {
        next(err);
    }
});

export default router;
