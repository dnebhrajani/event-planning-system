import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function BrowseEvents() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [eventType, setEventType] = useState("");
    const [eligibility, setEligibility] = useState("");

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const params = {};
            if (search) params.search = search;
            if (eventType) params.eventType = eventType;
            if (eligibility) params.eligibility = eligibility;
            const { data } = await api.get("/api/participant/events", { params });
            setEvents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchEvents();
    };

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-5xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-4">Browse Events</h1>

                <form onSubmit={handleSearch} className="flex flex-wrap gap-3 mb-6">
                    <input
                        type="text"
                        className="input input-bordered flex-1 min-w-[200px]"
                        placeholder="Search events or organizers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <select className="select select-bordered" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                        <option value="">All Types</option>
                        <option value="NORMAL">Normal</option>
                        <option value="MERCH">Merchandise</option>
                    </select>
                    <select className="select select-bordered" value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
                        <option value="">All Eligibility</option>
                        <option value="IIIT">IIIT Only</option>
                        <option value="NON_IIIT">Non-IIIT Only</option>
                    </select>
                    <button type="submit" className="btn btn-primary">Search</button>
                </form>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                ) : events.length === 0 ? (
                    <p className="text-center text-base-content/60 py-10">No events found.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {events.map((e) => (
                            <Link key={e._id} to={`/participant/events/${e._id}`} className="card bg-base-100 shadow hover:shadow-lg transition-shadow">
                                <div className="card-body">
                                    <h2 className="card-title text-lg">{e.name}</h2>
                                    <p className="text-sm text-base-content/60">{e.organizerName}</p>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="badge badge-outline">{e.type}</span>
                                        <span className="badge badge-outline">{e.eligibility}</span>
                                    </div>
                                    <div className="text-sm mt-2">
                                        {e.startDate ? new Date(e.startDate).toLocaleDateString() : "TBA"}
                                        {e.registrationCount > 0 && (
                                            <span className="ml-2 text-base-content/50">
                                                {e.registrationCount} registered
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
