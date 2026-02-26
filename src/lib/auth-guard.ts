import { PrivyClient } from "@privy-io/node";

import { prisma } from "@/lib/prisma";

let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (privyClient) return privyClient;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
  if (!appId || !appSecret || !verificationKey) {
    throw new Error("Privy server env vars are missing.");
  }

  privyClient = new PrivyClient({
    appId,
    appSecret,
    jwtVerificationKey: verificationKey,
  });

  return privyClient;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function getEmailFromLinkedAccounts(linkedAccounts: Array<{ type: string; address?: string }>): string | null {
  const email = linkedAccounts.find((account) => account.type === "email")?.address;
  return email ? email.toLowerCase() : null;
}

export async function getAuthorizedEmailFromRequest(request: Request): Promise<string | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  let userEmail: string | null = null;
  try {
    const privy = getPrivyClient();
    const claims = await privy.utils().auth().verifyAccessToken(accessToken);
    const user = await privy.users()._get(claims.user_id);
    userEmail = getEmailFromLinkedAccounts(user.linked_accounts);
  } catch {
    return null;
  }

  if (!userEmail) return null;

  const allowed = await prisma.allowedEmail.findUnique({
    where: { email: userEmail },
    select: { isActive: true },
  });

  if (!allowed?.isActive) return null;
  return userEmail;
}
