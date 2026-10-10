import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
export const SESSION_COOKIE = "frosti_session";
export const SESSION_AGE = 60 * 60 * 24 * 30;
export function sessionSecret() {
  const secret = process.env.FROSTI_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "FROSTI_SESSION_SECRET doit contenir au moins 32 caractères.",
    );
  return secret;
}
export function secureEqual(a: string, b: string) {
  const first = createHmac("sha256", sessionSecret()).update(a).digest();
  const second = createHmac("sha256", sessionSecret()).update(b).digest();
  return timingSafeEqual(first, second);
}
export function credentialTag(password: string) {
  return createHmac("sha256", sessionSecret())
    .update("credential:" + password)
    .digest("hex");
}
export interface Session {
  id: string;
  expires: number;
  credential: string;
  nonce: string;
}
export function signSession(id: string, password: string, now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({
      id,
      expires: Math.floor(now / 1000) + SESSION_AGE,
      credential: credentialTag(password),
      nonce: randomUUID(),
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
  );
}
export function verifySession(
  token: string | undefined,
  now = Date.now(),
): Session | null {
  if (!token || token.length > 2000) return null;
  try {
    const [payload, signature, ...extra] = token.split(".");
    if (extra.length || !payload || !signature) return null;
    const expected = createHmac("sha256", sessionSecret())
      .update(payload)
      .digest("base64url");
    if (!secureEqual(signature, expected)) return null;
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as Session;
    if (
      !/^[0-9a-f-]{36}$/i.test(data.id) ||
      !Number.isFinite(data.expires) ||
      data.expires <= Math.floor(now / 1000) ||
      typeof data.credential !== "string"
    )
      return null;
    return data;
  } catch {
    return null;
  }
}
