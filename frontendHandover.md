PayBridge Frontend Developer Handover 
Project: PayBridge
Repository: paybridge (pnpm monorepo)
Audience: Frontend developer
Document status: Initial implementation brief — 12 November 2026 
 1. Project overview 
PayBridge is a cross-chain invoicing and stablecoin payment platform for businesses. 
The product is intended to let businesses create and manage invoices, share invoices with customers, accept supported
cryptocurrency payments through NEAR Intents, and track payment and settlement status. 
The initial payment direction agreed by the project team is: 
Customers can pay using supported crypto assets and networks.
NEAR Intents 1Click handles the cross-chain payment route.
The initial merchant settlement asset is USDC on Base.
NGN off-ramp and Nigerian bank payouts are a later phase. Do not present them as currently available. 
The frontend must communicate with the PayBridge NestJS API. It must not connect directly to PostgreSQL or call NEAR Intents
using private credentials. 
2. Existing repository and technology 
PayBridge is a pnpm monorepo: 
paybridge/
├── apps/
│ ├── api/│ └── web/├── packages/
│ └── database/├── .env├── .env.example├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml

# NestJS backend
# Next.js frontend
# Prisma schema, migrations and client
# Private local environment; never share or commit
# Root environment template
Confirmed frontend stackTechnology Current version/configurationNext.js 15.5.6React 19TypeScript 5.7+Routing Next.js App RouterTypeScript mode StrictImport alias @/* maps to apps/web/src/*Package manager pnpm 
The current frontend is a minimal starter. The inspected source tree contained: 
apps/web/
├── next.config.ts
├── package.json
├── tsconfig.json
└── src/
└── app/
├── layout.tsx
└── page.tsx

There is no established dashboard, component library, design system or substantial frontend feature set to preserve. Build the
frontend structure cleanly.Compatibility: Keep the existing Next.js and React versions. Do not upgrade framework dependencies without discussing it with the
project owner first. 
3. Product scope and implementation priorities 
Build the frontend in the following order. Use API capabilities that exist today, and identify screens that depend on backend work
still in progress. 
Phase 1 — Application foundation 
Establish a consistent visual design system.
Create responsive application shell and navigation.
Build reusable buttons, inputs, form controls, tables, status labels, dialogs, alerts, loading/empty/error states.
Set up a typed API client and centralized error handling.
Add route protection based on the actual backend authentication/session behaviour.
Ensure the application works on desktop, tablet and mobile. 
Phase 2 — Authentication 
Build user-facing flows supported by the backend: 
Registration.
Login.
Logout.
Email verification.
Resend verification email, if supported.
Forgot/reset password, once corresponding backend endpoints are confirmed.
Authenticated session restoration. 
Do not invent endpoint paths or request/response fields. Inspect the actual auth controllers and DTOs before wiring each flow. 
Phase 3 — Business onboarding and settings 
List businesses available to the signed-in user.
Create a business.
Select the active business context.
Display business name and default currency.
Provide business settings.
Provide a field to save/update the merchant’s Base payout wallet address. 
The backend schema has been updated with: 
basePayoutAddress String? @db.VarChar(42)

Migration 20261112154838_add_business_base_payout_address was successfully applied, Prisma Client regenerated, and
database/API builds passed. 
The payout-settings route was added in the implementation work: 
PATCH /v1/businesses/:businessId/payout-settings

Request body: 
{
"basePayoutAddress": "0x..."
}

The backend DTO validates EVM address format. This does not prove wallet ownership. Do not claim the address has been
ownership-verified. Test this endpoint against the running API before treating it as production-ready. 
Phase 4 — Dashboard 
Build a business overview, including where API data is available: 
Invoice totals and counts.
Paid, outstanding and overdue invoice summaries.
Recent invoices.Recent payments.
Useful actions such as creating an invoice or viewing payments. 
Do not fabricate financial figures or display hardcoded sample totals as real account data. If an endpoint or aggregate is not
available, use a clear empty state or mark the widget as awaiting backend support. 
Phase 5 — Invoice management 
The backend has invoice functionality for: 
Creating draft invoices.
Listing invoices with pagination and query filters.
Retrieving one invoice.
Updating draft invoices.
Issuing invoices.
Cancelling eligible invoices.
Retrieving a public invoice by token. 
Known business invoice route pattern: 
/v1/businesses/:businessId/invoices

Known operations from the backend controller:Method Route PurposePOST /businesses/:businessId/invoices Create draft invoiceGET /businesses/:businessId/invoices List invoicesGET /businesses/:businessId/invoices/:invoiceId Get one invoicePATCH /businesses/:businessId/invoices/:invoiceId Update draft invoicePOST /businesses/:businessId/invoices/:invoiceId/issue Issue invoicePOST /businesses/:businessId/invoices/:invoiceId/cancel Cancel eligible invoiceGET /public/invoices/:token Public invoice view 
The API global prefix is /v1. Confirm DTOs and response shapes in the backend before implementing forms and types. 
Invoice UI should support: 
Invoice list, search, status filtering and pagination.
Create/edit draft invoice.
Client selection.
Line items, quantity, unit price and totals.
Tax rate and notes.
Issue/cancel actions with confirmation.
Invoice detail view.
Public invoice page suitable for sharing with customers. 
Respect backend business rules. For example, only draft invoices can be updated or issued. Cancellation is restricted when protected
payment or installment records exist. 
Phase 6 — Payments 
The backend has a payment listing/detail service and controller. 
Known route pattern: 
/v1/businesses/:businessId/payments

Known operations:Method Route PurposeGET /businesses/:businessId/payments List business paymentsGET /businesses/:businessId/payments/:paymentId Get payment detailsGET /businesses/:businessId/payments/near/tokens Retrieve supported NEAR Intents assetsPOST /businesses/:businessId/payments/near/quote Generate a NEAR Intents dry-run quote 
The quote endpoint currently generates a dry-run quote. It is not a live payment initiation endpoint and does not mean funds have
been deposited or settled.The frontend may build a supported-asset selector and quote-preview experience against the dry-run endpoint. Clearly label it as a
quote/preview until live initiation is implemented and tested. 
Do not build a fake “payment successful” state. A payment must only be shown as paid/settled when the backend reports a verified
status. 
Phase 7 — Public invoice checkout 
Design a customer-facing checkout experience for a public invoice: 
Display invoice number, issuer/business, line items, total and currency.
Show available payment assets/networks returned by the backend.
Allow the customer to request a quote.
Clearly display estimated input/output, fees, minimum received amount and quote expiry when returned by the API.
Explain that the quote preview is not a completed payment.
Later, when live initiation is implemented, display deposit instructions and monitor backend-reported payment status. 
Do not collect or store customer private keys or seed phrases. 
4. API integration contract 
Base URL 
For local development: 
http://localhost:4000/v1

The root .env.example includes the proposed frontend variable: 
NEXT_PUBLIC_API_URL=http://localhost:4000/v1

Next.js normally loads app-specific environment files from the app directory. Create apps/web/.env.local: 
NEXT_PUBLIC_API_URL=http://localhost:4000/v1

Create a shareable template at apps/web/.env.example with the same non-secret variable. 
If the frontend uses a server-side API proxy or server components, keep private backend configuration server-side. Never expose
secrets through NEXT_PUBLIC_ variables. 
Authentication and cookies 
The API uses NestJS, cookie parsing and credentialed CORS. Local API CORS is configured to allow the web origin, currently: 
http://localhost:3000

The frontend API client should support credentialed requests where the backend authentication flow requires cookies, for example: 
fetch(`${API_BASE_URL}/some-route`, {
credentials: "include",
});

Confirm actual login/logout/session endpoint names, cookie names, CSRF requirements (if any), and response DTOs by inspecting
the backend auth controller and service. Do not assume bearer tokens are stored in browser local storage. Do not put authentication
secrets in client-side code. 
API client expectations 
Create one centralized typed API client rather than scattering raw fetch() calls throughout components. It should: 
Read the base URL from NEXT_PUBLIC_API_URL.
Include credentials for cookie-based authenticated requests.
Set JSON headers when sending JSON.
Parse JSON responses safely.
Handle non-2xx responses consistently.
Surface useful validation messages from the API.Handle expired/unauthenticated sessions.
Avoid logging credentials, cookies, API keys or sensitive payment data. 
Use shared TypeScript types for request and response payloads. Derive them from actual backend DTOs and response shapes; do not
invent fields. 
5. Environment configuration and security 
The root .env.example documents backend/shared local configuration, including database, API, JWT, SMTP, verification and NEAR
Intents settings. 
The frontend developer should only need the public API URL for ordinary local UI development: 
NEXT_PUBLIC_API_URL=http://localhost:4000/v1

Security rules: 
Never request or copy the owner’s real .env file.
Never put DATABASE_URL, PostgreSQL credentials, JWT secrets, SMTP passwords or NEAR_INTENTS_API_KEY in frontend
environment variables.
Never call NEAR Intents directly from browser code using the partner API key.
Never ask a customer for a wallet seed phrase or private key.
Do not store authentication credentials in local storage unless the backend architecture is explicitly changed and reviewed.
Do not commit .env, .env.local or other files containing real credentials.
Keep .env.example files limited to variable names and safe placeholders. 
6. Local development 
Prerequisites: 
Node.js version compatible with the repository’s .node-version.
pnpm.
Access to the repository.
Backend and PostgreSQL running for integrated API work. 
Install dependencies from the repository root: 
pnpm install

Start the backend in one terminal: 
pnpm --filter @paybridge/api dev

Start the frontend in another terminal: 
pnpm --filter @paybridge/web dev

The frontend should be available at http://localhost:3000.
The API should be available at http://localhost:4000. 
Frontend quality checks: 
pnpm --filter @paybridge/web typecheck
pnpm --filter @paybridge/web lint
pnpm --filter @paybridge/web build

Do not change backend dependencies or database schema as part of frontend work without coordinating with the backend owner. 
7. Design and user experience requirements 
The product should feel like a trustworthy financial/business application: clear, restrained, modern and easy to operate. 
Required principles: 
Responsive layouts, not desktop-only pages.
Clear navigation and active states.Consistent spacing, typography, colours, borders and radii.
Accessible contrast and visible keyboard focus.
Proper labels and validation for every form field.
Loading, success, empty and error states for every data-driven screen.
Confirmation before irreversible actions such as issuing or cancelling an invoice.
Clear status labels for draft, sent, partially paid, paid, overdue, cancelled, pending, confirmed, failed, refunded and expired
where applicable.
Use currency-aware formatting; do not assume every business invoices in USD.
Use decimal-safe display/formatting for money. Do not use floating-point arithmetic in the frontend to recalculate
authoritative invoice/payment totals.
Avoid fake charts, fake balances, fake transaction history or unsupported product claims. 
The frontend developer may propose a visual direction, but should share the design system and key screens for approval before
building every page. 
8. Backend/frontend responsibility boundaryResponsibility OwnerPage layouts, components and responsive UI FrontendForm interaction and client-side validation FrontendAPI client and typed integration FrontendAuthentication UI and session handling Frontend, following backend contractAuthorization and business-role enforcement BackendInvoice calculations and authoritative totals BackendPayment creation and status transitions BackendNEAR Intents partner key and provider calls Backend onlyPayment verification and settlement decisions Backend onlyDatabase schema and migrations BackendNGN off-ramp integration Later backend phase, with corresponding UI when ready 
The frontend must not decide that a payment is settled based solely on a browser redirect, quote response or customer-submitted
transaction hash. The backend must verify provider status and update the payment record. 
9. Current backend capability versus work in progress 
Confirmed implemented or inspected 
NestJS API with /v1 global prefix.
PostgreSQL and Prisma.
Business creation and business membership.
Business retrieval.
Invoice create/list/get/update/issue/cancel service and routes.
Public invoice retrieval by token.
Payment list and detail endpoints.
NEAR Intents supported-token retrieval.
NEAR Intents dry-run quote endpoint.
Business basePayoutAddress schema migration applied.
Database package build and API typecheck/build passed after the payout-address migration. 
Requires verification or further backend implementation 
Test the business payout-settings endpoint end-to-end.
Confirm exact authentication endpoint contracts.
Live NEAR Intents quote commitment (dry: false).
Persisting a live payment/deposit instruction.
Deposit/status monitoring and verified settlement updates.
Payment webhook or polling strategy.
Exact-output checkout and invoice-currency conversion rules.
NGN off-ramp and bank payout integration. 
Do not represent work-in-progress items as available product functionality. 
10. Suggested delivery milestones 
Milestone 1 — Foundation☐ Frontend app shell and navigation.
☐ Design tokens and reusable components.
☐ API client and environment setup.
☐ Responsive behaviour.
☐ Typecheck, lint and build pass. 
Milestone 2 — Authentication and business 
☐ Registration/login/logout and session restoration.
☐ Email verification screens.
☐ Business list/create/select.
☐ Business settings and Base payout address form.
☐ API error and validation states. 
Milestone 3 — Invoices 
☐ Invoice list and filters.
☐ Create/edit draft invoice.
☐ Invoice details.
☐ Issue/cancel flows.
☐ Public invoice view. 
Milestone 4 — Payments 
☐ Payment list and detail.
☐ Supported asset selector.
☐ Dry-run quote preview.
☐ Checkout states aligned with actual backend capability.
☐ Live payment flow only after backend implementation is complete. 
11. Definition of done 
A frontend feature is ready for review when: 
It uses the real API contract or is explicitly labelled as a temporary UI-only prototype.
It works at mobile and desktop widths.
It includes loading, empty, validation, success and error states as appropriate.
It does not expose secrets or trust client-side payment claims.
It respects backend permissions and business context.
It has no TypeScript errors.
ESLint passes.
The production build passes.
The developer documents any backend endpoint or DTO that is missing or blocks completion. 
12. Working agreement 
Work in a dedicated feature branch; do not commit directly to main.
Keep pull requests focused and explain the screens/features changed.
Do not upgrade Next.js, React, NestJS or Prisma without approval.
Do not modify database schema or migrations without coordinating with the backend owner.
Do not invent API routes, response fields or payment states. Ask for the backend contract when uncertain.
Raise blockers early, especially when a UI feature depends on an endpoint that is not implemented yet. 
 Primary instruction: Build the frontend against the existing PayBridge backend contracts, make unsupported functionality visibly
pending, and keep all payment, security and financial decisions authoritative on the backend