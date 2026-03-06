import crypto from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "portal_admin_session";

const SESSION_TTL_SECONDS = 60 * 60 * 8;

const getSecret = () => process.env.ADMIN_SESSION_SECRET || "portal-dev-secret-change-me";

const base64UrlEncode = (value) => Buffer.from(value, "utf8").toString("base64url");
const base64UrlDecode = (value) => Buffer.from(value, "base64url").toString("utf8");

const sign = (payload) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

export const createAdminSessionToken = (email) => {
  const payload = JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  const encoded = base64UrlEncode(payload);
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
};

export const verifyAdminSessionToken = (token) => {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);

  const sigA = Buffer.from(signature);
  const sigB = Buffer.from(expected);
  if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) return null;

  let parsed;
  try {
    parsed = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return null;
  }

  if (!parsed?.email || !parsed?.exp) return null;
  if (Date.now() / 1000 > parsed.exp) return null;
  return parsed;
};

export const getAdminSessionFromCookieStore = () => {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
};
