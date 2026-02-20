import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

let QRCodeSVG = null;
try {
    const mod = await import("qrcode.react");
    QRCodeSVG = mod.QRCodeSVG;
} catch (_) {
    // qrcode.react not installed — QR rendering will be skipped
}

export default function EventDetails() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [regLoading, setRegLoading] = useState(false);
    const [error, setError] = useState("");
    const [registerResult, setRegisterResult] = useState(null);
    const [calLinks, setCalLinks] = useState(null);

    // Form state
    const [formFields, setFormFields] = useState([]);
    const [formAnswers, setFormAnswers] = useState({});
    const [fileUploading, setFileUploading] = useState({});

    useEffect(() => {
        (async () => {
            try {
                const [evRes, calRes, formRes] = await Promise.allSettled([
                    api.get(`/api/participant/events/${eventId}`),
                    api.get(`/api/calendar/events/${eventId}/links`),
                    api.get(`/api/forms/events/${eventId}`),
                ]);
                if (evRes.status === "fulfilled") setEvent(evRes.value.data);
                else setError(evRes.reason?.response?.data?.error || "Failed to load event");
                if (calRes.status === "fulfilled") setCalLinks(calRes.value.data);
                if (formRes.status === "fulfilled" && formRes.value.data.fields?.length > 0) {
                    setFormFields(formRes.value.data.fields);
                }
            } catch (err) {
                setError(err.response?.data?.error || "Failed to load event");
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    const handleAnswerChange = (label, value) => {
        setFormAnswers((prev) => ({ ...prev, [label]: value }));
    };

    const handleFileUpload = async (label, file) => {
        if (!file) return;
        setFileUploading((prev) => ({ ...prev, [label]: true }));
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result.split(",")[1];
                const { data } = await api.post("/api/forms/upload", {
                    filename: file.name,
                    data: base64,
                    mimetype: file.type,
                });
                handleAnswerChange(label, data.url);
                setFileUploading((prev) => ({ ...prev, [label]: false }));
            };
            reader.readAsDataURL(file);
        } catch (err) {
            setError("File upload failed");
            setFileUploading((prev) => ({ ...prev, [label]: false }));
        }
    };

    const handleRegister = async () => {
        setRegLoading(true);
        setError("");
        try {
            if (event.type === "MERCH") {
                // Construct merch items payload
                const items = [];
                event.merchItems.forEach((item, idx) => {
                    const qty = parseInt(formAnswers[`merch_qty_${idx}`] || 0, 10);
                    if (qty > 0) {
                        items.push({
                            itemId: item.id || item._id, // fallback depending on backend projection
                            quantity: qty,
                            size: formAnswers[`merch_variant_${idx}`] || null
                        });
                    }
                });

                if (items.length === 0) {
                    throw new Error("Please select at least one item to order.");
                }

                if (!formAnswers["paymentProofUrl"]) {
                    throw new Error("Payment proof is required.");
                }

                const body = {
                    items,
                    paymentProofUrl: formAnswers["paymentProofUrl"]
                };

                const { data } = await api.post(`/api/merch/events/${eventId}/order`, body);
                setRegisterResult(data);
                setEvent((prev) => ({
                    ...prev,
                    alreadyRegistered: true,
                    registrationOpen: false,
                }));
            } else {
                const body = {};
                // Only include formAnswers if form fields exist
                if (formFields.length > 0) {
                    body.formAnswers = formAnswers;
                }
                const { data } = await api.post(`/api/participant/events/${eventId}/register`, body);
                setRegisterResult(data);
                setEvent((prev) => ({
                    ...prev,
                    alreadyRegistered: true,
                    registrationOpen: false,
                    registrationCount: (prev.registrationCount || 0) + 1,
                }));
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || "Registration failed");
        } finally {
            setRegLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="flex justify-center py-20">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="min-h-screen bg-base-200">
                <Navbar />
                <div className="max-w-3xl mx-auto p-6">
                    <p className="text-error">{error || "Event not found"}</p>
                </div>
            </div>
        );
    }

    const qrValue = registerResult?.qrPayload || registerResult?.ticketId || "";
    const anyFileUploading = Object.values(fileUploading).some(Boolean);

    return (
        <div className="min-h-screen bg-base-200">
            <Navbar />
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
                    Back
                </button>

                {/* Success banner + QR */}
                {registerResult && (
                    <div className="card bg-base-100 shadow border border-success/30">
                        <div className="card-body items-center text-center">
                            <h2 className="text-xl font-bold text-success">Registration Successful</h2>
                            <p className="text-sm mt-1">
                                Ticket ID: <code className="bg-base-300 px-2 py-0.5 rounded">{registerResult.ticketId}</code>
                            </p>
                            {QRCodeSVG && qrValue && (
                                <div className="mt-4">
                                    <QRCodeSVG value={qrValue} size={200} />
                                </div>
                            )}
                            <p className="text-xs text-base-content/50 mt-2">
                                {registerResult.emailSent
                                    ? "Confirmation email sent."
                                    : "Email could not be sent (SMTP not configured)."}
                            </p>
                            <Link to="/participant/my-events" className="btn btn-outline btn-sm mt-3">
                                Go to My Events
                            </Link>
                        </div>
                    </div>
                )}

                {/* Event details card */}
                <div className="card bg-base-100 shadow">
                    <div className="card-body">
                        <h1 className="card-title text-2xl">{event.name}</h1>
                        <p className="text-sm text-base-content/60">by {event.organizerName}</p>

                        <div className="flex flex-wrap gap-2 mt-2">
                            <span className="badge badge-outline">{event.type}</span>
                            <span className="badge badge-outline">{event.eligibility}</span>
                            <span className="badge badge-info">{event.status}</span>
                        </div>

                        {event.description && (
                            <p className="mt-4">{event.description}</p>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                            <div>
                                <span className="font-semibold">Start:</span>{" "}
                                {event.startDate ? new Date(event.startDate).toLocaleString() : "-"}
                            </div>
                            <div>
                                <span className="font-semibold">End:</span>{" "}
                                {event.endDate ? new Date(event.endDate).toLocaleString() : "-"}
                            </div>
                            <div>
                                <span className="font-semibold">Deadline:</span>{" "}
                                {event.registrationDeadline ? new Date(event.registrationDeadline).toLocaleString() : "-"}
                            </div>
                            <div>
                                <span className="font-semibold">Registered:</span>{" "}
                                {event.registrationCount}{event.registrationLimit ? ` / ${event.registrationLimit}` : ""}
                            </div>
                            {event.registrationFee > 0 && (
                                <div>
                                    <span className="font-semibold">Fee:</span> {event.registrationFee}
                                </div>
                            )}
                        </div>

                        {event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                                {event.tags.map((t) => (
                                    <span key={t} className="badge badge-sm badge-ghost">{t}</span>
                                ))}
                            </div>
                        )}

                        {error && (
                            <div className="alert alert-error text-sm mt-4">
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Dynamic registration form + register button */}
                        <div className="mt-6">
                            {registerResult ? (
                                <div className="text-success font-medium">
                                    <p>You have successfully {event.type === "MERCH" ? "placed an order" : "registered"} for this event.</p>
                                    {event.type === "MERCH" && <p className="text-sm mt-1 text-base-content/70">Your order is pending approval by the organizer.</p>}
                                </div>
                            ) : event.alreadyRegistered && event.type !== "MERCH" ? (
                                <p className="text-success font-medium">You are registered for this event.</p>
                            ) : event.registrationOpen ? (
                                <div className="space-y-4">
                                    {event.type === "MERCH" ? (
                                        <div className="space-y-4 p-4 border border-base-300 rounded-lg">
                                            <h3 className="font-semibold">Merchandise Order Form</h3>

                                            {/* Merch Items Selection */}
                                            {event.merchItems && event.merchItems.length > 0 ? (
                                                <div className="space-y-3">
                                                    {event.merchItems.map((item, idx) => (
                                                        <div key={idx} className="flex flex-col sm:flex-row gap-2 border-b border-base-200 pb-3 mb-2 last:border-0 last:pb-0 last:mb-0">
                                                            <div className="flex-1">
                                                                <h4 className="font-medium">{item.name}</h4>
                                                                <p className="text-sm text-base-content/60">₹{item.price}</p>
                                                                {item.perUserLimit && (
                                                                    <p className="text-xs text-info">Limit: {item.perUserLimit} per user (Remaining: {item.remaining !== null ? item.remaining : item.perUserLimit})</p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-2 items-center">
                                                                {item.sizes && item.sizes.length > 0 && (
                                                                    <select
                                                                        className="select select-bordered select-sm w-24"
                                                                        value={formAnswers[`merch_variant_${idx}`] || ""}
                                                                        onChange={(e) => handleAnswerChange(`merch_variant_${idx}`, e.target.value)}
                                                                        disabled={item.remaining === 0}
                                                                    >
                                                                        <option value="">Size</option>
                                                                        {item.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                                                                    </select>
                                                                )}
                                                                <input
                                                                    type="number"
                                                                    className="input input-bordered input-sm w-20"
                                                                    min="0"
                                                                    max={item.remaining !== null ? item.remaining : undefined}
                                                                    placeholder="Qty"
                                                                    value={formAnswers[`merch_qty_${idx}`] || ""}
                                                                    onChange={(e) => handleAnswerChange(`merch_qty_${idx}`, e.target.value)}
                                                                    disabled={item.remaining === 0}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {/* Payment Proof Upload */}
                                                    <div className="form-control mt-4">
                                                        <label className="label">
                                                            <span className="label-text">
                                                                Payment Proof <span className="text-error">*</span>
                                                            </span>
                                                        </label>
                                                        <div>
                                                            <input
                                                                type="file"
                                                                accept="image/*,.pdf"
                                                                className="file-input file-input-bordered file-input-sm w-full"
                                                                onChange={(e) => handleFileUpload("paymentProofUrl", e.target.files[0])}
                                                            />
                                                            {fileUploading["paymentProofUrl"] && (
                                                                <span className="text-xs text-info mt-1 block">Uploading...</span>
                                                            )}
                                                            {formAnswers["paymentProofUrl"] && !fileUploading["paymentProofUrl"] && (
                                                                <span className="text-xs text-success mt-1 block">File uploaded successfully</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-base-content/50">No merchandise items available for this event.</p>
                                            )}
                                        </div>
                                    ) : (
                                        /* Dynamic form fields for NORMAL events */
                                        formFields.length > 0 && (
                                            <div className="space-y-3 border border-base-300 rounded-lg p-4">
                                                <h3 className="font-semibold text-sm">Registration Form</h3>
                                                {formFields.map((field) => (
                                                    <div key={field.label} className="form-control">
                                                        <label className="label">
                                                            <span className="label-text">
                                                                {field.label}
                                                                {field.required && <span className="text-error ml-1">*</span>}
                                                            </span>
                                                        </label>
                                                        {field.type === "text" && (
                                                            <input
                                                                type="text"
                                                                className="input input-bordered input-sm w-full"
                                                                value={formAnswers[field.label] || ""}
                                                                onChange={(e) => handleAnswerChange(field.label, e.target.value)}
                                                            />
                                                        )}
                                                        {field.type === "textarea" && (
                                                            <textarea
                                                                className="textarea textarea-bordered textarea-sm w-full"
                                                                value={formAnswers[field.label] || ""}
                                                                onChange={(e) => handleAnswerChange(field.label, e.target.value)}
                                                            />
                                                        )}
                                                        {field.type === "number" && (
                                                            <input
                                                                type="number"
                                                                className="input input-bordered input-sm w-full"
                                                                value={formAnswers[field.label] || ""}
                                                                onChange={(e) => handleAnswerChange(field.label, e.target.value)}
                                                            />
                                                        )}
                                                        {field.type === "select" && (
                                                            <select
                                                                className="select select-bordered select-sm w-full"
                                                                value={formAnswers[field.label] || ""}
                                                                onChange={(e) => handleAnswerChange(field.label, e.target.value)}
                                                            >
                                                                <option value="">Select...</option>
                                                                {(field.options || []).map((opt) => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        {field.type === "checkbox" && (
                                                            <input
                                                                type="checkbox"
                                                                className="checkbox checkbox-sm"
                                                                checked={!!formAnswers[field.label]}
                                                                onChange={(e) => handleAnswerChange(field.label, e.target.checked)}
                                                            />
                                                        )}
                                                        {field.type === "file" && (
                                                            <div>
                                                                <input
                                                                    type="file"
                                                                    className="file-input file-input-bordered file-input-sm w-full"
                                                                    onChange={(e) => handleFileUpload(field.label, e.target.files[0])}
                                                                />
                                                                {fileUploading[field.label] && (
                                                                    <span className="text-xs text-info mt-1">Uploading...</span>
                                                                )}
                                                                {formAnswers[field.label] && !fileUploading[field.label] && (
                                                                    <span className="text-xs text-success mt-1">File uploaded</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    )}

                                    <button
                                        className={`btn btn-primary ${regLoading ? "loading" : ""}`}
                                        disabled={regLoading || anyFileUploading}
                                        onClick={handleRegister}
                                    >
                                        {regLoading ? "Processing..." : (event.type === "MERCH" ? "Place Order" : "Register Now")}
                                    </button>
                                </div>
                            ) : !event.eligible ? (
                                <p className="text-warning">You are not eligible for this event.</p>
                            ) : null}
                        </div>

                        {/* Calendar links */}
                        {calLinks && (
                            <div className="mt-4">
                                <h3 className="font-semibold text-sm mb-1">Add to Calendar</h3>
                                <div className="flex flex-wrap gap-2">
                                    <a href={calLinks.googleUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">Google Calendar</a>
                                    <a href={calLinks.outlookUrl} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline">Outlook</a>
                                    <a href={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${calLinks.icsUrl}`} className="btn btn-xs btn-outline">Download .ics</a>
                                </div>
                            </div>
                        )}

                        {/* Forum link */}
                        <div className="mt-4">
                            <Link to={`/forum/${eventId}`} className="btn btn-sm btn-outline">
                                Discussion Forum
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
