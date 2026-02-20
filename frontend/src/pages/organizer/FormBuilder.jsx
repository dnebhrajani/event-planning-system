import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/axios";
import Navbar from "../../components/Navbar";

const FIELD_TYPES = ["text", "textarea", "number", "select", "checkbox", "file"];

export default function FormBuilder() {
    const { eventId } = useParams();
    const [fields, setFields] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get(`/api/forms/events/${eventId}`);
                setFields(
                    (data.fields || []).map((f) => ({
                        ...f,
                        options: Array.isArray(f.options) ? f.options.join(", ") : f.options || "",
                    }))
                );
                setLocked(!!data.locked);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        })();
    }, [eventId]);

    const addField = () => {
        setFields([...fields, { label: "", type: "text", required: false, options: "" }]);
    };

    const removeField = (idx) => {
        setFields(fields.filter((_, i) => i !== idx));
    };

    const updateField = (idx, key, value) => {
        setFields(
            fields.map((f, i) =>
                i === idx ? { ...f, [key]: value } : f
            )
        );
    };

    const moveField = (idx, dir) => {
        const newFields = [...fields];
        const target = idx + dir;
        if (target < 0 || target >= newFields.length) return;
        [newFields[idx], newFields[target]] = [newFields[target], newFields[idx]];
        setFields(newFields);
    };

    const handleSave = async () => {
        setMsg("");
        setSaving(true);
        try {
            const prepared = fields.map((f) => ({
                label: f.label,
                type: f.type,
                required: !!f.required,
                ...(f.type === "select" && {
                    options: (f.options || "")
                        .split(",")
                        .map((o) => o.trim())
                        .filter(Boolean),
                }),
            }));
            await api.put(`/api/forms/events/${eventId}`, { fields: prepared });
            setMsg("Form saved");
        } catch (err) {
            setMsg(err.response?.data?.error || "Save failed");
        } finally {
            setSaving(false);
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
            <div className="max-w-3xl mx-auto p-6 space-y-4">
                <h1 className="text-2xl font-bold">Registration Form Builder</h1>

                {locked && (
                    <div className="alert alert-warning text-sm">
                        <span>This form is locked because participants have already registered. You cannot edit it.</span>
                    </div>
                )}

                {msg && (
                    <div className={`alert text-sm ${msg.includes("saved") ? "alert-success" : "alert-error"}`}>
                        <span>{msg}</span>
                    </div>
                )}

                {fields.length === 0 && !locked && (
                    <p className="text-base-content/60">No custom fields yet. Add fields that participants must fill during registration.</p>
                )}

                <div className="space-y-3">
                    {fields.map((f, idx) => (
                        <div key={idx} className="card bg-base-100 shadow">
                            <div className="card-body p-4 space-y-2">
                                <div className="flex gap-2 items-start">
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text"
                                            className="input input-bordered input-sm w-full"
                                            placeholder="Field label"
                                            value={f.label}
                                            onChange={(e) => updateField(idx, "label", e.target.value)}
                                            disabled={locked}
                                        />
                                        <div className="flex gap-2 items-center">
                                            <select
                                                className="select select-bordered select-sm"
                                                value={f.type}
                                                onChange={(e) => updateField(idx, "type", e.target.value)}
                                                disabled={locked}
                                            >
                                                {FIELD_TYPES.map((t) => (
                                                    <option key={t} value={t}>{t}</option>
                                                ))}
                                            </select>
                                            <label className="flex items-center gap-1 text-sm">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={f.required || false}
                                                    onChange={(e) => updateField(idx, "required", e.target.checked)}
                                                    disabled={locked}
                                                />
                                                Required
                                            </label>
                                        </div>
                                        {f.type === "select" && (
                                            <input
                                                type="text"
                                                className="input input-bordered input-sm w-full"
                                                placeholder="Options (comma-separated)"
                                                value={f.options || ""}
                                                onChange={(e) => updateField(idx, "options", e.target.value)}
                                                disabled={locked}
                                            />
                                        )}
                                    </div>
                                    {!locked && (
                                        <div className="flex flex-col gap-1">
                                            <button className="btn btn-ghost btn-xs" onClick={() => moveField(idx, -1)} disabled={idx === 0}>Up</button>
                                            <button className="btn btn-ghost btn-xs" onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1}>Dn</button>
                                            <button className="btn btn-ghost btn-xs text-error" onClick={() => removeField(idx)}>X</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {!locked && (
                    <div className="flex gap-2">
                        <button className="btn btn-outline btn-sm" onClick={addField}>+ Add Field</button>
                        <button className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                            {saving ? "Saving..." : "Save Form"}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
