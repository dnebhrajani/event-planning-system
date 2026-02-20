import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function Organizers() {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("");

    const fetchOrgs = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (category) params.category = category;
            const { data } = await api.get("/api/participant/organizers", { params });
            setOrgs(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOrgs(); }, [search, category]);

    const toggleFollow = async (orgId, isFollowed) => {
        try {
            if (isFollowed) {
                await api.delete(`/api/participant/follow/${orgId}`);
            } else {
                await api.post(`/api/participant/follow/${orgId}`);
            }
            setOrgs((prev) =>
                prev.map((o) => (o._id === orgId ? { ...o, isFollowed: !isFollowed } : o))
            );
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-5xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Clubs / Organizers</h1>

                <div className="flex gap-3 mb-4">
                    <input
                        type="text"
                        placeholder="Search clubs..."
                        className="input input-bordered flex-1"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select
                        className="select select-bordered"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="Technical">Technical</option>
                        <option value="Cultural">Cultural</option>
                        <option value="Sports">Sports</option>
                        <option value="Academic">Academic</option>
                        <option value="Other">Other</option>
                    </select>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : orgs.length === 0 ? (
                    <p className="text-center text-base-content/60 py-10">No organizers found.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {orgs.map((o) => (
                            <div key={o._id} className="card bg-base-100 shadow">
                                <div className="card-body">
                                    <h2 className="card-title text-lg">{o.name}</h2>
                                    <span className="badge badge-outline badge-sm">{o.category}</span>
                                    {o.description && <p className="text-sm text-base-content/70 line-clamp-2">{o.description}</p>}
                                    <div className="card-actions justify-between items-center mt-2">
                                        <Link to={`/participant/organizers/${o._id}`} className="btn btn-ghost btn-sm">
                                            View Details
                                        </Link>
                                        <button
                                            className={`btn btn-sm ${o.isFollowed ? "btn-outline" : "btn-primary"}`}
                                            onClick={() => toggleFollow(o._id, o.isFollowed)}
                                        >
                                            {o.isFollowed ? "Unfollow" : "Follow"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
