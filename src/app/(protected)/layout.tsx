"use client";

import { usePrivy } from "@privy-io/react-auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MobileHeader, MobileTabNav, Sidebar } from "@/components/navigation/sidebar";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    let cancelled = false;
    async function verifyWhitelistAccess() {
      setIsCheckingAccess(true);
      setAccessError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new Error("Missing access token.");

        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error("Your email is not whitelisted for this dashboard.");
        }
        const payload = (await response.json()) as { email: string };
        if (!cancelled) setEmail(payload.email);
      } catch (error) {
        if (!cancelled) {
          setAccessError(error instanceof Error ? error.message : "Access denied.");
        }
      } finally {
        if (!cancelled) setIsCheckingAccess(false);
      }
    }

    void verifyWhitelistAccess();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, router, pathname]);

  if (!ready || isCheckingAccess) {
    return <div className="p-8 text-sm text-[#9b9b9b]">Checking access...</div>;
  }

  if (accessError || !email) {
    return (
      <div className="min-h-screen bg-[#202020] px-6 py-20 text-white">
        <div className="mx-auto max-w-md rounded-2xl border border-[#f87171]/30 bg-[#2a2323] p-6">
          <h1 className="text-xl font-semibold">Access denied</h1>
          <p className="mt-2 text-sm text-[#f3c0c0]">{accessError ?? "You do not have access to this dashboard."}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="hidden min-h-screen bg-[#1A1A1A] text-white md:flex">
        <Sidebar email={email} />
        <div className="w-px bg-white/[0.04]" />
        <main className="min-h-screen flex-1 overflow-y-auto bg-[#202020]">{children}</main>
      </div>

      <div className="min-h-screen bg-[#202020] pb-16 text-white md:hidden">
        <MobileHeader email={email} />
        <main>{children}</main>
        <MobileTabNav />
      </div>
    </>
  );
}
