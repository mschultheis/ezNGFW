/**
 * API client singleton for communicating with the ezNGFW Rust backend.
 *
 * Wraps `fetch()` with automatic JWT Bearer token injection, 401
 * session-expiry handling (redirects to /login), and typed JSON
 * deserialization.  Every REST call in the admin GUI flows through
 * the exported `api` instance so authentication and error handling
 * are centralised in one place.
 *
 * In demo mode, requests are served by a browser-local mock API.
 */
import { goto } from '$app/navigation';
import { browser } from '$app/environment';
import { demoRequest, isDemoMode } from './demo-api';

/**
 * HTTP client that centralizes backend access concerns:
 * - `/api` base-path prefixing,
 * - JWT Bearer auth header injection,
 * - 401/session-expiry handling,
 * - JSON parsing and typed return values.
 */
class ApiClient {
    /** Current JWT Bearer token, persisted in localStorage across reloads. */
  private token: string | null = null;

  constructor() {
    if (browser) {
      this.token = localStorage.getItem('ezngfw_token');
    }
  }

    /** Store or clear the auth token (both in memory and localStorage). */
  setToken(t: string | null) {
    this.token = t;
    if (browser) {
      if (t) localStorage.setItem('ezngfw_token', t);
      else localStorage.removeItem('ezngfw_token');
    }
  }

    /** Return the current token (may be null if not authenticated). */
  getToken() {
    return this.token;
  }

    /**
   * Execute a request against the backend API.
   *
   * The request always targets `/api${path}` to keep callers independent from
   * deployment host details.
   */
  async request<T>(path: string, opts?: RequestInit): Promise<T> {
    if (browser && isDemoMode()) {
      return demoRequest<T>(path, opts);
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(`/api${path}`, {
      ...opts,
      headers: { ...headers, ...(opts?.headers as Record<string, string>) }
    });

    if (res.status === 401) {
      // Don't redirect to /login when the 401 comes from the login/mfa endpoint itself
      const isAuthEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/mfa');
      if (!isAuthEndpoint) {
        this.setToken(null);
        if (browser) goto('/login');
      }
      throw new Error(isAuthEndpoint ? 'Invalid credentials' : 'Session expired');
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

    /** GET request for read-only endpoints. */
  get = <T>(path: string) => this.request<T>(path);
    /** POST request for create/actions with optional JSON body. */
  post = <T>(path: string, body?: unknown) =>
    this.request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
    /** PATCH request for partial updates. */
  patch = <T>(path: string, body: unknown) =>
    this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
    /** DELETE request. */
  del = <T>(path: string) => this.request<T>(path, { method: 'DELETE' });
    /** PUT request for full replacement updates. */
  put = <T>(path: string, body: unknown) =>
    this.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

/** Singleton API client instance used throughout the admin GUI. */
export const api = new ApiClient();
