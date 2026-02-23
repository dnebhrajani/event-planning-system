import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function ParticipantDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [resetStatus, setResetStatus] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [profileRes, rstRes] = await Promise.allSettled([
                    api.get("/api/participant/profile"),
                    api.get("/api/password-reset/my-request"),
                ]);
                if (profileRes.status === "fulfilled" && !profileRes.value.data.onboarded) {
                    navigate("/participant/onboarding");
                }
                if (rstRes.status === "fulfilled") setResetStatus(rstRes.value.data);
            } catch (err) {
                console.error("Error checking onboarding status", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    const requestPasswordReset = async () => {
        try {
            await api.post("/api/password-reset/request");
            setResetStatus({ status: "pending" });
        } catch (err) {
            alert(err.response?.data?.error || "Failed to submit request");
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-base-200 flex justify-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold mb-2">Participant Dashboard</h1>
                <p className="text-base-content/60">
                    Use the navigation above to browse events or view your registrations.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                    <Link to="/participant/browse" className="card bg-base-100 shadow hover:shadow-lg transition p-4">
                        <h2 className="font-semibold text-lg">Browse Events</h2>
                        <p className="text-sm text-base-content/60">Discover and register for events.</p>
                    </Link>
                    <Link to="/participant/my-events" className="card bg-base-100 shadow hover:shadow-lg transition p-4">
                        <h2 className="font-semibold text-lg">My Events</h2>
                        <p className="text-sm text-base-content/60">View your registrations and tickets.</p>
                    </Link>
                </div>

                {/* Password Reset */}
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h2 className="card-title text-lg">Password Reset</h2>
                        {resetStatus?.status === "pending" ? (
                            <p className="text-warning text-sm">Your password reset request is pending admin approval.</p>
                        ) : resetStatus?.status === "approved" ? (
                            <div className="text-sm">
                                <p className="text-success mb-1">Password was reset by admin.</p>
                                {resetStatus.newPassword && (
                                    <p>New password: <code className="bg-base-300 px-2 py-0.5 rounded">{resetStatus.newPassword}</code></p>
                                )}
                            </div>
                        ) : resetStatus?.status === "rejected" ? (
                            <div>
                                <p className="text-error text-sm mb-2">Your last request was rejected.</p>
                                <button className="btn btn-sm btn-outline" onClick={requestPasswordReset}>Request Again</button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-sm text-base-content/60 mb-2">Request admin to reset your password.</p>
                                <button className="btn btn-sm btn-outline" onClick={requestPasswordReset}>Request Password Reset</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
