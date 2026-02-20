import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function OrganizerDetail() {
    const { organizerId } = useParams();
    const [org, setOrg] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/api/participant/organizers/${organizerId}`);
                setOrg(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [organizerId]);

    const toggleFollow = async () => {
        try {
            if (org.isFollowed) {
                await api.delete(`/api/participant/follow/${org._id}`);
            } else {
                await api.post(`/api/participant/follow/${org._id}`);
            }
            setOrg((prev) => ({ ...prev, isFollowed: !prev.isFollowed }));
        } catch (err) {
            console.error(err);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg"></span></div>
            </div>
        );

    if (!org)
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="max-w-3xl mx-auto p-6"><p className="text-error">Organizer not found</p></div>
            </div>
        );

    const EventRow = ({ e }) => (
        <Link to={`/participant/events/${e._id}`} className="flex items-center justify-between p-3 hover:bg-base-200 rounded-lg transition">
            <div>
                <span className="font-medium">{e.name}</span>
                <span className="badge badge-sm badge-ghost ml-2">{e.type}</span>
            </div>
            <div className="text-sm text-base-content/60">
                {e.startDate ? new Date(e.startDate).toLocaleDateString() : "TBA"}
            </div>
        </Link>
    );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="card-title text-2xl">{org.name}</h1>
                                <span className="badge badge-outline mt-1">{org.category}</span>
                            </div>
                            <button className={`btn btn-sm ${org.isFollowed ? "btn-outline" : "btn-primary"}`} onClick={toggleFollow}>
                                {org.isFollowed ? "Unfollow" : "Follow"}
                            </button>
                        </div>
                        {org.description && <p className="mt-3">{org.description}</p>}
                        {org.contactEmail && <p className="text-sm text-base-content/60 mt-1">Contact: {org.contactEmail}</p>}
                    </div>
                </div>

                {org.upcoming?.length > 0 && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h2 className="card-title text-lg">Upcoming Events</h2>
                            <div className="divide-y divide-base-300">
                                {org.upcoming.map((e) => <EventRow key={e._id} e={e} />)}
                            </div>
                        </div>
                    </div>
                )}

                {org.past?.length > 0 && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h2 className="card-title text-lg">Past Events</h2>
                            <div className="divide-y divide-base-300">
                                {org.past.map((e) => <EventRow key={e._id} e={e} />)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
