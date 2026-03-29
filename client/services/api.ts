/**
 * Central Axios instance — all services import from here.
 * Attaches the Auth0 access token to every request automatically.
 */
import axios from 'axios';

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
    headers: { 'Content-Type': 'application/json' },
});

/**
 * Call this once after Auth0 provides a token, e.g. via useAuth0().getAccessTokenSilently().
 */
export const setAuthToken = (token: string) => {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export const clearAuthToken = () => {
    delete apiClient.defaults.headers.common['Authorization'];
};
