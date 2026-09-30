import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { detectTimezone, useMe } from "@/lib/queries";
import { AuthLayout } from "./AuthLayout";
import { passwordStrength } from "./passwordStrength";

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(10, "Use at least 10 characters"),
  displayName: z.string().min(1, "Tell us what to call you").max(80),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const strength = passwordStrength(password);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", displayName: "" },
  });

  useEffect(() => {
    if (me) navigate("/", { replace: true });
  }, [me, navigate]);

  const onSubmit = async (values: RegisterValues) => {
    setServerError(null);
    try {
      await api.post("/auth/register", {
        email: values.email,
        password: values.password,
        display_name: values.displayName,
        timezone: detectTimezone(),
      });
      navigate("/onboarding", { replace: true });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "We couldn't reach SenseHeaven. Try again.");
    }
  };

  return (
    <AuthLayout heading="Create your account">
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <label className="block text-secondary">
          Your name
          <Input
            className="mt-1"
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(errors.displayName)}
            {...register("displayName")}
          />
          {errors.displayName ? (
            <p className="mt-1 text-caption text-stress-fg">{errors.displayName.message}</p>
          ) : null}
        </label>
        <label className="block text-secondary">
          Email
          <Input
            className="mt-1"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register("email")}
          />
          {errors.email ? <p className="mt-1 text-caption text-stress-fg">{errors.email.message}</p> : null}
        </label>
        <label className="block text-secondary">
          Password
          <div className="relative">
            <Input
              className="mt-1 pr-16"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password", { onChange: (event) => setPassword(event.target.value) })}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-caption font-medium text-primary"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-pill px-2 py-0.5 text-caption font-medium ${strength.className}`}>
              {password ? strength.label : "At least 10 characters"}
            </span>
          </div>
          {errors.password ? (
            <p className="mt-1 text-caption text-stress-fg">{errors.password.message}</p>
          ) : null}
        </label>

        {serverError ? (
          <div role="alert" className="rounded-input bg-stress-soft px-3 py-2 text-secondary text-stress-fg">
            {serverError}
          </div>
        ) : null}

        <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
        <p className="text-center text-secondary text-text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
