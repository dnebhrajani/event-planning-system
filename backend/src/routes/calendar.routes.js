import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../config/db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = Router();

// ─── GET /api/calendar/events/:eventId/calendar.ics ─────────────────────────
router.get(
    "/events/:eventId/calendar.ics",
    authRequired,
    async (req, res, next) => {
        try {
            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
            });
            if (!event) return res.status(404).json({ error: "Event not found" });

            const formatDate = (d) => {
                if (!d) return "";
                const dt = new Date(d);
                return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
            };

            const uid = `${event._id}@event-platform`;
            const now = formatDate(new Date());

            const ics = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//EventPlatform//Event//EN",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "BEGIN:VEVENT",
                `UID:${uid}`,
                `DTSTAMP:${now}`,
                `DTSTART:${formatDate(event.startDate)}`,
                `DTEND:${formatDate(event.endDate)}`,
                `SUMMARY:${(event.name || "").replace(/[,;\\]/g, " ")}`,
                `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n").replace(/[,;\\]/g, " ")}`,
                `ORGANIZER;CN=${(event.organizerName || "").replace(/[,;\\]/g, " ")}:MAILTO:noreply@events.local`,
                "END:VEVENT",
                "END:VCALENDAR",
            ].join("\r\n");

            res.setHeader("Content-Type", "text/calendar; charset=utf-8");
            res.setHeader("Content-Disposition", `attachment; filename="${event.name}.ics"`);
            res.send(ics);
        } catch (err) {
            next(err);
        }
    }
);

// ─── GET /api/calendar/events/:eventId/links ────────────────────────────────
// Return Google Calendar and Outlook links
router.get(
    "/events/:eventId/links",
    authRequired,
    async (req, res, next) => {
        try {
            const event = await collections.events.findOne({
                _id: new ObjectId(req.params.eventId),
            });
            if (!event) return res.status(404).json({ error: "Event not found" });

            const formatGCal = (d) => {
                if (!d) return "";
                return new Date(d).toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
            };

            const start = formatGCal(event.startDate);
            const end = formatGCal(event.endDate);
            const title = encodeURIComponent(event.name || "");
            const desc = encodeURIComponent(event.description || "");

            const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${desc}`;

            const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${event.startDate ? new Date(event.startDate).toISOString() : ""
                }&enddt=${event.endDate ? new Date(event.endDate).toISOString() : ""}&body=${desc}`;

            const icsUrl = `/api/calendar/events/${event._id}/calendar.ics`;

            res.json({ googleUrl, outlookUrl, icsUrl });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
