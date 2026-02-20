import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import { getToken, getRole } from "../auth/storage";

export default function Forum() {
    const { eventId } = useParams();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const bottomRef = useRef(null);
    const socketRef = useRef(null);
    const role = getRole();

    useEffect(() => {
        // Load initial messages via REST
        (async () => {
            try {
                const { data } = await api.get(`/api/forum/events/${eventId}/messages`);
                setMessages(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();

        // Try Socket.IO if available
        let socket;
        (async () => {
            try {
                const { io } = await import("socket.io-client");
                const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
                socket = io(apiUrl, { transports: ["websocket", "polling"] });
                socketRef.current = socket;

                socket.emit("forum:join", eventId);

                socket.on("forum:message", (msg) => {
                    setMessages((prev) => [...prev, msg]);
                });

                socket.on("forum:delete", ({ messageId }) => {
                    setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));
                });
            } catch {
                // socket.io-client not installed, fall back to polling
                console.log("Socket.IO not available, using REST fallback");
            }
        })();

        return () => {
            if (socket) {
                socket.emit("forum:leave", eventId);
                socket.disconnect();
            }
        };
    }, [eventId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim()) return;
        setSending(true);
        try {
            const { data } = await api.post(`/api/forum/events/${eventId}/messages`, { text });
            // If no socket, add locally
            if (!socketRef.current || !socketRef.current.connected) {
                setMessages((prev) => [...prev, data]);
            }
            setText("");
        } catch (err) {
            console.error(err);
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (msgId) => {
        try {
            await api.delete(`/api/forum/messages/${msgId}`);
            if (!socketRef.current || !socketRef.current.connected) {
                setMessages((prev) => prev.filter((m) => m._id !== msgId));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="min-h-screen bg-base-200 flex flex-col">
            <Navbar />
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
                <h2 className="text-lg font-bold mb-2">Event Discussion</h2>

                <div className="flex-1 card bg-base-100 shadow overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <span className="loading loading-spinner"></span>
                            </div>
                        ) : messages.length === 0 ? (
                            <p className="text-center text-base-content/50 py-10">No messages yet</p>
                        ) : (
                            messages.map((msg) => (
                                <div key={msg._id} className="chat chat-start">
                                    <div className="chat-header">
                                        {msg.senderName}
                                        <span className="badge badge-xs badge-ghost ml-1">{msg.role}</span>
                                        <time className="text-xs opacity-50 ml-1">
                                            {new Date(msg.createdAt).toLocaleTimeString()}
                                        </time>
                                    </div>
                                    <div className="chat-bubble chat-bubble-primary whitespace-pre-wrap">
                                        {msg.text}
                                    </div>
                                    {(role === "admin" || role === "organizer" || msg.userId === localStorage.getItem("auth_userId")) && (
                                        <div className="chat-footer">
                                            <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(msg._id)}>
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={bottomRef} />
                    </div>

                    <div className="p-3 border-t border-base-300 flex gap-2">
                        <input
                            type="text"
                            className="input input-bordered flex-1"
                            placeholder="Type a message..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <button className="btn btn-primary" disabled={sending || !text.trim()} onClick={handleSend}>
                            {sending ? "..." : "Send"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
