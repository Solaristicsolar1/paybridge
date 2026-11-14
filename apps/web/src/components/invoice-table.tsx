"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Invoice } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge, Empty } from "./ui";

export function InvoiceTable({
  invoices,
  emptyAction,
}: {
  invoices: Invoice[];
  emptyAction?: ReactNode;
}) {
  if (!invoices.length) {
    return (
      <Empty
        title="No invoices here yet"
        description="Create a draft invoice, then issue it when you’re ready to share it."
        action={emptyAction}
      />
    );
  }

  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Invoices table"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Client</th>
            <th scope="col">Status</th>
            <th scope="col">Due date</th>
            <th scope="col" className="numeric">Invoice total</th>
          </tr>
        </thead>

        <tbody>
          {invoices.map(invoice => (
            <tr key={invoice.id}>
              <td>
                <Link
                  className="record-link"
                  href={`/invoices/${invoice.id}`}
                >
                  {invoice.invoiceNumber}
                </Link>
              </td>

              <td>
                <span className="cell-title">{invoice.client.name}</span>
                {invoice.client.companyName && (
                  <small>{invoice.client.companyName}</small>
                )}
              </td>

              <td><Badge status={invoice.status} /></td>
              <td>{formatDate(invoice.dueDate)}</td>

              <td className="numeric">
                {formatMoney(invoice.totalAmount, invoice.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}