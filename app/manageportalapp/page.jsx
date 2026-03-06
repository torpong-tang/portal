import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_COOKIE_NAME } from "../../lib/adminAuth";
import ManagePortalClient from "./ManagePortalClient";

export default function ManagePortalPage() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session) {
    redirect("/");
  }

  return <ManagePortalClient email={session.email} />;
}
