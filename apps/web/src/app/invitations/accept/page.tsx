import { Suspense } from "react";
import { AcceptInvitationScreen } from "@/features/invitation";
import { Loading } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AcceptInvitationScreen />
    </Suspense>
  );
}