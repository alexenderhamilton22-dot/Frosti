import { createHmac } from "node:crypto";
import {
  body,
  db,
  failure,
  json,
  sameOrigin,
  ApiError,
} from "../../../lib/server";
import {
  SESSION_AGE,
  SESSION_COOKIE,
  secureEqual,
  sessionSecret,
  signSession,
} from "../../../lib/session";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await body(request);
    if (
      typeof input.username !== "string" ||
      !input.username.trim() ||
      input.username.length > 200 ||
      typeof input.password !== "string" ||
      !input.password ||
      input.password.length > 500
    )
      throw new ApiError("Saisissez votre foyer et votre mot de passe.");
    const username = input.username.trim();
    const address =
      request.headers.get("x-vercel-forwarded-for") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      "local";
    for (const key of ["foyer:" + username, "adresse:" + address]) {
      const digest = createHmac("sha256", sessionSecret())
        .update(key)
        .digest("hex");
      const { data, error } = await db().rpc("frosti_login_attempt", {
        p_key: digest,
      });
      if (error)
        throw new ApiError(
          "La connexion nécessite la migration 001. Vérifiez son installation.",
          503,
        );
      if (!data)
        throw new ApiError(
          "Trop de tentatives. Réessayez dans 15 minutes.",
          429,
        );
    }
    const { data, error } = await db()
      .from("app_users")
      .select("id,password")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new ApiError("Connexion momentanément indisponible.", 503);
    const matches = secureEqual(
      input.password,
      data?.password ?? "invalid-account-placeholder",
    );
    if (!data || !matches)
      throw new ApiError("Foyer ou mot de passe incorrect.", 401);
    const response = json({ username });
    response.cookies.set(SESSION_COOKIE, signSession(data.id, data.password), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_AGE,
    });
    for (const legacy of ["congelo_user_id", "congelo_username"])
      response.cookies.set(legacy, "", { path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    return failure(error);
  }
}
