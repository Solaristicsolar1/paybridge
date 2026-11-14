"use client";

import { useCallback, useState, type FormEvent } from "react";
import {
  membersApi,
  type AssignableRole,
  type Invitation,
  type Member,
} from "@/lib/api";
import { useWorkspace } from "@/components/workspace";
import {
  Alert, Confirm, ErrorState, Field, Icon, Loading, PageHeading,
} from "@/components/ui";
import { errorMessage, useResource } from "@/hooks/use-resource";
import { assignableRoles, canManageTeam } from "@/lib/permissions";
import { statusLabel } from "@/lib/format";
import {
  TeamTables,
  type MemberAction,
  type InvitationAction,
} from "./team-tables";

interface TeamAction {
  title: string;
  description: string;
  label: string;
  run: () => Promise<unknown>;
}

export function TeamScreen() {
  const { business, role, user } = useWorkspace();
  const businessId = business!.id;

  const load = useCallback(async () =>
    canManageTeam(role)
      ? Promise.all([
          membersApi.list(businessId),
          membersApi.invitations(businessId),
        ])
      : null,
    [businessId, role],
  );

  const resource = useResource(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmation, setConfirmation] = useState<TeamAction | null>(null);
  const roles = assignableRoles(role);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await membersApi.invite(
        businessId,
        String(form.get("email") || "").trim().toLowerCase(),
        form.get("role") as AssignableRole,
      );
      setSuccess(result.message);
      element.reset();
      resource.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function memberAction(member: Member, action: MemberAction) {
    const verb = action === "remove" ? "Remove"
      : action === "suspend" ? "Suspend" : "Reactivate";

    setConfirmation({
      title: `${verb} ${member.user.displayName || member.user.email}?`,
      description: action === "remove"
        ? "This removes their membership from this business."
        : action === "suspend"
          ? "They will lose access to this business until reactivated."
          : "Their access to this business will be restored.",
      label: `${verb} member`,
      run: () => membersApi[action](businessId, member.id),
    });
  }

  function roleAction(member: Member, newRole: AssignableRole) {
    setConfirmation({
      title: "Change member role?",
      description: `${member.user.email} will become ${statusLabel(newRole).toLowerCase()}.`,
      label: "Change role",
      run: () => membersApi.role(businessId, member.id, newRole),
    });
  }

  function invitationAction(
    invitation: Invitation,
    action: InvitationAction,
  ) {
    setConfirmation({
      title: action === "resend" ? "Resend invitation?" : "Revoke invitation?",
      description: action === "resend"
        ? `Send a new invitation email to ${invitation.email}.`
        : `${invitation.email} will no longer be able to accept this invitation.`,
      label: action === "resend" ? "Resend invitation" : "Revoke invitation",
      run: () => membersApi[action](businessId, invitation.id),
    });
  }

  async function performAction() {
    if (!confirmation) return;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const result = await confirmation.run();
      setSuccess(
        result && typeof result === "object" &&
        "message" in result && typeof result.message === "string"
          ? result.message
          : "Team updated.",
      );
      resource.reload();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setConfirmation(null);
      setBusy(false);
    }
  }

  if (!canManageTeam(role)) {
    return (
      <Alert tone="info">
        Team management is available to owners and administrators.
      </Alert>
    );
  }

  return (
    <>
      <PageHeading
        title="Your team"
        description="Invite collaborators and manage business access."
      />

      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}

      <section className="panel panel-padding">
        <h2>Invite a team member</h2>
        <form className="invite-form" onSubmit={invite}>
          <Field label="Email address">
            <input
              name="email"
              type="email"
              maxLength={320}
              required
              placeholder="colleague@business.com"
              disabled={busy}
            />
          </Field>

          <Field label="Role">
            <select name="role" defaultValue="MEMBER" disabled={busy}>
              {roles.map(item => (
                <option key={item} value={item}>{statusLabel(item)}</option>
              ))}
            </select>
          </Field>

          <button className="button" disabled={busy}>
            <Icon name="plus" />
            {busy ? "Working…" : "Send invitation"}
          </button>
        </form>
      </section>

      {resource.loading ? (
        <Loading label="Loading your team…" />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : resource.data && (
        <TeamTables
          members={resource.data[0]}
          invitations={resource.data[1]}
          role={role}
          currentUserId={user.id}
          busy={busy}
          onMemberAction={memberAction}
          onRoleChange={roleAction}
          onInvitationAction={invitationAction}
        />
      )}

      {confirmation && (
        <Confirm
          title={confirmation.title}
          description={confirmation.description}
          actionLabel={confirmation.label}
          busy={busy}
          onClose={() => setConfirmation(null)}
          onConfirm={() => void performAction()}
        />
      )}
    </>
  );
}