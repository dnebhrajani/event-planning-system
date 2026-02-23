import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import organizerRoutes from "./routes/organizer.routes.js";
import participantRoutes from "./routes/participant.routes.js";
import formRoutes from "./routes/form.routes.js";
import merchRoutes from "./routes/merch.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import passwordResetRoutes from "./routes/passwordReset.routes.js";
import forumRoutes from "./routes/forum.routes.js";
import notificationRoutes from "./routes/notification.routes.js";

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "50mb" }));

// ─── Health check ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/organizer", organizerRoutes);
app.use("/api/participant", participantRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/merch", merchRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/password-reset", passwordResetRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/notifications", notificationRoutes);

// ─── Centralised error handler ──────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error",
        ...(process.env.NODE_ENV !== "production" && { details: err.stack }),
    });
});

export default app;
