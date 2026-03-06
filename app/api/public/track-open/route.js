import { NextResponse } from "next/server";
import { trackOpen } from "../../../../lib/adminData";

export async function POST(request) {
  try {
    const { appName } = await request.json();
    if (!appName) {
      return NextResponse.json({ error: "appName is required" }, { status: 400 });
    }
    await trackOpen(appName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
