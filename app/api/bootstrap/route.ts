import { failure, json, user, rows } from "../../lib/server";
import {
  Item,
  Equipment,
  Category,
  Template,
  Rule,
  Settings,
} from "../../lib/types";
export async function GET() {
  try {
    const household = await user();
    const [
      items,
      equipments,
      categories,
      templates,
      rules,
      settings,
      ingredients,
    ] = await Promise.all([
      rows<Item>("items", household.id),
      rows<Equipment>("freezers", household.id),
      rows<Category>("categories"),
      rows<Template>("product_templates"),
      rows<Rule>("alert_rules", household.id),
      rows<Settings>("user_settings", household.id),
      rows<{ id: string; name: string }>("ingredient_catalog"),
    ]);
    return json({
      username: household.username,
      archive_enabled: process.env.FROSTI_ENABLE_ARCHIVE === "true",
      items: items.map((i) => ({
        ...i,
        qte: Number(i.qte),
        version: Number(i.version),
      })),
      equipments,
      categories,
      templates,
      rules,
      ingredients,
      settings: settings[0] ?? { ntfy_topic: null, dlc_warning_days: 3 },
      synchronizedAt: new Date().toISOString(),
    });
  } catch (error) {
    return failure(error);
  }
}
