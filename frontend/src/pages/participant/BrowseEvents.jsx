import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function BrowseEvents() {
    const [events, setEvents] = useState([]);
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [eventType, setEventType] = useState("");
    const [eligibility, setEligibility] = useState("");
    const [filterCategory, setFilterCategory] = useState("ALL"); // ALL or FOLLOWED
    const [dateRange, setDateRange] = useState({ start: "", end: "" });

    const fetchAllData = async () => {
        try {
            setLoading(true);

            // Fetch Trending
            const trendingRes = await api.get("/api/participant/events/trending");
            setTrending(trendingRes.data || []);

            // Construct filter params
            const params = {};
            if (search) params.search = search;
            if (eventType) params.eventType = eventType;
            if (eligibility) params.eligibility = eligibility;
            if (filterCategory === "FOLLOWED") params.followedOnly = "true";
            if (dateRange.start) params.startAfter = dateRange.start;
            if (dateRange.end) params.endBefore = dateRange.end;

            // Fetch Main Events
            const { data } = await api.get("/api/participant/events", { params });
            setEvents(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
        // eslint-disable-next-line
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        fetchAllData();
    };

    const EventCard = ({ e, isTrending }) => (
        <Link to={`/participant/events/${e._id}`} className={`card bg-base-100 shadow hover:shadow-lg transition-transform ${isTrending ? "border border-primary min-w-[280px]" : ""}`}>
            <div className="card-body">
                {isTrending && <div className="badge badge-primary mb-2">Trending</div>}
                <h2 className="card-title text-lg leading-tight">{e.name}</h2>
                <p className="text-sm text-base-content/60">{e.organizerName}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    <span className="badge badge-outline">{e.type}</span>
                    <span className="badge badge-outline">{e.eligibility}</span>
                </div>
                <div className="text-sm mt-3 pt-3 border-t border-base-200">
                    <p>{e.startDate ? new Date(e.startDate).toLocaleDateString() : "TBA"}</p>
                    {isTrending ? (
                        <p className="text-primary font-medium">{e.recentRegistrations} recent signups</p>
                    ) : (e.registrationCount > 0 && (
                        <p className="opacity-75">{e.registrationCount} registered</p>
                    ))}
                </div>
            </div>
        </Link>
    );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-6xl mx-auto p-6 space-y-8">

                {/* Search & Filters */}
                <div className="bg-base-100 p-4 rounded-xl shadow-sm">
                    <form onSubmit={handleSearch} className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-3">
                            <input type="text" className="input input-bordered flex-1 min-w-[200px]" placeholder="Search events or organizers..." value={search} onChange={(e) => setSearch(e.target.value)} />
                            <select className="select select-bordered" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                                <option value="ALL">All Events & Organizers</option>
                                <option value="FOLLOWED">Followed Clubs Only</option>
                            </select>
                            <button type="submit" className="btn btn-primary px-8">Filter</button>
                        </div>
                        <div className="flex flex-wrap gap-3 text-sm items-center">
                            <select className="select select-bordered select-sm" value={eventType} onChange={(e) => setEventType(e.target.value)}>
                                <option value="">Event Type (All)</option>
                                <option value="NORMAL">Normal</option>
                                <option value="MERCH">Merchandise</option>
                            </select>
                            <select className="select select-bordered select-sm" value={eligibility} onChange={(e) => setEligibility(e.target.value)}>
                                <option value="">Eligibility (All)</option>
                                <option value="IIIT">IIIT Only</option>
                                <option value="NON_IIIT">Non-IIIT Only</option>
                            </select>
                            <div className="flex items-center gap-2">
                                <span className="text-base-content/60">From:</span>
                                <input type="date" className="input input-bordered input-sm" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-base-content/60">To:</span>
                                <input type="date" className="input input-bordered input-sm" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} />
                            </div>
                        </div>
                    </form>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><span className="loading loading-spinner loading-lg text-primary"></span></div>
                ) : (
                    <>
                        {/* Trending Section */}
                        {trending.length > 0 && !search && !eventType && !eligibility && !dateRange.start && !dateRange.end && filterCategory === "ALL" && (
                            <section>
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">Trending (Top 5 / 24h)</h2>
                                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                                    {trending.map(e => (
                                        <div key={e._id} className="snap-start shrink-0">
                                            <EventCard e={e} isTrending={true} />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Main Feed */}
                        <section>
                            <div className="flex justify-between items-end mb-4 border-b border-base-300 pb-2">
                                <h2 className="text-xl font-bold flex flex-col sm:flex-row sm:items-center gap-2">
                                    For You
                                    <span className="text-sm font-normal text-base-content/60">
                                        (Ordered by your preferences and interests)
                                    </span>
                                </h2>
                            </div>

                            {events.length === 0 ? (
                                <p className="text-center text-base-content/60 py-10 bg-base-100 rounded-xl outline-dashed outline-1 outline-base-300">
                                    No events found matching these filters. Try broadening your search.
                                </p>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {events.map((e) => <EventCard key={e._id} e={e} />)}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
