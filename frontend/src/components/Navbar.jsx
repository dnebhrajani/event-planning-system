import { NavLink, useNavigate } from "react-router-dom";
import { clearToken, clearRole, getRole, getToken } from "../auth/storage";
import { useEffect, useState, useRef } from "react";
import api from "../api/axios";

const isDev = import.meta.env.DEV;

const links = {
    admin: [
        { to: "/admin", label: "Dashboard" },
        ...(isDev ? [{ to: "/admin/clubs", label: "Clubs (Dev)" }] : []),
    ],
    organizer: [
        { to: "/organizer", label: "Dashboard" },
        { to: "/organizer/profile", label: "Profile" },
        { to: "/organizer/create-event", label: "Create Event" },
        { to: "/organizer/my-events", label: "My Events" },
    ],
    participant: [
        { to: "/participant", label: "Dashboard" },
        { to: "/participant/profile", label: "Profile" },
        { to: "/participant/events", label: "Browse Events" },
        { to: "/participant/my-events", label: "My Events" },
    ],
};

export default function Navbar() {
    const navigate = useNavigate();
    const role = getRole();
    const items = links[role] || [];
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    const handleLogout = () => {
        clearToken();
        clearRole();
        navigate("/login", { replace: true });
    };

    useEffect(() => {
        if (!getToken()) return;
        const fetchNotifications = async () => {
            try {
                const { data } = await api.get("/api/notifications");
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            } catch (_) { /* silent */ }
        };
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const markAllRead = async () => {
        try {
            await api.patch("/api/notifications/read-all");
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (_) { /* silent */ }
    };

    const markRead = async (id) => {
        try {
            await api.patch(`/api/notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch (_) { /* silent */ }
    };

    return (
        <nav className="navbar bg-base-100 shadow-md px-6">
            <div className="flex-1 gap-4">
                <span className="text-xl font-bold capitalize">{role} Panel</span>
                <div className="hidden sm:flex gap-2 flex-wrap">
                    {items.map((l) => (
                        <NavLink
                            key={l.to}
                            to={l.to}
                            end
                            className={({ isActive }) =>
                                `btn btn-ghost btn-sm ${isActive ? "btn-active" : ""}`
                            }
                        >
                            {l.label}
                        </NavLink>
                    ))}
                </div>
            </div>
            <div className="flex-none flex items-center gap-2">
                {getToken() && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            className="btn btn-ghost btn-sm relative"
                            onClick={() => setShowDropdown(!showDropdown)}
                        >
                            Notifications
                            {unreadCount > 0 && (
                                <span className="badge badge-xs badge-error ml-1">
                                    {unreadCount > 9 ? "9+" : unreadCount}
                                </span>
                            )}
                        </button>

                        {showDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-80 bg-base-100 shadow-xl rounded-box border border-base-300 z-50">
                                <div className="p-3 border-b border-base-300 flex justify-between items-center">
                                    <span className="font-semibold text-sm">Notifications</span>
                                    {unreadCount > 0 && (
                                        <button className="btn btn-ghost btn-xs" onClick={markAllRead}>
                                            Mark all read
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-72 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <p className="text-center text-sm text-base-content/50 py-6">No notifications</p>
                                    ) : (
                                        notifications.slice(0, 20).map((n) => (
                                            <div
                                                key={n._id}
                                                className={`px-3 py-2 border-b border-base-200 cursor-pointer hover:bg-base-200 transition text-sm ${!n.read ? "bg-primary/5" : ""}`}
                                                onClick={() => {
                                                    markRead(n._id);
                                                    if (n.eventId) {
                                                        setShowDropdown(false);
                                                        navigate(`/forum/${n.eventId}`);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-xs">{n.eventName || "Event"}</p>
                                                        <p className="text-xs text-base-content/70 truncate">
                                                            <strong>{n.senderName}</strong>: {n.text}
                                                        </p>
                                                        <p className="text-xs text-base-content/40 mt-0.5">
                                                            {new Date(n.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    {!n.read && <span className="badge badge-xs badge-primary mt-1">New</span>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </nav>
    );
}
