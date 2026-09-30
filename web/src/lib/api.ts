/** Typed fetch wrapper for the parent API (P4.1).

- credentials: include (JWT lives in the sh_session cookie)
- X-Requested-With on every mutating call (LEAN §1.2 CSRF replacement)
- problem+json parsed into ApiError {code, status, requestId}
- 60 s timeout (G18 cold-start tolerance), one retry with backoff+jitter for GET only
- friendly copy via lib/errorCopy (contracts/error_codes.md)
*/
import { copyFor } from "./errorCopy";

const BASE = "/api/v1";
const TIMEOUT_MS = 60_000;
export const REQUESTED_WITH = "senseheaven";

export class ApiError extends Error {
  status: number;
  code: string;
  requestId: string | null;
  fields: { loc: string[]; msg: string }[];

  constructor(status: number, code: string, detail: string, requestId: string | null,
              fields: { loc: string[]; msg: string }[] = []) {
    super(copyFor(code, detail));
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fields = fields;
  }
}

type ProblemBody = {
  code?: string;
  detail?: string;
  request_id?: string;
  status?: number;
  errors?: { loc: string[]; msg: string }[];
};

async function parseError(response: Response): Promise<ApiError> {
  let body: ProblemBody = {};
  try {
    body = (await response.json()) as ProblemBody;
  } catch {
    // non-JSON error body — fall through with defaults
  }
  const code = body.code ?? (response.status >= 500 ? "INTERNAL_ERROR" : "NOT_FOUND");
  return new ApiError(
    response.status,
    code,
    body.detail ?? "",
    body.request_id ?? response.headers.get("X-Request-ID"),
    body.errors ?? [],
  );
}

async function parseOk<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function apiFetch<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const attempt = async (): Promise<Response> => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET") headers["X-Requested-With"] = REQUESTED_WITH;
    return fetch(BASE + path, {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  };

  let response: Response;
  try {
    response = await attempt();
  } catch {
    if (method === "GET") {
      await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
      try {
        response = await attempt();
      } catch {
        throw new ApiError(0, "NETWORK", "", null);
      }
    } else {
      throw new ApiError(0, "NETWORK", "", null);
    }
  }
  if (!response.ok) {
    // one retry for transient GET failures (server cold start, proxy hiccup)
    if (method === "GET" && response.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 250 + Math.random() * 250));
      const retried = await attempt().catch(() => null);
      if (retried?.ok) return parseOk<T>(retried);
    }
    throw await parseError(response);
  }
  return parseOk<T>(response);
}

export const api = {
  get: <T>(path: string) => apiFetch<T>("GET", path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => apiFetch<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>("PATCH", path, body),
  delete: <T>(path: string) => apiFetch<T>("DELETE", path),
};
