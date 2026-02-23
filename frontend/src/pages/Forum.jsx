import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api/axios";
import Navbar from "../components/Navbar";
import { getRole } from "../auth/storage";

const EMOJIS = ["👍", "❤️", "😂", "🔥", "👏"];

export default function Forum() {
    const { eventId } = useParams();
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showEmojiFor, setShowEmojiFor] = useState(null);
    const [replyTo, setReplyTo] = useState(null); // { _id, senderName }
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const socketRef = useRef(null);
    const role = getRole();

    useEffect(() => {
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

        let isMounted = true;
        let socket;
        (async () => {
            try {
                const { io } = await import("socket.io-client");
                const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
                socket = io(apiUrl, { transports: ["websocket", "polling"] });

                if (!isMounted) { socket.disconnect(); return; }
                socketRef.current = socket;
                socket.emit("forum:join", eventId);

                socket.on("forum:message", (msg) => {
                    setMessages((prev) => {
                        if (prev.some((m) => (m._id || m.id) === (msg._id || msg.id))) return prev;
                        return [...prev, msg];
                    });
                });
                socket.on("forum:delete", ({ messageId }) => {
                    setMessages((prev) => prev.filter((m) => (m._id || m.id) !== messageId));
                });
                socket.on("forum:pin", ({ messageId, pinned }) => {
                    setMessages((prev) =>
                        prev.map((m) => ((m._id || m.id) === messageId ? { ...m, pinned } : m))
                    );
                });
                socket.on("forum:react", ({ messageId, reactions }) => {
                    setMessages((prev) =>
                        prev.map((m) => ((m._id || m.id) === messageId ? { ...m, reactions } : m))
                    );
                });
            } catch {
                console.log("Socket.IO not available, using REST fallback");
            }
        })();

        return () => {
            isMounted = false;
            if (socketRef.current) {
                socketRef.current.emit("forum:leave", eventId);
                socketRef.current.disconnect();
                socketRef.current = null;
            } else if (socket) {
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
            const body = { text };
            if (replyTo) body.parentId = replyTo._id;
            const { data } = await api.post(`/api/forum/events/${eventId}/messages`, body);
            if (!socketRef.current || !socketRef.current.connected) {
                setMessages((prev) => [...prev, data]);
            }
            setText("");
            setReplyTo(null);
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

    const handlePin = async (msgId) => {
        try {
            await api.post(`/api/forum/messages/${msgId}/pin`);
            if (!socketRef.current || !socketRef.current.connected) {
                setMessages((prev) =>
                    prev.map((m) => (m._id === msgId ? { ...m, pinned: !m.pinned } : m))
                );
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleReact = async (msgId, emoji) => {
        try {
            const { data } = await api.post(`/api/forum/messages/${msgId}/react`, { emoji });
            if (!socketRef.current || !socketRef.current.connected) {
                setMessages((prev) =>
                    prev.map((m) => (m._id === msgId ? { ...m, reactions: data.reactions } : m))
                );
            }
            setShowEmojiFor(null);
        } catch (err) {
            console.error(err);
        }
    };

    const handleReply = (msg) => {
        setReplyTo({ _id: msg._id, senderName: msg.senderName });
        inputRef.current?.focus();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Build threaded structure: top-level messages + replies grouped by parentId
    const topLevel = messages.filter((m) => !m.parentId);
    const repliesByParent = {};
    messages.forEach((m) => {
        if (m.parentId) {
            const pid = m.parentId.toString ? m.parentId.toString() : m.parentId;
            if (!repliesByParent[pid]) repliesByParent[pid] = [];
            repliesByParent[pid].push(m);
        }
    });

    const pinnedMessages = messages.filter((m) => m.pinned);

    const renderMessage = (msg, isReply = false) => {
        const replies = repliesByParent[msg._id] || [];
        return (
            <div key={msg._id}>
                <div className={`chat chat-start ${msg.role === "organizer" ? "border-l-4 border-primary pl-2" : ""} ${isReply ? "ml-8 border-l-2 border-base-300 pl-3" : ""}`}>
                    <div className="chat-header">
                        {msg.senderName}
                        <span className={`badge badge-xs ml-1 ${msg.role === "organizer" ? "badge-primary" : "badge-ghost"}`}>
                            {msg.role}
                        </span>
                        {msg.pinned && <span className="badge badge-xs badge-info ml-1">pinned</span>}
                        <time className="text-xs opacity-50 ml-1">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                        </time>
                    </div>

                    {/* If this is a reply, show who it's replying to */}
                    {isReply && (
                        <div className="text-xs text-base-content/50 ml-12 -mb-1">
                            replying to thread
                        </div>
                    )}

                    <div className={`chat-bubble whitespace-pre-wrap ${msg.role === "organizer" ? "chat-bubble-primary" : ""}`}>
                        {msg.text}
                    </div>

                    {/* Reactions display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                                <button
                                    key={emoji}
                                    className="btn btn-ghost btn-xs rounded-full text-sm"
                                    onClick={() => handleReact(msg._id, emoji)}
                                    title={`${users.length} reaction(s)`}
                                >
                                    {emoji} {users.length}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="chat-footer flex gap-1 items-center mt-0.5">
                        {/* React */}
                        <div className="relative">
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setShowEmojiFor(showEmojiFor === msg._id ? null : msg._id)}
                            >
                                React
                            </button>
                            {showEmojiFor === msg._id && (
                                <div className="absolute bottom-full left-0 bg-base-100 shadow-lg rounded-lg p-1 flex gap-1 z-50 border border-base-300">
                                    {EMOJIS.map((e) => (
                                        <button key={e} className="btn btn-ghost btn-xs text-lg" onClick={() => handleReact(msg._id, e)}>
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Reply */}
                        <button className="btn btn-ghost btn-xs" onClick={() => handleReply(msg)}>
                            Reply
                        </button>

                        {/* Pin — organizer/admin only */}
                        {(role === "admin" || role === "organizer") && (
                            <button className="btn btn-ghost btn-xs" onClick={() => handlePin(msg._id)}>
                                {msg.pinned ? "Unpin" : "Pin"}
                            </button>
                        )}

                        {/* Delete */}
                        {(role === "admin" || role === "organizer" || msg.userId === localStorage.getItem("auth_userId")) && (
                            <button className="btn btn-ghost btn-xs text-error" onClick={() => handleDelete(msg._id)}>
                                Delete
                            </button>
                        )}
                    </div>
                </div>

                {/* Render replies recursively */}
                {replies.length > 0 && (
                    <div className="mt-1">
                        {replies.map((reply) => renderMessage(reply, true))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-base-200 flex flex-col">
            <Navbar />
            <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
                <h2 className="text-lg font-bold mb-2">Event Discussion</h2>

                {/* Pinned messages banner */}
                {pinnedMessages.length > 0 && (
                    <div className="mb-3 space-y-1">
                        {pinnedMessages.map((msg) => (
                            <div key={`pin-${msg._id}`} className="alert alert-info py-2 text-sm flex items-center gap-2">
                                <span className="font-semibold">{msg.senderName}:</span>
                                <span className="truncate">{msg.text}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex-1 card bg-base-100 shadow overflow-hidden flex flex-col" style={{ minHeight: "400px" }}>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <span className="loading loading-spinner"></span>
                            </div>
                        ) : messages.length === 0 ? (
                            <p className="text-center text-base-content/50 py-10">No messages yet</p>
                        ) : (
                            topLevel.map((msg) => renderMessage(msg, false))
                        )}
                        <div ref={bottomRef} />
                    </div>

                    {/* Reply indicator */}
                    {replyTo && (
                        <div className="px-3 py-1 bg-base-200 border-t border-base-300 flex justify-between items-center text-sm">
                            <span>Replying to <strong>{replyTo.senderName}</strong></span>
                            <button className="btn btn-ghost btn-xs" onClick={() => setReplyTo(null)}>✕</button>
                        </div>
                    )}

                    <div className="p-3 border-t border-base-300 flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            className="input input-bordered flex-1"
                            placeholder={replyTo ? `Reply to ${replyTo.senderName}...` : "Type a message..."}
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
