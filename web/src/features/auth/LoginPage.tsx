import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { AuthLayout } from "./AuthLayout";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [serverError, setServerError] = useState<{ message: string; code: string; retryAfter: number | null } | null>(null);
  const [countdown, setCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (me) navigate("/app", { replace: true });
  }, [me, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      const { api } = await import("@/lib/api");
      await api.post("/auth/login", values);
      navigate("/app", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError({ message: error.message, code: error.code, retryAfter: error.retryAfter });
        if (error.retryAfter !== null) setCountdown(error.retryAfter);
      } else {
        setServerError({ message: "We couldn't reach SenseHeaven. Your child's limits still work. Try again.", code: "NETWORK", retryAfter: null });
      }
    }
  };

  const rateLimited = serverError?.code === "RATE_LIMITED";

  return (
    <AuthLayout heading="Welcome back">
      <form
        className="mt-6 space-y-4"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <label className="block text-secondary">
          Email
          <Input
            className="mt-1"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email ? (
            <p id="login-email-error" className="mt-1 text-caption text-stress-fg">{errors.email.message}</p>
          ) : null}
        </label>
        <label className="block text-secondary">
          Password
          <Input
            className="mt-1"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            {...register("password")}
          />
          {errors.password ? (
            <p id="login-password-error" className="mt-1 text-caption text-stress-fg">{errors.password.message}</p>
          ) : null}
        </label>

        {serverError ? (
          <div role="alert" className="rounded-control bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
            {rateLimited && countdown > 0
              ? `${serverError.message} You can try again in ${countdown} s.`
              : serverError.message}
          </div>
        ) : null}

        <Button type="submit" className="w-full sm:w-auto sm:min-w-40" size="lg" disabled={isSubmitting || (rateLimited && countdown > 0)}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-left text-secondary text-text-muted">
          New here?{" "}
          <Link to="/register" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline lg:min-h-6">
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
