import Navbar from "../../components/Navbar";

export default function ParticipantDashboard() {
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
