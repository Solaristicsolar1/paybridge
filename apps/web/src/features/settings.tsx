"use client";

import { useState, type FormEvent } from "react";
import { businessesApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  Badge,
  Field,
  PageHeading,
} from "@/components/ui";
import { errorMessage } from "@/hooks/use-resource";
import { canUpdatePayout } from "@/lib/permissions";

export function SettingsScreen() {
  const {
    business,
    user,
    role,
    refreshBusinesses,
  } = useWorkspace();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const businessId = business?.id;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!businessId) return;

    const form = new FormData(event.currentTarget);
    const address = String(
      form.get("basePayoutAddress") || "",
    ).trim();

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      await businessesApi.payout(businessId, address);
      await refreshBusinesses();

      setSuccess(
        "Payout wallet saved. Future checkouts will use this destination.",
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!business) return null;

  const canEditWallet = canUpdatePayout(role);

  return (
    <>
      <PageHeading
        title="Settings"
        description="Your business, settlement destination and account."
      />

      <div className="settings-grid">
        <section className="panel panel-padding">
          <h2>Business profile</h2>

          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{business.name}</dd>
            </div>
            <div>
              <dt>Default currency</dt>
              <dd>{business.defaultCurrency}</dd>
            </div>
            <div>
              <dt>Your role</dt>
              <dd>
                <Badge status={role || "MEMBER"} />
              </dd>
            </div>
          </dl>
        </section>

        <section className="panel panel-padding">
          <h2>Payout wallet</h2>

          <p className="muted">
            Receive merchant settlement in USDC on Base.
            Use a Base-compatible EVM wallet that you control.
          </p>

          {error && <Alert>{error}</Alert>}
          {success && (
            <Alert tone="success">{success}</Alert>
          )}

          <form className="form-stack" onSubmit={save}>
            <Field
              label="Base wallet address"
              hint="Address format is validated; wallet ownership is not verified."
            >
              <input
                name="basePayoutAddress"
                defaultValue={business.basePayoutAddress || ""}
                required
                pattern="0x[a-fA-F0-9]{40}"
                title="A 0x-prefixed, 40-character hexadecimal EVM address"
                placeholder="0x…"
                disabled={!canEditWallet || busy}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>

            {canEditWallet ? (
              <button className="button" disabled={busy}>
                {busy ? "Saving…" : "Save payout wallet"}
              </button>
            ) : (
              <Alert tone="info">
                An owner or administrator can update the payout wallet.
              </Alert>
            )}
          </form>
        </section>

        <section className="panel panel-padding">
          <h2>Your account</h2>

          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{user.displayName || "Not set"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Email status</dt>
              <dd>
                <Badge
                  status={user.emailVerifiedAt
                    ? "VERIFIED"
                    : "UNVERIFIED"}
                />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}