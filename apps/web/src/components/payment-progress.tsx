"use client";

import type { PaymentStatus } from "@/lib/api";
import { statusLabel } from "@/lib/format";
import { Icon } from "./ui";

export function PaymentProgress({
  status,
  providerStatus,
}: {
  status: PaymentStatus;
  providerStatus?: string | null;
}) {
  const confirmed = status === "CONFIRMED";

  const processing = !confirmed && [
    "PROCESSING", "KNOWN_DEPOSIT_TX", "SUCCESS",
  ].includes(providerStatus || "");

  const stages = [
    { label: "Checkout created", complete: true, current: false },
    {
      label: "Deposit & processing",
      complete: processing || confirmed,
      current: !processing && !confirmed,
    },
    {
      label: "Verified settlement",
      complete: confirmed,
      current: false,
    },
  ];

  return (
    <div
      className={`payment-progress ${confirmed ? "settled" : ""}`}
      role="group"
      aria-label={`Payment ${statusLabel(status)}`}
    >
      {stages.map(stage => (
        <div
          key={stage.label}
          className={`progress-stage ${
            stage.complete ? "complete" : stage.current ? "current" : ""
          }`}
        >
          <span>
            {stage.complete && <Icon name="check" size={14} />}
          </span>
          <strong>{stage.label}</strong>
        </div>
      ))}
    </div>
  );
}