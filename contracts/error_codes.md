# Error Codes

Stable `code` values carried by every RFC 7807 `application/problem+json` response
(File 01 §E2). Body shape:

```json
{
  "type": "about:blank",
  "title": "<HTTP status text>",
  "status": 401,
  "code": "UNAUTHENTICATED",
  "detail": "<user-facing copy from the table below>",
  "request_id": "<uuid>"
}
```

Copy follows the File 02 §5 voice: warm, plain, sentence case; every message says what
happened **and** what to do next. Never log tokens, PINs, passwords, search queries or full
pairing codes (G8) — mask identifiers to their last 4 characters.

| Code | HTTP | Meaning | User-facing copy |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | No or invalid parent session cookie | "Your session ended. Sign in again to keep going." |
| `INVALID_CREDENTIALS` | 401 | Login rejected (identical response for unknown email and wrong password) | "That email and password don't match. Check them and try again." |
| `EMAIL_TAKEN` | 409 | Registration with an email that already has an account | "An account with this email already exists. Try signing in instead." |
| `VALIDATION_ERROR` | 422 | Request body failed field validation (details list the fields) | "Some details need a fix. Check the highlighted fields and try again." |
| `NOT_FOUND` | 404 | Unknown id, or an id owned by another parent (tenant isolation returns 404, never 403) | "We couldn't find that. It may have been removed — head back and try again." |
| `RATE_LIMITED` | 429 | Throttled (login failures, pairing attempts); response carries `Retry-After` seconds | "Too many attempts. Wait a moment and try again." |
| `CSRF_HEADER_MISSING` | 403 | Mutating parent request without the required `X-Requested-With: senseheaven` header | "We couldn't verify that request. Refresh the page and try again." |
| `PIN_REQUIRED` | 409 | Pairing code requested while the parent has no device PIN set | "Set your 6-digit device PIN first — you'll find it in Account." |
| `PIN_INVALID` | 422 | Device PIN wrong format or failed verification | "That PIN doesn't match. Device PINs are 6 digits — check and try again." |
| `PAIRING_CODE_INVALID` | 422 | Code does not match any active pairing code for this child | "That code isn't right. Compare it with the dashboard code and try again." |
| `PAIRING_CODE_EXPIRED` | 410 | Pairing code past its 10-minute TTL, already used, or attempts exhausted | "That code expired — pairing codes last 10 minutes. Generate a new one." |
| `DEVICE_TOKEN_INVALID` | 401 | Device bearer token unknown or malformed | "This phone isn't paired any more. Open the app and pair with a new code." |
| `DEVICE_REVOKED` | 401 | Device was revoked by its parent; the app must wipe local state | "This phone was unpaired from the parent dashboard. Pair again to reconnect." |
| `SESSION_NOT_ACTIVE` | 409 | Control action needs a live session (e.g. adjust on an ended session, start with no paired device) | "There's no running session for that right now. Start one and try again." |
| `BATCH_TOO_LARGE` | 413 | `/device/events` batch over the 200-item limit | "That update was too big to accept at once. It will be resent in smaller parts." |
| `COMMAND_EXPIRED` | 410 | Command older than its 24-hour TTL; the device ignores it | "That instruction expired. The phone picks up fresh instructions at its next check-in." |
| `INTERNAL_ERROR` | 500 | Unexpected server fault; `request_id` is safe to share for support | "Something went wrong on our side. Your child's limits still work — try again in a moment." |
