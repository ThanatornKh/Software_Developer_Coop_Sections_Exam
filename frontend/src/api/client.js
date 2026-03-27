import axios from 'axios';

let accessToken = null;
let refreshToken = null;

const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
}

export function getToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export { decodeJWT };

// Request interceptor - attach Bearer token
client.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 and token refresh
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await axios.post('/api/auth/refresh', {
          refresh_token: refreshToken,
        });

        const newAccess = response.data.data.access_token;
        setTokens(newAccess, refreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);

        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export async function login(username, password) {
  const response = await client.post('/auth/login', { username, password });
  const { access_token, refresh_token } = response.data.data;
  setTokens(access_token, refresh_token);
  return decodeJWT(access_token);
}

export async function logout() {
  try {
    await client.post('/auth/logout');
  } catch {
    // Ignore logout errors
  } finally {
    clearTokens();
  }
}

export default client;
