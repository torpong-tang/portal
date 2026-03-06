import { NextResponse } from "next/server";
import { createAdminSessionToken, ADMIN_COOKIE_NAME } from "../../../../lib/adminAuth";
import { verifyAdminLogin } from "../../../../lib/adminData";

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    const ok = await verifyAdminLogin(email, password);
    if (!ok) {
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = createAdminSessionToken(email);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
