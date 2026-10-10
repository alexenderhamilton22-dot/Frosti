import { Item, Equipment, Rule, Settings } from "./types";
export function localDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}
export function dayDifference(first: string, second: string) {
  return Math.round(
    (Date.parse(first + "T00:00:00Z") - Date.parse(second + "T00:00:00Z")) /
      86400000,
  );
}
export function alertFor(
  item: Item,
  equipments: Equipment[],
  rules: Rule[],
  settings: Settings,
  today = localDay(),
) {
  if (item.qte <= 0) return null;
  if (item.date_peremption) {
    const dateLabel =
      item.date_kind === "estimated" ? "Date indicative" : "Date limite";
    const days = dayDifference(item.date_peremption, today);
    if (!Number.isFinite(days)) return null;
    if (days < 0)
      return {
        level: "overdue",
        order: days,
        label: `${dateLabel} dépassée de ${-days} j`,
      };
    if (days <= settings.dlc_warning_days)
      return {
        level: "soon",
        order: days,
        label:
          days === 0
            ? `${dateLabel} aujourd’hui`
            : `${dateLabel} dans ${days} j`,
      };
    return null;
  }
  if (!item.date_entree) return null;
  const equipment = equipments.find((e) => e.id === item.congelo_id);
  if (!equipment)
    return { level: "unknown", order: 9999, label: "Emplacement à vérifier" };
  const rule = rules.find((r) => r.categorie === item.categorie);
  const threshold = equipment.is_fridge
    ? (rule?.fridge_days ?? 7)
    : (rule?.freezer_days ?? 90);
  const age = dayDifference(today, item.date_entree);
  if (Number.isFinite(age) && threshold > 0 && age >= threshold)
    return {
      level: "age",
      order: threshold - age,
      label: `Entré depuis ${age} j · rappel d’ancienneté`,
    };
  return null;
}
export function defaultExpiry(
  category: string,
  equipment: Equipment | undefined,
  rules: Rule[],
  entry: string,
) {
  if (!equipment || !entry) return null;
  const rule = rules.find((r) => r.categorie === category);
  const days = equipment.is_fridge
    ? rule?.fridge_default_days
    : rule?.freezer_default_days;
  if (!days || !Number.isInteger(days) || days < 1 || days > 3650) return null;
  const date = new Date(entry + "T00:00:00Z");
  if (!Number.isFinite(date.valueOf())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .trim();
}
export function parisDayStart(day: string) {
  const utc = new Date(day + "T00:00:00Z");
  const offset =
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Paris",
      timeZoneName: "shortOffset",
    })
      .formatToParts(utc)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const match = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const minutes = match
    ? (match[1] === "-" ? -1 : 1) *
      (Number(match[2]) * 60 + Number(match[3] ?? 0))
    : 0;
  return new Date(utc.valueOf() - minutes * 60000).toISOString();
}
