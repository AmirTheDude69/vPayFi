import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getAuthorizedEmail(): Promise<string | null> {
  const session = await auth();
  const rawEmail = session?.user?.email;
  if (!rawEmail) return null;
  const email = rawEmail.toLowerCase();

  const allowed = await prisma.allowedEmail.findUnique({
    where: { email },
    select: { isActive: true },
  });

  if (!allowed?.isActive) return null;
  return email;
}
