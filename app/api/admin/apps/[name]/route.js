import { NextResponse } from "next/server";
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from "../../../../../lib/adminAuth";
import { setAppDesiredState, setShowCard, setAppGroup } from "../../../../../lib/adminData";

const isAllowedState = (value) => value === "RUN" || value === "STOP";
const isAllowedGroup = (value) => value === "general" || value === "specific";

export async function PATCH(request, { params }) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appName = params.name;

  try {
    const body = await request.json();
    if (typeof body.showCard === "boolean") {
      await setShowCard({ appName, showCard: body.showCard });
    }
    if (typeof body.desiredState === "string") {
      if (!isAllowedState(body.desiredState)) {
        return NextResponse.json({ error: "Invalid desiredState" }, { status: 400 });
      }
      await setAppDesiredState({ appName, desiredState: body.desiredState });
    }
    if (typeof body.group === "string") {
      if (!isAllowedGroup(body.group)) {
        return NextResponse.json({ error: "Invalid group" }, { status: 400 });
      }
      await setAppGroup({ appName, group: body.group });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
