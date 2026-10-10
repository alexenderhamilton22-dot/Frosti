import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  credentialTag,
  secureEqual,
  verifySession,
} from "./session";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ApiError(
      `Configuration serveur incomplète : ${[!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(" et ")} manquant(s).`,
      503,
    );
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        }),
    },
  });
}
export async function user() {
  const token = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!token)
    throw new ApiError("Votre session a expiré. Reconnectez-vous.", 401);
  const { data, error } = await db()
    .from("app_users")
    .select("id,username,password")
    .eq("id", token.id)
    .maybeSingle();
  if (error)
    throw new ApiError("Impossible de vérifier la connexion. Réessayez.", 503);
  if (!data || !secureEqual(token.credential, credentialTag(data.password)))
    throw new ApiError("Reconnectez-vous à votre foyer.", 401);
  return { id: String(data.id), username: String(data.username) };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  let valid = false;
  try {
    valid =
      !!origin &&
      new URL(origin).host ===
        (request.headers.get("host") || new URL(request.url).host);
  } catch {}
  if (!valid)
    throw new ApiError("Cette demande doit être effectuée depuis Frosti.", 403);
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > 32000) throw new ApiError("La saisie est trop longue.", 413);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new ApiError("La demande est illisible.");
  }
}
export function textValue(
  value: unknown,
  name: string,
  max = 200,
  optional = false,
) {
  if (optional && (value === null || value === undefined || value === ""))
    return null;
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new ApiError(
      `${name} : saisissez une valeur valide (maximum ${max} caractères).`,
    );
  return value.trim();
}
export function uuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApiError("Identifiant invalide.");
  return value;
}
export function numberValue(value: unknown, min = 0) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > 1e9
  )
    throw new ApiError("Saisissez une quantité valide.");
  return value;
}
export function dateValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new ApiError("Date invalide.");
  return value;
}
export function databaseError(error: { code?: string; message: string }) {
  if (error.code === "P0001")
    return new ApiError(
      error.message,
      /changé|déjà utilisé/.test(error.message) ? 409 : 400,
    );
  if (error.code === "23514" || error.code === "23503")
    return new ApiError(
      "Stock ou emplacement incohérent. Vérifiez la quantité et le foyer.",
    );
  if (error.code === "23505")
    return new ApiError("Cette valeur existe déjà.", 409);
  console.error("Frosti database error", error.code, error.message);
  return new ApiError(
    "Impossible d’enregistrer. Vérifiez les migrations et réessayez.",
    503,
  );
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
export function failure(error: unknown) {
  if (error instanceof ApiError)
    return json({ error: error.message }, error.status);
  console.error(
    "Frosti request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return json(
    { error: "Le service est momentanément indisponible. Réessayez." },
    503,
  );
}
export async function rows<T>(
  table: string,
  owner?: string,
  column = "user_id",
): Promise<T[]> {
  const output: T[] = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    let query = db()
      .from(table)
      .select("*")
      .order(table === "user_settings" ? "user_id" : "id")
      .range(offset, offset + 499);
    if (owner) query = query.eq(column, owner);
    const { data, error } = await query;
    if (error) throw databaseError(error);
    output.push(...(data as unknown as T[]));
    if (data.length < 500) return output;
  }
  throw new ApiError("Trop de données pour une lecture complète.", 503);
}
