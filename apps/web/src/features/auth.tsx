"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authApi } from "@/lib/api";
import { errorMessage } from "@/hooks/use-resource";
import { Alert, Brand, Icon } from "@/components/ui";
import { AuthFields, type AuthMode } from "./auth-fields";

export type { AuthMode } from "./auth-fields";

const titles: Record<AuthMode, string> = {
  login: "Welcome back.",
  register: "Build your business across borders.",
  "forgot-password": "Let’s get you back in.",
  "reset-password": "Choose a new password.",
  "verify-email": "Verify your email.",
};

const descriptions: Record<AuthMode, string> = {
  login: "Sign in to your PayBridge workspace.",
  register: "Create your account to start sending invoices and accepting stablecoin payments.",
  "forgot-password": "Enter your email and we’ll send password reset instructions.",
  "reset-password": "Use a unique password with at least 12 characters.",
  "verify-email": "Confirm your email to activate your account.",
};

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();

    try {
      if (mode === "login") {
        await authApi.login(email, String(form.get("password")));
        await authApi.me();

        const next = params.get("next");
        const destination =
          next && next.startsWith("/") &&
          !next.startsWith("//") && !next.includes("\\")
            ? next
            : "/dashboard";

        router.replace(destination);
        router.refresh();
      } else if (mode === "register") {
        const result = await authApi.register(
          email,
          String(form.get("password")),
          String(form.get("displayName") || "").trim(),
        );
        setSuccess(result.message);
      } else if (mode === "forgot-password") {
        setSuccess((await authApi.forgotPassword(email)).message);
      } else if (mode === "reset-password") {
        const password = String(form.get("newPassword"));
        const confirm = String(form.get("confirmPassword"));

        if (password !== confirm) {
          throw new Error(
            "Your passwords do not match. Enter the same password in both fields.",
          );
        }

        setSuccess(
          (await authApi.resetPassword(token, password, confirm)).message,
        );
      } else {
        const result = token
          ? await authApi.verifyEmail(token)
          : await authApi.resendVerification(email);
        setSuccess(result.message);
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const resetInvalid =
    mode === "reset-password" && !/^[a-f0-9]{64}$/i.test(token);

  const completed = Boolean(success && (
    mode === "register" ||
    mode === "reset-password" ||
    (mode === "verify-email" && token)
  ));

  const buttonLabel =
    mode === "login" ? "Sign in" :
    mode === "register" ? "Create account" :
    mode === "forgot-password" ? "Send reset instructions" :
    mode === "reset-password" ? "Reset password" :
    token ? "Confirm email address" : "Resend verification email";

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <h2>Good work deserves<br />a simpler way to get paid.</h2>
          <p>
            Bring your clients, invoices and stablecoin payments
            together in one clear workspace.
          </p>
          <div className="auth-route">
            <span>Send an invoice</span>
            <i />
            <span>Share a link</span>
            <i />
            <span>Follow settlement</span>
          </div>
        </div>
        <span className="auth-foot">
          PayBridge · USDC settlement on Base
        </span>
      </aside>

      <main id="main-content" className="auth-main">
        <div className="auth-mobile-brand"><Brand /></div>
        <div className="auth-form-wrap">
          <h1>{titles[mode]}</h1>
          <p className="auth-description">{descriptions[mode]}</p>

          {error && <Alert>{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}

          {resetInvalid ? (
            <>
              <Alert>
                This reset link is missing or invalid.
                Request a new one to continue.
              </Alert>
              <Link className="button" href="/forgot-password">
                Request reset link
              </Link>
            </>
          ) : completed ? (
            <div className="stack">
              <Link href="/login" className="button">
                Continue to sign in <Icon name="arrow" />
              </Link>
              {mode === "register" && (
                <Link href="/verify-email">Resend verification email</Link>
              )}
            </div>
          ) : (
            <form className="form-stack" onSubmit={submit}>
              <AuthFields mode={mode} token={token} />
              <button className="button wide" disabled={busy}>
                {busy ? "Please wait…" : buttonLabel}
                {!busy && <Icon name="arrow" />}
              </button>
            </form>
          )}

          <div className="auth-links">
            {mode === "login" ? (
              <>
                New to PayBridge?{" "}
                <Link href="/register">Create an account</Link>
                <Link href="/verify-email">Need to verify your email?</Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login">Sign in</Link>
              </>
            )}
          </div>
        </div>

        <div className="auth-bottom">
          Your credentials stay in a secure, HTTP-only session.
        </div>
      </main>
    </div>
  );
}