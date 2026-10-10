import {
  ApiError,
  db,
  databaseError,
  failure,
  json,
  rows,
} from "../../lib/server";
import { secureEqual } from "../../lib/session";
import { alertFor, localDay } from "../../lib/alerts";
import { Equipment, Item, Rule, Settings } from "../../lib/types";
import { notify } from "../../lib/notifications";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (
      !secret ||
      !secureEqual(
        request.headers.get("authorization") ?? "",
        `Bearer ${secret}`,
      )
    )
      throw new ApiError("Accès refusé.", 401);
    const [allItems, equipments, rules, settings] = await Promise.all([
      rows<Item>("items"),
      rows<Equipment>("freezers"),
      rows<Rule & { user_id: string }>("alert_rules"),
      rows<Settings & { user_id: string }>("user_settings"),
    ]);
    let sent = 0,
      failed = 0,
      skipped = 0;
    const day = localDay();
    // Each household is isolated; one failed notification does not stop others.
    const candidates = settings.filter((s) => s.ntfy_topic);
    for (let offset = 0; offset < candidates.length; offset += 5) {
      await Promise.all(
        candidates.slice(offset, offset + 5).map(async (settings) => {
          const ownedItems = allItems.filter(
            (i) => i.user_id === settings.user_id,
          );
          const ownedEquipment = equipments.filter(
            (e) => e.user_id === settings.user_id,
          );
          const ownedRules = rules.filter(
            (r) => r.user_id === settings.user_id,
          );
          const attention = ownedItems.filter((i) =>
            alertFor(i, ownedEquipment, ownedRules, settings, day),
          );
          if (!attention.length) return;
          const { error: claimError } = await db()
            .from("frosti_notification_runs")
            .insert({ user_id: settings.user_id, day, status: "processing" });
          if (claimError) {
            if (claimError.code === "23505") {
              skipped++;
              return;
            }
            throw databaseError(claimError);
          }
          try {
            await notify(
              settings.ntfy_topic!,
              `${attention.length} lot(s) à vérifier : ${attention
                .slice(0, 10)
                .map(
                  (i) =>
                    `${i.produit} (${alertFor(i, ownedEquipment, ownedRules, settings, day)?.label})`,
                )
                .join(", ")}${attention.length > 10 ? "…" : ""}`,
            );
            const { error } = await db()
              .from("frosti_notification_runs")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("user_id", settings.user_id)
              .eq("day", day);
            if (error) throw databaseError(error);
            sent++;
          } catch (error) {
            failed++;
            await db()
              .from("frosti_notification_runs")
              .update({
                status: "failed",
                error: error instanceof Error ? error.message : "Échec",
              })
              .eq("user_id", settings.user_id)
              .eq("day", day);
          }
        }),
      );
    }
    return json({ sent, failed, skipped }, failed ? 502 : 200);
  } catch (error) {
    return failure(error);
  }
}
