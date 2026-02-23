import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

export default function Signup() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        participantType: "NON_IIIT",
        collegeOrOrg: "",
        contact: "",
    });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState("");
    const captchaRef = useRef(null);

    // Load reCAPTCHA script
    useEffect(() => {
        if (!RECAPTCHA_SITE_KEY) return;

        const renderCaptcha = () => {
            if (captchaRef.current && window.grecaptcha?.render) {
                try {
                    window.grecaptcha.render(captchaRef.current, {
                        sitekey: RECAPTCHA_SITE_KEY,
                        callback: (token) => setCaptchaToken(token),
                        "expired-callback": () => setCaptchaToken(""),
                    });
                } catch (_) { /* already rendered */ }
            }
        };

        // If grecaptcha is already loaded (e.g. navigated from Login), render immediately
        if (window.grecaptcha?.render) {
            renderCaptcha();
            return;
        }

        // Otherwise load the script
        if (!document.getElementById("recaptcha-script")) {
            const script = document.createElement("script");
            script.id = "recaptcha-script";
            script.src = "https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
        window.onRecaptchaLoad = renderCaptcha;
    }, []);

    const handleChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (RECAPTCHA_SITE_KEY && !captchaToken) {
            setError("Please complete the CAPTCHA verification.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/api/auth/register", { ...form, captchaToken });
            setSuccess("Registration successful! Redirecting to login…");
            setTimeout(() => navigate("/login"), 1500);
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed");
            if (window.grecaptcha) {
                window.grecaptcha.reset();
                setCaptchaToken("");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 py-8">
            <div className="card w-full max-w-lg bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold justify-center mb-2">
                        Participant Registration
                    </h1>

                    {error && (
                        <div className="alert alert-error text-sm">
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="alert alert-success text-sm">
                            <span>{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">First Name</span>
                                </label>
                                <input
                                    type="text"
                                    name="firstName"
                                    className="input input-bordered w-full"
                                    value={form.firstName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Last Name</span>
                                </label>
                                <input
                                    type="text"
                                    name="lastName"
                                    className="input input-bordered w-full"
                                    value={form.lastName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Email</span>
                            </label>
                            <input
                                type="email"
                                name="email"
                                className="input input-bordered w-full"
                                value={form.email}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Password</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                className="input input-bordered w-full"
                                value={form.password}
                                onChange={handleChange}
                                required
                                minLength={6}
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Participant Type</span>
                            </label>
                            <select
                                name="participantType"
                                className="select select-bordered w-full"
                                value={form.participantType}
                                onChange={handleChange}
                            >
                                <option value="NON_IIIT">Non-IIIT</option>
                                <option value="IIIT">IIIT</option>
                            </select>
                            {form.participantType === "IIIT" && (
                                <label className="label">
                                    <span className="label-text-alt text-warning">
                                        Must use an email ending in @iiit.ac.in or .iiit.ac.in
                                    </span>
                                </label>
                            )}
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">College / Organization *</span>
                            </label>
                            <input
                                type="text"
                                name="collegeOrOrg"
                                className="input input-bordered w-full"
                                value={form.collegeOrOrg}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Contact *</span>
                            </label>
                            <input
                                type="text"
                                name="contact"
                                className="input input-bordered w-full"
                                value={form.contact}
                                onChange={handleChange}
                                pattern="\d{10}"
                                title="Contact must be exactly 10 digits"
                                required
                            />
                        </div>

                        {RECAPTCHA_SITE_KEY && (
                            <div className="flex justify-center">
                                <div ref={captchaRef}></div>
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`btn btn-primary w-full ${loading ? "loading" : ""}`}
                            disabled={loading}
                        >
                            {loading ? "Registering…" : "Register"}
                        </button>
                    </form>

                    <p className="text-center text-sm mt-4">
                        Already have an account?{" "}
                        <Link to="/login" className="link link-primary">
                            Login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
