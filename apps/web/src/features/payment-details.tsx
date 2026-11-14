"use client";

import Link from "next/link";
import { useCallback, useEffect } from "react";
import { paymentsApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  BackLink,
  Badge,
  CopyButton,
  Empty,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
} from "@/components/ui";
import { PaymentProgress } from "@/components/payment-progress";
import { useResource } from "@/hooks/use-resource";
import { formatDate, formatMoney, statusLabel } from "@/lib/format";

export function PaymentDetailsScreen({
  paymentId,
}: {
  paymentId: string;
}) {
  const { business } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(
    () => paymentsApi.get(businessId, paymentId),
    [businessId, paymentId],
  );

  const resource = useResource(load);

  useEffect(() => {
    if (resource.data?.status !== "PENDING") return;

    const timer = setInterval(resource.reload, 30_000);
    return () => clearInterval(timer);
  }, [resource.data?.status, resource.reload]);

  if (resource.loading) {
    return <Loading label="Loading payment…" />;
  }

  if (resource.error || !resource.data) {
    return (
      <ErrorState
        error={resource.error || "Payment not found."}
        retry={resource.reload}
      />
    );
  }

  const payment = resource.data;

  return (
    <>
      <BackLink href="/payments">All payments</BackLink>

      <PageHeading
        title="Payment details"
        description={payment.invoice.invoiceNumber}
        action={
          <button className="button secondary" onClick={resource.reload}>
            <Icon name="refresh" />
            Refresh status
          </button>
        }
      />

      <section className="panel panel-padding">
        <div className="section-heading">
          <h2>
            {formatMoney(payment.invoiceAmount, payment.invoice.currency)}
          </h2>
          <Badge status={payment.status} />
        </div>

        {(payment.status === "PENDING" ||
          payment.status === "CONFIRMED") && (
          <PaymentProgress
            status={payment.status}
            providerStatus={payment.providerStatus}
          />
        )}

        {payment.status === "CONFIRMED" ? (
          <Alert tone="success">
            Settlement has been confirmed by PayBridge.
          </Alert>
        ) : payment.status === "PENDING" ? (
          <Alert tone="info">
            Waiting for verified settlement.
            This page checks for updates every 30 seconds.
          </Alert>
        ) : (
          <Alert tone="info">
            This payment is {statusLabel(payment.status).toLowerCase()}.
            Review its event history for details.
          </Alert>
        )}

        <dl className="details two-column-details">
          <div>
            <dt>Invoice</dt>
            <dd>
              <Link href={`/invoices/${payment.invoiceId}`}>
                {payment.invoice.invoiceNumber}
              </Link>
            </dd>
          </div>

          <div>
            <dt>Provider status</dt>
            <dd>
              {payment.providerStatus
                ? statusLabel(payment.providerStatus)
                : "Awaiting update"}
            </dd>
          </div>

          <div>
            <dt>Source asset</dt>
            <dd>
              {payment.sourceTokenSymbol || "Not available"} ·{" "}
              {payment.sourceChain || "Not available"}
            </dd>
          </div>

          <div>
            <dt>Destination asset</dt>
            <dd>
              {payment.destinationTokenSymbol} · {payment.destinationChain}
            </dd>
          </div>

          <div>
            <dt>Destination amount</dt>
            <dd>
              {payment.destinationAmount
                ? `${payment.destinationAmount} ${payment.destinationTokenSymbol}`
                : "Not available"}
            </dd>
          </div>

          <div>
            <dt>Confirmed at</dt>
            <dd>{formatDate(payment.confirmedAt)}</dd>
          </div>

          <div>
            <dt>Original refund address</dt>
            <dd className="address">
              {payment.sourceRefundAddress || "Not available"}
            </dd>
          </div>

          <div>
            <dt>Payout address</dt>
            <dd className="address">
              {payment.payoutAddress || "Not available"}
            </dd>
          </div>

          <div>
            <dt>Destination transaction</dt>
            <dd className="address">
              {payment.destinationTxHash || "Not confirmed"}
              {payment.destinationTxHash && (
                <CopyButton value={payment.destinationTxHash} />
              )}
            </dd>
          </div>

          <div>
            <dt>Payment reference</dt>
            <dd className="address">{payment.id}</dd>
          </div>
        </dl>
      </section>

      <div className="section-heading">
        <h2>Payment event history</h2>
      </div>

      <section className="panel">
        {payment.events.length ? (
          <ol className="event-list">
            {payment.events.map(event => (
              <li key={event.id}>
                <span className="event-dot" />

                <div>
                  <strong>{statusLabel(event.eventType)}</strong>
                  <small>
                    {formatDate(event.occurredAt)}
                    {event.previousStatus && event.newStatus
                      ? ` · ${statusLabel(event.previousStatus)} → ${statusLabel(event.newStatus)}`
                      : ""}
                  </small>
                </div>

                {event.newStatus && <Badge status={event.newStatus} />}
              </li>
            ))}
          </ol>
        ) : (
          <Empty
            icon="payment"
            title="No events recorded yet"
            description="Payment updates will be listed here as they are recorded."
          />
        )}
      </section>
    </>
  );
}