"use client";

import { useState, type FormEvent } from "react";
import {
  businessesApi,
  currencies,
  type Currency,
} from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  Field,
  Icon,
  PageHeading,
} from "@/components/ui";
import { errorMessage } from "@/hooks/use-resource";

export function BusinessesScreen() {
  const {
    businesses,
    refreshBusinesses,
    selectBusiness,
    business,
  } = useWorkspace();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const result = await businessesApi.create(
        String(form.get("name") || "").trim(),
        form.get("defaultCurrency") as Currency,
      );

      await refreshBusinesses();
      selectBusiness(result.business.id);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading
        title="Your businesses"
        description="A separate workspace for every business you manage."
      />

      <div className="two-column">
        <section className="panel">
          <div className="panel-heading">
            <h2>Business workspaces</h2>
            <span className="muted">
              {businesses.length} available
            </span>
          </div>

          {businesses.length ? (
            <div className="business-list">
              {businesses.map(item => (
                <button
                  className={`business-row ${
                    business?.id === item.id ? "selected" : ""
                  }`}
                  key={item.id}
                  onClick={() => selectBusiness(item.id)}
                >
                  <span className="business-initial">
                    {item.name.slice(0, 2).toUpperCase()}
                  </span>

                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.defaultCurrency} ·{" "}
                      {item.members[0]?.role.toLowerCase()}
                    </small>
                  </span>

                  <Icon
                    name={business?.id === item.id ? "check" : "arrow"}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p className="panel-padding muted">
              Create your first business to start invoicing.
            </p>
          )}
        </section>

        <section className="panel panel-padding">
          <h2>Create a business</h2>
          <p className="muted">
            You’ll be the owner of this workspace.
          </p>

          {error && <Alert>{error}</Alert>}

          <form onSubmit={create} className="form-stack">
            <Field label="Business name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="Your business name"
                disabled={busy}
              />
            </Field>

            <Field
              label="Default invoice currency"
              hint="Crypto checkout currently supports USD invoices. Other currencies are for invoice records."
            >
              <select
                name="defaultCurrency"
                defaultValue="USD"
                disabled={busy}
              >
                {currencies.map(currency => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
            </Field>

            <button className="button" disabled={busy}>
              <Icon name="plus" />
              {busy ? "Creating…" : "Create business"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}