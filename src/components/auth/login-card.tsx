"use client";

import { ArrowUpRight, Lock } from "lucide-react";
import { signIn } from "next-auth/react";

function errorMessage(code?: string): string | null {
  if (!code) return null;
  if (code === "AccessDenied") return "This email is not on the vPay whitelist.";
  return "Unable to sign in right now. Please try again.";
}

export function LoginCard({ error }: { error?: string }) {
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
            <p className="mt-1 text-[12px] text-[#8a8a8a]">Sign in with a whitelisted Google account</p>
          </div>

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-semibold transition-all duration-300 hover:opacity-95"
            style={{
              background: "linear-gradient(135deg, #4A9EFF, #7C5CFF)",
              boxShadow: "0 0 28px rgba(74, 158, 255, 0.25)",
            }}
          >
            Continue with Google
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>

          {errorMessage(error) ? (
            <p className="mt-3 text-center text-[11px] font-medium text-[#F87171]">{errorMessage(error)}</p>
          ) : null}

          <div className="mt-7 flex items-center justify-center gap-2 text-[10px] text-[#595959]">
            <div className="h-1 w-1 rounded-full bg-[#4A9EFF]/40" />
            <span>Authorized co-founders only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
