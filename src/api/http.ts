import type { ProblemDetail } from "./types";

// Same-origin by default: dev uses the Vite proxy, prod should serve the app
// same-site with the API (SESSION cookie is SameSite=Lax).
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public problem: ProblemDetail,
  ) {
    super(problem.detail || problem.title || `HTTP ${status}`);
    this.name = "ApiError";
  }
}

/** Fired on any 401 so the auth context can drop the session globally. */
export const UNAUTHORIZED_EVENT = "kindred:unauthorized";

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

export async function api<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" ? { "X-XSRF-TOKEN": csrfToken() } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  if (!res.ok) {
    let problem: ProblemDetail = { status: res.status };
    try {
      problem = await res.json();
    } catch {
      // non-JSON error body; keep the bare status
    }
    throw new ApiError(res.status, problem);
  }

  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

/** Any GET makes the server set the XSRF-TOKEN cookie; /meta is public. */
export async function bootstrapCsrf(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/meta`, { credentials: "include" });
  } catch {
    // Backend unreachable; individual calls will surface the error.
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
