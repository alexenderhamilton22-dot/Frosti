import { parisDayStart } from "../../lib/alerts";
import {
  failure,
  json,
  user,
  db,
  databaseError,
  dateValue,
} from "../../lib/server";
export async function GET(request: Request) {
  try {
    const household = await user();
    const url = new URL(request.url);
    const offset = Math.max(
      0,
      Math.min(100000, Number(url.searchParams.get("offset")) || 0),
    );
    let query = db()
      .from("stock_movements")
      .select("*")
      .eq("user_id", household.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + 99);
    const since = url.searchParams.get("since"),
      until = url.searchParams.get("until");
    if (since) {
      dateValue(since);
      query = query.gte("created_at", parisDayStart(since));
    }
    if (until) {
      dateValue(until);
      const next = new Date(Date.parse(until) + 86400000)
        .toISOString()
        .slice(0, 10);
      query = query.lt("created_at", parisDayStart(next));
    }
    const { data, error } = await query;
    if (error) throw databaseError(error);
    return json({ movements: data, hasMore: data.length === 100 });
  } catch (error) {
    return failure(error);
  }
}
