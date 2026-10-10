import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Item } from "../app/lib/types";
const u = "11111111-1111-4111-8111-111111111111",
  f = "33333333-3333-4333-8333-333333333333",
  g = "44444444-4444-4444-8444-444444444444";
test("V1.2: identical transfers merge quantities, preserve distinct notes/dates, and undo complete grouped merges", async () => {
  const db = new PGlite();
  try {
    for (const file of [
      "tests/baseline.sql",
      "migrations/001_frosti_v1_0.sql",
      "migrations/004_frosti_v1_1.sql",
      "migrations/005_frosti_v1_2.sql",
      "migrations/005_frosti_v1_2.sql",
    ])
      await db.exec(await readFile(file, "utf8"));
    await db.query(
      "INSERT INTO app_users(id,username,password) VALUES($1,'KH','test')",
      [u],
    );
    await db.query(
      "INSERT INTO freezers(id,user_id,name,is_fridge) VALUES($1,$3,'Source',false),($2,$3,'Cible',false)",
      [f, g, u],
    );
    async function action(
      action: string,
      item: string | null,
      payload: unknown,
      op = randomUUID(),
    ) {
      return (
        await db.query<{ result: Item }>(
          "SELECT frosti_stock_action($1,$2,$3,$4,$5::jsonb) result",
          [u, op, action, item, JSON.stringify(payload)],
        )
      ).rows[0].result;
    }
    async function add(
      location: string,
      quantity: number,
      notes = "Mars",
      entry = "2026-08-20",
    ) {
      return action("add", null, {
        produit: "Bâtonnets glacés",
        categorie: "Pâtisserie",
        qte: quantity,
        unite: "pièce(s)",
        congelo_id: location,
        date_entree: entry,
        date_peremption: null,
        date_kind: "declared",
        notes,
      });
    }
    const destination = await add(g, 4),
      a = await add(f, 2),
      different = await add(g, 3, "Magnum blanc");
    const op = randomUUID();
    await action("transfer", a.id, { amount: 2, congelo_id: g }, op);
    await action("transfer", a.id, { amount: 2, congelo_id: g }, op);
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          destination.id,
        ])
      ).rows[0].qte,
      "6",
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM items WHERE congelo_id=$1",
          [g],
        )
      ).rows[0].n,
      2,
    );
    await action("undo", null, { operation_id: op });
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          destination.id,
        ])
      ).rows[0].qte,
      "4",
    );
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          a.id,
        ])
      ).rows[0].qte,
      "2",
    );
    const partial = randomUUID();
    await action("transfer", a.id, { amount: 0.5, congelo_id: g }, partial);
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          a.id,
        ])
      ).rows[0].qte,
      "1.5",
    );
    await action("undo", null, { operation_id: partial });
    const differentDate = await add(f, 1, "Mars", "2026-08-21");
    await action("transfer", differentDate.id, { amount: 1, congelo_id: g });
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM items WHERE congelo_id=$1 AND notes='Mars'",
          [g],
        )
      ).rows[0].n,
      2,
    );
    const b = await add(f, 5);
    const sourceRows = (
      await db.query<Item>("SELECT * FROM items WHERE congelo_id=$1", [f])
    ).rows;
    const batchId = randomUUID();
    const lots = sourceRows.map((r) => ({
      id: r.id,
      amount: Number(r.qte),
      version: Number(r.version),
    }));
    await db.query("SELECT frosti_transfer_batch($1,$2,$3,$4,$5::jsonb)", [
      u,
      batchId,
      f,
      g,
      JSON.stringify(lots),
    ]);
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          destination.id,
        ])
      ).rows[0].qte,
      "11",
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM stock_movements WHERE operation_id=$1 AND item_id=$2",
          [batchId, destination.id],
        )
      ).rows[0].n,
      1,
    );
    await action("undo", null, { operation_id: batchId });
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          destination.id,
        ])
      ).rows[0].qte,
      "4",
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM items WHERE congelo_id=$1",
          [f],
        )
      ).rows[0].n,
      2,
    );
    const duplicate = await add(g, 2);
    await assert.rejects(
      action("merge", duplicate.id, { version: 999 }),
      /changé/,
    );
    const mergeId = randomUUID();
    await action(
      "merge",
      duplicate.id,
      { version: duplicate.version },
      mergeId,
    );
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          destination.id,
        ])
      ).rows[0].qte,
      "6",
    );
    await action("undo", null, { operation_id: mergeId });
    assert.equal(
      (
        await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
          duplicate.id,
        ])
      ).rows[0].qte,
      "2",
    );
    await assert.rejects(
      action("merge", different.id, { version: different.version }),
      /Aucun autre lot/,
    );
    // Also test several source rows merging into a destination created by the first transfer.
    await action("edit", a.id, {
      ...sourceRows.find((r) => r.id === a.id),
      produit: "Autre",
      version: Number(
        (await db.query<Item>("SELECT * FROM items WHERE id=$1", [a.id]))
          .rows[0].version,
      ),
    });
    const c = await add(f, 1, "Snickers"),
      d = await add(f, 2, "Snickers");
    const newBatch = randomUUID();
    await db.query("SELECT frosti_transfer_batch($1,$2,$3,$4,$5::jsonb)", [
      u,
      newBatch,
      f,
      g,
      JSON.stringify(
        [c, d].map((r) => ({
          id: r.id,
          amount: Number(r.qte),
          version: Number(r.version),
        })),
      ),
    ]);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM items WHERE congelo_id=$1 AND notes='Snickers'",
          [g],
        )
      ).rows[0].n,
      1,
    );
    await action("undo", null, { operation_id: newBatch });
    assert.equal(
      (
        await db.query<{ n: number }>(
          "SELECT count(*)::int n FROM items WHERE congelo_id=$1 AND notes='Snickers'",
          [f],
        )
      ).rows[0].n,
      2,
    );
    assert(b.id);
  } finally {
    await db.close();
  }
});
