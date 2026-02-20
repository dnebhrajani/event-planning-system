import { Navigate } from "react-router-dom";
import { getToken, getRole } from "../auth/storage";

const roleToDashboard = {
    admin: "/admin",
    organizer: "/organizer",
    participant: "/participant",
};

/**
 * ProtectedRoute: ensures the user is authenticated and has the required role.
 * - No token → redirect to /login
 * - Wrong role → redirect to the user's correct dashboard
 */
export default function ProtectedRoute({ allowedRoles, children }) {
    const token = getToken();
    const role = getRole();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
        const correctPath = roleToDashboard[role] || "/login";
        return <Navigate to={correctPath} replace />;
    }

    return children;
}
