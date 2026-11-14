"use client";

import { useEffect, useState } from "react";
import type { Checkout } from "@/lib/api";
import { Loading } from "@/components/ui";
import { CheckoutForm } from "./checkout-form";
import { PaymentTracker } from "./payment-tracker";

export function CheckoutPanel({
  token,
  onConfirmed,
}: {
  token: string;
  onConfirmed: (paymentId: string) => void;
}) {
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [paymentId, setPaymentId] = useState("");
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const requested = new URLSearchParams(
      window.location.search,
    ).get("payment") || "";

    const requestedId = /^[a-f0-9-]{36}$/i.test(requested)
      ? requested
      : "";

    let restored: Checkout | null = null;

    try {
      const saved = sessionStorage.getItem(`pb:checkout:${token}`);

      if (saved) {
        const value = JSON.parse(saved) as Checkout;

        if (
          value &&
          typeof value.paymentId === "string" &&
          /^[a-f0-9-]{36}$/i.test(value.paymentId) &&
          value.sourceAsset &&
          (!value.deposit || typeof value.deposit.address === "string")
        ) {
          restored = value;
        }
      }
    } catch {
      // Invalid local instructions are ignored.
    }

    if (requestedId && restored?.paymentId !== requestedId) {
      restored = null;
    }

    setCheckout(restored);
    setPaymentId(requestedId || restored?.paymentId || "");
    setRestoring(false);
  }, [token]);

  function created(value: Checkout) {
    setCheckout(value);
    setPaymentId(value.paymentId);

    try {
      sessionStorage.setItem(
        `pb:checkout:${token}`,
        JSON.stringify(value),
      );
    } catch {
      // Instructions remain available in memory.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("payment", value.paymentId);
    window.history.replaceState(null, "", url);
  }

  if (restoring) {
    return <Loading label="Checking payment session…" />;
  }

  if (paymentId) {
    return (
      <PaymentTracker
        token={token}
        paymentId={paymentId}
        checkout={checkout}
        onConfirmed={onConfirmed}
      />
    );
  }

  return <CheckoutForm token={token} onCreated={created} />;
}