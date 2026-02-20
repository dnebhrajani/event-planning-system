import axios from "axios";
import { getToken, clearToken, clearRole } from "../auth/storage";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
});

// Attach JWT to every request if available
api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// On 401/403 clear auth state and redirect to login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && [401, 403].includes(error.response.status)) {
            // Don't redirect if we're already on login/signup or if this is a login request
            const isAuthRequest = error.config.url?.includes("/api/auth/login");
            if (!isAuthRequest) {
                clearToken();
                clearRole();
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);

export default api;
