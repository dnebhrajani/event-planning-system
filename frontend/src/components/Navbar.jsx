import { NavLink, useNavigate } from "react-router-dom";
import { clearToken, clearRole, getRole } from "../auth/storage";

const links = {
    admin: [
        { to: "/admin", label: "Dashboard" },
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
        { to: "/participant/organizers", label: "Clubs" },
        { to: "/participant/merch-orders", label: "Merch Orders" },
    ],
};

export default function Navbar() {
    const navigate = useNavigate();
    const role = getRole();
    const items = links[role] || [];

    const handleLogout = () => {
        clearToken();
        clearRole();
        navigate("/login", { replace: true });
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
            <div className="flex-none">
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                    Logout
                </button>
            </div>
        </nav>
    );
}
