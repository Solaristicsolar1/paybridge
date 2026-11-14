"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { paymentsApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Badge,
  Empty,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
  PaginationControls,
} from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { formatDate, formatMoney, statusLabel } from "@/lib/format";

export function PaymentsScreen() {
  const { business } = useWorkspace();
  const businessId = business!.id;
  const [page, setPage] = useState(1);

  const load = useCallback(
    (signal: AbortSignal) => paymentsApi.list(
      businessId,
      { page, limit: 20 },
      signal,
    ),
    [businessId, page],
  );

  const { data, loading, error, reload } = useResource(load);

  return (
    <>
      <PageHeading
        title="Payments"
        description="Follow checkout progress and verified settlement."
        action={
          <button
            className="button secondary"
            onClick={reload}
            disabled={loading}
          >
            <Icon name="refresh" />
            Refresh
          </button>
        }
      />

      <section className="panel">
        {loading ? (
          <Loading label="Loading payments…" />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : data && (
          <>
            {data.data.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Payments table"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Invoice</th>
                      <th scope="col">Source</th>
                      <th scope="col">Payment status</th>
                      <th scope="col">Provider status</th>
                      <th scope="col" className="numeric">Invoice amount</th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.data.map(payment => (
                      <tr key={payment.id}>
                        <td>
                          <Link
                            className="record-link"
                            href={`/payments/${payment.id}`}
                          >
                            {payment.invoice.invoiceNumber}
                          </Link>
                          <small>{formatDate(payment.createdAt)}</small>
                        </td>

                        <td>
                          {payment.sourceTokenSymbol || "Pending"}
                          <small>
                            {payment.sourceChain || "Network pending"}
                          </small>
                        </td>

                        <td><Badge status={payment.status} /></td>

                        <td>
                          {payment.providerStatus
                            ? statusLabel(payment.providerStatus)
                            : "Awaiting update"}
                        </td>

                        <td className="numeric">
                          {formatMoney(
                            payment.invoiceAmount,
                            payment.invoice.currency,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                icon="payment"
                title="Ready when your clients are"
                description="Payment records appear when a client starts checkout from an issued invoice."
                action={
                  <Link href="/invoices" className="button secondary">
                    Open invoices <Icon name="arrow" />
                  </Link>
                }
              />
            )}

            <PaginationControls
              pagination={data.pagination}
              onPage={setPage}
            />
          </>
        )}
      </section>

      <p className="footnote">
        Pending payments do not count as confirmed settlement.
        Provider progress alone does not mark an invoice paid.
      </p>
    </>
  );
}