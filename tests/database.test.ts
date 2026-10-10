import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
const u = "11111111-1111-4111-8111-111111111111",
  v = "22222222-2222-4222-8222-222222222222",
  f = "33333333-3333-4333-8333-333333333333",
  g = "44444444-4444-4444-8444-444444444444",
  h = "55555555-5555-4555-8555-555555555555";
test("Real PostgreSQL migrations: atomic movements, idempotency, ownership, undo and compatibility", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("tests/baseline.sql", "utf8"));
    await db.exec(await readFile("migrations/001_frosti_v1_0.sql", "utf8"));
    // Migration is safe to rerun.
    await db.exec(await readFile("migrations/001_frosti_v1_0.sql", "utf8"));
    await db.query(
      "INSERT INTO app_users(id,username,password) VALUES($1,'KH','test'),($2,'Other','test')",
      [u, v],
    );
    await db.query(
      "INSERT INTO freezers(id,user_id,name,is_fridge) VALUES($1,$4,'Freezer',false),($2,$4,'Fridge',true),($3,$5,'Other',false)",
      [f, g, h, u, v],
    );
    async function action(
      action: string,
      item: string | null,
      payload: unknown,
      op = randomUUID(),
      owner = u,
    ) {
      const result = await db.query<{ result: Record<string, unknown> }>(
        "SELECT frosti_stock_action($1,$2,$3,$4,$5::jsonb) AS result",
        [owner, op, action, item, JSON.stringify(payload)],
      );
      return result.rows[0].result;
    }
    const request = {
      produit: "Courgettes",
      categorie: "Légumes",
      qte: 0.8,
      unite: "kg",
      congelo_id: f,
      date_entree: "2026-10-09",
      date_peremption: null,
      notes: null,
    };
    const addOp = randomUUID(),
      item = await action("add", null, request, addOp),
      itemId = String(item.id);
    assert.equal(Number(item.qte), 0.8);
    assert.equal((await action("add", null, request, addOp)).id, itemId);
    assert.equal((await db.query("SELECT * FROM items")).rows.length, 1);
    await assert.rejects(
      action("add", null, { ...request, qte: 1 }, addOp),
      /déjà utilisé/,
    );
    await assert.rejects(
      action("add", null, { ...request, congelo_id: h }),
      /Emplacement/,
    );
    await assert.rejects(
      action("use", itemId, { amount: 0.1 }, randomUUID(), v),
      /introuvable/,
    );
    const used = await action("use", itemId, { amount: 0.25 });
    assert.equal(Number(used.qte), 0.55);
    await assert.rejects(action("use", itemId, { amount: 1 }), /supérieure/);
    await assert.rejects(
      action("inventory", itemId, { qte: 2, version: 1 }),
      /changé/,
    );
    const transferOp = randomUUID();
    await action(
      "transfer",
      itemId,
      { amount: 0.2, congelo_id: g },
      transferOp,
    );
    let stock = await db.query<{ qte: string; congelo_id: string }>(
      "SELECT qte,congelo_id FROM items",
    );
    assert.equal(stock.rows.length, 2);
    assert.equal(
      stock.rows.reduce((sum, r) => sum + Number(r.qte), 0),
      0.55,
    );
    await action("undo", null, { operation_id: transferOp });
    stock = await db.query("SELECT qte,congelo_id FROM items");
    assert.equal(stock.rows.filter((r) => Number(r.qte) > 0).length, 1);
    assert.equal(Number(stock.rows.find((r) => r.congelo_id === f)!.qte), 0.55);
    await assert.rejects(
      action("undo", null, { operation_id: transferOp }),
      /déjà annulé/,
    );
    const useOp = randomUUID();
    await action("use", itemId, { amount: 0.1 }, useOp);
    await db.query("UPDATE items SET notes='Mealio update' WHERE id=$1", [
      itemId,
    ]);
    await assert.rejects(
      action("undo", null, { operation_id: useOp }),
      /changé depuis/,
    );
    await assert.rejects(
      db.query("UPDATE items SET congelo_id=$2 WHERE id=$1", [itemId, h]),
      /autre foyer|foreign key/,
    );
    await assert.rejects(
      db.query("UPDATE items SET qte=-1 WHERE id=$1", [itemId]),
      /check constraint/,
    );
    await assert.rejects(
      db.query("SELECT frosti_equipment_action($1,$2,'archive')", [u, f]),
      /Déplacez/,
    );
    const before = await db.query<{ qte: string; version: number }>(
      "SELECT qte,version FROM items WHERE id=$1",
      [itemId],
    );
    const correctionOp = randomUUID();
    await action(
      "inventory",
      itemId,
      { qte: 1.2, version: Number(before.rows[0].version) },
      correctionOp,
    );
    await action("undo", null, { operation_id: correctionOp });
    assert.equal(
      Number(
        (
          await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
            itemId,
          ])
        ).rows[0].qte,
      ),
      Number(before.rows[0].qte),
    );
    // Different clients decrement current quantity rather than replacing stale snapshots.
    await action("inventory", itemId, {
      qte: 5,
      version: Number(
        (
          await db.query<{ version: number }>(
            "SELECT version FROM items WHERE id=$1",
            [itemId],
          )
        ).rows[0].version,
      ),
    });
    await Promise.all([
      action("use", itemId, { amount: 1 }),
      action("use", itemId, { amount: 1 }),
    ]);
    assert.equal(
      Number(
        (
          await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
            itemId,
          ])
        ).rows[0].qte,
      ),
      3,
    );
    // Deletion by Mealio is journalled and reversible without altering its interface.
    await db.query("DELETE FROM items WHERE id=$1", [itemId]);
    const deletion = await db.query<{ operation_id: string }>(
      "SELECT operation_id FROM stock_movements WHERE item_id=$1 AND kind='delete' ORDER BY created_at DESC LIMIT 1",
      [itemId],
    );
    await action("undo", null, { operation_id: deletion.rows[0].operation_id });
    assert.equal(
      Number(
        (
          await db.query<{ qte: string }>("SELECT qte FROM items WHERE id=$1", [
            itemId,
          ])
        ).rows[0].qte,
      ),
      3,
    );
    const movements = await db.query<{ origin: string }>(
      "SELECT origin FROM stock_movements",
    );
    assert(movements.rows.some((m) => m.origin === "mealio_ou_externe"));
    await db.exec(
      await readFile("migrations/002_close_public_access.sql", "utf8"),
    );
    await db.exec("SET ROLE anon");
    await assert.rejects(
      db.query("SELECT password FROM app_users"),
      /permission denied/,
    );
    await assert.rejects(db.query("SELECT * FROM items"), /permission denied/);
    await assert.rejects(
      action("use", itemId, { amount: 1 }),
      /permission denied/,
    );
    await db.exec("RESET ROLE; SET ROLE service_role");
    assert.equal(
      (await db.query("SELECT * FROM items WHERE user_id=$1", [u])).rows.length,
      1,
    );
    await db.exec("RESET ROLE");
    const login = await db.query<{ ok: boolean }>(
      "SELECT frosti_login_attempt('test') AS ok",
    );
    assert.equal(login.rows[0].ok, true);
    for (let i = 0; i < 9; i++)
      await db.query("SELECT frosti_login_attempt('test')");
    assert.equal(
      (
        await db.query<{ ok: boolean }>(
          "SELECT frosti_login_attempt('test') AS ok",
        )
      ).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});
