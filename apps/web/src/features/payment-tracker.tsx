"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  publicApi,
  type Checkout,
  type PublicPayment,
} from "@/lib/api";
import {
  Alert, Badge, CopyButton, Field, Icon, Loading,
} from "@/components/ui";
import { PaymentProgress } from "@/components/payment-progress";
import { errorMessage } from "@/hooks/use-resource";
import { formatMoney, statusLabel } from "@/lib/format";

export function PaymentTracker({
  token,
  paymentId,
  checkout,
  onConfirmed,
}: {
  token: string;
  paymentId: string;
  checkout: Checkout | null;
  onConfirmed: (paymentId: string) => void;
}) {
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [version, setVersion] = useState(0);
  const [now, setNow] = useState(Date.now());
  const notified = useRef("");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      setBusy(true);
      try {
        const record = await publicApi.status(
          token, paymentId, controller.signal,
        );

        if (controller.signal.aborted) return;

        setPayment(record);
        setError("");

        if (record.status === "CONFIRMED" && notified.current !== record.id) {
          notified.current = record.id;
          onConfirmed(record.id);
        }

        if (record.status === "PENDING") {
          timer = setTimeout(poll, 10_000);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(errorMessage(error));
          timer = setTimeout(poll, 15_000);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }

    void poll();

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [token, paymentId, version, onConfirmed]);

  useEffect(() => {
    if (!checkout?.deposit?.expiresAt || payment?.status !== "PENDING") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [checkout?.deposit?.expiresAt, payment?.status]);

  const status = payment?.status;
  const deposit = checkout?.deposit;
  const expiry = deposit?.expiresAt ? Date.parse(deposit.expiresAt) : NaN;
  const expired = Number.isFinite(expiry) && now >= expiry;
  const terminal = !!status && status !== "PENDING";

  return (
    <section className="panel panel-padding">
      <div className="section-heading">
        <h2>
          {status === "CONFIRMED"
            ? "Payment confirmed"
            : terminal
              ? `Payment ${statusLabel(status!).toLowerCase()}`
              : "Your payment instructions"}
        </h2>
        {status && <Badge status={status} />}
      </div>

      {error && <Alert>{error}</Alert>}
      {!payment && busy && <Loading label="Checking payment status…" />}

      {payment && (
        <>
          {(status === "PENDING" || status === "CONFIRMED") && (
            <PaymentProgress
              status={payment.status}
              providerStatus={payment.providerStatus}
            />
          )}

          {status === "CONFIRMED" ? (
            <Alert tone="success">
              PayBridge has verified settlement. Thank you for your payment.
            </Alert>
          ) : terminal ? (
            <Alert tone="info">
              This payment is {statusLabel(status!).toLowerCase()}.
              Contact the business before sending any more funds.
            </Alert>
          ) : (
            <>
              {deposit && !expired ? (
                <>
                  <div className="deposit-amount">
                    <span>Send exactly</span>
                    {deposit.formattedAmount ? (
                      <strong>
                        {deposit.formattedAmount} {checkout?.sourceAsset.symbol}
                      </strong>
                    ) : (
                      <p>
                        Exact source amount is unavailable.
                        Do not send funds. Contact the business.
                      </p>
                    )}
                    <span>on {checkout?.sourceAsset.blockchain}</span>
                  </div>

                  <Field label="Deposit address">
                    <div className="copy-value">
                      <span className="address">{deposit.address}</span>
                      <CopyButton value={deposit.address} />
                    </div>
                  </Field>

                  {deposit.memo && (
                    <Field label="Required deposit memo">
                      <div className="copy-value">
                        <span className="address">{deposit.memo}</span>
                        <CopyButton value={deposit.memo} />
                      </div>
                    </Field>
                  )}

                  {Number.isFinite(expiry) && (
                    <p className="expiry">
                      Instructions expire{" "}
                      {new Intl.DateTimeFormat("en-GB", {
                        dateStyle: "medium", timeStyle: "short",
                      }).format(new Date(expiry))}{" "}
                      (your local time). Send before expiry.
                    </p>
                  )}
                </>
              ) : (
                <Alert tone="info">
                  {expired
                    ? "These instructions have expired. Do not send funds to them. Contact the business for the next step."
                    : "Deposit instructions are unavailable in this browser session. Contact the business before sending funds."}
                </Alert>
              )}

              <p className="muted">
                Waiting for verified settlement. Status updates automatically;
                a deposit alone does not confirm payment.
              </p>
            </>
          )}

          {checkout && (
            <p className="footnote">
              Amount reserved for this checkout:{" "}
              {formatMoney(checkout.invoiceAmount, "USD")}.
            </p>
          )}

          <dl className="details">
            <div>
              <dt>PayBridge status</dt>
              <dd>{statusLabel(payment.status)}</dd>
            </div>
            <div>
              <dt>Provider progress</dt>
              <dd>
                {payment.providerStatus
                  ? statusLabel(payment.providerStatus)
                  : "Awaiting update"}
              </dd>
            </div>
            {payment.destinationTxHash && (
              <div>
                <dt>Settlement transaction</dt>
                <dd className="address">{payment.destinationTxHash}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      <button
        className="button secondary wide"
        disabled={busy}
        onClick={() => setVersion(value => value + 1)}
      >
        <Icon name="refresh" />
        {busy ? "Checking…" : "Refresh payment status"}
      </button>

      <p className="footnote address">Payment reference: {paymentId}</p>
      <Link
        className="footnote"
        href={`/pay/${token}?payment=${paymentId}`}
      >
        Payment status link
      </Link>
    </section>
  );
}