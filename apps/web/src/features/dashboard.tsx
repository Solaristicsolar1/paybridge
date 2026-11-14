"use client";

import Link from "next/link";
import { useCallback } from "react";
import { invoicesApi, paymentsApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  Badge,
  Empty,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
} from "@/components/ui";
import { InvoiceTable } from "@/components/invoice-table";
import { useResource } from "@/hooks/use-resource";
import { formatDate, formatMoney } from "@/lib/format";
import { canManageFinancialRecords } from "@/lib/permissions";

export function DashboardScreen() {
  const { business, role } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(async (signal: AbortSignal) => {
    const [invoices, payments, sent, overdue] = await Promise.all([
      invoicesApi.list(businessId, { limit: 5 }, signal),
      paymentsApi.list(businessId, { limit: 4 }, signal),
      invoicesApi.list(
        businessId,
        { limit: 1, status: "SENT" },
        signal,
      ),
      invoicesApi.list(
        businessId,
        { limit: 1, status: "OVERDUE" },
        signal,
      ),
    ]);

    return {
      invoices,
      payments,
      sent: sent.pagination.total,
      overdue: overdue.pagination.total,
    };
  }, [businessId]);

  const { data, loading, error, reload } = useResource(load);

  const createAction = canManageFinancialRecords(role) ? (
    <Link href="/invoices/new" className="button">
      <Icon name="plus" />
      Create invoice
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeading
        title="Your business, in motion."
        description="Create invoices. Follow payments. Stay in control."
        action={createAction}
      />

      {!business?.basePayoutAddress && (
        <Alert tone="info">
          <div className="notice-content">
            <span>Set your Base payout wallet before accepting payments.</span>
            <Link href="/settings">
              Open settings <Icon name="arrow" size={16} />
            </Link>
          </div>
        </Alert>
      )}

      <div className="lifecycle-guide">
        <div>
          <span className="stage-dot" />
          <h2>Create an invoice</h2>
          <p>Add a client and your line items.</p>
        </div>
        <div>
          <span className="stage-dot" />
          <h2>Share the payment link</h2>
          <p>Your client chooses a supported asset.</p>
        </div>
        <div>
          <span className="stage-dot" />
          <h2>Track verified settlement</h2>
          <p>Payment updates come from PayBridge.</p>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : data && (
        <>
          <div className="section-heading">
            <h2>Recent invoices</h2>
            <Link href="/invoices">
              View all invoices <Icon name="arrow" size={16} />
            </Link>
          </div>

          <section className="panel">
            <div className="record-summary">
              <span>
                {data.invoices.pagination.total} invoice
                {data.invoices.pagination.total === 1 ? "" : "s"}
              </span>
              <Link href="/invoices?status=SENT">
                {data.sent} sent
              </Link>
              <Link href="/invoices?status=OVERDUE">
                {data.overdue} overdue
              </Link>
            </div>

            <InvoiceTable
              invoices={data.invoices.data}
              emptyAction={createAction}
            />
          </section>

          <div className="section-heading">
            <div>
              <h2>Latest payments</h2>
              <p className="muted">
                Payment records and provider progress are tracked separately.
              </p>
            </div>
            <Link href="/payments">
              View all payments <Icon name="arrow" size={16} />
            </Link>
          </div>

          <section className="panel">
            {data.payments.data.length ? (
              <div className="payment-feed">
                {data.payments.data.map(payment => (
                  <Link
                    href={`/payments/${payment.id}`}
                    key={payment.id}
                  >
                    <span className="feed-icon">
                      <Icon name="payment" />
                    </span>

                    <div>
                      <strong>{payment.invoice.invoiceNumber}</strong>
                      <small>
                        {payment.sourceTokenSymbol || "Asset pending"} ·{" "}
                        {payment.sourceChain || "Network pending"} ·{" "}
                        {formatDate(payment.createdAt)}
                      </small>
                    </div>

                    <div className="feed-amount">
                      <strong>
                        {formatMoney(
                          payment.invoiceAmount,
                          payment.invoice.currency,
                        )}
                      </strong>
                      <Badge status={payment.status} />
                    </div>

                    <Icon name="arrow" size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon="payment"
                title="Payments will appear here"
                description="When a client starts checkout, you’ll be able to follow its progress here."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}