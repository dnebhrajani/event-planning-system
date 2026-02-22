import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

const INTEREST_OPTIONS = ["Technical", "Cultural", "Sports", "Academic", "Other"];

export default function Onboarding() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [form, setForm] = useState({ areasOfInterest: [] });
    const [organizers, setOrganizers] = useState([]);
    const [followed, setFollowed] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                // Fetch profile to see if they're already onboarded
                const { data: profile } = await api.get("/api/participant/profile");
                if (profile.onboarded) {
                    navigate("/participant"); // skip if already onboarded
                    return;
                }
                setForm({ areasOfInterest: profile.areasOfInterest || [] });
                setFollowed(profile.followedDetails?.map(f => f._id) || []);

                // Fetch all organizers
                const { data: orgs } = await api.get("/api/participant/organizers");
                setOrganizers(orgs);
            } catch (err) {
                setMsg(err.response?.data?.error || "Failed to load onboarding data");
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    const toggleInterest = (interest) => {
        setForm((prev) => ({
            ...prev,
            areasOfInterest: prev.areasOfInterest.includes(interest)
                ? prev.areasOfInterest.filter((i) => i !== interest)
                : [...prev.areasOfInterest, interest],
        }));
    };

    const toggleFollow = (orgId) => {
        setFollowed((prev) =>
            prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setMsg("");
        try {
            await api.patch("/api/participant/profile", {
                areasOfInterest: form.areasOfInterest,
                onboarded: true // Mark onboarded flag
            });

            // Iterate over selected follows and follow them
            for (const orgId of followed) {
                await api.post(`/api/participant/follow/${orgId}`);
            }

            navigate("/participant");
        } catch (err) {
            setMsg(err.response?.data?.error || "Failed to save preferences");
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = async () => {
        setSaving(true);
        try {
            await api.patch("/api/participant/profile", { onboarded: true });
            navigate("/participant");
        } catch (err) {
            setMsg("Failed to skip");
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200 flex justify-center py-20">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200 py-8 px-4">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold">Welcome to Event Management!</h1>
                    <p className="text-base-content/70">Let's set up your preferences so we can recommend the best events for you.</p>
                </div>

                {msg && (
                    <div className="alert alert-error text-sm">
                        <span>{msg}</span>
                    </div>
                )}

                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h2 className="card-title mb-2">1. What are your areas of interest?</h2>
                        <div className="flex flex-wrap gap-2">
                            {INTEREST_OPTIONS.map((i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className={`btn ${form.areasOfInterest?.includes(i) ? "btn-primary" : "btn-outline"}`}
                                    onClick={() => toggleInterest(i)}
                                >
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h2 className="card-title mb-2">2. Follow Event Organizers you like</h2>
                        <p className="text-sm text-base-content/60 mb-2">Events from these organizers will be prioritized in your feed.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto p-1">
                            {organizers.map(org => (
                                <div key={org._id} className="flex justify-between items-center bg-base-200 p-3 rounded-box">
                                    <div className="truncate pr-2">
                                        <div className="font-semibold text-sm truncate">{org.name}</div>
                                        <div className="text-xs text-base-content/60">{org.category}</div>
                                    </div>
                                    <button
                                        className={`btn btn-sm ${followed.includes(org._id) ? "btn-secondary" : "btn-outline"}`}
                                        onClick={() => toggleFollow(org._id)}
                                    >
                                        {followed.includes(org._id) ? "Following" : "Follow"}
                                    </button>
                                </div>
                            ))}
                            {organizers.length === 0 && (
                                <p className="text-sm text-base-content/50">No organizers found yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 pt-4">
                    <button className="btn btn-outline flex-1" onClick={handleSkip} disabled={saving}>
                        Skip for later
                    </button>
                    <button className="btn btn-primary flex-1" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save & Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}
