import axios, { AxiosError } from 'axios';

export const TOKEN_STORAGE_KEY = 'deskflow_token';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface NormalizedApiError {
  status: number | null;
  message: string;
  details?: unknown;
}

/** Normalizes any axios error into a friendly, predictable shape for the UI. */
export function normalizeError(error: unknown): NormalizedApiError {
  if (axios.isAxiosError(error)) {
    const err = error as AxiosError<{ message?: string; details?: unknown }>;
    if (err.response) {
      return {
        status: err.response.status,
        message: err.response.data?.message ?? 'Something went wrong. Please try again.',
        details: err.response.data?.details,
      };
    }
    return { status: null, message: 'Could not reach the server. Check your connection and try again.' };
  }
  return { status: null, message: 'An unexpected error occurred.' };
}

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);
