import { describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./api";

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      type: "about:blank", title: "x", status, code, detail: "", request_id: "r-123", ...extra,
    }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

async function expectApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected the call to fail with an ApiError");
}

describe("api client error mapping (P4.1)", () => {
  it("maps 401 problem+json to ApiError with code and request id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(401, "UNAUTHENTICATED")));
    const error = await expectApiError(apiFetch("GET", "/children"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe("UNAUTHENTICATED");
    expect(error.status).toBe(401);
    expect(error.requestId).toBe("r-123");
    expect(error.message).toContain("Sign in again"); // friendly copy fills empty detail
  });

  it("prefers the server's detail copy when present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(401, "UNAUTHENTICATED", { detail: "server says" })));
    const error = await expectApiError(apiFetch("GET", "/children"));
    expect(error.message).toBe("server says");
  });

  it("maps 422 with field details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(problem(422, "VALIDATION_ERROR", {
      errors: [{ loc: ["body", "email"], msg: "invalid" }],
    })));
    const error = await expectApiError(apiFetch("POST", "/auth/register", {}));
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fields[0].loc[1]).toBe("email");
  });

  it("sends credentials and X-Requested-With on mutations", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("POST", "/children", { name: "Aarav" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/children");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-Requested-With"]).toBe("senseheaven");
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("retries a failed GET once then maps to NETWORK", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const error = await expectApiError(apiFetch("GET", "/children"));
    expect(fetchMock).toHaveBeenCalledTimes(2); // one retry for GET
    expect(error.code).toBe("NETWORK");
  });

  it("retries a 5xx GET once and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(problem(502, "INTERNAL_ERROR"))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "1" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await apiFetch<{ id: string }[]>("GET", "/children");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: "1" }]);
  });

  it("does not retry non-GET network failures", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network down"));
    vi.stubGlobal("fetch", fetchMock);
    await expectApiError(apiFetch("POST", "/auth/login", {}));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
