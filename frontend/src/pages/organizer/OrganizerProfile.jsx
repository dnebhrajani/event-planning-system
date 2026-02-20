import { useEffect, useState } from "react";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function OrganizerProfile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [form, setForm] = useState({});

    // Reset password state
    const [resetReason, setResetReason] = useState("");
    const [resetMsg, setResetMsg] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetRequests, setResetRequests] = useState([]);

    const fetchResetRequests = async () => {
        try {
            const { data } = await api.get("/api/password-reset/my-request");
            setResetRequests(Array.isArray(data) ? data : (data ? [data] : []));
        } catch (err) {
            // ignore if not found
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/organizer/profile");
                setProfile(data);
                setForm({
                    name: data.name || "",
                    category: data.category || "",
                    subCategory: data.subCategory || "",
                    description: data.description || "",
                    contactEmail: data.contactEmail || "",
                    discordWebhookUrl: data.discordWebhookUrl || "",
                });
            } catch (err) {
                setMsg(err.response?.data?.error || "Failed to load profile");
            } finally {
                setLoading(false);
            }
            await fetchResetRequests();
        })();
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            const { data } = await api.patch("/api/organizer/profile", form);
            setProfile(data);
            setMsg("Profile updated");
        } catch (err) {
            setMsg(err.response?.data?.error || "Update failed");
        } finally {
            setSaving(false);
        }
    };

    const handleResetRequest = async () => {
        if (!resetReason.trim()) return;
        setResetLoading(true);
        setResetMsg("");
        try {
            await api.post("/api/password-reset/request", { reason: resetReason });
            setResetMsg("Password reset request submitted successfully.");
            setResetReason("");
            await fetchResetRequests();
        } catch (err) {
            setResetMsg(err.response?.data?.error || "Failed to submit reset request.");
        } finally {
            setResetLoading(false);
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
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold">Organizer Profile</h1>

                {msg && (
                    <div className={`alert text-sm ${msg.includes("updated") ? "alert-success" : "alert-error"}`}>
                        <span>{msg}</span>
                    </div>
                )}

                <div className="card bg-base-100 shadow">
                    <div className="card-body space-y-3">
                        <p className="text-sm text-base-content/60">
                            Login Email: <strong>{profile?.email}</strong> (read-only)
                        </p>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Club Name</span></label>
                            <input type="text" name="name" className="input input-bordered w-full" value={form.name} onChange={handleChange} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">Category</span></label>
                                <select name="category" className="select select-bordered w-full" value={form.category} onChange={handleChange}>
                                    <option value="Technical">Technical</option>
                                    <option value="Cultural">Cultural</option>
                                    <option value="Sports">Sports</option>
                                    <option value="Academic">Academic</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Sub-Category</span></label>
                                <input type="text" name="subCategory" className="input input-bordered w-full" value={form.subCategory} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Description</span></label>
                            <textarea name="description" className="textarea textarea-bordered w-full" rows={3} value={form.description} onChange={handleChange} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Contact Email</span></label>
                            <input type="email" name="contactEmail" className="input input-bordered w-full" value={form.contactEmail} onChange={handleChange} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Discord Webhook URL</span></label>
                            <input type="url" name="discordWebhookUrl" className="input input-bordered w-full" value={form.discordWebhookUrl} onChange={handleChange} placeholder="https://discord.com/api/webhooks/..." />
                            <label className="label"><span className="label-text-alt">Events will be announced to this webhook when published</span></label>
                        </div>

                        <button className="btn btn-primary w-full" disabled={saving} onClick={handleSave}>
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </div>

                <div className="divider">Password Management</div>

                <div className="card bg-base-100 shadow mt-6">
                    <div className="card-body">
                        <h2 className="card-title text-lg">Request Password Reset</h2>
                        {resetMsg && (
                            <div className={`alert text-sm ${resetMsg.includes("success") ? "alert-success" : "alert-error"}`}>
                                <span>{resetMsg}</span>
                            </div>
                        )}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Reason for Reset <span className="text-error">*</span></span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered w-full"
                                rows={2}
                                placeholder="E.g., Forgot password, security breach..."
                                value={resetReason}
                                onChange={(e) => setResetReason(e.target.value)}
                            />
                        </div>
                        <button
                            className={`btn btn-warning w-full mt-4 ${resetLoading ? "loading" : ""}`}
                            disabled={resetLoading || !resetReason.trim()}
                            onClick={handleResetRequest}
                        >
                            {resetLoading ? "Submitting..." : "Submit Reset Request"}
                        </button>

                        {resetRequests.length > 0 && (
                            <div className="mt-6">
                                <h3 className="font-semibold text-sm mb-2">My Requests</h3>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra table-sm w-full">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Reason</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resetRequests.map(req => (
                                                <tr key={req._id}>
                                                    <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                                                    <td className="max-w-[200px] truncate" title={req.reason}>{req.reason}</td>
                                                    <td>
                                                        <span className={`badge badge-sm ${req.status === 'APPROVED' ? 'badge-success' : req.status === 'REJECTED' ? 'badge-error' : 'badge-warning'}`}>
                                                            {req.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
