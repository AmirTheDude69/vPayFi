"use client";

import { BarChart3, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

function navClass(active: boolean): string {
  return `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-all ${
    active ? "text-white" : "text-[#808080] hover:text-[#B0B0B0]"
  }`;
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const { logout } = usePrivy();
  const initial = email[0]?.toUpperCase() ?? "?";

  return (
    <aside className="w-[220px] shrink-0 bg-[#1A1A1A]">
      <div className="px-5 pb-6 pt-7">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7">
            <div className="absolute inset-0 rounded-md bg-gradient-to-br from-[#4A9EFF] to-[#7C5CFF] opacity-80" />
            <div className="absolute inset-[2px] rounded-[4px] bg-[#1A1A1A]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-gradient-to-r from-[#4A9EFF] to-[#7C5CFF] bg-clip-text text-[11px] font-extrabold text-transparent">
                v
              </span>
            </div>
          </div>
          <span className="text-[16px] font-semibold tracking-[-0.02em] text-white/90">vPay</span>
        </div>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-[#4A9EFF]/30 via-[#7C5CFF]/20 to-transparent" />

      <nav className="mt-5 space-y-0.5 px-3">
        <Link href="/dashboard" className={navClass(pathname.startsWith("/dashboard"))}>
          {pathname.startsWith("/dashboard") ? (
            <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#4A9EFF] to-[#7C5CFF]" />
          ) : null}
          <BarChart3 className="h-[15px] w-[15px]" />
          <span>Analytics</span>
        </Link>
        <Link href="/manage" className={navClass(pathname.startsWith("/manage"))}>
          {pathname.startsWith("/manage") ? (
            <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#4A9EFF] to-[#7C5CFF]" />
          ) : null}
          <Settings className="h-[15px] w-[15px]" />
          <span>Manage</span>
        </Link>
      </nav>

      <div className="px-4 pb-5 pt-6">
        <div className="mx-1 mb-3 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4A9EFF] to-[#7C5CFF]">
            <span className="text-[9px] font-bold text-white">{initial}</span>
          </div>
          <p className="flex-1 truncate text-[10px] text-[#808080]">{email}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="text-[#606060] transition-colors hover:text-white"
            title="Sign out"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MobileHeader({ email }: { email: string }) {
  const initial = email[0]?.toUpperCase() ?? "?";
  const { logout } = usePrivy();
  return (
    <header className="flex items-center justify-between border-b border-white/[0.04] bg-[#1A1A1A] px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="relative h-6 w-6">
          <div className="absolute inset-0 rounded-md bg-gradient-to-br from-[#4A9EFF] to-[#7C5CFF] opacity-80" />
          <div className="absolute inset-[2px] rounded-[4px] bg-[#1A1A1A]" />
        </div>
        <span className="text-[14px] font-semibold text-white/90">vPay</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#4A9EFF] to-[#7C5CFF]">
          <span className="text-[9px] font-bold text-white">{initial}</span>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-[#707070] transition-colors hover:text-white"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}

export function MobileTabNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-white/[0.04] bg-[#1A1A1A] md:hidden">
      <Link
        href="/dashboard"
        className={`flex flex-1 items-center justify-center gap-2 py-3 text-[12px] ${
          pathname.startsWith("/dashboard") ? "text-white" : "text-[#8a8a8a]"
        }`}
      >
        <BarChart3 className="h-4 w-4" />
        Analytics
      </Link>
      <Link
        href="/manage"
        className={`flex flex-1 items-center justify-center gap-2 py-3 text-[12px] ${
          pathname.startsWith("/manage") ? "text-white" : "text-[#8a8a8a]"
        }`}
      >
        <Settings className="h-4 w-4" />
        Manage
      </Link>
    </nav>
  );
}
