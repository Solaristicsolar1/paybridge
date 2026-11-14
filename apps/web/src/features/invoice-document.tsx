"use client";

import type { PublicInvoice } from "@/lib/api";
import { Badge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";

export function InvoiceDocument({
  invoice,
  businessName,
}: {
  invoice: PublicInvoice;
  businessName?: string;
}) {
  return (
    <article className="invoice-document">
      <div className="document-header">
        <div>
          {businessName && <h2>{businessName}</h2>}
          <p className="document-title">Invoice</p>
          <strong>{invoice.invoiceNumber}</strong>
        </div>
        <Badge status={invoice.status} />
      </div>

      <div className="document-parties">
        <div>
          <span className="muted">Billed to</span>
          <strong>{invoice.client.name}</strong>

          {invoice.client.companyName && (
            <span>{invoice.client.companyName}</span>
          )}

          {invoice.client.billingAddress && (
            <p className="preserve-lines">
              {invoice.client.billingAddress}
            </p>
          )}
        </div>

        <dl>
          <div>
            <dt>Issue date</dt>
            <dd>{formatDate(invoice.issueDate)}</dd>
          </div>
          <div>
            <dt>Due date</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{invoice.currency}</dd>
          </div>
        </dl>
      </div>

      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Invoice line items"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="numeric">Quantity</th>
              <th scope="col" className="numeric">Unit price</th>
              <th scope="col" className="numeric">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td className="numeric">{item.quantity}</td>
                <td className="numeric">
                  {formatMoney(item.unitPrice, invoice.currency)}
                </td>
                <td className="numeric">
                  {formatMoney(item.lineTotal, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="invoice-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Tax ({invoice.taxRate}%)</dt>
          <dd>{formatMoney(invoice.taxAmount, invoice.currency)}</dd>
        </div>
        <div className="grand-total">
          <dt>Invoice total</dt>
          <dd>{formatMoney(invoice.totalAmount, invoice.currency)}</dd>
        </div>
      </dl>

      {invoice.notes && (
        <div className="invoice-notes">
          <h3>Notes</h3>
          <p className="preserve-lines">{invoice.notes}</p>
        </div>
      )}
    </article>
  );
}