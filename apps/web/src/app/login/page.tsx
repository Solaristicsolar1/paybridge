import { Suspense } from "react";
import { AuthScreen } from "@/features/auth";
import { Loading } from "@/components/ui";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthScreen mode="login" />
    </Suspense>
  );
}