import axios, { AxiosError } from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  // Configure Axios to automatically send CSRF token from cookie as header
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// CSRF token management for Laravel Sanctum
export const getCsrfToken = async () => {
  await axios.get(`${backendURL}/sanctum/csrf-cookie`, {
    withCredentials: true,
  });
};

// Helper function to get cookie value by name
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop()?.split(';').shift();
    return cookieValue ? decodeURIComponent(cookieValue) : null;
  }
  return null;
};

// Track if CSRF token has been fetched in this session
let csrfTokenFetched = false;

// Request interceptor to add auth token and handle CSRF
api.interceptors.request.use(
  async (config) => {
    // Get CSRF token for state-changing requests on first call
    if (!csrfTokenFetched && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
      await getCsrfToken();
      csrfTokenFetched = true;
    }

    // Manually set X-XSRF-TOKEN header from cookie for cross-origin requests
    const xsrfToken = getCookie('XSRF-TOKEN');
    if (xsrfToken) {
      config.headers['X-XSRF-TOKEN'] = xsrfToken;
    }

    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 403) {
      // Permission denied - redirect to unauthorized page
      if (typeof window !== 'undefined' &&
          !window.location.pathname.includes('/unauthorized') &&
          !window.location.pathname.includes('/login')) {
        console.warn('Access denied: insufficient permissions');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
