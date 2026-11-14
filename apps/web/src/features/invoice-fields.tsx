"use client";

import Link from "next/link";
import {
  currencies,
  type ClientDetail,
  type Currency,
  type Invoice,
  type InvoiceItemInput,
} from "@/lib/api";
import { Field, Icon } from "@/components/ui";

export function InvoiceHeaderFields({
  invoice,
  defaultCurrency,
  clients,
  clientsLoading,
  clientSearch,
  onClientSearch,
}: {
  invoice: Invoice | null;
  defaultCurrency: Currency;
  clients: ClientDetail[];
  clientsLoading: boolean;
  clientSearch: string;
  onClientSearch: (value: string) => void;
}) {
  return (
    <div className="invoice-form-top">
      <div>
        <h2>Who is this invoice for?</h2>

        {!invoice && (
          <div className="client-lookup">
            <input
              type="search"
              aria-label="Find a client for the invoice"
              placeholder="Find a client by name or email"
              maxLength={100}
              value={clientSearch}
              onChange={event => onClientSearch(event.target.value)}
            />
            <Link href="/clients/new">Add a new client</Link>
          </div>
        )}

        <Field label="Client">
          {invoice ? (
            <input value={invoice.client.name} disabled />
          ) : (
            <select
              name="clientId"
              required
              disabled={clientsLoading || !clients.length}
              defaultValue=""
            >
              <option value="">
                {clientsLoading ? "Loading clients…" : "Select a client"}
              </option>
              {clients.map(client => (
                <option value={client.id} key={client.id}>
                  {client.name}
                  {client.companyName ? ` · ${client.companyName}` : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        {!invoice && !clientsLoading && !clients.length && (
          <p className="footnote">
            Add a client, or try another search, before creating an invoice.
          </p>
        )}
      </div>

      <div className="form-grid">
        <Field label="Currency" hint="Crypto checkout supports USD invoices.">
          <select
            name="currency"
            defaultValue={invoice?.currency || defaultCurrency}
            disabled={!!invoice}
          >
            {currencies.map(currency => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </Field>

        <Field label="Issue date (optional)">
          <input
            name="issueDate"
            type="date"
            defaultValue={invoice?.issueDate.slice(0, 10)}
          />
        </Field>

        <Field label="Due date (optional)">
          <input
            name="dueDate"
            type="date"
            defaultValue={invoice?.dueDate?.slice(0, 10)}
          />
        </Field>

        <Field label="Tax rate (%)">
          <input
            name="taxRate"
            inputMode="decimal"
            defaultValue={invoice?.taxRate || "0"}
            required
            pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?"
            title="A non-negative percentage with up to four decimal places"
          />
        </Field>
      </div>
    </div>
  );
}

export function InvoiceItemsEditor({
  items,
  onChange,
}: {
  items: InvoiceItemInput[];
  onChange: (items: InvoiceItemInput[]) => void;
}) {
  function update(
    index: number,
    key: keyof InvoiceItemInput,
    value: string,
  ) {
    onChange(items.map((item, position) =>
      position === index ? { ...item, [key]: value } : item,
    ));
  }

  return (
    <>
      <div className="section-heading">
        <h2>Line items</h2>
        <span className="muted">Amounts in invoice currency</span>
      </div>

      <div className="invoice-items-editor">
        {items.map((item, index) => (
          <div className="line-item-form" key={index}>
            <Field label={`Description ${index + 1}`}>
              <input
                value={item.description}
                onChange={event => update(index, "description", event.target.value)}
                maxLength={500}
                required
                placeholder="Service or product"
              />
            </Field>

            <Field label="Quantity">
              <input
                value={item.quantity}
                onChange={event => update(index, "quantity", event.target.value)}
                inputMode="decimal"
                pattern="(?=.*[1-9])[0-9]+(?:\.[0-9]{1,8})?"
                title="A positive quantity with up to eight decimal places"
                required
              />
            </Field>

            <Field label="Unit price">
              <input
                value={item.unitPrice}
                onChange={event => update(index, "unitPrice", event.target.value)}
                inputMode="decimal"
                pattern="[0-9]+(?:\.[0-9]{1,8})?"
                title="A non-negative amount with up to eight decimal places"
                required
                placeholder="0.00"
              />
            </Field>

            <button
              className="icon-button remove-item"
              type="button"
              aria-label={`Remove line item ${index + 1}`}
              disabled={items.length === 1}
              onClick={() => onChange(items.filter((_, position) => position !== index))}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
      </div>

      <button
        className="button secondary fit"
        type="button"
        onClick={() => onChange([
          ...items,
          { description: "", quantity: "1", unitPrice: "" },
        ])}
      >
        <Icon name="plus" />
        Add line item
      </button>
    </>
  );
}