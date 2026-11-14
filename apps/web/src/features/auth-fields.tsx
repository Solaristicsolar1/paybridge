"use client";

import Link from "next/link";
import { Field } from "@/components/ui";

export type AuthMode =
  | "login"
  | "register"
  | "forgot-password"
  | "reset-password"
  | "verify-email";

export function AuthFields({
  mode,
  token,
}: {
  mode: AuthMode;
  token: string;
}) {
  const needsEmail =
    ["login", "register", "forgot-password"].includes(mode) ||
    (mode === "verify-email" && !token);

  return (
    <>
      {mode === "register" && (
        <Field label="Your name">
          <input
            name="displayName"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
            placeholder="Full name"
          />
        </Field>
      )}

      {needsEmail && (
        <Field label="Email address">
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
            required
            placeholder="you@business.com"
          />
        </Field>
      )}

      {(mode === "login" || mode === "register") && (
        <Field
          label="Password"
          hint={mode === "register"
            ? "12–128 characters. Use a unique password."
            : undefined}
        >
          <input
            name="password"
            type="password"
            autoComplete={mode === "login"
              ? "current-password"
              : "new-password"}
            minLength={mode === "register" ? 12 : 1}
            maxLength={128}
            required
            placeholder="Enter your password"
          />
        </Field>
      )}

      {mode === "reset-password" && (
        <>
          <Field label="New password">
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
        </>
      )}

      {mode === "login" && (
        <Link className="forgot-link" href="/forgot-password">
          Forgot password?
        </Link>
      )}
    </>
  );
}