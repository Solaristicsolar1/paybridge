import { PublicInvoiceScreen } from "@/features/public-invoice";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicInvoiceScreen token={token} />;
}