/** User-facing copy per stable error code — mirrors contracts/error_codes.md (single source). */
export const ERROR_COPY: Record<string, string> = {
  UNAUTHENTICATED: "Your session ended. Sign in again to keep going.",
  INVALID_CREDENTIALS: "That email and password don't match. Check them and try again.",
  EMAIL_TAKEN: "An account with this email already exists. Try signing in instead.",
  VALIDATION_ERROR: "Some details need a fix. Check the highlighted fields and try again.",
  NOT_FOUND: "We couldn't find that. It may have been removed — head back and try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  CSRF_HEADER_MISSING: "We couldn't verify that request. Refresh the page and try again.",
  PIN_REQUIRED: "Set your 6-digit device PIN first — you'll find it in Account.",
  PIN_INVALID: "That PIN doesn't match. Device PINs are 6 digits — check and try again.",
  PAIRING_CODE_INVALID: "That code isn't right. Compare it with the dashboard code and try again.",
  PAIRING_CODE_EXPIRED: "That code expired — pairing codes last 10 minutes. Generate a new one.",
  DEVICE_TOKEN_INVALID: "This phone isn't paired any more. Open the app and pair with a new code.",
  DEVICE_REVOKED: "This phone was unpaired from the parent dashboard. Pair again to reconnect.",
  SESSION_NOT_ACTIVE: "There's no running session for that right now. Start one and try again.",
  BATCH_TOO_LARGE: "That update was too big to accept at once. It will be resent in smaller parts.",
  COMMAND_EXPIRED: "That instruction expired. The phone picks up fresh instructions at its next check-in.",
  INTERNAL_ERROR: "Something went wrong on our side. Your child's limits still work — try again in a moment.",
  NETWORK: "We couldn't reach SenseHeaven. Your child's limits still work. Try again.",
};

export function copyFor(code: string, detail: string | null): string {
  return detail || ERROR_COPY[code] || ERROR_COPY.INTERNAL_ERROR;
}
