# PayBridge --- Frontend Developer Handover

**Project:** PayBridge\
**Repository:** `paybridge` (pnpm monorepo)\
**Audience:** Frontend developer\
**Updated:** 13 November 2026\
**Approach:** Start frontend implementation now; backend refinements
will continue in parallel.

## 1. Product overview

PayBridge is a business invoicing and cross-chain stablecoin payment
platform. Businesses manage clients and invoices, configure a merchant
payout wallet, and track payments. Customers open public invoices and
pay using supported crypto assets/networks.

**Current settlement direction:** NEAR Intents 1Click routes customer
payments to merchant USDC on Base. NGN off-ramp and Nigerian bank
payouts are future work and must not be presented as available.

The frontend communicates only with the PayBridge API. It must never
connect directly to PostgreSQL or call NEAR Intents with private
credentials.

## 2. Agreed frontend technology

-   React Native
-   Expo
-   TypeScript
-   Android, iOS and web targets
-   Intended frontend workspace: `apps/client`
-   Package manager: pnpm

The old `apps/web` Next.js starter is not the selected frontend
direction. Do not build the new product UI there unless the project
owner changes this decision.

First inspect the root and `apps/client` package files. Preserve
existing workspace conventions and dependency versions. Do not upgrade
major dependencies or restructure the monorepo without approval.

## 3. Backend status at handover

  -----------------------------------------------------------------------
  Area                                Current position
  ----------------------------------- -----------------------------------
  NestJS REST API (`/v1`)             Implemented

  PostgreSQL + Prisma                 Configured; migrations applied

  Authentication and sessions         Implemented

  Email verification/password         Backend flows implemented; wire to
  recovery                            actual controller contracts

  Business and membership management  Implemented

  Business role enforcement           Implemented

  Client management                   Implemented

  Invoice management                  Implemented

  Merchant Base payout address        Implemented

  NEAR Intents 1Click checkout        Implemented

  Deposit instructions persistence    Implemented

  Payment status polling              Implemented; scheduled every 30
                                      seconds

  Settlement validation               Implemented

  Invoice reconciliation              Implemented

  `OVERPAID` invoice status           Implemented

  Customer source refund-address      Implemented
  snapshot

  Merchant-initiated refund execution Not implemented

  NGN off-ramp/bank payout            Future phase
  -----------------------------------------------------------------------

### Latest verification recorded

-   API unit tests: 10 passing.
-   PostgreSQL payment integration tests: 2 passing.
-   Database package build: passed.
-   API TypeScript typecheck: passed.
-   NestJS API build: passed.
-   Test database migrations: up to date at the time of verification.

These results establish an integration baseline; they do not mean every
frontend flow or production deployment has been end-to-end tested.

## 4. Frontend delivery order

Share the design direction and navigation with the project owner before
implementing every screen.

### Milestone 1 --- App foundation

-   Confirm the `apps/client` Expo setup, package scripts and
    Android/iOS/web run targets.
-   Establish navigation and public/protected route groups.
-   Create design tokens for colour, typography, spacing, radii and
    elevation.
-   Build reusable buttons, inputs, selects, lists/tables, cards,
    dialogs, alerts and status badges.
-   Add loading, empty, error, offline and success states.
-   Create one typed API client and centralized error handling.
-   Test connectivity from web, Android emulator, iOS simulator and a
    physical device where available.

### Milestone 2 --- Authentication and onboarding

Build registration, login, logout, email verification, resend
verification where supported, forgot/reset password and session
restoration.

**Authentication contract:** the API uses HTTP-only cookies named
`pb_access` and `pb_refresh`. The JWT strategy reads the access cookie.
Browser requests must include credentials (`credentials: "include"`).

Do not assume bearer tokens. Do not put access/refresh tokens in local
storage or AsyncStorage. Test HTTP-only cookie persistence and refresh
behaviour early on Android and iOS. If the native runtime does not
reliably retain and send these cookies, report this as an integration
blocker to the backend owner. Do not silently change the authentication
design.

Inspect the actual auth controller and DTOs for exact route paths,
request fields and response shapes. Do not guess endpoint names.

### Milestone 3 --- Business workspace

Build business list/selection, create business, business
profile/settings, default currency display, team/membership and
role-aware navigation where supported, and Base payout wallet settings.

The payout address is an EVM address. The backend validates its format;
do not label it as ownership-verified.

### Milestone 4 --- Dashboard

Use real API data for invoice counts/statuses, paid and outstanding
summaries where supported, recent invoices/payments and quick actions.

Do not invent balances, metrics or charts. If an aggregate endpoint is
unavailable, show an honest empty/limited state and report the missing
endpoint.

### Milestone 5 --- Clients

Build client list/search, create client, detail/edit where supported,
and client selection during invoice creation. Use actual DTOs and
validation rules.

### Milestone 6 --- Invoices

Build invoice list, pagination, search and status filters; create/edit
draft; client selection; line items; tax, notes, due date and currency
where supported; invoice detail; issue/cancel with confirmation; public
invoice view and shareable link.

Invoice statuses must include:

`DRAFT`, `SENT`, `PARTIALLY_PAID`, `PAID`, `OVERPAID`, `OVERDUE`,
`CANCELLED`.

The backend owns invoice calculations and authoritative totals. Use
decimal-safe formatting. Do not use JavaScript floating-point
calculations to decide what a customer owes or whether an invoice is
paid.

### Milestone 7 --- Payments and customer checkout

Build business payment list/detail, supported asset/network selector
from API data, public invoice checkout, quote/instructions and deposit
address/memo when returned, expiry information, and payment progress
based on backend status.

The backend uses NEAR Intents 1Click. The frontend must not call the
provider directly or hold its API key.

Payment status must come from the backend record. Never mark a payment
successful because of a redirect, quote response, customer-submitted
transaction hash or frontend timer. Distinguish PayBridge payment status
from provider status.

Support the `OVERPAID` invoice state distinctly; do not collapse it into
`PAID`.

**Refunds:** the payment record snapshots the customer's original source
refund address. This does not mean merchant-initiated refunds can
currently be executed. Do not add a working refund button or promise
refunds until refund execution is implemented by the backend.

## 5. API integration rules

Local API base URL:

`http://localhost:4000/v1`

For Expo, use a public environment variable such as:

`EXPO_PUBLIC_API_URL=http://localhost:4000/v1`

Use an environment-specific reachable API host: - Web browser: API host
reachable from the browser. - Android emulator: `localhost` inside the
emulator is not the development machine; use the host bridge address
(commonly `10.0.2.2`) where appropriate. - Physical device: use the
development machine's LAN IP or another reachable API host. - iOS
simulator: verify the configured host is reachable from the simulator.

Only the public API base URL belongs in client-side configuration. Never
commit real secrets.

### Known route families

The global API prefix is `/v1`. Previously inspected route families
include:

-   `/businesses`
-   `/businesses/:businessId/clients`
-   `/businesses/:businessId/invoices`
-   `/public/invoices/:token`
-   `/businesses/:businessId/payments`

Previously inspected invoice operations include:

-   `POST /businesses/:businessId/invoices`
-   `GET /businesses/:businessId/invoices`
-   `GET /businesses/:businessId/invoices/:invoiceId`
-   `PATCH /businesses/:businessId/invoices/:invoiceId`
-   `POST /businesses/:businessId/invoices/:invoiceId/issue`
-   `POST /businesses/:businessId/invoices/:invoiceId/cancel`
-   `GET /public/invoices/:token`

Previously inspected payment operations include:

-   `GET /businesses/:businessId/payments`
-   `GET /businesses/:businessId/payments/:paymentId`

**Important:** payment checkout and authentication routes have evolved
during backend development. Before wiring a route, inspect the current
controller decorators and DTOs in `apps/api/src`. Treat checked-in
backend code as the source of truth. Do not infer an endpoint from a
service method name or this summary.

### API client requirements

Create one centralized typed API client that: - Reads
`EXPO_PUBLIC_API_URL`. - Includes credentials for cookie-authenticated
requests where supported by the runtime. - Sets JSON headers for JSON
requests. - Parses success and error responses safely. - Handles non-2xx
responses and validation errors consistently. - Handles expired sessions
without infinite refresh loops. - Exposes typed methods to feature
modules. - Never logs cookies, tokens, private customer information or
sensitive payment data.

Derive types from actual backend DTOs and response shapes. Do not invent
fields or status values.

## 6. Security and financial boundaries

Never: - Request or store wallet seed phrases/private keys. - Put
`DATABASE_URL`, PostgreSQL credentials, JWT secrets, SMTP passwords or
`NEAR_INTENTS_API_KEY` in frontend environment variables. - Call NEAR
Intents directly from client code using a partner API key. - Store
authentication tokens in local storage/AsyncStorage as a workaround
without explicit backend/security approval. - Treat a quote as a
payment. - Treat a submitted transaction hash as proof of settlement. -
Calculate authoritative invoice balances or settlement decisions in the
client. - Use frontend-only role checks as a replacement for backend
authorization.

The backend enforces business membership and roles. Frontend role-aware
navigation is for user experience only.

## 7. Design and UX expectations

PayBridge should feel like a trustworthy financial product: modern,
clear, restrained and practical.

Requirements: - Responsive layouts across phone, tablet and
desktop/web. - Consistent navigation and active states. - Accessible
contrast, labels and focus states. - Understandable form validation. -
Loading, empty, error, offline and success states. - Confirmation before
irreversible actions such as issuing/cancelling invoices. - Clear
distinction between invoice status, payment status and provider
status. - Currency-aware formatting and decimal-safe money display. - No
fake charts, sample balances or fabricated transaction history presented
as real data.

Submit the proposed design system, navigation and key screen previews
for approval before building the full application.

## 8. Local development and collaboration

From repository root:

``` bash
pnpm install
```

Start the API:

``` bash
pnpm --filter @paybridge/api dev
```

Start the Expo client using the actual script in
`apps/client/package.json`. Inspect the package first; do not assume the
script name.

The API listens on port `4000` in the current local configuration.
PostgreSQL runs through Docker Compose in the project owner's
environment.

The backend configures credentialed CORS using `WEB_ORIGIN`. Coordinate
the correct web development origin if the Expo web URL differs from the
current configured origin. Native mobile requests do not use browser
CORS in the same way, but cookie handling still needs device testing.

### Working agreement

-   Work on a dedicated feature branch; do not commit directly to
    `main`.
-   Keep changes focused and submit reviewable pull requests.
-   Do not change database schema, migrations, backend dependencies or
    API behaviour without coordinating with the project owner.
-   Do not upgrade major dependencies without approval.
-   Raise missing endpoints and DTO mismatches early.
-   Keep a clear list of backend blockers.
-   Keep the frontend runnable while backend refinements continue in
    parallel.

## 9. Definition of done

A feature is ready for review when: - It uses a real API contract or is
clearly marked as a temporary UI-only prototype. - It works on its
intended Android, iOS and web targets. - It has appropriate loading,
empty, validation, success and error states. - It respects business
context and backend permissions. - It does not expose secrets or make
client-side financial decisions. - TypeScript checks pass. - Lint checks
pass. - Relevant Expo platform run/build checks pass. - Missing backend
endpoints or contracts are documented.

## 10. First tasks for the frontend developer

1.  Inspect the monorepo and confirm the `apps/client` Expo workspace,
    package scripts and platform targets.
2.  Run the API and client locally; verify basic connectivity.
3.  Test cookie-based authentication on web, Android and iOS before
    building the full auth experience. Report any native cookie/session
    blocker immediately.
4.  Propose the design system, navigation map and initial screen
    layouts.
5.  Build the app shell and centralized API client.
6.  Implement authentication and business onboarding.
7.  Continue with clients, invoices, public invoice view and payments.

**Primary instruction:** Build against the backend that exists today. Do
not block all frontend progress while backend refinements continue, but
do not fake or promise functionality the backend does not yet provide.
