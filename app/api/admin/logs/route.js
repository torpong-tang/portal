import { NextResponse } from "next/server";
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from "../../../../lib/adminAuth";
import { clearAllLogs, getAdminLogs } from "../../../../lib/adminData";

const isAuthorized = (request) => {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return Boolean(verifyAdminSessionToken(token));
};

export async function GET(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getAdminLogs();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await clearAllLogs();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
