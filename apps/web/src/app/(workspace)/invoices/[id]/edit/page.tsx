import { InvoiceFormScreen } from "@/features/invoice-form";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceFormScreen invoiceId={id} />;
}