"use client";

import { PrivyProvider } from "@privy-io/react-auth";

export function Providers({
  children,
  appId,
}: {
  children: React.ReactNode;
  appId: string;
}) {
  if (!appId) {
    throw new Error("Missing Privy app ID.");
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#4A9EFF",
        },
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
          solana: {
            createOnLogin: "off",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
