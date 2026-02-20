import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function OrganizerDashboard() {
    const [overview, setOverview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resetStatus, setResetStatus] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [ovRes, rstRes] = await Promise.allSettled([
                    api.get("/api/organizer/overview"),
                    api.get("/api/password-reset/my-request"),
                ]);
                if (ovRes.status === "fulfilled") setOverview(ovRes.value.data);
                if (rstRes.status === "fulfilled") setResetStatus(rstRes.value.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const requestPasswordReset = async () => {
        try {
            await api.post("/api/password-reset/request");
            setResetStatus({ status: "pending" });
        } catch (err) {
            alert(err.response?.data?.error || "Failed to submit request");
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg"></span></div>
            </div>
        );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-4xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold">Organizer Dashboard</h1>

                {overview && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="stat bg-base-100 rounded-box shadow p-4">
                            <div className="stat-title">Total Events</div>
                            <div className="stat-value text-primary">{overview.totalEvents}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-box shadow p-4">
                            <div className="stat-title">Published</div>
                            <div className="stat-value text-success">{overview.publishedEvents}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-box shadow p-4">
                            <div className="stat-title">Upcoming</div>
                            <div className="stat-value text-info">{overview.upcomingEvents}</div>
                        </div>
                        <div className="stat bg-base-100 rounded-box shadow p-4">
                            <div className="stat-title">Registrations</div>
                            <div className="stat-value text-secondary">{overview.totalRegistrations}</div>
                        </div>
                    </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                    <Link to="/organizer/create-event" className="card bg-base-100 shadow hover:shadow-lg transition p-4">
                        <h2 className="font-semibold text-lg">Create Event</h2>
                        <p className="text-sm text-base-content/60">Start a new event, workshop, or merch listing.</p>
                    </Link>
                    <Link to="/organizer/my-events" className="card bg-base-100 shadow hover:shadow-lg transition p-4">
                        <h2 className="font-semibold text-lg">My Events</h2>
                        <p className="text-sm text-base-content/60">View and manage all your events.</p>
                    </Link>
                    <Link to="/organizer/profile" className="card bg-base-100 shadow hover:shadow-lg transition p-4">
                        <h2 className="font-semibold text-lg">Club Profile</h2>
                        <p className="text-sm text-base-content/60">Update club information and Discord webhook.</p>
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
