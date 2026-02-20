import { useEffect, useState } from "react";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function MerchOrders() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/merch/my-orders");
                setOrders(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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
            <div className="max-w-4xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">My Merch Orders</h1>

                {orders.length === 0 ? (
                    <p className="text-center text-base-content/60 py-10">No orders yet.</p>
                ) : (
                    <div className="space-y-3">
                        {orders.map((o) => (
                            <div key={o._id} className="card bg-base-100 shadow">
                                <div className="card-body p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="font-semibold">{o.eventName}</h2>
                                            <p className="text-xs text-base-content/60">Order: {o.orderId}</p>
                                        </div>
                                        <span className={`badge ${statusBadge(o.status)}`}>{o.status}</span>
                                    </div>
                                    <div className="mt-2 text-sm">
                                        {o.items.map((item, i) => (
                                            <div key={i} className="flex justify-between">
                                                <span>{item.name} x{item.quantity} {item.size ? `(${item.size})` : ""}</span>
                                                <span>{item.price * item.quantity}</span>
                                            </div>
                                        ))}
                                        <div className="divider my-1"></div>
                                        <div className="flex justify-between font-semibold">
                                            <span>Total</span>
                                            <span>{o.total}</span>
                                        </div>
                                    </div>
                                    {o.paymentReference && (
                                        <p className="text-xs mt-1 text-base-content/60">Payment ref: {o.paymentReference}</p>
                                    )}
                                    <p className="text-xs text-base-content/50 mt-1">{new Date(o.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
