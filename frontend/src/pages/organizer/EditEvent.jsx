import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function EditEvent() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [organizerId, setOrganizerId] = useState("");
    const [statusOverride, setStatusOverride] = useState(""); // Added statusOverride state
    const [merchItems, setMerchItems] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const [eventsRes, profileRes] = await Promise.all([
                    api.get("/api/organizer/events"),
                    api.get("/api/organizer/profile")
                ]);
                setOrganizerId(profileRes.data.customOrganizerId || "");
                const ev = eventsRes.data.find((e) => e._id === eventId);
                if (!ev) { setError("Event not found"); return; }
                setStatus(ev.status);
                setStatusOverride(ev.statusOverride || ""); // Keep empty string if no override exists
                setMerchItems((ev.merchItems || []).map(m => ({
                    ...m,
                    stock: m.stock ?? m.stockQty ?? "",
                })));
                setForm({
                    name: ev.name || "",
                    type: ev.type || "NORMAL",
                    description: ev.description || "",
                    eligibility: ev.eligibility || "ALL",
                    startDate: ev.startDate ? toLocalInput(ev.startDate) : "",
                    endDate: ev.endDate ? toLocalInput(ev.endDate) : "",
                    registrationDeadline: ev.registrationDeadline ? toLocalInput(ev.registrationDeadline) : "",
                    registrationLimit: ev.registrationLimit ?? "",
                    registrationFee: ev.registrationFee ?? "",
                    tags: Array.isArray(ev.tags) ? ev.tags.join(", ") : "",
                });
            } catch (err) {
                setError(err.response?.data?.error || "Failed to load event");
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    function toLocalInput(dateStr) {
        const d = new Date(dateStr);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    }

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async () => {
        setError("");

        // Frontend validation for ALL fields
        if (!form.name || !form.description || !form.startDate || !form.endDate || !form.registrationDeadline || form.registrationLimit === "" || form.registrationFee === "" || !form.tags) {
            setError("All fields with an asterisk (*) are mandatory.");
            return;
        }

        if (form.type === "MERCH") {
            if (merchItems.length === 0) {
                setError("Merchandise events must have at least one merch item.");
                return;
            }
            for (const item of merchItems) {
                if (!item.name || item.price === "" || item.stock === "" || item.perUserLimit === "") {
                    setError("All fields for every merch item are mandatory.");
                    return;
                }
            }
        }

        setSaving(true);
        try {
            let payload = {};
            const isOngoingOrCompleted = ["Ongoing", "Completed", "Closed"].includes(status);
            const isPublished = status === "Published";

            if (isOngoingOrCompleted) {
                // strict payload for ongoing/completed
                payload = { statusOverride };
            } else if (isPublished) {
                // strict payload for published
                payload = {
                    description: form.description,
                    registrationDeadline: new Date(form.registrationDeadline).toISOString(),
                    registrationLimit: form.registrationLimit === "" ? undefined : Number(form.registrationLimit),
                    statusOverride: statusOverride || undefined
                };
            } else {
                // full payload for draft
                payload = { ...form };
                if (payload.tags) {
                    payload.tags = payload.tags.split(",").map((t) => t.trim()).filter(Boolean);
                } else {
                    payload.tags = [];
                }
                if (payload.registrationLimit === "") delete payload.registrationLimit;
                else payload.registrationLimit = Number(payload.registrationLimit);
                if (payload.registrationFee === "") delete payload.registrationFee;
                else payload.registrationFee = Number(payload.registrationFee);

                if (form.type === "MERCH") {
                    payload.merchItems = merchItems.map((m) => ({
                        name: m.name,
                        price: Number(m.price),
                        stockQty: Number(m.stock),
                        perUserLimit: Number(m.perUserLimit)
                    }));
                } else {
                    payload.merchItems = []; // clear if somehow switched to NORMAL
                }
            }

            await api.patch(`/api/organizer/events/${eventId}`, payload);
            navigate("/organizer/my-events");
        } catch (err) {
            setError(err.response?.data?.error || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        setError("");

        // Frontend validation for ALL fields
        if (!form.name || !form.description || !form.startDate || !form.endDate || !form.registrationDeadline || form.registrationLimit === "" || form.registrationFee === "" || !form.tags) {
            setError("All fields with an asterisk (*) are mandatory.");
            return;
        }

        if (form.type === "MERCH") {
            if (merchItems.length === 0) {
                setError("Merchandise events must have at least one merch item.");
                return;
            }
            for (const item of merchItems) {
                if (!item.name || item.price === "" || item.stock === "" || item.perUserLimit === "") {
                    setError("All fields for every merch item are mandatory.");
                    return;
                }
            }
        }

        setSaving(true);
        try {
            // Save first, then publish
            const payload = { ...form };
            if (payload.tags) {
                payload.tags = payload.tags.split(",").map((t) => t.trim()).filter(Boolean);
            } else {
                payload.tags = [];
            }
            if (payload.registrationLimit === "") delete payload.registrationLimit;
            else payload.registrationLimit = Number(payload.registrationLimit);
            if (payload.registrationFee === "") delete payload.registrationFee;
            else payload.registrationFee = Number(payload.registrationFee);

            if (form.type === "MERCH") {
                payload.merchItems = merchItems.map((m) => ({
                    name: m.name,
                    price: Number(m.price),
                    stockQty: Number(m.stock),
                    perUserLimit: Number(m.perUserLimit)
                }));
            } else {
                payload.merchItems = [];
            }

            if (statusOverride) {
                payload.statusOverride = statusOverride;
            }

            await api.patch(`/api/organizer/events/${eventId}`, payload);
            await api.post(`/api/organizer/events/${eventId}/publish`);
            navigate("/organizer/my-events");
        } catch (err) {
            setError(err.response?.data?.error || "Publish failed");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        );
    }

    if (!form) {
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="max-w-3xl mx-auto p-6">
                    <p className="text-error">{error || "Event not found"}</p>
                </div>
            </div>
        );
    }

    const isDraft = status === "Draft";
    const isOngoingOrCompleted = ["Ongoing", "Completed", "Closed"].includes(status);

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Edit Event</h1>

                {error && (
                    <div className="alert alert-error text-sm mb-4">
                        <span>{error}</span>
                    </div>
                )}

                <div className="card bg-base-100 shadow">
                    <div className="card-body space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Organizer ID</span></label>
                                <input type="text" className="input input-bordered w-full bg-base-200" value={organizerId} disabled />
                            </div>
                            {!isDraft && (
                                <div className="form-control">
                                    <label className="label"><span className="label-text text-warning font-semibold">Change Status Override</span></label>
                                    <select
                                        className="select select-bordered w-full"
                                        value={statusOverride}
                                        onChange={(e) => setStatusOverride(e.target.value)}
                                    >
                                        <option value="" disabled>-- Select Override ({status}) --</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Event Name *</span></label>
                            <input type="text" name="name" className="input input-bordered w-full" value={form.name} onChange={handleChange} disabled={!isDraft} required />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Type *</span></label>
                                <select name="type" className="select select-bordered w-full" value={form.type} onChange={handleChange} disabled={!isDraft}>
                                    <option value="NORMAL">Normal</option>
                                    <option value="MERCH">Merchandise</option>
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Eligibility</span></label>
                                <select name="eligibility" className="select select-bordered w-full" value={form.eligibility} onChange={handleChange} disabled={!isDraft}>
                                    <option value="ALL">All</option>
                                    <option value="IIIT">IIIT Only</option>
                                    <option value="NON_IIIT">Non-IIIT Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Description *</span></label>
                            <textarea name="description" className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={handleChange} disabled={isOngoingOrCompleted} required />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Start Date *</span></label>
                                <input type="datetime-local" name="startDate" className="input input-bordered w-full" value={form.startDate} onChange={handleChange} disabled={!isDraft} required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">End Date *</span></label>
                                <input type="datetime-local" name="endDate" className="input input-bordered w-full" value={form.endDate} onChange={handleChange} disabled={!isDraft} required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Reg. Deadline *</span></label>
                                <input type="datetime-local" name="registrationDeadline" className="input input-bordered w-full" value={form.registrationDeadline} onChange={handleChange} disabled={isOngoingOrCompleted} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Limit *</span></label>
                                <input type="number" name="registrationLimit" className="input input-bordered w-full" value={form.registrationLimit} onChange={handleChange} disabled={isOngoingOrCompleted} min="1" required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Fee *</span></label>
                                <input type="number" name="registrationFee" className="input input-bordered w-full" value={form.registrationFee} onChange={handleChange} min="0" step="0.01" disabled={!isDraft} required />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Tags (comma-separated) *</span></label>
                            <input type="text" name="tags" className="input input-bordered w-full" value={form.tags} onChange={handleChange} disabled={!isDraft} required />
                        </div>

                        {form.type === "MERCH" && (
                            <div className="border border-base-300 rounded-box p-4 bg-base-200/50 mt-4">
                                <h3 className="font-semibold text-lg mb-2">Merchandise Item * (Max 1)</h3>
                                {merchItems.length === 0 && (
                                    <p className="text-sm text-base-content/60 mb-2">Please add at least one item.</p>
                                )}
                                <div className="space-y-3">
                                    {merchItems.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 items-end bg-base-100 p-3 rounded shadow-sm border border-base-200">
                                            <div className="form-control flex-1">
                                                <label className="label py-1"><span className="label-text text-xs">Item Name/Variant *</span></label>
                                                <input
                                                    type="text"
                                                    className="input input-bordered input-sm w-full"
                                                    value={item.name}
                                                    onChange={(e) => {
                                                        const copy = [...merchItems];
                                                        copy[idx].name = e.target.value;
                                                        setMerchItems(copy);
                                                    }}
                                                    placeholder="T-Shirt L"
                                                    disabled={!isDraft}
                                                    required
                                                />
                                            </div>
                                            <div className="form-control w-24">
                                                <label className="label py-1"><span className="label-text text-xs">Price *</span></label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered input-sm w-full"
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const copy = [...merchItems];
                                                        copy[idx].price = e.target.value;
                                                        setMerchItems(copy);
                                                    }}
                                                    min="0"
                                                    step="0.01"
                                                    disabled={!isDraft}
                                                    required
                                                />
                                            </div>
                                            <div className="form-control w-24">
                                                <label className="label py-1"><span className="label-text text-xs">Stock *</span></label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered input-sm w-full"
                                                    value={item.stock}
                                                    onChange={(e) => {
                                                        const copy = [...merchItems];
                                                        copy[idx].stock = e.target.value;
                                                        setMerchItems(copy);
                                                    }}
                                                    min="1"
                                                    disabled={!isDraft}
                                                    required
                                                />
                                            </div>
                                            <div className="form-control w-24">
                                                <label className="label py-1"><span className="label-text text-xs">Limit/User *</span></label>
                                                <input
                                                    type="number"
                                                    className="input input-bordered input-sm w-full"
                                                    value={item.perUserLimit}
                                                    onChange={(e) => {
                                                        const copy = [...merchItems];
                                                        copy[idx].perUserLimit = e.target.value;
                                                        setMerchItems(copy);
                                                    }}
                                                    min="1"
                                                    disabled={!isDraft}
                                                    required
                                                />
                                            </div>
                                            {isDraft && (
                                                <button
                                                    type="button"
                                                    className="btn btn-error btn-sm btn-square"
                                                    onClick={() => setMerchItems(merchItems.filter((_, i) => i !== idx))}
                                                    title="Remove Item"
                                                >
                                                    x
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {isDraft && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline mt-3"
                                        onClick={() => setMerchItems([...merchItems, { name: "", price: "", stock: "", perUserLimit: "" }])}
                                        disabled={merchItems.length >= 1}
                                    >
                                        + Add Item
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 mt-4 items-center">
                            <button className="btn btn-outline" disabled={saving} onClick={handleSave}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                            {isDraft && (
                                <button className="btn btn-primary" disabled={saving} onClick={handlePublish}>
                                    {saving ? "Publishing..." : "Save and Publish"}
                                </button>
                            )}
                            {form.type === "NORMAL" && (
                                <div className="ml-auto">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => navigate(`/organizer/events/${eventId}/form-builder`)}
                                    >
                                        Registration Form Builder
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
