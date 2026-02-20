import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import jsQR from "jsqr";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function Attendance() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scanInput, setScanInput] = useState("");
    const [manualTicket, setManualTicket] = useState("");
    const [scanMsg, setScanMsg] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const [evRes, attRes] = await Promise.all([
                    api.get(`/api/organizer/events/${eventId}`),
                    api.get(`/api/attendance/events/${eventId}`),
                ]);
                setEvent(evRes.data);
                setRecords(attRes.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setScanMsg("");
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.width = img.width;
                canvas.height = img.height;
                context.drawImage(img, 0, 0, img.width, img.height);
                const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    setScanInput(code.data);
                    setScanMsg("QR Code successfully scanned! Click Mark Attendance.");
                } else {
                    setScanMsg("No QR code found in the image.");
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };

    const handleScan = async () => {
        setScanMsg("");
        try {
            let body;
            // Try to parse as JSON (QR payload)
            try {
                const parsed = JSON.parse(scanInput);
                body = { qrPayload: scanInput };
            } catch {
                // Not JSON, treat as ticket ID
                body = { ticketId: scanInput };
            }
            const { data } = await api.post(`/api/attendance/events/${eventId}/scan`, body);
            setScanMsg(`Marked: ${data.participantName || data.ticketId}`);
            setScanInput("");
            // Refresh list
            const { data: attData } = await api.get(`/api/attendance/events/${eventId}`);
            setRecords(attData);
        } catch (err) {
            setScanMsg(err.response?.data?.error || "Scan failed");
        }
    };

    const handleManual = async () => {
        setScanMsg("");
        try {
            await api.post(`/api/attendance/events/${eventId}/manual`, { ticketId: manualTicket });
            setScanMsg("Manually marked attendance");
            setManualTicket("");
            const { data: attData } = await api.get(`/api/attendance/events/${eventId}`);
            setRecords(attData);
        } catch (err) {
            setScanMsg(err.response?.data?.error || "Manual mark failed");
        }
    };

    const exportCsv = async () => {
        try {
            const res = await api.get(`/api/attendance/events/${eventId}/export.csv`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = "attendance.csv";
            a.click();
            URL.revokeObjectURL(url);
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

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-5xl mx-auto p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Attendance: {event?.name}</h1>
                    <Link to={`/organizer/events/${eventId}/manage`} className="btn btn-sm btn-ghost">Back to Event</Link>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    {/* QR / Ticket Scan */}
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h2 className="card-title text-lg">Scan QR / Enter Ticket ID</h2>
                            <textarea
                                className="textarea textarea-bordered w-full"
                                rows={2}
                                placeholder='Paste QR payload or ticket ID (e.g. FEL-...)'
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                            />

                            <div className="divider my-1">OR</div>

                            <div className="form-control mb-2">
                                <label className="label py-0 mb-1">
                                    <span className="label-text text-xs">Upload QR Image</span>
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="file-input file-input-bordered file-input-sm w-full"
                                    onChange={handleImageUpload}
                                />
                            </div>

                            <button className="btn btn-primary btn-sm mt-1" onClick={handleScan} disabled={!scanInput.trim()}>
                                Mark Attendance
                            </button>
                        </div>
                    </div>

                    {/* Manual */}
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h2 className="card-title text-lg">Manual Mark by Ticket ID</h2>
                            <input
                                type="text"
                                className="input input-bordered w-full"
                                placeholder="Ticket ID"
                                value={manualTicket}
                                onChange={(e) => setManualTicket(e.target.value)}
                            />
                            <button className="btn btn-outline btn-sm mt-1" onClick={handleManual} disabled={!manualTicket.trim()}>
                                Mark Manually
                            </button>
                        </div>
                    </div>
                </div>

                {scanMsg && (
                    <div className={`alert text-sm ${scanMsg.includes("failed") || scanMsg.includes("Already") || scanMsg.includes("No QR") ? "alert-error" : "alert-success"}`}>
                        <span>{scanMsg}</span>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Attendance Records ({records.length})</h2>
                    <button className="btn btn-sm btn-outline" onClick={exportCsv}>Export CSV</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="table table-zebra table-sm w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Ticket</th>
                                <th>Method</th>
                                <th>Scanned At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r) => (
                                <tr key={r._id}>
                                    <td>{r.participantName}</td>
                                    <td><code className="text-xs">{r.ticketId}</code></td>
                                    <td><span className="badge badge-sm badge-ghost">{r.method}</span></td>
                                    <td>{new Date(r.scannedAt).toLocaleString()}</td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr><td colSpan={4} className="text-center py-6 text-base-content/60">No attendance records yet</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
