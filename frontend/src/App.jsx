import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import AdminDashboard from "./pages/dashboards/AdminDashboard.jsx";
import OrganizerDashboard from "./pages/dashboards/OrganizerDashboard.jsx";
import ParticipantDashboard from "./pages/dashboards/ParticipantDashboard.jsx";
import CreateEvent from "./pages/organizer/CreateEvent.jsx";
import EditEvent from "./pages/organizer/EditEvent.jsx";
import OrganizerEvents from "./pages/organizer/OrganizerEvents.jsx";
import OrganizerProfile from "./pages/organizer/OrganizerProfile.jsx";
import ManageEvent from "./pages/organizer/ManageEvent.jsx";
import Attendance from "./pages/organizer/Attendance.jsx";
import FormBuilder from "./pages/organizer/FormBuilder.jsx";
import MerchOrdersManage from "./pages/organizer/MerchOrdersManage.jsx";
import BrowseEvents from "./pages/participant/BrowseEvents.jsx";
import EventDetails from "./pages/participant/EventDetails.jsx";
import MyEvents from "./pages/participant/MyEvents.jsx";
import Profile from "./pages/participant/Profile.jsx";
import Organizers from "./pages/participant/Organizers.jsx";
import OrganizerDetail from "./pages/participant/OrganizerDetail.jsx";
import MerchOrders from "./pages/participant/MerchOrders.jsx";
import Forum from "./pages/Forum.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Admin */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                        <AdminDashboard />
                    </ProtectedRoute>
                }
            />

            {/* Organizer */}
            <Route
                path="/organizer"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <OrganizerDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/profile"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <OrganizerProfile />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/create-event"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <CreateEvent />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/my-events"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <OrganizerEvents />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/events/:eventId/edit"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <EditEvent />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/events/:eventId/manage"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <ManageEvent />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/events/:eventId/attendance"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <Attendance />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/events/:eventId/form-builder"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <FormBuilder />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/organizer/events/:eventId/merch-orders"
                element={
                    <ProtectedRoute allowedRoles={["organizer"]}>
                        <MerchOrdersManage />
                    </ProtectedRoute>
                }
            />

            {/* Participant */}
            <Route
                path="/participant"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <ParticipantDashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/participant/profile"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <Profile />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/participant/events"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <BrowseEvents />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/participant/events/:eventId"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <EventDetails />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/participant/my-events"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <MyEvents />
                    </ProtectedRoute>
                }
            />
            {import.meta.env.DEV && (
                <>
                    <Route
                        path="/admin/clubs"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <Organizers />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin/clubs/:organizerId"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <OrganizerDetail />
                            </ProtectedRoute>
                        }
                    />
                </>
            )}
            <Route
                path="/participant/merch-orders"
                element={
                    <ProtectedRoute allowedRoles={["participant"]}>
                        <MerchOrders />
                    </ProtectedRoute>
                }
            />

            {/* Shared */}
            <Route
                path="/forum/:eventId"
                element={
                    <ProtectedRoute allowedRoles={["participant", "organizer", "admin"]}>
                        <Forum />
                    </ProtectedRoute>
                }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    );
}
