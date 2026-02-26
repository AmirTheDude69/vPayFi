import { redirect } from "next/navigation";

import { getAuthorizedEmail } from "@/lib/auth-guard";

export default async function Home() {
  const email = await getAuthorizedEmail();
  if (email) {
    redirect("/dashboard");
  }
  redirect("/login");
}
