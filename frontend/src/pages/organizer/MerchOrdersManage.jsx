import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function MerchOrdersManage() {
    const { eventId } = useParams();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState(null);
    const [merchForm, setMerchForm] = useState([]);
    const [showItems, setShowItems] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [eventId]);

    const fetchData = async () => {
        try {
            const [evRes, ordRes] = await Promise.all([
                api.get(`/api/organizer/events/${eventId}`),
                api.get(`/api/merch/events/${eventId}/orders`),
            ]);
            setEvent(evRes.data);
            setOrders(ordRes.data);
            setMerchForm(evRes.data.merchItems || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (orderId, status) => {
        try {
            await api.patch(`/api/merch/orders/${orderId}`, { status });
            setOrders((prev) =>
                prev.map((o) => (o._id === orderId ? { ...o, status } : o))
            );
        } catch (err) {
            console.error(err);
        }
    };

    const addMerchItem = () => {
        setMerchForm([...merchForm, { name: "", price: 0, sizes: "" }]);
    };

    const updateMerchItem = (idx, key, value) => {
        setMerchForm(merchForm.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
    };

    const removeMerchItem = (idx) => {
        setMerchForm(merchForm.filter((_, i) => i !== idx));
    };

    const saveMerchItems = async () => {
        setSaving(true);
        try {
            const items = merchForm.map((m) => ({
                name: m.name,
                price: parseFloat(m.price) || 0,
                sizes: m.sizes
                    ? m.sizes.split(",").map((s) => s.trim()).filter(Boolean)
                    : [],
            }));
            await api.put(`/api/merch/events/${eventId}/items`, { merchItems: items });
            fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const statusBadge = (s) => {
        if (s === "approved") return "badge-success";
        if (s === "rejected") return "badge-error";
        return "badge-warning";
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
                <h1 className="text-2xl font-bold">Merch Orders: {event?.name}</h1>

                {/* Merch Items Editor */}
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <div className="flex justify-between items-center">
                            <h2 className="card-title text-lg">Merch Items</h2>
                            <button className="btn btn-sm btn-ghost" onClick={() => setShowItems(!showItems)}>
                                {showItems ? "Hide" : "Edit Items"}
                            </button>
                        </div>
                        {showItems && (
                            <div className="space-y-2 mt-2">
                                {merchForm.map((m, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input
                                            className="input input-bordered input-sm flex-1"
                                            placeholder="Item name"
                                            value={m.name}
                                            onChange={(e) => updateMerchItem(idx, "name", e.target.value)}
                                        />
                                        <input
                                            className="input input-bordered input-sm w-24"
                                            type="number"
                                            placeholder="Price"
                                            value={m.price}
                                            onChange={(e) => updateMerchItem(idx, "price", e.target.value)}
                                        />
                                        <input
                                            className="input input-bordered input-sm flex-1"
                                            placeholder="Sizes (S,M,L,XL)"
                                            value={m.sizes || ""}
                                            onChange={(e) => updateMerchItem(idx, "sizes", e.target.value)}
                                        />
                                        <button className="btn btn-ghost btn-xs text-error" onClick={() => removeMerchItem(idx)}>X</button>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <button className="btn btn-outline btn-sm" onClick={addMerchItem}>+ Add Item</button>
                                    <button className="btn btn-primary btn-sm" onClick={saveMerchItems} disabled={saving}>
                                        {saving ? "Saving..." : "Save Items"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Orders Table */}
                <h2 className="text-lg font-semibold">Orders ({orders.length})</h2>
                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm w-full">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Participant</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Payment Ref</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => (
                                <tr key={o._id}>
                                    <td><code className="text-xs">{o.orderId}</code></td>
                                    <td>{o.participantName}</td>
                                    <td className="text-xs">
                                        {o.items.map((it, i) => (
                                            <div key={i}>{it.name} x{it.quantity}{it.size ? ` (${it.size})` : ""}</div>
                                        ))}
                                    </td>
                                    <td>{o.total}</td>
                                    <td className="text-xs">{o.paymentReference || "-"}</td>
                                    <td><span className={`badge badge-sm ${statusBadge(o.status)}`}>{o.status}</span></td>
                                    <td>
                                        {o.status === "pending" && (
                                            <div className="flex gap-1">
                                                <button className="btn btn-xs btn-success" onClick={() => handleAction(o._id, "approved")}>Approve</button>
                                                <button className="btn btn-xs btn-error" onClick={() => handleAction(o._id, "rejected")}>Reject</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={7} className="text-center py-6 text-base-content/60">No orders yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
