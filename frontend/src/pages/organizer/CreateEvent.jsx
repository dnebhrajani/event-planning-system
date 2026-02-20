import { useState } from "react";
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

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (publish) => {
        setError("");
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
                            <label className="label"><span className="label-text">Description</span></label>
                            <textarea name="description" className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={handleChange} />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Start Date</span></label>
                                <input type="datetime-local" name="startDate" className="input input-bordered w-full" value={form.startDate} onChange={handleChange} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">End Date</span></label>
                                <input type="datetime-local" name="endDate" className="input input-bordered w-full" value={form.endDate} onChange={handleChange} />
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
                                <input type="number" name="registrationFee" className="input input-bordered w-full" value={form.registrationFee} onChange={handleChange} min="0" step="0.01" />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Tags (comma-separated)</span></label>
                            <input type="text" name="tags" className="input input-bordered w-full" value={form.tags} onChange={handleChange} placeholder="coding, hackathon" />
                        </div>

                        <div className="flex gap-3 pt-2">
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
