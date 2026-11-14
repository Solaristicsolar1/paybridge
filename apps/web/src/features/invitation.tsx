"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authApi, membersApi, ApiError } from "@/lib/api";
import { errorMessage } from "@/hooks/use-resource";
import { Alert, Brand } from "@/components/ui";

export function AcceptInvitationScreen() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const businessId = params.get("businessId") || "";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const valid =
    /^[a-f0-9]{64}$/i.test(token) &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(businessId);

  const returnPath =
    `/invitations/accept?businessId=${encodeURIComponent(businessId)}` +
    `&token=${encodeURIComponent(token)}`;

  async function accept() {
    setBusy(true);
    setError("");

    try {
      await authApi.me();
      const result = await membersApi.accept(businessId, token);
      setSuccess(result.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setNeedsLogin(true);
        setError("Sign in with the invited email address to continue.");
      } else {
        setError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" className="public-message">
      <Brand />
      <h1>You’re invited.</h1>
      <p>
        Join a PayBridge business workspace with the account
        that received this invitation.
      </p>

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      {!valid ? (
        <Alert>
          This invitation link is invalid.
          Ask your business administrator to resend it.
        </Alert>
      ) : success ? (
        <Link className="button" href="/businesses">
          Open your businesses
        </Link>
      ) : needsLogin ? (
        <Link
          className="button"
          href={`/login?next=${encodeURIComponent(returnPath)}`}
        >
          Sign in to accept invitation
        </Link>
      ) : (
        <button
          className="button"
          disabled={busy}
          onClick={() => void accept()}
        >
          {busy ? "Joining…" : "Accept invitation"}
        </button>
      )}
    </main>
  );
}