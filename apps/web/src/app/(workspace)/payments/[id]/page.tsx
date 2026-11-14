import { PaymentDetailsScreen } from "@/features/payment-details";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentDetailsScreen paymentId={id} />;
}