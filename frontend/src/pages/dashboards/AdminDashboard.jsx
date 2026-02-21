import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { clearToken, clearRole } from "../../auth/storage";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [organizers, setOrganizers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeTab, setActiveTab] = useState("organizers");
    const [resetRequests, setResetRequests] = useState([]);

    // Create organizer form
    const [showForm, setShowForm] = useState(false);
    const [newOrg, setNewOrg] = useState({
        name: "",
        category: "",
        subCategory: "",
        description: "",
        contactEmail: "",
    });
    const [createLoading, setCreateLoading] = useState(false);
    const [createdOrg, setCreatedOrg] = useState(null); // holds the just-created organizer (with password)

    const fetchOrganizers = async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/api/admin/organizers");
            setOrganizers(data);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to load organizers");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrganizers();
        fetchResetRequests();
    }, []);

    const fetchResetRequests = async () => {
        try {
            const { data } = await api.get("/api/password-reset/requests");
            setResetRequests(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleResetAction = async (requestId, action) => {
        try {
            const { data } = await api.patch(`/api/password-reset/requests/${requestId}`, { action });
            if (action === "approve" && data.newPassword) {
                alert(`Password reset approved. New password: ${data.newPassword}`);
            }
            fetchResetRequests();
        } catch (err) {
            setError(err.response?.data?.error || "Action failed");
        }
    };

    const handleLogout = () => {
        clearToken();
        clearRole();
        navigate("/login", { replace: true });
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setCreateLoading(true);
        setError("");
        try {
            const { data } = await api.post("/api/admin/organizers", newOrg);
            setCreatedOrg(data);
            setNewOrg({ name: "", category: "", subCategory: "", description: "", contactEmail: "" });
            fetchOrganizers();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to create organizer");
        } finally {
            setCreateLoading(false);
        }
    };

    const handleToggleDisable = async (org) => {
        try {
            await api.patch(`/api/admin/organizers/${org._id}/disable`, {
                isDisabled: !org.isDisabled,
            });
            fetchOrganizers();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to update organizer");
        }
    };

    const handleDelete = async (org) => {
        if (!window.confirm(`Delete organizer "${org.name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/api/admin/organizers/${org._id}`);
            fetchOrganizers();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to delete organizer");
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
            {/* Navbar */}
            <div className="navbar bg-base-100 shadow-md px-6">
                <div className="flex-1 gap-4">
                    <span className="text-xl font-bold">Admin Panel</span>
                    <div className="hidden sm:flex gap-2 flex-wrap">
                        <button className={`btn btn-ghost btn-sm ${activeTab === 'organizers' ? "btn-active" : ""}`} onClick={() => setActiveTab('organizers')}>Dashboard</button>
                        <button className={`btn btn-ghost btn-sm ${activeTab === 'organizers' ? "btn-active" : ""}`} onClick={() => setActiveTab('organizers')}>Manage Clubs/Organizers</button>
                        <button className={`btn btn-ghost btn-sm ${activeTab === 'resetRequests' ? "btn-active" : ""}`} onClick={() => setActiveTab('resetRequests')}>Password Reset Requests</button>
                    </div>
                </div>
                <div className="flex-none">
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-6 space-y-6">

                {error && (
                    <div className="alert alert-error text-sm">
                        <span>{error}</span>
                        <button className="btn btn-ghost btn-xs" onClick={() => setError("")}>x</button>
                    </div>
                )}

                {activeTab === 'organizers' && (
                    <>
                        {/* Created organizer credentials (shown once) */}
                        {createdOrg && (
                            <div className="alert alert-success shadow-lg">
                                <div className="space-y-1">
                                    <p className="font-bold">Organizer created! Copy these credentials, the password will not be shown again.</p>
                                    <p><strong>Email:</strong> {createdOrg.email}</p>
                                    <p><strong>Password:</strong> <code className="bg-base-300 px-2 py-0.5 rounded">{createdOrg.generatedPassword}</code></p>
                                </div>
                                <button className="btn btn-ghost btn-xs" onClick={() => setCreatedOrg(null)}>Dismiss</button>
                            </div>
                        )}

                        {/* Create organizer toggle */}
                        <div className="flex justify-between items-center">
                            <h2 className="text-lg font-semibold">Organizers</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
                                {showForm ? "Cancel" : "+ New Organizer"}
                            </button>
                        </div>

                        {/* Create form */}
                        {showForm && (
                            <div className="card bg-base-100 shadow">
                                <div className="card-body">
                                    <form onSubmit={handleCreate} className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="form-control">
                                                <label className="label"><span className="label-text">Name *</span></label>
                                                <input
                                                    type="text"
                                                    className="input input-bordered w-full"
                                                    value={newOrg.name}
                                                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                                                    required
                                                />
                                            </div>
                                            <div className="form-control">
                                                <label className="label"><span className="label-text">Category *</span></label>
                                                <input
                                                    type="text"
                                                    className="input input-bordered w-full"
                                                    value={newOrg.category}
                                                    onChange={(e) => setNewOrg({ ...newOrg, category: e.target.value })}
                                                    placeholder="e.g. Technical, Cultural, Sports"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Sub-category</span></label>
                                            <input
                                                type="text"
                                                className="input input-bordered w-full"
                                                value={newOrg.subCategory}
                                                onChange={(e) => setNewOrg({ ...newOrg, subCategory: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Description</span></label>
                                            <textarea
                                                className="textarea textarea-bordered w-full"
                                                value={newOrg.description}
                                                onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-control">
                                            <label className="label"><span className="label-text">Contact Email</span></label>
                                            <input
                                                type="email"
                                                className="input input-bordered w-full"
                                                value={newOrg.contactEmail}
                                                onChange={(e) => setNewOrg({ ...newOrg, contactEmail: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className={`btn btn-primary ${createLoading ? "loading" : ""}`}
                                            disabled={createLoading}
                                        >
                                            {createLoading ? "Creating..." : "Create Organizer"}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Organizer list */}
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <span className="loading loading-spinner loading-lg"></span>
                            </div>
                        ) : organizers.length === 0 ? (
                            <p className="text-center text-base-content/60 py-10">No organizers yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table table-zebra w-full">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Category</th>
                                            <th>Email</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {organizers.map((org) => (
                                            <tr key={org._id}>
                                                <td className="font-medium">{org.name}</td>
                                                <td>{org.category}{org.subCategory ? ` / ${org.subCategory}` : ""}</td>
                                                <td className="text-sm">{org.email}</td>
                                                <td>
                                                    <span className={`badge ${org.isDisabled ? "badge-error" : "badge-success"}`}>
                                                        {org.isDisabled ? "Disabled" : "Active"}
                                                    </span>
                                                </td>
                                                <td className="space-x-2">
                                                    <button
                                                        className={`btn btn-xs ${org.isDisabled ? "btn-success" : "btn-warning"}`}
                                                        onClick={() => handleToggleDisable(org)}
                                                    >
                                                        {org.isDisabled ? "Enable" : "Disable"}
                                                    </button>
                                                    <button
                                                        className="btn btn-xs btn-error"
                                                        onClick={() => handleDelete(org)}
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* Password Reset Requests Tab */}
                {activeTab === 'resetRequests' && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold">Password Reset Requests</h2>
                        {resetRequests.length === 0 ? (
                            <p className="text-center text-base-content/60 py-10">No reset requests.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="table table-zebra w-full">
                                    <thead>
                                        <tr>
                                            <th>Organizer</th>
                                            <th>Email</th>
                                            <th>Status</th>
                                            <th>Requested</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resetRequests.map((r) => (
                                            <tr key={r._id}>
                                                <td>{r.organizerName}</td>
                                                <td className="text-sm">{r.email}</td>
                                                <td>
                                                    <span className={`badge badge-sm ${r.status === 'pending' ? 'badge-warning' :
                                                        r.status === 'approved' ? 'badge-success' : 'badge-error'
                                                        }`}>{r.status}</span>
                                                </td>
                                                <td className="text-sm">{new Date(r.createdAt).toLocaleString()}</td>
                                                <td>
                                                    {r.status === 'pending' && (
                                                        <div className="flex gap-1">
                                                            <button className="btn btn-xs btn-success" onClick={() => handleResetAction(r._id, 'approve')}>Approve</button>
                                                            <button className="btn btn-xs btn-error" onClick={() => handleResetAction(r._id, 'reject')}>Reject</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
