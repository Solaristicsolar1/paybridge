"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { invoicesApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert, BackLink, Badge, Confirm, CopyButton,
  ErrorState, Icon, Loading, PageHeading,
} from "@/components/ui";
import { errorMessage, useResource } from "@/hooks/use-resource";
import { formatDate, formatMoney } from "@/lib/format";
import {
  canCancelInvoice,
  canManageFinancialRecords,
} from "@/lib/permissions";
import { InvoiceDocument } from "./invoice-document";

export function InvoiceDetailsScreen({
  invoiceId,
}: {
  invoiceId: string;
}) {
  const { business, role } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(
    () => invoicesApi.get(businessId, invoiceId),
    [businessId, invoiceId],
  );

  const { data: invoice, loading, error, reload } = useResource(load);
  const [action, setAction] = useState<"issue" | "cancel" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");

  async function performAction() {
    if (!action) return;
    setBusy(true);
    setActionError("");
    setSuccess("");

    try {
      if (action === "issue") {
        await invoicesApi.issue(businessId, invoiceId);
        setSuccess("Invoice issued. You can now share its payment link.");
      } else {
        await invoicesApi.cancel(businessId, invoiceId);
        setSuccess("Invoice cancelled.");
      }
      setAction(null);
      reload();
    } catch (error) {
      setActionError(errorMessage(error));
      setAction(null);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading label="Loading invoice…" />;

  if (error || !invoice) {
    return <ErrorState error={error || "Invoice not found."} retry={reload} />;
  }

  const mayEdit =
    invoice.status === "DRAFT" && canManageFinancialRecords(role);

  const mayCancel =
    !["CANCELLED", "PAID", "OVERPAID"].includes(invoice.status) &&
    canCancelInvoice(role);

  const shareable = !["DRAFT", "CANCELLED"].includes(invoice.status);
  const publicPath = `/pay/${invoice.publicToken}`;
  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}${publicPath}`
    : publicPath;

  return (
    <>
      <BackLink href="/invoices">All invoices</BackLink>

      <PageHeading
        title={invoice.invoiceNumber}
        description={`Created for ${invoice.client.name}`}
        action={
          <div className="button-group">
            {mayEdit && (
              <>
                <Link
                  className="button secondary"
                  href={`/invoices/${invoiceId}/edit`}
                >
                  Edit draft
                </Link>
                <button className="button" onClick={() => setAction("issue")}>
                  Issue invoice <Icon name="arrow" />
                </button>
              </>
            )}
            {mayCancel && (
              <button
                className="button danger-outline"
                onClick={() => setAction("cancel")}
              >
                Cancel invoice
              </button>
            )}
          </div>
        }
      />

      {success && <Alert tone="success">{success}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}

      {invoice.status === "OVERPAID" && (
        <Alert tone="info">
          This invoice is overpaid. Review its confirmed payment records
          with your team. Merchant refund execution is not currently available.
        </Alert>
      )}

      {shareable && (
        <div className="share-bar">
          <Icon name="link" />
          <div>
            <strong>Share this invoice</strong>
            <Link href={publicPath} target="_blank" rel="noopener noreferrer">
              {publicUrl}
            </Link>
          </div>
          <CopyButton value={publicUrl} label="Copy link" />
        </div>
      )}

      <InvoiceDocument invoice={invoice} businessName={business!.name} />

      {!!invoice.installments.length && (
        <section className="panel panel-padding installment-section">
          <h2>Installment schedule</h2>
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Installment schedule"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Installment</th>
                  <th scope="col">Due</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="numeric">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.installments.map(item => (
                  <tr key={item.id}>
                    <td>{item.installmentNumber}</td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td><Badge status={item.status} /></td>
                    <td className="numeric">
                      {formatMoney(item.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {action && (
        <Confirm
          title={action === "issue"
            ? "Issue this invoice?"
            : "Cancel this invoice?"}
          description={action === "issue"
            ? "Issuing makes this invoice available through its public payment link. You can no longer edit the draft."
            : "This prevents new checkouts. Cancellation depends on the invoice status and payment history."}
          actionLabel={action === "issue" ? "Issue invoice" : "Cancel invoice"}
          busy={busy}
          onClose={() => setAction(null)}
          onConfirm={() => void performAction()}
        />
      )}
    </>
  );
}