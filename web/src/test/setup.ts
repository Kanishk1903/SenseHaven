import "@testing-library/jest-dom/vitest";

// jsdom lacks AbortSignal.timeout — the api client relies on it.
if (typeof AbortSignal.timeout !== "function") {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), ms);
    return controller.signal;
  };
}
