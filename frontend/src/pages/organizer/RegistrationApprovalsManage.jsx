import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function RegistrationApprovalsManage() {
    const { eventId } = useParams();
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [openingFile, setOpeningFile] = useState(null);

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        try {
            const [evRes, regRes] = await Promise.all([
                api.get(`/api/organizer/events/${eventId}`),
                api.get(`/api/organizer/events/${eventId}/registrations`),
            ]);
            setEvent(evRes.data);

            // Only list registrations that have a payment proof or are PENDING for clarity
            const filteredRegs = regRes.data.filter(r => r.paymentProofUrl || r.status === "PENDING" || r.status === "rejected" || r.status === "registered");
            setRegistrations(filteredRegs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (regId, action) => {
        setProcessingId(regId);
        try {
            await api.post(`/api/organizer/events/${eventId}/registrations/${regId}/${action}`, {});
            const newStatus = action === "approve" ? "registered" : "rejected";
            setRegistrations((prev) =>
                prev.map((r) => (r._id === regId ? { ...r, status: newStatus } : r))
            );
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingId(null);
        }
    };

    const statusBadge = (s) => {
        if (s === "registered" || s === "APPROVED") return "badge-success";
        if (s === "cancelled" || s === "REJECTED" || s === "rejected") return "badge-error";
        return "badge-warning";
    };

    const handleViewFile = async (url) => {
        if (!url) return;
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
            window.open(url, '_blank', 'noopener,noreferrer');
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
            <div className="max-w-5xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold">Registration Approvals: {event?.name}</h1>

                <h2 className="text-lg font-semibold">Registrations ({registrations.length})</h2>
                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Expected Fee</th>
                                <th>Payment Ref</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.map((r) => (
                                <tr key={r._id}>
                                    <td>{r.participantName}</td>
                                    <td>{r.participantEmail}</td>
                                    <td>₹{event?.registrationFee || 0}</td>
                                    <td className="text-xs">
                                        {r.paymentProofUrl ? (
                                            <button
                                                onClick={() => handleViewFile(r.paymentProofUrl)}
                                                disabled={openingFile === r.paymentProofUrl}
                                                className="text-primary link link-hover break-all flex items-center gap-1 text-left"
                                            >
                                                {openingFile === r.paymentProofUrl ? (
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                )}
                                                View Uploaded File
                                            </button>
                                        ) : (
                                            <span className="text-base-content/50">-</span>
                                        )}
                                    </td>
                                    <td><span className={`badge badge-sm ${statusBadge(r.status)}`}>{r.status}</span></td>
                                    <td>
                                        {r.status === "PENDING" && (
                                            <div className="flex gap-1">
                                                <button
                                                    className="btn btn-xs btn-success"
                                                    disabled={processingId === r._id}
                                                    onClick={() => handleAction(r._id, "approve")}
                                                >
                                                    {processingId === r._id ? "..." : "Approve"}
                                                </button>
                                                <button
                                                    className="btn btn-xs btn-error"
                                                    disabled={processingId === r._id}
                                                    onClick={() => handleAction(r._id, "reject")}
                                                >
                                                    {processingId === r._id ? "..." : "Reject"}
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {registrations.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-6 text-base-content/60">No registrations yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
