"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { clientsApi } from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Empty,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
  PaginationControls,
} from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { canManageFinancialRecords } from "@/lib/permissions";

export function ClientsScreen() {
  const { business, role } = useWorkspace();
  const businessId = business!.id;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const load = useCallback(
    (signal: AbortSignal) => clientsApi.list(
      businessId,
      { page, search, limit: 20 },
      signal,
    ),
    [businessId, page, search],
  );

  const { data, loading, error, reload } = useResource(load);

  const action = canManageFinancialRecords(role) ? (
    <Link className="button" href="/clients/new">
      <Icon name="plus" />
      Add client
    </Link>
  ) : undefined;

  return (
    <>
      <PageHeading
        title="Clients"
        description="The people and businesses you work with."
        action={action}
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
              aria-label="Search clients"
              name="search"
              maxLength={100}
              placeholder="Search name, company or email"
            />
          </div>
          <button className="button secondary small">Search</button>
        </form>

        {loading ? (
          <Loading label="Loading clients…" />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : data && (
          <>
            {data.data.length ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Clients table"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col">Email</th>
                      <th scope="col">Company</th>
                      <th scope="col" className="numeric">Invoices</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(client => (
                      <tr key={client.id}>
                        <td>
                          <Link
                            className="record-link"
                            href={`/clients/${client.id}`}
                          >
                            {client.name}
                          </Link>
                        </td>
                        <td>{client.email || "Not set"}</td>
                        <td>{client.companyName || "—"}</td>
                        <td className="numeric">{client._count.invoices}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                icon="clients"
                title={search ? "No matching clients" : "Meet your client list"}
                description={search
                  ? "Try another name, company or email."
                  : "Add your first client so you can start creating invoices."}
                action={action}
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