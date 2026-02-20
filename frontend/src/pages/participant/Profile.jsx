import { useEffect, useState } from "react";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const INTEREST_OPTIONS = ["Technical", "Cultural", "Sports", "Academic", "Other"];

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [form, setForm] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/participant/profile");
                setProfile(data);
                setForm({
                    firstName: data.firstName || "",
                    lastName: data.lastName || "",
                    contact: data.contact || "",
                    collegeOrOrg: data.collegeOrOrg || "",
                    areasOfInterest: data.areasOfInterest || [],
                });
            } catch (err) {
                setMsg(err.response?.data?.error || "Failed to load profile");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const toggleInterest = (interest) => {
        setForm((prev) => ({
            ...prev,
            areasOfInterest: prev.areasOfInterest.includes(interest)
                ? prev.areasOfInterest.filter((i) => i !== interest)
                : [...prev.areasOfInterest, interest],
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            const { data } = await api.patch("/api/participant/profile", form);
            setProfile((prev) => ({ ...prev, ...data }));
            setMsg("Profile updated");
        } catch (err) {
            setMsg(err.response?.data?.error || "Update failed");
        } finally {
            setSaving(false);
        }
    };

    const handleUnfollow = async (orgId) => {
        try {
            await api.delete(`/api/participant/follow/${orgId}`);
            setProfile((prev) => ({
                ...prev,
                followedDetails: prev.followedDetails.filter((o) => o._id !== orgId),
            }));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold">My Profile</h1>

                {msg && (
                    <div className={`alert text-sm ${msg.includes("updated") ? "alert-success" : "alert-error"}`}>
                        <span>{msg}</span>
                    </div>
                )}

                <div className="card bg-base-100 shadow">
                    <div className="card-body space-y-3">
                        <p className="text-sm text-base-content/60">
                            Email: <strong>{profile?.email}</strong> (read-only)
                        </p>
                        <p className="text-sm text-base-content/60">
                            Type: <strong>{profile?.participantType}</strong> (read-only)
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label"><span className="label-text">First Name</span></label>
                                <input type="text" name="firstName" className="input input-bordered w-full" value={form.firstName} onChange={handleChange} />
                            </div>
                            <div className="form-control">
                                <label className="label"><span className="label-text">Last Name</span></label>
                                <input type="text" name="lastName" className="input input-bordered w-full" value={form.lastName} onChange={handleChange} />
                            </div>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Contact</span></label>
                            <input type="text" name="contact" className="input input-bordered w-full" value={form.contact} onChange={handleChange} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">College / Organization</span></label>
                            <input type="text" name="collegeOrOrg" className="input input-bordered w-full" value={form.collegeOrOrg} onChange={handleChange} />
                        </div>

                        <div className="form-control">
                            <label className="label"><span className="label-text">Areas of Interest</span></label>
                            <div className="flex flex-wrap gap-2">
                                {INTEREST_OPTIONS.map((i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`btn btn-sm ${form.areasOfInterest?.includes(i) ? "btn-primary" : "btn-outline"}`}
                                        onClick={() => toggleInterest(i)}
                                    >
                                        {i}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button className="btn btn-primary w-full mt-2" disabled={saving} onClick={handleSave}>
                            {saving ? "Saving..." : "Save Profile"}
                        </button>
                    </div>
                </div>

                {/* Followed Clubs */}
                {profile?.followedDetails?.length > 0 && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h2 className="card-title text-lg">Followed Clubs</h2>
                            <div className="space-y-2">
                                {profile.followedDetails.map((org) => (
                                    <div key={org._id} className="flex items-center justify-between border-b border-base-300 pb-2">
                                        <div>
                                            <span className="font-medium">{org.name}</span>
                                            <span className="badge badge-sm badge-ghost ml-2">{org.category}</span>
                                        </div>
                                        <button className="btn btn-xs btn-outline" onClick={() => handleUnfollow(org._id)}>
                                            Unfollow
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
