/** Contracts checked against backend DTOs and service responses. */

export type Decimal = string;

export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "MEMBER";

export type AssignableRole = Exclude<Role, "OWNER">;

export type MembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

export const invoiceStatuses = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERPAID",
  "OVERDUE",
  "CANCELLED",
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];

export type PaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "FAILED"
  | "REFUNDED"
  | "EXPIRED";

export const currencies = [
  "NGN",
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "AUD",
  "KES",
  "GHS",
  "ZAR",
  "XOF",
] as const;

export type Currency = (typeof currencies)[number];

export interface Message {
  message: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  slug: string;
  defaultCurrency: Currency;
  basePayoutAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyBusiness extends Business {
  members: {
    role: Role;
    status: MembershipStatus;
    joinedAt: string | null;
  }[];
}

export interface CreatedBusiness {
  business: Business;
  membership: {
    id: string;
    role: Role;
    status: MembershipStatus;
    joinedAt: string | null;
  };
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  billingAddress?: string;
  notes?: string;
}

export interface Client extends Omit<
  ClientInput,
  "email" | "phone" | "companyName" | "billingAddress" | "notes"
> {
  id: string;
  businessId: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  billingAddress: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetail extends Client {
  _count: {
    invoices: number;
  };
}

export interface InvoiceItemInput {
  description: string;
  quantity: Decimal;
  unitPrice: Decimal;
}

export interface InvoiceItem extends InvoiceItemInput {
  lineTotal: Decimal;
}

export interface InvoiceInput {
  clientId: string;
  currency?: Currency;
  issueDate?: string;
  dueDate?: string;
  taxRate?: Decimal;
  notes?: string;
  items: InvoiceItemInput[];
}

export type InvoiceUpdate = Partial<
  Pick<InvoiceInput, "issueDate" | "dueDate" | "taxRate" | "notes" | "items">
>;

export interface Installment {
  id: string;
  invoiceId: string;
  installmentNumber: number;
  amount: Decimal;
  dueDate: string;
  status:
    | "SCHEDULED"
    | "DUE"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED";
}

export interface PublicInvoice {
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: Currency;
  issueDate: string;
  dueDate: string | null;
  subtotal: Decimal;
  taxRate: Decimal;
  taxAmount: Decimal;
  totalAmount: Decimal;
  notes: string | null;

  client: {
    name: string;
    companyName: string | null;
    billingAddress: string | null;
  };

  items: InvoiceItem[];
}

export interface Invoice extends Omit<PublicInvoice, "client"> {
  id: string;
  businessId: string;
  clientId: string;
  publicToken: string;
  client: Client;
  installments: Installment[];
  _count: {
    payments: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceQuery extends PageQuery {
  search?: string;
  status?: InvoiceStatus;
  fromDate?: string;
  toDate?: string;
}

export interface Member {
  id: string;
  role: Role;
  status: MembershipStatus;
  invitedAt: string | null;
  joinedAt: string | null;
  createdAt: string;
  user: Pick<User, "id" | "email" | "displayName">;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;

  invitedBy: Pick<User, "id" | "email" | "displayName"> | null;
}

export interface PaymentEvent {
  id: string;
  eventType: string;
  previousStatus: PaymentStatus | null;
  newStatus: PaymentStatus | null;
  reference: string | null;
  occurredAt: string;
}

export interface PublicPayment {
  id: string;
  status: PaymentStatus;
  providerStatus: string | null;
  sourceChain: string | null;
  sourceTokenSymbol: string | null;
  destinationChain: string;
  destinationTokenSymbol: string;
  destinationAmount: Decimal | null;
  destinationTxHash: string | null;
  confirmedAt: string | null;
  refundedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Payment extends PublicPayment {
  invoiceId: string;
  invoiceAmount: Decimal;
  sourceRefundAddress: string | null;
  payoutAddress: string | null;
  sourceTxHash: string | null;
  sourceAmount: Decimal | null;
  providerReference: string | null;
  events: PaymentEvent[];
  installment: Installment | null;

  invoice: Pick<
    Invoice,
    "id" | "invoiceNumber" | "currency" | "totalAmount" | "status"
  >;
}

export interface PaymentAsset {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
}

export interface CheckoutInput {
  originAsset: string;
  refundTo: string;
  slippageTolerance?: number;
}

export interface Checkout {
  paymentId: string;
  status: PaymentStatus;
  invoiceAmount: Decimal;

  sourceAsset: {
    assetId: string | null;
    blockchain: string | null;
    symbol: string | null;
  };

  destinationAsset: {
    assetId: string | null;
    blockchain: string;
    symbol: string;
    amount?: Decimal;
  };

  deposit: {
    address: string;
    memo: string | null;
    amount?: string;
    formattedAmount?: string;
    expiresAt: string | null;
  } | null;

  providerReference: string | null;
  estimatedSeconds?: number;
}
