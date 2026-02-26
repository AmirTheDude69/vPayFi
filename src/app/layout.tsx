import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "vPay Accounting Dashboard",
  description: "Accounting dashboard for vPay co-founders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID ?? "";

  return (
    <html lang="en">
      <body className="antialiased">
        <Providers appId={privyAppId}>{children}</Providers>
      </body>
    </html>
  );
}
