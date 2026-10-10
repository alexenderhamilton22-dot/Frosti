import {
  ApiError,
  body,
  dateValue,
  db,
  databaseError,
  failure,
  json,
  numberValue,
  sameOrigin,
  textValue,
  user,
  uuid,
} from "../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const household = await user();
    const input = await body(request);
    const action = textValue(input.action, "Action");
    if (
      ![
        "add",
        "edit",
        "inventory",
        "use",
        "discard",
        "transfer",
        "transfer_batch",
        "merge",
        "undo",
      ].includes(action!)
    )
      throw new ApiError("Action inconnue.");
    const operationId = uuid(input.operation_id);
    if (action === "transfer_batch") {
      if (
        !Array.isArray(input.lots) ||
        input.lots.length < 1 ||
        input.lots.length > 100
      )
        throw new ApiError("Sélectionnez entre 1 et 100 lots.");
      const lots = input.lots.map((raw: unknown) => {
        if (!raw || typeof raw !== "object")
          throw new ApiError("Lot invalide.");
        const lot = raw as Record<string, unknown>;
        return {
          id: uuid(lot.id),
          amount: numberValue(lot.amount, Number.MIN_VALUE),
          version: numberValue(lot.version, 1),
        };
      });
      const { data, error } = await db().rpc("frosti_transfer_batch", {
        p_user: household.id,
        p_operation: operationId,
        p_source: uuid(input.source_id),
        p_target: uuid(input.congelo_id),
        p_lots: lots,
      });
      if (error) throw databaseError(error);
      return json({ result: data, operation_id: operationId });
    }
    const payload: Record<string, unknown> = {};
    if (action === "add" || action === "edit") {
      payload.apply_default_expiry = action === "add";
      payload.produit = textValue(input.produit, "Produit");
      payload.categorie = textValue(input.categorie, "Catégorie");
      payload.unite = textValue(input.unite, "Unité", 60);
      payload.qte = numberValue(
        input.qte,
        action === "add" ? Number.MIN_VALUE : 0,
      );
      payload.date_entree = dateValue(input.date_entree);
      payload.date_peremption = dateValue(input.date_peremption);
      if (
        input.date_kind !== undefined &&
        !["declared", "estimated"].includes(String(input.date_kind))
      )
        throw new ApiError("Type de date invalide.");
      payload.date_kind = input.date_kind ?? "declared";
      payload.ingredient_id = input.ingredient_id
        ? uuid(input.ingredient_id)
        : null;
      if (payload.ingredient_id) {
        const { data: ingredient, error } = await db()
          .from("ingredient_catalog")
          .select("name")
          .eq("id", payload.ingredient_id)
          .maybeSingle();
        if (error) throw databaseError(error);
        if (!ingredient)
          throw new ApiError(
            "Actualisez le référentiel avant d’associer cet ingrédient.",
          );
        payload.ingredient_name = ingredient.name;
      } else payload.ingredient_name = null;
      payload.content_quantity =
        input.content_quantity == null || input.content_quantity === ""
          ? null
          : numberValue(input.content_quantity, Number.MIN_VALUE);
      payload.content_unit =
        payload.content_quantity == null
          ? null
          : textValue(input.content_unit, "Unité du contenu", 20);
      if (
        payload.content_unit &&
        !["g", "mL", "pièce(s)"].includes(String(payload.content_unit))
      )
        throw new ApiError("Unité du contenu invalide.");
      for (const [key, allowed] of Object.entries({
        product_type: ["food", "beverage", "wine"],
        preparation_origin: ["bought", "homemade"],
        date_role: ["unknown", "dlc", "ddm", "apogee", "indicative"],
      })) {
        const value = input[key] ?? (key === "date_role" ? "unknown" : null);
        if (value !== null && !allowed.includes(String(value)))
          throw new ApiError("Classification invalide.");
        payload[key] = value;
      }
      payload.date_fabrication = dateValue(input.date_fabrication);
      payload.notes = textValue(input.notes, "Notes", 2000, true);
    }
    if (action === "add" || action === "transfer")
      payload.congelo_id = uuid(input.congelo_id);
    if (action === "use" || action === "discard" || action === "transfer")
      payload.amount = numberValue(input.amount, Number.MIN_VALUE);
    if (action === "inventory") payload.qte = numberValue(input.qte);
    if (action === "edit" || action === "inventory" || action === "merge")
      payload.version = numberValue(input.version, 1);
    if (action === "undo")
      payload.operation_id = uuid(input.original_operation_id);
    const { data, error } = await db().rpc("frosti_stock_action", {
      p_user: household.id,
      p_operation: operationId,
      p_action: action,
      p_item:
        action === "add" || action === "undo" ? null : uuid(input.item_id),
      p_payload: payload,
    });
    if (error) throw databaseError(error);
    return json({ result: data, operation_id: operationId });
  } catch (error) {
    return failure(error);
  }
}
