import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function ManageEvent() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("overview");
    const [pFilter, setPFilter] = useState({ participantType: "", attendance: "" });
    const [selectedParticipant, setSelectedParticipant] = useState(null);
    const [openingFile, setOpeningFile] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const [evRes, anRes] = await Promise.all([
                    api.get(`/api/organizer/events/${eventId}`),
                    api.get(`/api/organizer/events/${eventId}/analytics`),
                ]);
                setEvent(evRes.data);
                setAnalytics(anRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    const fetchParticipants = async () => {
        try {
            const params = {};
            if (pFilter.participantType) params.participantType = pFilter.participantType;
            if (pFilter.attendance) params.attendance = pFilter.attendance;
            const { data } = await api.get(`/api/organizer/events/${eventId}/participants`, { params });
            setParticipants(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (tab === "participants") fetchParticipants();
    }, [tab, pFilter]);

    const handleViewFile = async (url) => {
        if (!url) return;

        // If it's an explicitly authenticated PDF, we MUST fetch a signed URL to bypass Cloudinary public ACL blocks
        if (url.toLowerCase().endsWith(".pdf") && url.includes("/authenticated/")) {
            setOpeningFile(url);
            try {
                const { data } = await api.get('/api/forms/signed-url', { params: { url } });
                window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
                console.error("Error fetching signed URL:", err);
                alert("Failed to securely open PDF. Please try again.");
            } finally {
                setOpeningFile(null);
            }
        } else {
            // Legacy files or standard publicly exposed images open fine normally
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const exportCsv = async () => {
        try {
            const res = await api.get(`/api/organizer/events/${eventId}/export-participants.csv`, {
                responseType: "blob",
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${event?.name || "participants"}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg"></span></div>
            </div>
        );

    if (!event)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="max-w-3xl mx-auto p-6"><p className="text-error">Event not found</p></div>
            </div>
        );

    const statusColor = { Draft: "badge-warning", Published: "badge-success", Ongoing: "badge-info", Completed: "badge-neutral" };

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-5xl mx-auto p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">{event.name}</h1>
                    <span className={`badge ${statusColor[event.status] || "badge-ghost"}`}>{event.status}</span>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-bordered">
                    {["overview", "analytics", "participants"].map((t) => (
                        <button key={t} className={`tab ${tab === t ? "tab-active" : ""}`} onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                {tab === "overview" && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><span className="font-semibold">Type:</span> {event.type}</div>
                                <div><span className="font-semibold">Eligibility:</span> {event.eligibility}</div>
                                <div><span className="font-semibold">Start:</span> {event.startDate ? new Date(event.startDate).toLocaleString() : "-"}</div>
                                <div><span className="font-semibold">End:</span> {event.endDate ? new Date(event.endDate).toLocaleString() : "-"}</div>
                                <div><span className="font-semibold">Deadline:</span> {event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleString() : "-"}</div>
                                <div><span className="font-semibold">Registrations:</span> {event.registrationCount}{event.registrationLimit ? ` / ${event.registrationLimit}` : ""}</div>
                                <div><span className="font-semibold">Fee:</span> {event.registrationFee || "Free"}</div>
                            </div>
                            {event.description && <p className="mt-4">{event.description}</p>}
                            <div className="flex gap-2 mt-4 flex-wrap">
                                {event.status === "Draft" && (
                                    <Link to={`/organizer/events/${eventId}/edit`} className="btn btn-sm btn-outline">Edit</Link>
                                )}
                                <Link to={`/organizer/events/${eventId}/attendance`} className="btn btn-sm btn-outline">Attendance</Link>
                                <Link to={`/organizer/events/${eventId}/form-builder`} className="btn btn-sm btn-outline">Form Builder</Link>
                                <Link to={`/organizer/events/${eventId}/merch-orders`} className="btn btn-sm btn-outline">Merch Orders</Link>
                                <Link to={`/forum/${eventId}`} className="btn btn-sm btn-outline">Discussion Forum</Link>
                            </div>
                        </div>
                    </div>
                )}

                {tab === "analytics" && analytics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="stat bg-base-100 shadow rounded-box">
                            <div className="stat-title">Registrations</div>
                            <div className="stat-value text-2xl">{analytics.totalRegistrations}</div>
                            <div className="stat-desc">Revenue: ₹{analytics.registrationRevenue || 0}</div>
                        </div>
                        <div className="stat bg-base-100 shadow rounded-box">
                            <div className="stat-title">Attended</div>
                            <div className="stat-value text-2xl">{analytics.attendedCount}</div>
                            <div className="stat-desc">{analytics.completionRate}% completion</div>
                        </div>
                        <div className="stat bg-base-100 shadow rounded-box">
                            <div className="stat-title">IIIT / Non-IIIT</div>
                            <div className="stat-value text-2xl">{analytics.iiitCount} / {analytics.nonIiitCount}</div>
                        </div>
                        <div className="stat bg-base-100 shadow rounded-box">
                            <div className="stat-title">Total Revenue</div>
                            <div className="stat-value text-2xl text-success">₹{analytics.totalRevenue || (analytics.registrationRevenue || 0) + (analytics.merchRevenue || 0)}</div>
                        </div>

                        {/* Merch Analytics */}
                        {analytics.merchOrdersTotal !== undefined && (
                            <>
                                <div className="stat bg-base-100 shadow rounded-box">
                                    <div className="stat-title">Merch Orders</div>
                                    <div className="stat-value text-2xl">{analytics.merchOrdersTotal}</div>
                                    <div className="stat-desc text-warning">{analytics.merchOrdersPending} Pending</div>
                                </div>
                                <div className="stat bg-base-100 shadow rounded-box">
                                    <div className="stat-title">Merch Revenue</div>
                                    <div className="stat-value text-2xl">₹{analytics.merchRevenue || 0}</div>
                                    <div className="stat-desc text-success">{analytics.merchOrdersApproved} Approved</div>
                                </div>
                            </>
                        )}

                        {analytics.fillRate !== null && analytics.fillRate !== undefined && (
                            <div className="stat bg-base-100 shadow rounded-box col-span-2">
                                <div className="stat-title">Registration Fill Rate</div>
                                <div className="stat-value text-2xl">{analytics.fillRate}%</div>
                                <progress className="progress progress-primary w-full" value={analytics.fillRate} max="100"></progress>
                            </div>
                        )}
                    </div>
                )}

                {tab === "participants" && (
                    <div className="space-y-3">
                        <div className="flex gap-2 flex-wrap items-center">
                            <select className="select select-bordered select-sm" value={pFilter.participantType} onChange={(e) => setPFilter((p) => ({ ...p, participantType: e.target.value }))}>
                                <option value="">All Types</option>
                                <option value="IIIT">IIIT</option>
                                <option value="NON_IIIT">NON_IIIT</option>
                            </select>
                            <select className="select select-bordered select-sm" value={pFilter.attendance} onChange={(e) => setPFilter((p) => ({ ...p, attendance: e.target.value }))}>
                                <option value="">All Attendance</option>
                                <option value="attended">Attended</option>
                                <option value="not_attended">Not Attended</option>
                            </select>
                            <button className="btn btn-sm btn-outline ml-auto" onClick={exportCsv}>Export CSV</button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="table table-zebra table-sm w-full">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Type</th>
                                        <th>Ticket</th>
                                        <th>Attended</th>
                                        <th>Answers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participants.map((p) => (
                                        <tr key={p.registrationId}>
                                            <td>{p.firstName} {p.lastName}</td>
                                            <td>{p.email}</td>
                                            <td><span className="badge badge-sm badge-outline">{p.participantType}</span></td>
                                            <td><code className="text-xs">{p.ticketId}</code></td>
                                            <td>{p.attended ? "Yes" : "No"}</td>
                                            <td>
                                                {p.formAnswers || p.paymentProofUrl ? (
                                                    <button
                                                        className="btn btn-xs btn-outline"
                                                        onClick={() => setSelectedParticipant(p)}
                                                    >
                                                        View Details
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-base-content/50">None</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {participants.length === 0 && <p className="text-center py-6 text-base-content/60">No participants yet</p>}
                        </div>
                    </div>
                )}

                {/* Answers Modal */}
                {selectedParticipant && (
                    <div className="modal modal-open">
                        <div className="modal-box">
                            <h3 className="font-bold text-lg mb-4">
                                Participant Details: {selectedParticipant.firstName} {selectedParticipant.lastName}
                            </h3>
                            <div className="space-y-3">
                                {selectedParticipant.formAnswers && Object.entries(selectedParticipant.formAnswers).map(([question, answer]) => (
                                    <div key={question} className="bg-base-200 p-3 rounded-lg">
                                        <p className="text-xs font-semibold text-base-content/70 mb-1">{question}</p>
                                        {typeof answer === 'string' && answer.startsWith('http') ? (
                                            <button
                                                onClick={() => handleViewFile(answer)}
                                                disabled={openingFile === answer}
                                                className="text-primary link link-hover break-all flex items-center gap-1 text-left"
                                            >
                                                {openingFile === answer ? (
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                )}
                                                View Uploaded File
                                            </button>
                                        ) : typeof answer === 'boolean' ? (
                                            <p>{answer ? "Yes" : "No"}</p>
                                        ) : (
                                            <p>{String(answer)}</p>
                                        )}
                                    </div>
                                ))}

                                {selectedParticipant.paymentProofUrl && (
                                    <div className="bg-base-200 p-3 rounded-lg">
                                        <p className="text-xs font-semibold text-base-content/70 mb-1">Payment Proof</p>
                                        <button
                                            onClick={() => handleViewFile(selectedParticipant.paymentProofUrl)}
                                            disabled={openingFile === selectedParticipant.paymentProofUrl}
                                            className="text-primary link link-hover break-all flex items-center gap-1 text-left"
                                        >
                                            {openingFile === selectedParticipant.paymentProofUrl ? (
                                                <span className="loading loading-spinner loading-xs"></span>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            )}
                                            View Uploaded Payment Proof
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="modal-action">
                                <button className="btn" onClick={() => setSelectedParticipant(null)}>Close</button>
                            </div>
                        </div>
                        <div className="modal-backdrop" onClick={() => setSelectedParticipant(null)}></div>
                    </div>
                )}
            </div>
        </div>
    );
}
