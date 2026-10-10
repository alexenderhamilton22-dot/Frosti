import {
  db,
  databaseError,
  failure,
  json,
  sameOrigin,
  user,
  ApiError,
} from "../../../lib/server";
import { notify } from "../../../lib/notifications";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const household = await user();
    const { data, error } = await db()
      .from("user_settings")
      .select("ntfy_topic")
      .eq("user_id", household.id)
      .maybeSingle();
    if (error) throw databaseError(error);
    if (!data?.ntfy_topic)
      throw new ApiError("Enregistrez votre canal avant de le tester.");
    await notify(
      data.ntfy_topic,
      `Frosti : les notifications du foyer ${household.username} fonctionnent.`,
    );
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
