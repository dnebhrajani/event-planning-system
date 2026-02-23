import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";
import { setToken, setRole } from "../auth/storage";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

export default function Login() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
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

        if (window.grecaptcha?.render) {
            renderCaptcha();
            return;
        }

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

        if (RECAPTCHA_SITE_KEY && !captchaToken) {
            setError("Please complete the CAPTCHA verification.");
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post("/api/auth/login", {
                ...form,
                captchaToken,
            });
            setToken(data.token);
            setRole(data.role);

            const dest =
                data.role === "admin"
                    ? "/admin"
                    : data.role === "organizer"
                        ? "/organizer"
                        : "/participant";
            navigate(dest, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || "Login failed");
            // Reset captcha on failure
            if (window.grecaptcha) {
                window.grecaptcha.reset();
                setCaptchaToken("");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-base-200">
            <div className="card w-full max-w-md bg-base-100 shadow-xl">
                <div className="card-body">
                    <h1 className="card-title text-2xl font-bold justify-center mb-2">
                        Login
                    </h1>

                    {error && (
                        <div className="alert alert-error text-sm">
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            {loading ? "Signing in…" : "Sign In"}
                        </button>
                    </form>

                    <p className="text-center text-sm mt-4">
                        Don't have an account?{" "}
                        <Link to="/signup" className="link link-primary">
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
