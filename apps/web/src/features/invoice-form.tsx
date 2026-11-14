"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import {
  clientsApi,
  invoicesApi,
  type Currency,
  type Invoice,
  type InvoiceInput,
  type InvoiceItemInput,
} from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  BackLink,
  ErrorState,
  Field,
  Icon,
  Loading,
  PageHeading,
} from "@/components/ui";
import { errorMessage, useResource } from "@/hooks/use-resource";
import { canManageFinancialRecords } from "@/lib/permissions";
import {
  InvoiceHeaderFields,
  InvoiceItemsEditor,
} from "./invoice-fields";

export function InvoiceFormScreen({ invoiceId }: { invoiceId?: string }) {
  const { business, role } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(
    async () => invoiceId
      ? invoicesApi.get(businessId, invoiceId)
      : null,
    [businessId, invoiceId],
  );

  const resource = useResource(load);

  if (!canManageFinancialRecords(role)) {
    return (
      <Alert tone="info">
        An owner, administrator or accountant can create and edit invoices.
      </Alert>
    );
  }

  return (
    <>
      <BackLink href="/invoices">All invoices</BackLink>

      <PageHeading
        title={invoiceId ? "Edit draft invoice" : "Create an invoice"}
        description="Start with a draft. Review the saved totals before issuing."
      />

      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : resource.data && resource.data.status !== "DRAFT" ? (
        <Alert>Only draft invoices can be edited.</Alert>
      ) : (
        <InvoiceForm
          key={resource.data?.updatedAt || "new"}
          invoice={resource.data}
          businessId={businessId}
          defaultCurrency={business!.defaultCurrency}
        />
      )}
    </>
  );
}

function InvoiceForm({
  invoice,
  businessId,
  defaultCurrency,
}: {
  invoice: Invoice | null;
  businessId: string;
  defaultCurrency: Currency;
}) {
  const router = useRouter();

  const [items, setItems] = useState<InvoiceItemInput[]>(
    invoice?.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })) || [{ description: "", quantity: "1", unitPrice: "" }],
  );

  const [clientSearch, setClientSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadClients = useCallback(
    (signal: AbortSignal) => clientsApi.list(
      businessId,
      { limit: 100, search: clientSearch },
      signal,
    ),
    [businessId, clientSearch],
  );

  const clients = useResource(loadClients);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const dueDate = String(form.get("dueDate") || "");
    const issueDate = String(form.get("issueDate") || "");

    const input: InvoiceInput = {
      clientId: invoice?.clientId || String(form.get("clientId") || ""),
      currency: (invoice?.currency || form.get("currency")) as Currency,
      items,
      taxRate: String(form.get("taxRate") || "0"),
      notes: String(form.get("notes") || "").trim(),
      ...(dueDate ? { dueDate } : {}),
      ...(issueDate ? { issueDate } : {}),
    };

    setBusy(true);
    setError("");

    try {
      if (items.some(item => !item.description.trim())) {
        throw new Error("Add a description for each line item.");
      }

      if (invoice && (
        (!dueDate && invoice.dueDate) ||
        (!issueDate && invoice.issueDate)
      )) {
        throw new Error(
          "Saved invoice dates can be changed but cannot currently be removed. Choose a replacement date before saving.",
        );
      }

      if (invoice) {
        await invoicesApi.update(businessId, invoice.id, {
          items,
          taxRate: input.taxRate,
          notes: input.notes,
          ...(dueDate ? { dueDate } : {}),
          ...(issueDate ? { issueDate } : {}),
        });
      } else {
        await invoicesApi.create(businessId, input);
      }

      router.push("/invoices");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-padding">
      {error && <Alert>{error}</Alert>}
      {clients.error && (
        <ErrorState error={clients.error} retry={clients.reload} />
      )}

      <form className="form-stack" onSubmit={submit}>
        <InvoiceHeaderFields
          invoice={invoice}
          defaultCurrency={defaultCurrency}
          clients={clients.data?.data || []}
          clientsLoading={clients.loading}
          clientSearch={clientSearch}
          onClientSearch={setClientSearch}
        />

        <InvoiceItemsEditor items={items} onChange={setItems} />

        <Field label="Notes (optional)">
          <textarea
            name="notes"
            rows={3}
            maxLength={5000}
            defaultValue={invoice?.notes || ""}
            placeholder="Payment terms or a note for your client"
          />
        </Field>

        <div className="save-notice">
          <Icon name="invoice" />
          <p>
            Your subtotal, tax and invoice total will be calculated when
            you save the draft. Review them before issuing.
          </p>
        </div>

        <div className="form-actions">
          <Link className="button secondary" href="/invoices">
            Cancel
          </Link>

          <button
            className="button"
            disabled={busy || (
              !invoice && (
                clients.loading || !clients.data?.data.length
              )
            )}
          >
            {busy ? "Saving draft…" : "Save draft invoice"}
            <Icon name="arrow" />
          </button>
        </div>
      </form>
    </section>
  );
}