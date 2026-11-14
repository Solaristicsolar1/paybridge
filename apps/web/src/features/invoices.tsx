"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

import {
  invoicesApi,
  invoiceStatuses,
  type InvoiceStatus,
} from "@/lib/api";

import { useWorkspace } from "@/components/workspace";
import { InvoiceTable } from "@/components/invoice-table";

import {
  Empty,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
  PaginationControls,
} from "@/components/ui";

import { useResource } from "@/hooks/use-resource";
import { statusLabel } from "@/lib/format";
import { canManageFinancialRecords } from "@/lib/permissions";

export function InvoicesScreen() {
  const { business, role } = useWorkspace();
  const businessId = business!.id;
  const params = useSearchParams();

  const initialStatus = params.get("status");

  const [status, setStatus] = useState<InvoiceStatus | "">(
    invoiceStatuses.includes(initialStatus as InvoiceStatus)
      ? initialStatus as InvoiceStatus
      : "",
  );

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(
    (signal: AbortSignal) => invoicesApi.list(
      businessId,
      {
        page,
        search,
        status: status || undefined,
        limit: 20,
      },
      signal,
    ),
    [businessId, page, search, status],
  );

  const { data, loading, error, reload } = useResource(load);

  const createAction = canManageFinancialRecords(role) ? (
    <Link className="button" href="/invoices/new">
      <Icon name="plus" />
      Create invoice
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeading
        title="Invoices"
        description="From first draft to verified payment."
        action={createAction}
      />

      <section className="panel">
        <form
          className="toolbar"
          onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setSearch(String(form.get("search") || "").trim());
            setPage(1);
          }}
        >
          <div className="search-field">
            <Icon name="search" />
            <input
              name="search"
              aria-label="Search invoices"
              maxLength={100}
              placeholder="Search invoice or client"
            />
          </div>

          <select
            aria-label="Filter by invoice status"
            value={status}
            onChange={event => {
              setStatus(event.target.value as InvoiceStatus | "");
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {invoiceStatuses.map(item => (
              <option key={item} value={item}>
                {statusLabel(item)}
              </option>
            ))}
          </select>

          <button className="button secondary small">
            Search
          </button>
        </form>

        {loading ? (
          <Loading label="Loading invoices…" />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : data && (
          <>
            {!data.data.length && (search || status) ? (
              <Empty
                icon="invoice"
                title="No matching invoices"
                description="Try another search or choose a different status."
              />
            ) : (
              <InvoiceTable
                invoices={data.data}
                emptyAction={createAction}
              />
            )}

            <PaginationControls
              pagination={data.pagination}
              onPage={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}