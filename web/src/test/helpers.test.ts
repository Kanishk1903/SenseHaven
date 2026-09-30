import { describe, expect, it } from "vitest";

import { copyFor, ERROR_COPY } from "@/lib/errorCopy";
import { formatDuration } from "@/lib/format";
import { passwordStrength } from "@/features/auth/passwordStrength";
import { detectTimezone } from "@/lib/queries";

describe("copy + formatting helpers (P4.7)", () => {
  it("formatDuration follows the copy guide: 1 h 25 m, never 85 minutes", () => {
    expect(formatDuration(5100)).toBe("1 h 25 m");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(300)).toBe("5 m");
    expect(formatDuration(0)).toBe("0 m");
    expect(formatDuration(-50)).toBe("0 m");
  });

  it("every contract error code has friendly copy", () => {
    const codes = [
      "UNAUTHENTICATED", "INVALID_CREDENTIALS", "EMAIL_TAKEN", "VALIDATION_ERROR", "NOT_FOUND",
      "RATE_LIMITED", "CSRF_HEADER_MISSING", "PIN_REQUIRED", "PIN_INVALID", "PAIRING_CODE_INVALID",
      "PAIRING_CODE_EXPIRED", "DEVICE_TOKEN_INVALID", "DEVICE_REVOKED", "SESSION_NOT_ACTIVE",
      "BATCH_TOO_LARGE", "COMMAND_EXPIRED", "INTERNAL_ERROR",
    ];
    for (const code of codes) {
      expect(ERROR_COPY[code], code).toMatch(/\S/);
      expect(ERROR_COPY[code].endsWith("."), code).toBe(true);
    }
  });

  it("copyFor prefers detail, falls back to the map, then to a safe default", () => {
    expect(copyFor("EMAIL_TAKEN", "server detail")).toBe("server detail");
    expect(copyFor("EMAIL_TAKEN", "")).toBe(ERROR_COPY.EMAIL_TAKEN);
    expect(copyFor("UNKNOWN_CODE", "")).toBe(ERROR_COPY.INTERNAL_ERROR);
  });

  it("password strength grades length and variety", () => {
    expect(passwordStrength("short").label).toBe("Too short");
    expect(passwordStrength("onlylowercase").score).toBeLessThan(3);
    expect(passwordStrength("LongEnough123!").label).toBe("Strong");
  });

  it("detectTimezone returns a plausible IANA zone", () => {
    expect(detectTimezone()).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/);
  });

  it("formatDuration keeps the copy guide at hour boundaries", () => {
    expect(formatDuration(60 * 60 * 2)).toBe("2 h");
    expect(formatDuration(60 * 60 * 2 + 60 * 5)).toBe("2 h 5 m");
    expect(formatDuration(59)).toBe("1 m"); // 59 s rounds up to a displayed minute
  });

  it("copyFor never returns an empty string", () => {
    for (const code of Object.keys(ERROR_COPY)) expect(copyFor(code, "").length).toBeGreaterThan(5);
  });
});
