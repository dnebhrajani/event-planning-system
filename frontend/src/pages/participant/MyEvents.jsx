import { useEffect, useState } from "react";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

let QRCodeSVG = null;
try {
    const mod = await import("qrcode.react");
    QRCodeSVG = mod.QRCodeSVG;
} catch (_) {
    // qrcode.react not installed
}

export default function MyEvents() {
    const [categories, setCategories] = useState({ upcoming: [], normal: [], merch: [], completed: [], cancelled: [] });
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState(null);
    const [activeTab, setActiveTab] = useState("upcoming");

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/participant/my-events");
                if (Array.isArray(data)) {
                    setCategories({ upcoming: data, normal: [], merch: [], completed: [], cancelled: [] });
                } else {
                    setCategories({
                        upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
                        normal: Array.isArray(data.normal) ? data.normal : [],
                        merch: Array.isArray(data.merch) ? data.merch : [],
                        completed: Array.isArray(data.completed) ? data.completed : [],
                        cancelled: Array.isArray(data.cancelled) ? data.cancelled : []
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const toggleQR = (id) => setExpanded((prev) => (prev === id ? null : id));

    const renderRegistrationRow = (r) => (
        <tr key={r.registrationId || r._id}>
            <td className="font-medium">{r.event?.name}</td>
            <td>{r.event?.organizerName}</td>
            <td>{r.event?.startDate ? new Date(r.event.startDate).toLocaleDateString() : "-"}</td>
            <td>
                <code className="bg-base-300 px-2 py-0.5 rounded text-sm">{r.ticketId}</code>
            </td>
            <td>
                <span className={`badge ${r.status === 'Cancelled' ? 'badge-error' : 'badge-outline'}`}>{r.status || r.event?.status}</span>
            </td>
            {QRCodeSVG && (
                <td>
                    <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => toggleQR(r.registrationId || r._id)}
                        disabled={r.status === 'Cancelled'}
                    >
                        {expanded === (r.registrationId || r._id) ? "Hide" : "Show"}
                    </button>
                </td>
            )}
        </tr>
    );

    const renderMerchRow = (o) => (
        <tr key={o._id || o.orderId}>
            <td className="font-medium">{o.event?.name}</td>
            <td>
                <div className="text-sm">
                    {Array.isArray(o.items) && o.items.map((it, idx) => (
                        <div key={idx}>{it.name} (Qty: {it.quantity}{it.size ? `, Size: ${it.size}` : ''})</div>
                    ))}
                </div>
            </td>
            <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "-"}</td>
            <td>
                {o.tickets && o.tickets.length > 0 ? (
                    <div className="flex flex-col gap-1">
                        {o.tickets.map(t => <code key={t} className="bg-base-300 px-2 py-0.5 rounded text-xs">{t}</code>)}
                    </div>
                ) : (
                    <span className="text-xs text-base-content/50">Pending</span>
                )}
            </td>
            <td>
                <span className={`badge ${o.status === "APPROVED" ? "badge-success" : o.status === "REJECTED" ? "badge-error" : "badge-warning"} badge-sm`}>{o.status}</span>
            </td>
            {QRCodeSVG && (
                <td>
                    {o.tickets && o.tickets.length > 0 ? (
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => toggleQR(o._id || o.orderId)}
                        >
                            {expanded === (o._id || o.orderId) ? "Hide" : "Show"}
                        </button>
                    ) : (
                        <span className="text-xs opacity-50">N/A</span>
                    )}
                </td>
            )}
        </tr>
    );

    const currentItems = categories[activeTab] || [];

    const tabs = [
        { id: "upcoming", label: "Upcoming / Active" },
        { id: "normal", label: "Normal Registrations" },
        { id: "merch", label: "Merch Orders" },
        { id: "completed", label: "Completed Events" },
        { id: "cancelled", label: "Cancelled / Rejected" },
    ];

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-6xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">My Events</h1>

                {/* Tabs */}
                <div className="tabs tabs-boxed mb-6 overflow-x-auto flex-nowrap whitespace-nowrap">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            className={`tab ${activeTab === t.id ? "tab-active" : ""}`}
                            onClick={() => { setActiveTab(t.id); setExpanded(null); }}
                        >
                            {t.label} ({categories[t.id]?.length || 0})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : currentItems.length === 0 ? (
                    <p className="text-center text-base-content/60 py-10 border border-base-300 rounded-lg bg-base-100">No records found for "{tabs.find(t => t.id === activeTab)?.label}".</p>
                ) : (
                    <div className="card bg-base-100 shadow overflow-hidden">
                        <div className="overflow-x-auto w-full">
                            <table className="table table-zebra w-full whitespace-nowrap">
                                <thead>
                                    <tr>
                                        <th>Event Name</th>
                                        <th>{activeTab === "merch" || (activeTab === "cancelled" && currentItems[0]?.items) ? "Items Ordered" : "Organizer"}</th>
                                        <th>Date</th>
                                        <th>Ticket ID(s)</th>
                                        <th>Status</th>
                                        {QRCodeSVG && <th>QR</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map((item) => (activeTab === "merch" || item.items) ? renderMerchRow(item) : renderRegistrationRow(item))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* QR expanded viewer */}
                {QRCodeSVG && expanded && (() => {
                    const item = currentItems.find(i => (i.registrationId || i._id || i.orderId) === expanded);
                    if (!item) return null;

                    const ticketId = item.ticketId || (item.tickets && item.tickets[0]) || null;
                    if (!ticketId) return null;

                    const eventId = item.event?._id || item.eventId;
                    const qrValue = JSON.stringify({ ticketId, eventId });

                    return (
                        <div className="mt-6 flex flex-col items-center p-6 card bg-base-100 shadow border border-primary/20">
                            <h3 className="font-bold mb-1">{item.event?.name}</h3>
                            <p className="text-sm mb-4 font-medium opacity-80">Ticket: {ticketId}</p>
                            <div className="bg-white p-3 rounded-xl shadow-inner inline-block">
                                <QRCodeSVG value={qrValue} size={200} />
                            </div>
                        </div>
                    );
                })()}

            </div>
        </div>
    );
}
