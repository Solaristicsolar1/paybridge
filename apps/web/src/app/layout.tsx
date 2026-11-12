import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PayBridge",
  description: "Simple invoicing and stablecoin payments for businesses."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
