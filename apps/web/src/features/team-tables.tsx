"use client";

import type {
  AssignableRole, Invitation, Member, Role,
} from "@/lib/api";
import { Badge, Empty } from "@/components/ui";
import { assignableRoles } from "@/lib/permissions";
import { formatDate, statusLabel } from "@/lib/format";

export type MemberAction = "suspend" | "reactivate" | "remove";
export type InvitationAction = "resend" | "revoke";

export function TeamTables({
  members,
  invitations,
  role,
  currentUserId,
  busy,
  onMemberAction,
  onRoleChange,
  onInvitationAction,
}: {
  members: Member[];
  invitations: Invitation[];
  role: Role | undefined;
  currentUserId: string;
  busy: boolean;
  onMemberAction: (member: Member, action: MemberAction) => void;
  onRoleChange: (member: Member, role: AssignableRole) => void;
  onInvitationAction: (
    invitation: Invitation,
    action: InvitationAction,
  ) => void;
}) {
  const roles = assignableRoles(role);

  return (
    <>
      <div className="section-heading"><h2>Members</h2></div>

      <section className="panel">
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Team members"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(member => {
                const editable =
                  member.role !== "OWNER" &&
                  member.user.id !== currentUserId &&
                  (role === "OWNER" || member.role !== "ADMIN");

                return (
                  <tr key={member.id}>
                    <td>
                      <strong>
                        {member.user.displayName || member.user.email}
                        {member.user.id === currentUserId ? " (you)" : ""}
                      </strong>
                      <small>{member.user.email}</small>
                    </td>

                    <td>
                      {editable ? (
                        <select
                          aria-label={`Role for ${member.user.email}`}
                          value={member.role}
                          disabled={busy}
                          onChange={event => onRoleChange(
                            member,
                            event.target.value as AssignableRole,
                          )}
                        >
                          {roles.map(item => (
                            <option key={item} value={item}>
                              {statusLabel(item)}
                            </option>
                          ))}
                        </select>
                      ) : statusLabel(member.role)}
                    </td>

                    <td><Badge status={member.status} /></td>

                    <td>
                      {editable ? (
                        <div className="button-group">
                          {member.status !== "INVITED" && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => onMemberAction(
                                member,
                                member.status === "SUSPENDED"
                                  ? "reactivate"
                                  : "suspend",
                              )}
                            >
                              {member.status === "SUSPENDED"
                                ? "Reactivate"
                                : "Suspend"}
                            </button>
                          )}
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => onMemberAction(member, "remove")}
                          >
                            Remove
                          </button>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="section-heading"><h2>Invitations</h2></div>

      <section className="panel">
        {invitations.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Business invitations"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map(invitation => (
                  <tr key={invitation.id}>
                    <td>{invitation.email}</td>
                    <td>{statusLabel(invitation.role)}</td>
                    <td><Badge status={invitation.status} /></td>
                    <td>{formatDate(invitation.expiresAt)}</td>
                    <td>
                      {invitation.status === "PENDING" &&
                        (role === "OWNER" || invitation.role !== "ADMIN") && (
                        <div className="button-group">
                          <button
                            className="text-button"
                            disabled={busy}
                            onClick={() => onInvitationAction(invitation, "resend")}
                          >
                            Resend
                          </button>
                          <button
                            className="text-button danger-text"
                            disabled={busy}
                            onClick={() => onInvitationAction(invitation, "revoke")}
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon="team"
            title="No invitations yet"
            description="Invite a colleague to collaborate in this workspace."
          />
        )}
      </section>
    </>
  );
}