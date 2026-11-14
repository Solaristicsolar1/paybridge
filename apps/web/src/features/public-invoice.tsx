"use client";

import { useCallback, useRef } from "react";
import { publicApi } from "@/lib/api";
import {
  Badge, Brand, ErrorState, Loading,
} from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { InvoiceDocument } from "./invoice-document";
import { CheckoutPanel } from "./checkout-panel";

export function PublicInvoiceScreen({ token }: { token: string }) {
  const load = useCallback(
    (signal: AbortSignal) => publicApi.invoice(token, signal),
    [token],
  );

  const { data: invoice, loading, error, reload } = useResource(load);
  const lastConfirmed = useRef("");

  const onConfirmed = useCallback((paymentId: string) => {
    // Refresh once per confirmed payment, including partial-payment cases.
    if (lastConfirmed.current === paymentId) return;
    lastConfirmed.current = paymentId;
    reload();
  }, [reload]);

  return (
    <div className="public-layout">
      <header className="public-header">
        <Brand />
        <span>Invoice & payment</span>
      </header>

      <main id="main-content" className="public-main">
        {loading ? (
          <Loading label="Opening invoice…" />
        ) : error || !invoice ? (
          <ErrorState
            error={error || "Invoice unavailable."}
            retry={reload}
          />
        ) : (
          <>
            <div className="public-title">
              <h1>Your invoice, ready to view.</h1>
              <p>Review the details below before starting a payment.</p>
            </div>

            <div className="checkout-layout">
              <InvoiceDocument invoice={invoice} />

              <aside className="checkout-aside">
                {invoice.status === "PAID" ? (
                  <section className="panel panel-padding">
                    <Badge status="PAID" />
                    <h2>This invoice is paid.</h2>
                    <p>
                      PayBridge has recorded confirmed payments
                      covering this invoice.
                    </p>
                  </section>
                ) : invoice.status === "OVERPAID" ? (
                  <section className="panel panel-padding">
                    <Badge status="OVERPAID" />
                    <h2>This invoice is overpaid.</h2>
                    <p>
                      No additional payment is needed.
                      Contact the business about the excess payment.
                    </p>
                  </section>
                ) : invoice.currency !== "USD" ? (
                  <section className="panel panel-padding">
                    <h2>Contact the business to pay</h2>
                    <p>
                      Stablecoin checkout is currently available for
                      USD invoices. This invoice is in {invoice.currency}.
                    </p>
                  </section>
                ) : ["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) ? (
                  <CheckoutPanel token={token} onConfirmed={onConfirmed} />
                ) : (
                  <section className="panel panel-padding">
                    <h2>Checkout unavailable</h2>
                    <p>Contact the business about this invoice.</p>
                  </section>
                )}

                <p className="checkout-help">
                  Send funds only to the deposit instructions returned
                  for this invoice. You never need to share a seed phrase
                  or private key.
                </p>
              </aside>
            </div>
          </>
        )}
      </main>

      <footer className="public-footer">
        Powered by PayBridge · USDC settlement on Base
      </footer>
    </div>
  );
}