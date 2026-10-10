import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Item } from "../app/lib/types";
import { contentTotal, dateLabelFor } from "../app/lib/alerts";
const app = "frosti",
  location = "congelo_id";
const migrations = [
  "001_frosti_v1_0.sql",
  "004_frosti_v1_1.sql",
  "005_frosti_v1_2.sql",
  "006_frosti_v1_3.sql",
  "007_frosti_v1_3_1.sql",
];
test("Ecosystem: additive migration, metadata, strict receiving merge, CAS, atomic inventory, idempotent retries and complete undo", async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile("tests/baseline.sql", "utf8"));
    for (const m of migrations)
      await db.exec(await readFile("migrations/" + m, "utf8"));
    await db.exec(await readFile("migrations/" + migrations.at(-1), "utf8"));
    const u = randomUUID(),
      a = randomUUID(),
      b = randomUUID(),
      ingredient = randomUUID();
    await db.query(
      "INSERT INTO app_users(id,username,password) VALUES($1,'Test','test')",
      [u],
    );
    await db.query(
      `INSERT INTO ${"freezers"}(id,user_id,name) VALUES($1,$3,'A'),($2,$3,'B')`,
      [a, b, u],
    );
    const action = async (
      kind: string,
      id: string | null,
      payload: Record<string, unknown>,
      op = randomUUID(),
    ) =>
      (
        await db.query<{ r: Item }>(
          `SELECT ${app}_stock_action($1,$2,$3,$4,$5::jsonb) r`,
          [u, op, kind, id, JSON.stringify(payload)],
        )
      ).rows[0].r;
    const request = {
      produit: "Compote",
      categorie: "Épicerie",
      qte: 4,
      unite: "pot(s)",
      [location]: a,
      date_entree: "2026-10-10",
      date_peremption: "2027-01-01",
      preparation_id: randomUUID(),
      recipe_id: randomUUID(),
      portions_per_unit: 2,
      ingredient_id: ingredient,
      ingredient_name: "Pomme",
      content_quantity: 250,
      content_unit: "mL",
      product_type: "food",
      preparation_origin: "homemade",
      date_role: "ddm",
      date_fabrication: "2026-10-09",
    };
    const original = await action("add", null, request);
    assert.equal(contentTotal(original), "1 000 mL au total");
    for (const variant of [
      { preparation_id: randomUUID() },
      { content_quantity: 300 },
      { ingredient_id: randomUUID() },
      { date_role: "dlc" },
      { preparation_origin: "bought" },
    ]) {
      const target = await action("add", null, {
        ...request,
        [location]: b,
        ...variant,
      });
      const op = randomUUID();
      await action(
        "transfer",
        original.id,
        { amount: 1, [location]: b, version: original.version },
        op,
      );
      const moved = (
        await db.query<Item>(
          `SELECT * FROM items WHERE ${location}=$1 AND id<>$2`,
          [b, target.id],
        )
      ).rows[0];
      assert.equal(moved.content_quantity, "250");
      assert.equal(moved.ingredient_id, ingredient);
      assert.equal(
        new Date(moved.date_fabrication!).toISOString().slice(0, 10),
        "2026-10-09",
      );
      await action("undo", null, { operation_id: op });
      await action("use", target.id, { amount: 4 });
      original.version = (
        await db.query<Item>("SELECT version FROM items WHERE id=$1", [
          original.id,
        ])
      ).rows[0].version;
    }
    const receiveOp = randomUUID();
    const merged = await action(
      "add",
      null,
      { ...request, merge_exact: true, qte: 2 },
      receiveOp,
    );
    assert.equal(merged.id, original.id);
    assert.equal(Number(merged.qte), 6);
    assert.equal(
      (
        await action(
          "add",
          null,
          { ...request, merge_exact: true, qte: 2 },
          receiveOp,
        )
      ).id,
      original.id,
    );
    await action("undo", null, { operation_id: receiveOp });
    const fresh = (
      await db.query<Item>("SELECT * FROM items WHERE id=$1", [original.id])
    ).rows[0];
    await assert.rejects(
      action("use", original.id, { amount: 1, version: 1 }),
      /changé/,
    );
    const second = await action("add", null, { ...request, [location]: b });
    const batch = randomUUID();
    await assert.rejects(
      db.query(`SELECT ${app}_inventory_batch($1,$2,$3::jsonb)`, [
        u,
        batch,
        JSON.stringify([
          { id: fresh.id, qte: 2, unite: "pot(s)", version: fresh.version },
          { id: second.id, qte: 3, unite: "pot(s)", version: 999 },
        ]),
      ]),
      /changé/,
    );
    assert.equal(
      (await db.query<Item>("SELECT qte FROM items WHERE id=$1", [fresh.id]))
        .rows[0].qte,
      "4",
    );
    const rows = [
      { id: fresh.id, qte: 2, unite: "pot(s)", version: fresh.version },
      { id: second.id, qte: 3, unite: "pot(s)", version: second.version },
    ];
    await db.query(`SELECT ${app}_inventory_batch($1,$2,$3::jsonb)`, [
      u,
      batch,
      JSON.stringify(rows),
    ]);
    await db.query(`SELECT ${app}_inventory_batch($1,$2,$3::jsonb)`, [
      u,
      batch,
      JSON.stringify(rows),
    ]);
    await action("undo", null, { operation_id: batch });
    const op = randomUUID();
    await action("use", fresh.id, { amount: 4 }, op);
    await action("undo", null, { operation_id: op });
    const restored = (
      await db.query<Item>("SELECT * FROM items WHERE id=$1", [fresh.id])
    ).rows[0];
    assert.equal(restored.date_role, "ddm");
    assert.equal(restored.content_quantity, "250");
    await assert.rejects(
      action("add", null, { ...request, content_unit: null }),
      /check constraint/,
    );
    assert.equal(
      dateLabelFor({ ...restored, date_role: "unknown" }),
      "Date de suivi",
    );
    assert.equal(dateLabelFor(restored), "DDM");
    const legacy=await action("add",null,{produit:"Ancien lot",categorie:"Épicerie",qte:2,unite:"pot(s)",[location]:a});
    const legacyOp=randomUUID();await action("use",legacy.id,{amount:1},legacyOp);
    // A movement written by the previous schema has no additive metadata keys.
    await db.query("UPDATE stock_movements SET after_row=after_row-ARRAY['ingredient_id','ingredient_name','content_quantity','content_unit','product_type','preparation_origin','date_role','date_fabrication','millesime','domaine','format'],before_row=before_row-ARRAY['ingredient_id','ingredient_name','content_quantity','content_unit','product_type','preparation_origin','date_role','date_fabrication','millesime','domaine','format'] WHERE operation_id=$1",[legacyOp]);
    await action("undo",null,{operation_id:legacyOp});
    assert.equal(Number((await db.query<Item>("SELECT * FROM items WHERE id=$1",[legacy.id])).rows[0].qte),2);
    const coordinated=randomUUID();await action("use",legacy.id,{amount:1,origin:"mealio"},coordinated);
    await assert.rejects(action("undo",null,{operation_id:coordinated}),/coordonnée par Mealio/);

    await db.query("INSERT INTO alert_rules(user_id,categorie,freezer_default_days,fridge_default_days) VALUES($1,'Default',2,1)",[u]);
    const defaultOp=randomUUID();const draft={produit:'Defaults',categorie:'Default',qte:1,unite:'g',[location]:a,date_entree:'2026-02-28',apply_default_expiry:true};
    const dated=await action('add',null,draft,defaultOp);
    assert.equal(dated.date_peremption,'2026-03-02');assert.equal(dated.date_kind,'estimated');assert.equal(dated.date_role,'indicative');
    assert.equal((await action('add',null,draft,defaultOp)).id,dated.id);
    const conditioned=await action('add',null,{...request,qte:1});
    await assert.rejects(db.query(`SELECT ${app}_inventory_batch($1,$2,$3::jsonb)`,[u,randomUUID(),JSON.stringify([{id:conditioned.id,qte:1,unite:'g',version:conditioned.version}])]),/contenu par unité/);
    assert.equal(conditioned.preparation_id,request.preparation_id);assert.equal(conditioned.portions_per_unit,2);
  } finally {
    await db.close();
  }
});
