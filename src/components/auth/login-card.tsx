"use client";

import { ArrowUpRight, LoaderCircle, Lock, LogOut } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function LoginCard() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      router.replace(nextPath);
    }
  }, [ready, authenticated, router, nextPath]);

  return (
    <div className="min-h-screen bg-[#202020] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-[360px] items-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="relative mx-auto mb-5 h-14 w-14">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#4A9EFF] to-[#7C5CFF] opacity-20" />
              <div className="absolute inset-[1.5px] rounded-[14.5px] bg-[#202020]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="h-5 w-5 text-[#4A9EFF]" />
              </div>
            </div>
            <h1 className="text-[22px] font-semibold tracking-[-0.03em]">vPay Accounting</h1>
            <p className="mt-1 text-[12px] text-[#8a8a8a]">Sign in with your whitelisted email</p>
          </div>

          {!ready ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-3 text-[13px] text-[#a0a0a0]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading auth...
            </div>
          ) : authenticated ? (
            <div className="space-y-3">
              <p className="text-center text-[12px] text-[#9cc4ff]">{user?.email?.address ?? "Authenticated"}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-white/10 py-3 text-[13px] text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => login()}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold transition-all duration-300 hover:opacity-95"
              style={{
                background: "linear-gradient(135deg, #4A9EFF, #7C5CFF)",
                boxShadow: "0 0 28px rgba(74, 158, 255, 0.25)",
              }}
            >
              Continue with Privy
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="mt-7 flex items-center justify-center gap-2 text-[10px] text-[#595959]">
            <div className="h-1 w-1 rounded-full bg-[#4A9EFF]/40" />
            <span>Authorized co-founders only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
