import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import jsQR from "jsqr";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

export default function Attendance() {
    const { eventId } = useParams();
    const [event, setEvent] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [scanInput, setScanInput] = useState("");
    const [manualTicket, setManualTicket] = useState("");
    const [manualReason, setManualReason] = useState("");
    const [scanMsg, setScanMsg] = useState("");
    const [scanMsgType, setScanMsgType] = useState("success"); // "success" | "error"
    const [activeTab, setActiveTab] = useState("scanner"); // "scanner" | "dashboard" | "export"
    const [cameraActive, setCameraActive] = useState(false);
    const [scanning, setScanning] = useState(false);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const animRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const [evRes, attRes] = await Promise.all([
                api.get(`/api/organizer/events/${eventId}`),
                api.get(`/api/attendance/events/${eventId}`),
            ]);
            setEvent(evRes.data);
            setDashboard(attRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const showMsg = (msg, type = "success") => {
        setScanMsg(msg);
        setScanMsgType(type);
    };

    // ── Camera QR scanning ──────────────────────────────────────────────────
    const startCamera = async () => {
        try {
            setCameraActive(true); // Render video element first
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
            });
            streamRef.current = stream;
            // Wait a tick for the video element to mount after setCameraActive
            setTimeout(() => {
                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                video.setAttribute("playsinline", "");
                video.play().catch(() => { });
                // Start scanning at 4fps
                animRef.current = setInterval(() => {
                    if (!video || video.readyState < 2) return;
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });
                    if (code) {
                        stopCamera();
                        setScanInput(code.data);
                        submitScan(code.data);
                    }
                }, 250);
            }, 100);
        } catch (err) {
            setCameraActive(false);
            showMsg("Camera access denied or not available.", "error");
        }
    };

    const stopCamera = () => {
        setCameraActive(false);
        if (animRef.current) {
            clearInterval(animRef.current);
            animRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    };


    // ── Submit scan ─────────────────────────────────────────────────────────
    const submitScan = async (payload) => {
        try {
            let body;
            try {
                JSON.parse(payload);
                body = { qrPayload: payload };
            } catch {
                body = { ticketId: payload };
            }
            const { data } = await api.post(`/api/attendance/events/${eventId}/scan`, body);
            showMsg(`Attendance marked: ${data.participantName || data.ticketId}`, "success");
            setScanInput("");
            fetchData();
        } catch (err) {
            showMsg(err.response?.data?.error || "Scan failed", "error");
        }
    };

    const handleScan = () => {
        if (!scanInput.trim()) return;
        submitScan(scanInput);
    };

    // ── Manual mark ─────────────────────────────────────────────────────────
    const handleManual = async () => {
        if (!manualTicket.trim()) return;
        try {
            await api.post(`/api/attendance/events/${eventId}/manual`, {
                ticketId: manualTicket,
                note: manualReason || "Manual override",
            });
            showMsg("Manually marked attendance", "success");
            setManualTicket("");
            setManualReason("");
            fetchData();
        } catch (err) {
            showMsg(err.response?.data?.error || "Manual mark failed", "error");
        }
    };

    // ── CSV export ──────────────────────────────────────────────────────────
    const exportCsv = async () => {
        try {
            const res = await api.get(`/api/attendance/events/${eventId}/export.csv`, {
                responseType: "blob",
            });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement("a");
            a.href = url;
            a.download = `attendance-${event?.name || "event"}.csv`;
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
                <div className="flex justify-center py-20">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        );

    const scannedCount = dashboard?.scannedCount || 0;
    const notScannedCount = dashboard?.notScannedCount || 0;
    const totalTickets = dashboard?.totalTickets || 0;
    const scanned = dashboard?.scanned || [];
    const notScanned = dashboard?.notScanned || [];
    const attendancePercent = totalTickets > 0 ? Math.round((scannedCount / totalTickets) * 100) : 0;

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-6xl mx-auto p-6 space-y-4">
                {/* Header */}
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <h1 className="text-2xl font-bold">Attendance: {event?.name}</h1>
                    <Link to={`/organizer/events/${eventId}/manage`} className="btn btn-sm btn-ghost">
                        Back to Event
                    </Link>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="stat bg-base-100 rounded-box shadow p-4">
                        <div className="stat-title">Total Tickets</div>
                        <div className="stat-value text-primary">{totalTickets}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-box shadow p-4">
                        <div className="stat-title">Scanned</div>
                        <div className="stat-value text-success">{scannedCount}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-box shadow p-4">
                        <div className="stat-title">Not Scanned</div>
                        <div className="stat-value text-warning">{notScannedCount}</div>
                    </div>
                    <div className="stat bg-base-100 rounded-box shadow p-4">
                        <div className="stat-title">Attendance</div>
                        <div className="stat-value text-info">{attendancePercent}%</div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="w-full">
                    <progress className="progress progress-success w-full" value={scannedCount} max={totalTickets || 1}></progress>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-100 w-fit">
                    <button className={`tab ${activeTab === "scanner" ? "tab-active" : ""}`} onClick={() => setActiveTab("scanner")}>Scanner</button>
                    <button className={`tab ${activeTab === "dashboard" ? "tab-active" : ""}`} onClick={() => setActiveTab("dashboard")}>Live Dashboard</button>
                    <button className={`tab ${activeTab === "export" ? "tab-active" : ""}`} onClick={() => setActiveTab("export")}>Export</button>
                </div>

                {/* Scan message */}
                {scanMsg && (
                    <div className={`alert text-sm ${scanMsgType === "error" ? "alert-error" : "alert-success"}`}>
                        <span>{scanMsg}</span>
                        <button className="btn btn-ghost btn-xs" onClick={() => setScanMsg("")}>✕</button>
                    </div>
                )}

                {/* Scanner Tab */}
                {activeTab === "scanner" && (
                    <div className="grid sm:grid-cols-2 gap-4">
                        {/* Camera / QR Scan */}
                        <div className="card bg-base-100 shadow">
                            <div className="card-body">
                                <h2 className="card-title text-lg">Camera QR Scanner</h2>
                                {cameraActive ? (
                                    <div className="space-y-2">
                                        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                                            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                                            <canvas ref={canvasRef} className="hidden" />
                                            {/* Scan overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-48 h-48 border-2 border-success rounded-lg opacity-60"></div>
                                            </div>
                                        </div>
                                        <button className="btn btn-error btn-sm w-full" onClick={stopCamera}>
                                            Stop Camera
                                        </button>
                                    </div>
                                ) : (
                                    <button className="btn btn-primary btn-sm" onClick={startCamera}>
                                        Open Camera Scanner
                                    </button>
                                )}


                            </div>
                        </div>

                        {/* Manual Override */}
                        <div className="card bg-base-100 shadow">
                            <div className="card-body">
                                <h2 className="card-title text-lg">Manual Override</h2>
                                <p className="text-xs text-base-content/60">For exceptional cases — requires audit reason.</p>
                                <div className="form-control">
                                    <label className="label py-0"><span className="label-text text-xs">Ticket ID</span></label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        placeholder="e.g. FEL-abc123"
                                        value={manualTicket}
                                        onChange={(e) => setManualTicket(e.target.value)}
                                    />
                                </div>
                                <div className="form-control">
                                    <label className="label py-0"><span className="label-text text-xs">Reason (audit log)</span></label>
                                    <input
                                        type="text"
                                        className="input input-bordered w-full"
                                        placeholder="e.g. Lost QR code, verified identity"
                                        value={manualReason}
                                        onChange={(e) => setManualReason(e.target.value)}
                                    />
                                </div>
                                <button
                                    className="btn btn-outline btn-sm mt-1"
                                    onClick={handleManual}
                                    disabled={!manualTicket.trim()}
                                >
                                    Mark Manually
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Live Dashboard Tab */}
                {activeTab === "dashboard" && (
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Scanned */}
                            <div className="card bg-base-100 shadow">
                                <div className="card-body max-h-96 overflow-y-auto">
                                    <h3 className="card-title text-sm text-success">Scanned ({scannedCount})</h3>
                                    {scanned.length === 0 ? (
                                        <p className="text-sm text-base-content/50">No one scanned yet</p>
                                    ) : (
                                        <table className="table table-xs">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Ticket</th>
                                                    <th>Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {scanned.map((s) => (
                                                    <tr key={s.ticketId}>
                                                        <td>{s.participantName}</td>
                                                        <td><code className="text-xs">{s.ticketId}</code></td>
                                                        <td className="text-xs">{new Date(s.scannedAt).toLocaleTimeString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>

                            {/* Not Scanned */}
                            <div className="card bg-base-100 shadow">
                                <div className="card-body max-h-96 overflow-y-auto">
                                    <h3 className="card-title text-sm text-warning">Not Yet Scanned ({notScannedCount})</h3>
                                    {notScanned.length === 0 ? (
                                        <p className="text-sm text-base-content/50">Everyone has been scanned!</p>
                                    ) : (
                                        <table className="table table-xs">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Ticket</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {notScanned.map((s) => (
                                                    <tr key={s.ticketId}>
                                                        <td>{s.participantName}</td>
                                                        <td><code className="text-xs">{s.ticketId}</code></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>

                        <button className="btn btn-sm btn-outline" onClick={fetchData}>Refresh Dashboard</button>
                    </div>
                )}

                {/* Export Tab */}
                {activeTab === "export" && (
                    <div className="card bg-base-100 shadow">
                        <div className="card-body">
                            <h3 className="card-title text-lg">Export Attendance</h3>
                            <p className="text-sm text-base-content/60 mb-2">
                                Download a CSV file containing all attendance records including name, email, ticket ID, method, and timestamp.
                            </p>
                            <button className="btn btn-primary btn-sm w-fit" onClick={exportCsv}>
                                Download CSV
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
