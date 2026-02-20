import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import { Server as SocketIO } from "socket.io";
import app from "./app.js";
import { connectDb } from "./config/db.js";

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await connectDb();

        const httpServer = createServer(app);

        // Socket.IO for real-time forum
        const io = new SocketIO(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || "http://localhost:5173",
                methods: ["GET", "POST"],
            },
        });

        // Make io accessible in routes
        app.set("io", io);

        io.on("connection", (socket) => {
            // Join event forum room
            socket.on("forum:join", (eventId) => {
                socket.join(`forum:${eventId}`);
            });

            socket.on("forum:leave", (eventId) => {
                socket.leave(`forum:${eventId}`);
            });
        });

        httpServer.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Failed to start server:", err);
        process.exit(1);
    }
}

start();
