import { auth } from "@/auth";
import { LoginCard } from "@/components/auth/login-card";
import { getAuthorizedEmail } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  if (session?.user?.email) {
    const allowed = await getAuthorizedEmail();
    if (allowed) redirect("/dashboard");
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return <LoginCard error={error} />;
}
