import {
  ApiError,
  body,
  db,
  databaseError,
  failure,
  json,
  numberValue,
  sameOrigin,
  user,
} from "../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const household = await user();
    const input = await body(request);
    if (input.type === "notifications") {
      const topic =
        typeof input.ntfy_topic === "string" ? input.ntfy_topic.trim() : "";
      if (topic && !/^[a-zA-Z0-9_-]{8,100}$/.test(topic))
        throw new ApiError(
          "Le canal doit contenir 8 à 100 lettres, chiffres, tirets ou underscores.",
        );
      const days = numberValue(input.dlc_warning_days, 0);
      if (!Number.isInteger(days) || days > 90)
        throw new ApiError("Choisissez une anticipation de 0 à 90 jours.");
      const { error } = await db()
        .from("user_settings")
        .upsert(
          {
            user_id: household.id,
            ntfy_topic: topic || null,
            dlc_warning_days: days,
          },
          { onConflict: "user_id" },
        );
      if (error) throw databaseError(error);
    } else if (input.type === "rules") {
      if (!Array.isArray(input.rules) || input.rules.length > 500)
        throw new ApiError("Règles invalides.");
      const rules = input.rules.map((raw: unknown) => {
        if (!raw || typeof raw !== "object")
          throw new ApiError("Règle invalide.");
        const r = raw as Record<string, unknown>;
        if (
          typeof r.categorie !== "string" ||
          !r.categorie.trim() ||
          r.categorie.length > 200
        )
          throw new ApiError("Catégorie invalide.");
        const fridge = numberValue(r.fridge_days, 1),
          freezer = numberValue(r.freezer_days, 1);
        const defaultDays = (value: unknown) => {
          if (value === null || value === undefined || value === "")
            return null;
          const days = numberValue(value, 1);
          if (!Number.isInteger(days) || days > 3650)
            throw new ApiError(
              "Les dates par défaut doivent être comprises entre 1 et 3650 jours.",
            );
          return days;
        };
        if (
          !Number.isInteger(fridge) ||
          !Number.isInteger(freezer) ||
          fridge > 3650 ||
          freezer > 3650
        )
          throw new ApiError(
            "Les délais doivent être compris entre 1 et 3650 jours.",
          );
        return {
          user_id: household.id,
          categorie: r.categorie,
          fridge_days: fridge,
          freezer_days: freezer,
          fridge_default_days: defaultDays(r.fridge_default_days),
          freezer_default_days: defaultDays(r.freezer_default_days),
        };
      });
      if (rules.length) {
        const { error } = await db()
          .from("alert_rules")
          .upsert(rules, { onConflict: "user_id,categorie" });
        if (error) throw databaseError(error);
      }
    } else throw new ApiError("Réglage inconnu.");
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
