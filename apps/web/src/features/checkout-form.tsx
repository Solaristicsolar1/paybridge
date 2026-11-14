"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  publicApi,
  type Checkout,
  type CheckoutInput,
} from "@/lib/api";
import {
  Alert, ErrorState, Field, Icon, Loading,
} from "@/components/ui";
import { errorMessage, useResource } from "@/hooks/use-resource";

export function CheckoutForm({
  token,
  onCreated,
}: {
  token: string;
  onCreated: (checkout: Checkout) => void;
}) {
  const load = useCallback(() => publicApi.assets(), []);
  const resource = useResource(load);

  const [assetId, setAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const lock = useRef(false);
  const request = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const selected = resource.data?.find(asset => asset.assetId === assetId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;

    const form = new FormData(event.currentTarget);

    const input: CheckoutInput = {
      originAsset: assetId,
      refundTo: String(form.get("refundTo") || "").trim(),
      slippageTolerance: Number(form.get("slippageTolerance") || 100),
    };

    const fingerprint = JSON.stringify(input);

    if (!request.current || request.current.fingerprint !== fingerprint) {
      request.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }

    lock.current = true;
    setBusy(true);
    setError("");

    try {
      const checkout = await publicApi.checkout(
        token,
        input,
        request.current.key,
      );
      onCreated(checkout);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-padding">
      <h2>Choose how to pay</h2>
      <p className="muted">
        Select your source asset and network.
        The business receives USDC on Base.
      </p>

      {error && <Alert>{error}</Alert>}

      {resource.loading ? (
        <Loading label="Loading supported assets…" />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <Alert tone="info">
          No payment assets are available right now. Please try again later.
        </Alert>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <Field label="Asset and network">
            <select
              value={assetId}
              onChange={event => setAssetId(event.target.value)}
              required
              disabled={busy}
            >
              <option value="">Select an asset and network</option>
              {resource.data.map(asset => (
                <option key={asset.assetId} value={asset.assetId}>
                  {asset.symbol} · {asset.blockchain}
                </option>
              ))}
            </select>
          </Field>

          {selected && (
            <Alert tone="info">
              Send only {selected.symbol} on {selected.blockchain},
              using the instructions from the next step.
            </Alert>
          )}

          <Field
            label="Your refund wallet address"
            hint="An EVM wallet on your selected source network. Used if the provider returns funds; this does not request a merchant refund."
          >
            <input
              name="refundTo"
              pattern="0x[a-fA-F0-9]{40}"
              title="A 0x-prefixed EVM wallet address"
              maxLength={42}
              required
              autoComplete="off"
              spellCheck={false}
              placeholder="0x…"
              disabled={busy}
            />
          </Field>

          <Field
            label="Slippage tolerance"
            hint="Maximum permitted conversion slippage."
          >
            <select
              name="slippageTolerance"
              defaultValue="100"
              disabled={busy}
            >
              <option value="50">0.5%</option>
              <option value="100">1%</option>
              <option value="200">2%</option>
            </select>
          </Field>

          <button className="button wide" disabled={busy || !assetId}>
            {busy ? "Preparing payment…" : "Get deposit instructions"}
            <Icon name="arrow" />
          </button>

          <p className="footnote">
            The next step gives the exact payment amount.
            Creating a checkout does not mean a payment is complete.
          </p>
        </form>
      )}
    </section>
  );
}