import { NextResponse } from "next/server";

import { getAuthorizedEmailFromRequest } from "@/lib/auth-guard";
import { unauthorizedResponse } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const email = await getAuthorizedEmailFromRequest(request);
  if (!email) return unauthorizedResponse();
  return NextResponse.json({ email });
}
