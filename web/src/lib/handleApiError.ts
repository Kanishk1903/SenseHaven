import { toast } from "sonner";

import { ApiError } from "./api";

/** Map any thrown error to friendly copy + a toast (suppress the toast with showToast=false). */
export async function handleApiError(error: unknown, showToast = true): Promise<string> {
  const message = error instanceof ApiError ? error.message : "We couldn't reach SenseHeaven. Try again.";
  if (showToast) toast.error(message);
  return message;
}
