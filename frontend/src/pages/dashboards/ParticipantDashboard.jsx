import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function ParticipantDashboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/api/participant/profile");
                if (!data.onboarded) {
                    navigate("/participant/onboarding");
                }
            } catch (err) {
                console.error("Error checking onboarding status", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    if (loading) return (
        <div className="min-h-screen bg-base-200 flex justify-center py-20">
            <span className="loading loading-spinner loading-lg"></span>
        </div>
    );

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-2">Participant Dashboard</h1>
                <p className="text-base-content/60">
                    Use the navigation above to browse events or view your registrations.
                </p>
            </div>
        </div>
    );
}
