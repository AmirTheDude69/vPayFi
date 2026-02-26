import { Suspense } from "react";

import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#9b9b9b]">Loading...</div>}>
      <LoginCard />
    </Suspense>
  );
}
