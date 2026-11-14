"use client";

import type { ClientDetail } from "@/lib/api";
import { Field } from "@/components/ui";

const contactFields = [
  { name: "companyName", label: "Company name (optional)", type: "text", max: 160 },
  { name: "email", label: "Email address (optional)", type: "email", max: 320 },
  { name: "phone", label: "Phone number (optional)", type: "tel", max: 30 },
] as const;

export function ClientFields({
  client,
  disabled,
}: {
  client: ClientDetail | null;
  disabled: boolean;
}) {
  return (
    <>
      <div className="form-grid">
        <Field label="Client name">
          <input
            name="name"
            defaultValue={client?.name || ""}
            required
            maxLength={160}
            disabled={disabled}
          />
        </Field>

        {contactFields.map(field => (
          <Field key={field.name} label={field.label}>
            <input
              name={field.name}
              type={field.type}
              defaultValue={client?.[field.name] || ""}
              maxLength={field.max}
              disabled={disabled}
            />
          </Field>
        ))}
      </div>

      <Field label="Billing address (optional)">
        <textarea
          name="billingAddress"
          defaultValue={client?.billingAddress || ""}
          maxLength={2000}
          rows={3}
          disabled={disabled}
        />
      </Field>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          defaultValue={client?.notes || ""}
          maxLength={5000}
          rows={3}
          disabled={disabled}
        />
      </Field>
    </>
  );
}