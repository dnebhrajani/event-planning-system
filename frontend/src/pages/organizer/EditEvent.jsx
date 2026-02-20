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

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/organizer/events");
                const ev = data.find((e) => e._id === eventId);
                if (!ev) { setError("Event not found"); return; }
                setStatus(ev.status);
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
        setSaving(true);
        try {
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
                        <div className="form-control">
                            <label className="label"><span className="label-text">Event Name *</span></label>
                            <input type="text" name="name" className="input input-bordered w-full" value={form.name} onChange={handleChange} disabled={!isDraft} />
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
                            <label className="label"><span className="label-text">Description</span></label>
                            <textarea name="description" className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Start Date</span></label>
                                <input type="datetime-local" name="startDate" className="input input-bordered w-full" value={form.startDate} onChange={handleChange} disabled={!isDraft} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">End Date</span></label>
                                <input type="datetime-local" name="endDate" className="input input-bordered w-full" value={form.endDate} onChange={handleChange} disabled={!isDraft} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Reg. Deadline</span></label>
                                <input type="datetime-local" name="registrationDeadline" className="input input-bordered w-full" value={form.registrationDeadline} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Limit</span></label>
                                <input type="number" name="registrationLimit" className="input input-bordered w-full" value={form.registrationLimit} onChange={handleChange} min="1" />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Registration Fee</span></label>
                                <input type="number" name="registrationFee" className="input input-bordered w-full" value={form.registrationFee} onChange={handleChange} min="0" step="0.01" disabled={!isDraft} />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Tags (comma-separated)</span></label>
                            <input type="text" name="tags" className="input input-bordered w-full" value={form.tags} onChange={handleChange} disabled={!isDraft} />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button className="btn btn-outline" disabled={saving} onClick={handleSave}>
                                {saving ? "Saving..." : "Save Changes"}
                            </button>
                            {isDraft && (
                                <button className="btn btn-primary" disabled={saving} onClick={handlePublish}>
                                    {saving ? "Publishing..." : "Save and Publish"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
