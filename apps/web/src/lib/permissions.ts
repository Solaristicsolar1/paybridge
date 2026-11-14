import type { AssignableRole, Role } from "./api/types";

export const canManageTeam = (role?: Role): boolean =>
  role === "OWNER" || role === "ADMIN";

export const canManageFinancialRecords = (role?: Role): boolean =>
  canManageTeam(role) || role === "ACCOUNTANT";

export const canCancelInvoice = canManageTeam;

export const canUpdatePayout = canManageTeam;

export function assignableRoles(actor?: Role): AssignableRole[] {
  return actor === "OWNER"
    ? ["ADMIN", "ACCOUNTANT", "MEMBER"]
    : actor === "ADMIN"
      ? ["ACCOUNTANT", "MEMBER"]
      : [];
}
