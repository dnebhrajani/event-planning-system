import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const statusColor = {
    Draft: "badge-warning",
    Published: "badge-success",
    Ongoing: "badge-info",
    Completed: "badge-neutral",
};

export default function OrganizerEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/api/organizer/events");
            setEvents(data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to load events");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handlePublish = async (id) => {
        try {
            await api.post(`/api/organizer/events/${id}/publish`);
            fetchEvents();
        } catch (err) {
            setError(err.response?.data?.error || "Publish failed");
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-5xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">My Events</h1>

                {error && (
                    <div className="alert alert-error text-sm mb-4">
                        <span>{error}</span>
                        <button className="btn btn-ghost btn-xs" onClick={() => setError("")}>x</button>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-10">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : events.length === 0 ? (
                    <p className="text-center text-base-content/60 py-10">No events created yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Type</th>
                                    <th>Start</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((e) => (
                                    <tr key={e._id}>
                                        <td className="font-medium">{e.name}</td>
                                        <td>{e.type}</td>
                                        <td>{e.startDate ? new Date(e.startDate).toLocaleDateString() : "-"}</td>
                                        <td>
                                            <span className={`badge ${statusColor[e.status] || "badge-ghost"}`}>
                                                {e.status}
                                            </span>
                                        </td>
                                        <td className="flex gap-1">
                                            {e.status === "Draft" && (
                                                <>
                                                    <Link to={`/organizer/events/${e._id}/edit`} className="btn btn-xs btn-outline">
                                                        Edit
                                                    </Link>
                                                    <button className="btn btn-xs btn-primary" onClick={() => handlePublish(e._id)}>
                                                        Publish
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
