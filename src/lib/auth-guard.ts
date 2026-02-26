import { type VerifyAccessTokenResponse, PrivyClient } from "@privy-io/node";

import { prisma } from "@/lib/prisma";

let privyClientWithOverride: PrivyClient | null = null;
let privyClientWithRemoteJwks: PrivyClient | null = null;

function getPrivyClient(useVerificationKeyOverride: boolean): PrivyClient {
  if (useVerificationKeyOverride && privyClientWithOverride) return privyClientWithOverride;
  if (!useVerificationKeyOverride && privyClientWithRemoteJwks) return privyClientWithRemoteJwks;

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error("Privy server env vars are missing.");
  }

  const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
  const client = new PrivyClient({
    appId,
    appSecret,
    ...(useVerificationKeyOverride && verificationKey ? { jwtVerificationKey: verificationKey } : {}),
  });

  if (useVerificationKeyOverride) {
    privyClientWithOverride = client;
  } else {
    privyClientWithRemoteJwks = client;
  }

  return client;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

interface LinkedAccountLike {
  type?: string;
  address?: string | null;
  email?: string | null;
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getEmailFromLinkedAccounts(linkedAccounts: Array<LinkedAccountLike>): string | null {
  for (const account of linkedAccounts) {
    if (account.type === "email") {
      const normalized = normalizeEmail(account.address);
      if (normalized) return normalized;
    }
  }

  for (const account of linkedAccounts) {
    const normalized = normalizeEmail(account.email);
    if (normalized) return normalized;
  }

  return null;
}

export async function getAuthorizedEmailFromRequest(request: Request): Promise<string | null> {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  let userEmail: string | null = null;
  try {
    const privyPrimary = getPrivyClient(true);
    let claims: VerifyAccessTokenResponse;
    try {
      claims = await privyPrimary.utils().auth().verifyAccessToken(accessToken);
    } catch (primaryError) {
      if (!process.env.PRIVY_VERIFICATION_KEY) {
        throw primaryError;
      }

      const privyFallback = getPrivyClient(false);
      claims = await privyFallback.utils().auth().verifyAccessToken(accessToken);
      console.warn("Privy auth verification succeeded via JWKS fallback.");
    }

    const user = await privyPrimary.users()._get(claims.user_id);
    userEmail = getEmailFromLinkedAccounts(user.linked_accounts);
  } catch (error) {
    console.error("Privy auth verification failed:", error);
    return null;
  }

  if (!userEmail) {
    console.warn("Privy user verified but no email was found in linked accounts.");
    return null;
  }

  const allowed = await prisma.allowedEmail.findFirst({
    where: {
      email: { equals: userEmail, mode: "insensitive" },
    },
    select: { isActive: true },
  });

  if (!allowed?.isActive) {
    console.warn("Whitelist check failed for email:", userEmail);
    return null;
  }
  return userEmail;
}
