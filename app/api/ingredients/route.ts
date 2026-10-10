import { createClient } from "@supabase/supabase-js";
import {
  ApiError,
  db,
  databaseError,
  failure,
  json,
  sameOrigin,
  user,
} from "../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await user();
    const url = process.env.MEALIO_SUPABASE_URL,
      key = process.env.MEALIO_SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new ApiError(
        "Configurez MEALIO_SUPABASE_URL et MEALIO_SUPABASE_SERVICE_ROLE_KEY sur le serveur pour importer le référentiel.",
        503,
      );
    const remote = createClient(url, key, {
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
    let count = 0;
    for (let offset = 0; offset < 20000; offset += 500) {
      const { data, error } = await remote
        .from("official_ingredients")
        .select("id,nom")
        .order("id")
        .range(offset, offset + 499);
      if (error)
        throw new ApiError("Impossible de lire le référentiel Mealio.", 503);
      if (!data?.length) break;
      const rows = data.map((i) => ({
        id: i.id,
        name: i.nom,
        updated_at: new Date().toISOString(),
      }));
      const { error: localError } = await db()
        .from("ingredient_catalog")
        .upsert(rows);
      if (localError) throw databaseError(localError);
      count += rows.length;
      if (data.length < 500) break;
    }
    return json({ count });
  } catch (error) {
    return failure(error);
  }
}
