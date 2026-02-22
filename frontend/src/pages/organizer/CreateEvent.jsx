import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const EMPTY = {
    name: "",
    type: "NORMAL",
    description: "",
    eligibility: "ALL",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    registrationLimit: "",
    registrationFee: "",
    tags: "",
};

export default function CreateEvent() {
    const navigate = useNavigate();
    const [form, setForm] = useState(EMPTY);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [organizerId, setOrganizerId] = useState("");
    const [merchItems, setMerchItems] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/organizer/profile");
                setOrganizerId(data.customOrganizerId || "");
            } catch (err) {
                console.error("Failed to fetch profile info");
            }
        })();
    }, []);

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (publish) => {
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

        setLoading(true);
        try {
            const payload = {
                ...form,
                tags: form.tags
                    ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
                    : [],
                registrationLimit: form.registrationLimit
                    ? Number(form.registrationLimit)
                    : null,
                registrationFee: form.registrationFee
                    ? Number(form.registrationFee)
                    : 0,
                ...(form.type === "MERCH" && {
                    merchItems: merchItems.map((m) => ({
                        name: m.name,
                        price: Number(m.price),
                        stock: Number(m.stock),
                        perUserLimit: Number(m.perUserLimit)
                    }))
                })
            };
            const { data } = await api.post("/api/organizer/events", payload);
            if (publish) {
                await api.post(`/api/organizer/events/${data._id}/publish`);
            }
            navigate("/organizer/my-events");
        } catch (err) {
            setError(err.response?.data?.error || "Failed to create event");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Create Event</h1>

                {error && (
                    <div className="alert alert-error text-sm mb-4">
                        <span>{error}</span>
                    </div>
                )}

                <div className="card bg-base-100 shadow">
                    <div className="card-body space-y-3">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Organizer ID</span></label>
                            <input type="text" className="input input-bordered w-full bg-base-200" value={organizerId} disabled />
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Event Name *</span></label>
                            <input type="text" name="name" className="input input-bordered w-full" value={form.name} onChange={handleChange} required />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Type *</span></label>
                                <select name="type" className="select select-bordered w-full" value={form.type} onChange={handleChange}>
                                    <option value="NORMAL">Normal</option>
                                    <option value="MERCH">Merchandise</option>
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Eligibility</span></label>
                                <select name="eligibility" className="select select-bordered w-full" value={form.eligibility} onChange={handleChange}>
                                    <option value="ALL">All</option>
                                    <option value="IIIT">IIIT Only</option>
                                    <option value="NON_IIIT">Non-IIIT Only</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Description *</span></label>
                            <textarea name="description" className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={handleChange} required />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Start Date *</span></label>
                                <input type="datetime-local" name="startDate" className="input input-bordered w-full" value={form.startDate} onChange={handleChange} required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">End Date *</span></label>
                                <input type="datetime-local" name="endDate" className="input input-bordered w-full" value={form.endDate} onChange={handleChange} required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Reg. Deadline *</span></label>
                                <input type="datetime-local" name="registrationDeadline" className="input input-bordered w-full" value={form.registrationDeadline} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Limit *</span></label>
                                <input type="number" name="registrationLimit" className="input input-bordered w-full" value={form.registrationLimit} onChange={handleChange} min="1" required />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Fee *</span></label>
                                <input type="number" name="registrationFee" className="input input-bordered w-full" value={form.registrationFee} onChange={handleChange} min="0" step="0.01" required />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Tags (comma-separated) *</span></label>
                            <input type="text" name="tags" className="input input-bordered w-full" value={form.tags} onChange={handleChange} placeholder="coding, hackathon" required />
                        </div>

                        {form.type === "MERCH" && (
                            <div className="border border-base-300 rounded-box p-4 bg-base-200/50 mt-4">
                                <h3 className="font-semibold text-lg mb-2">Merchandise Items *</h3>
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
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                className="btn btn-error btn-sm btn-square"
                                                onClick={() => setMerchItems(merchItems.filter((_, i) => i !== idx))}
                                                title="Remove Item"
                                            >
                                                x
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline mt-3"
                                    onClick={() => setMerchItems([...merchItems, { name: "", price: "", stock: "", perUserLimit: "" }])}
                                >
                                    + Add Item
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2 mt-4">
                            <button className="btn btn-outline" disabled={loading} onClick={() => submit(false)}>
                                {loading ? "Saving..." : "Save as Draft"}
                            </button>
                            <button className="btn btn-primary" disabled={loading} onClick={() => submit(true)}>
                                {loading ? "Publishing..." : "Save and Publish"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
