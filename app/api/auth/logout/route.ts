import { failure, json, sameOrigin } from "../../../lib/server";
import { SESSION_COOKIE } from "../../../lib/session";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const response = json({ ok: true });
    for (const name of [SESSION_COOKIE, "congelo_user_id", "congelo_username"])
      response.cookies.set(name, "", { path: "/", httpOnly: true, maxAge: 0 });
    return response;
  } catch (error) {
    return failure(error);
  }
}
