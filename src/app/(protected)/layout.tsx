import { redirect } from "next/navigation";

import { MobileHeader, MobileTabNav, Sidebar } from "@/components/navigation/sidebar";
import { getAuthorizedEmail } from "@/lib/auth-guard";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const email = await getAuthorizedEmail();
  if (!email) {
    redirect("/login");
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
