import { Suspense } from "react";
import { InvoicesScreen } from "@/features/invoices";
import { Loading } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <InvoicesScreen />
    </Suspense>
  );
}