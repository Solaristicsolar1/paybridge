import { apiRequest, queryString, segment } from "./client";

import type {
  AssignableRole,
  Business,
  Checkout,
  CheckoutInput,
  Client,
  ClientDetail,
  ClientInput,
  CreatedBusiness,
  Currency,
  Invitation,
  Invoice,
  InvoiceInput,
  InvoiceQuery,
  InvoiceUpdate,
  Member,
  Message,
  MyBusiness,
  Page,
  PageQuery,
  Payment,
  PaymentAsset,
  PublicInvoice,
  PublicPayment,
  User,
} from "./types";

export * from "./types";
export { ApiError } from "./client";

const json = (method: string, body?: unknown) => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const business = (id: string) => `/businesses/${segment(id)}`;

const resource = (id: string, name: string, item?: string) =>
  `${business(id)}/${name}${item ? `/${segment(item)}` : ""}`;

/* Authentication */

export const authApi = {
  me: (signal?: AbortSignal) => apiRequest<User>("/auth/me", { signal }),

  login: (email: string, password: string) =>
    apiRequest<{
      message: string;
      user: Pick<User, "id" | "email" | "displayName">;
    }>("/auth/login", {
      ...json("POST", { email, password }),
      authenticated: false,
    }),

  register: (email: string, password: string, displayName?: string) =>
    apiRequest<Message & { emailVerificationRequired: true }>(
      "/auth/register",
      {
        ...json("POST", {
          email,
          password,
          ...(displayName ? { displayName } : {}),
        }),
        authenticated: false,
      },
    ),

  logout: () =>
    apiRequest<Message>("/auth/logout", {
      method: "POST",
      authenticated: false,
    }),

  verifyEmail: (token: string) =>
    apiRequest<Message>(
      `/auth/verify-email/confirm${queryString({
        token,
      })}`,
      {
        method: "POST",
        authenticated: false,
      },
    ),

  resendVerification: (email: string) =>
    apiRequest<Message>("/auth/resend-verification", {
      ...json("POST", { email }),
      authenticated: false,
    }),

  forgotPassword: (email: string) =>
    apiRequest<Message>("/auth/forgot-password", {
      ...json("POST", { email }),
      authenticated: false,
    }),

  resetPassword: (
    token: string,
    newPassword: string,
    confirmPassword: string,
  ) =>
    apiRequest<Message>("/auth/reset-password/confirm", {
      ...json("POST", {
        token,
        newPassword,
        confirmPassword,
      }),
      authenticated: false,
    }),
};

/* Businesses */

export const businessesApi = {
  list: () => apiRequest<MyBusiness[]>("/businesses"),

  get: (id: string) => apiRequest<Business>(business(id)),

  create: (name: string, defaultCurrency: Currency = "USD") =>
    apiRequest<CreatedBusiness>(
      "/businesses",
      json("POST", { name, defaultCurrency }),
    ),

  payout: (id: string, basePayoutAddress: string) =>
    apiRequest<
      Pick<
        Business,
        "id" | "name" | "defaultCurrency" | "basePayoutAddress" | "updatedAt"
      >
    >(`${business(id)}/payout-settings`, json("PATCH", { basePayoutAddress })),
};

/* Clients */

export const clientsApi = {
  list: (
    id: string,
    query: PageQuery & { search?: string } = {},
    signal?: AbortSignal,
  ) =>
    apiRequest<Page<ClientDetail>>(
      `${resource(id, "clients")}${queryString(query)}`,
      { signal },
    ),

  get: (id: string, clientId: string) =>
    apiRequest<ClientDetail>(resource(id, "clients", clientId)),

  create: (id: string, input: ClientInput) =>
    apiRequest<Client>(resource(id, "clients"), json("POST", input)),

  update: (id: string, clientId: string, input: Partial<ClientInput>) =>
    apiRequest<Client>(resource(id, "clients", clientId), json("PATCH", input)),

  remove: (id: string, clientId: string) =>
    apiRequest<Message>(resource(id, "clients", clientId), {
      method: "DELETE",
    }),
};

/* Invoices */

export const invoicesApi = {
  list: (id: string, query: InvoiceQuery = {}, signal?: AbortSignal) =>
    apiRequest<Page<Invoice>>(
      `${resource(id, "invoices")}${queryString(query)}`,
      { signal },
    ),

  get: (id: string, invoiceId: string) =>
    apiRequest<Invoice>(resource(id, "invoices", invoiceId)),

  create: (id: string, input: InvoiceInput) =>
    apiRequest<Invoice>(resource(id, "invoices"), json("POST", input)),

  update: (id: string, invoiceId: string, input: InvoiceUpdate) =>
    apiRequest<Invoice>(
      resource(id, "invoices", invoiceId),
      json("PATCH", input),
    ),

  issue: (id: string, invoiceId: string) =>
    apiRequest<Invoice>(`${resource(id, "invoices", invoiceId)}/issue`, {
      method: "POST",
    }),

  cancel: (id: string, invoiceId: string) =>
    apiRequest<Invoice>(`${resource(id, "invoices", invoiceId)}/cancel`, {
      method: "POST",
    }),
};

/* Payments */

export const paymentsApi = {
  list: (id: string, query: PageQuery = {}, signal?: AbortSignal) =>
    apiRequest<Page<Payment>>(
      `${resource(id, "payments")}${queryString(query)}`,
      { signal },
    ),

  get: (id: string, paymentId: string) =>
    apiRequest<Payment>(resource(id, "payments", paymentId)),
};

/* Team and invitations */

export const membersApi = {
  list: (id: string) => apiRequest<Member[]>(resource(id, "members")),

  invitations: (id: string) =>
    apiRequest<Invitation[]>(resource(id, "invitations")),

  invite: (id: string, email: string, role: AssignableRole) =>
    apiRequest<Message>(
      `${resource(id, "members")}/invite`,
      json("POST", { email, role }),
    ),

  accept: (id: string, token: string) =>
    apiRequest<Message>(
      `${resource(id, "members")}/accept`,
      json("POST", { token }),
    ),

  resend: (id: string, invitationId: string) =>
    apiRequest<Message>(`${resource(id, "invitations", invitationId)}/resend`, {
      method: "POST",
    }),

  revoke: (id: string, invitationId: string) =>
    apiRequest<Message>(`${resource(id, "invitations", invitationId)}/revoke`, {
      method: "PATCH",
    }),

  role: (id: string, memberId: string, role: AssignableRole) =>
    apiRequest<Pick<Member, "id" | "role" | "status" | "user">>(
      `${resource(id, "members", memberId)}/role`,
      json("PATCH", { role }),
    ),

  suspend: (id: string, memberId: string) =>
    apiRequest<Pick<Member, "id" | "role" | "status">>(
      `${resource(id, "members", memberId)}/suspend`,
      { method: "PATCH" },
    ),

  reactivate: (id: string, memberId: string) =>
    apiRequest<Pick<Member, "id" | "role" | "status">>(
      `${resource(id, "members", memberId)}/reactivate`,
      { method: "PATCH" },
    ),

  remove: (id: string, memberId: string) =>
    apiRequest<Message>(resource(id, "members", memberId), {
      method: "DELETE",
    }),
};

/* Public invoices and checkout */

export const publicApi = {
  invoice: (token: string, signal?: AbortSignal) =>
    apiRequest<PublicInvoice>(`/public/invoices/${segment(token)}`, {
      authenticated: false,
      signal,
    }),

  assets: () =>
    apiRequest<PaymentAsset[]>("/public/payment-assets", {
      authenticated: false,
    }),

  checkout: (token: string, input: CheckoutInput, idempotencyKey: string) =>
    apiRequest<Checkout>(`/public/invoices/${segment(token)}/checkout`, {
      ...json("POST", input),
      authenticated: false,
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
    }),

  status: (token: string, paymentId: string, signal?: AbortSignal) =>
    apiRequest<PublicPayment>(
      `/public/invoices/${segment(token)}/payments/${segment(paymentId)}/status`,
      {
        authenticated: false,
        signal,
      },
    ),
};
