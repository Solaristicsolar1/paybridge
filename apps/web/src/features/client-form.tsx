"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import {
  clientsApi,
  type ClientDetail,
  type ClientInput,
} from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert,
  BackLink,
  Confirm,
  ErrorState,
  Icon,
  Loading,
  PageHeading,
} from "@/components/ui";
import { errorMessage, useResource } from "@/hooks/use-resource";
import { canManageFinancialRecords } from "@/lib/permissions";
import { ClientFields } from "./client-fields";

export function ClientFormScreen({ clientId }: { clientId?: string }) {
  const { business, role } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(
    async () => clientId
      ? clientsApi.get(businessId, clientId)
      : null,
    [businessId, clientId],
  );

  const resource = useResource(load);
  const canEdit = canManageFinancialRecords(role);

  if (!canEdit && !clientId) {
    return (
      <Alert tone="info">
        Your role can view clients. An owner, administrator or accountant
        can create them.
      </Alert>
    );
  }

  return (
    <>
      <BackLink href="/clients">All clients</BackLink>
      <PageHeading
        title={clientId ? "Client details" : "Add a client"}
        description="Keep the details you need for a clear invoice."
      />

      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : (
        <ClientForm
          key={resource.data?.updatedAt || "new"}
          client={resource.data}
          businessId={businessId}
          canEdit={canEdit}
        />
      )}
    </>
  );
}

function ClientForm({
  client,
  businessId,
  canEdit,
}: {
  client: ClientDetail | null;
  businessId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const input: ClientInput = {
      name: String(form.get("name") || "").trim(),
    };

    const optionalFields = [
      "email", "phone", "companyName", "billingAddress", "notes",
    ] as const;

    for (const key of optionalFields) {
      const value = String(form.get(key) || "").trim();
      if (value) input[key] = value;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (!input.name) {
        throw new Error("Enter a client name.");
      }

      if (client && optionalFields.some(
        key => client[key] && !String(form.get(key) || "").trim(),
      )) {
        throw new Error(
          "Saved optional details can be updated but cannot currently be removed. Restore the detail or enter a replacement before saving.",
        );
      }

      const result = client
        ? await clientsApi.update(businessId, client.id, input)
        : await clientsApi.create(businessId, input);

      setSuccess("Client saved.");

      if (!client) {
        router.push(`/clients/${result.id}`);
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!client) return;

    setBusy(true);
    setError("");

    try {
      await clientsApi.remove(businessId, client.id);
      router.push("/clients");
    } catch (error) {
      setError(errorMessage(error));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel panel-padding form-panel">
      {success && <Alert tone="success">{success}</Alert>}
      {error && <Alert>{error}</Alert>}

      <form className="form-stack" onSubmit={submit}>
        <ClientFields client={client} disabled={!canEdit || busy} />

        {client && (
          <p className="muted">
            {client._count.invoices} linked invoice
            {client._count.invoices === 1 ? "" : "s"}.
            Clients with invoices cannot be deleted.
          </p>
        )}

        <div className="form-actions">
          {client && canEdit && (
            <button
              className="button danger-outline"
              type="button"
              disabled={busy || client._count.invoices > 0}
              onClick={() => setConfirm(true)}
            >
              <Icon name="trash" />
              Delete client
            </button>
          )}

          <Link className="button secondary" href="/clients">
            Back to clients
          </Link>

          {canEdit && (
            <button className="button" disabled={busy}>
              {busy ? "Saving…" : client ? "Save client" : "Create client"}
            </button>
          )}
        </div>
      </form>

      {confirm && (
        <Confirm
          title="Delete this client?"
          description="This removes the client record. This action cannot be undone."
          actionLabel="Delete client"
          busy={busy}
          onClose={() => setConfirm(false)}
          onConfirm={() => void remove()}
        />
      )}
    </section>
  );
}