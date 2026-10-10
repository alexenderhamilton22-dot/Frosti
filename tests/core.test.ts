import assert from "node:assert/strict";
import { test } from "node:test";
import {
  signSession,
  verifySession,
  credentialTag,
  secureEqual,
} from "../app/lib/session";
import { alertFor, localDay, normalize } from "../app/lib/alerts";
import { Item } from "../app/lib/types";
process.env.FROSTI_SESSION_SECRET =
  "unit-tests-secret-with-at-least-32-characters";
const id = "11111111-1111-4111-8111-111111111111";
test("Session rejects forgery, legacy IDs, expiration, and password changes", () => {
  const token = signSession(id, "password", 100000);
  assert.equal(verifySession(token, 100001)?.id, id);
  assert.equal(verifySession(id, 100001), null);
  assert.equal(verifySession(token + "x", 100001), null);
  assert.equal(verifySession(token, 100000 + 31 * 86400000), null);
  assert.equal(
    secureEqual(
      verifySession(token, 100001)!.credential,
      credentialTag("changed"),
    ),
    false,
  );
});
test("Paris date and date-based alerts handle midnight and thresholds", () => {
  assert.equal(localDay(new Date("2026-10-08T22:30:00Z")), "2026-10-09");
  assert.equal(localDay(new Date("2026-12-08T23:30:00Z")), "2026-12-09");
  const item = {
    qte: 1,
    date_peremption: "2026-10-12",
    date_entree: "2026-10-08",
    categorie: "Légumes",
    congelo_id: "f",
  } as Item;
  assert.equal(
    alertFor(
      item,
      [],
      [],
      { ntfy_topic: null, dlc_warning_days: 3 },
      "2026-10-09",
    )?.order,
    3,
  );
  assert.equal(
    alertFor(
      item,
      [],
      [],
      { ntfy_topic: null, dlc_warning_days: 2 },
      "2026-10-09",
    ),
    null,
  );
  assert.equal(
    alertFor(
      { ...item, qte: 0 },
      [],
      [],
      { ntfy_topic: null, dlc_warning_days: 3 },
      "2026-10-09",
    ),
    null,
  );
  assert.equal(normalize("  Crème Épaisse "), "creme epaisse");
});
