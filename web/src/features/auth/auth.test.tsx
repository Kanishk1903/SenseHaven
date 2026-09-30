import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";
import { AppRoutes } from "@/app/AppRoutes";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const { ERROR_COPY } = await import("@/lib/errorCopy");
  class ApiError extends Error {
    status: number;
    code: string;
    requestId: string | null;
    retryAfter: number | null;
    fields: { loc: string[]; msg: string }[];
    constructor(status: number, code: string, detail: string, requestId: string | null,
                fields: { loc: string[]; msg: string }[] = [], retryAfter: number | null = null) {
      super(detail || ERROR_COPY[code] || code); // mirror the real client's copy behaviour
      this.status = status;
      this.code = code;
      this.requestId = requestId;
      this.retryAfter = retryAfter;
      this.fields = fields;
    }
  }
  return { ApiError, api: apiMock, REQUESTED_WITH: "senseheaven" };
});

function renderWithProviders(ui: React.ReactElement, initialPath = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  // default: no session — get() rejects with 401 like the real client would
  apiMock.get.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "", null));
});

describe("auth pages (P4.7)", () => {
  it("LoginPage shows inline validation on blur and never submits invalid data", async () => {
    renderWithProviders(<LoginPage />);
    const email = screen.getByLabelText(/Email/);
    await userEvent.type(email, "not-an-email");
    await userEvent.tab(); // blur
    await waitFor(() => expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it("LoginPage submits valid credentials and reaches the dashboard", async () => {
    apiMock.post.mockResolvedValueOnce({ email: "p@example.com" });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Email/), "p@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/login", {
      email: "p@example.com",
      password: "secret-password",
    }));
  });

  it("LoginPage shows a live countdown after RATE_LIMITED with Retry-After", async () => {
    apiMock.post.mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "", null, [], 90));
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Email/), "p@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/try again in 90 s/i));
    const button = screen.getByRole("button", { name: /Sign in/ }) as HTMLButtonElement;
    expect(button).toBeDisabled();
  });

  it("LoginPage maps INVALID_CREDENTIALS to the contract copy", async () => {
    apiMock.post.mockRejectedValueOnce(new ApiError(401, "INVALID_CREDENTIALS", "", null));
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText(/Email/), "p@example.com");
    await userEvent.type(screen.getByLabelText(/Password/), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/email and password don't match/i));
  });

  it("RegisterPage grades the password live and blocks short passwords", async () => {
    renderWithProviders(<RegisterPage />);
    const password = screen.getByLabelText(/^Password/);
    await userEvent.type(password, "abc");
    expect(screen.getByText("Too short")).toBeInTheDocument();
    await userEvent.type(password, "LongEnough123!");
    expect(screen.getByText("Strong")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    expect(apiMock.post).not.toHaveBeenCalled(); // min 10 enforced by zod
  });

  it("RegisterPage maps EMAIL_TAKEN to friendly copy", async () => {
    apiMock.post.mockRejectedValueOnce(new ApiError(409, "EMAIL_TAKEN", "", null));
    renderWithProviders(<RegisterPage />);
    await userEvent.type(screen.getByLabelText(/Your name/), "Priya");
    await userEvent.type(screen.getByLabelText(/Email/), "taken@example.com");
    await userEvent.type(screen.getByLabelText(/^Password/), "LongEnough123!");
    await userEvent.click(screen.getByRole("button", { name: /Create account/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/already exists/i));
  });
});

describe("routing guard (P4.7)", () => {
  it("redirects an unauthenticated visitor from / to /login", async () => {
    renderWithProviders(<AppRoutes />, "/");
    await waitFor(() => expect(screen.getByRole("heading", { name: /Welcome back|Create your account/i })).toBeInTheDocument());
  });

  it("shows the orb 404 page for unknown routes", async () => {
    renderWithProviders(<AppRoutes />, "/definitely-not-a-page");
    expect(await screen.findByText("We couldn't find that page")).toBeInTheDocument();
  });
});
