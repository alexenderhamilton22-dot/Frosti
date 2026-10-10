import {
  ApiError,
  body,
  db,
  databaseError,
  failure,
  json,
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
    if (
      input.action === "archive" &&
      process.env.FROSTI_ENABLE_ARCHIVE !== "true"
    )
      throw new ApiError(
        "L’archivage sera disponible après adaptation du rangement dans Mealio.",
      );
    if (
      !["add", "rename", "archive", "restore", "delete"].includes(
        String(input.action),
      )
    )
      throw new ApiError("Action inconnue.");
    const { data, error } = await db().rpc("frosti_equipment_action", {
      p_user: household.id,
      p_id: input.action === "add" ? null : uuid(input.id),
      p_action: input.action,
      p_name:
        input.action === "add" || input.action === "rename"
          ? textValue(input.name, "Nom")
          : null,
      p_fridge: input.is_fridge === true,
    });
    if (error) throw databaseError(error);
    return json(data);
  } catch (error) {
    return failure(error);
  }
}
