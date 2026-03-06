import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "../../../../lib/adminAuth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}
