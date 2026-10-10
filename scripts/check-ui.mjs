import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:net";
const portProbe = createServer();
await new Promise((resolve) => portProbe.listen(0, "127.0.0.1", resolve));
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
const base = `http://127.0.0.1:${port}`,
  secret = "local-preview-secret-at-least-32-characters",
  id = "11111111-1111-4111-8111-111111111111",
  f = "33333333-3333-4333-8333-333333333333",
  g = "44444444-4444-4444-8444-444444444444";
const payload = Buffer.from(
  JSON.stringify({
    id,
    expires: Math.floor(Date.now() / 1000) + 3600,
    credential: "preview",
    nonce: randomUUID(),
  }),
).toString("base64url");
const token =
  payload +
  "." +
  createHmac("sha256", secret).update(payload).digest("base64url");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { env: { ...process.env, FROSTI_SESSION_SECRET: secret }, stdio: "ignore" },
);
let ready = false;
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    const response = await fetch(base + "/login");
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) {
  server.kill();
  throw new Error("Preview server did not start");
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  server.kill();
  throw error;
}
await mkdir("../qa", { recursive: true });
try {
  const unauthorized = await browser.newContext();
  let response = await unauthorized.request.get(base + "/api/auth/me");
  assert.equal(response.status(), 401);
  response = await unauthorized.request.post(base + "/api/stock", { data: {} });
  assert.equal(response.status(), 403);
  await unauthorized.addCookies([
    { name: "congelo_user_id", value: id, url: base },
  ]);
  const loginPage = await unauthorized.newPage();
  await loginPage.goto(base);
  await loginPage.waitForURL("**/login");
  await unauthorized.close();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });
  await context.addCookies([
    { name: "frosti_session", value: token, url: base },
  ]);
  let current = {
    username: "KH",
    archive_enabled: false,
    items: [
      {
        id: randomUUID(),
        user_id: id,
        congelo_id: f,
        produit: "Courgettes",
        categorie: "Légumes",
        qte: 0.8,
        unite: "kg",
        date_entree: "2026-10-08",
        date_peremption: null,
        notes: "Tiroir 2",
        version: 1,
      },
    ],
    equipments: [
      {
        id: f,
        user_id: id,
        name: "Congélateur garage",
        is_fridge: false,
        archived_at: null,
      },
      {
        id: g,
        user_id: id,
        name: "Frigo cuisine",
        is_fridge: true,
        archived_at: null,
      },
    ],
    categories: [{ id: "c", name: "Légumes" }],
    templates: [{ id: "t", name: "Courgettes", category_id: "c" }],
    rules: [
      {
        categorie: "Légumes",
        fridge_days: 7,
        freezer_days: 90,
        fridge_default_days: 4,
        freezer_default_days: 30,
      },
    ],
    settings: { ntfy_topic: "frosti-test-preview", dlc_warning_days: 3 },
    synchronizedAt: new Date().toISOString(),
  };
  let changes = [],
    failNext = false;
  await context.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    if (path === "/api/bootstrap") return route.fulfill({ json: current });
    if (path === "/api/history")
      return route.fulfill({ json: { movements: [], hasMore: false } });
    if (path === "/api/stock") {
      const input = request.postDataJSON();
      changes.push(input);
      if (failNext) {
        failNext = false;
        return route.fulfill({
          status: 503,
          json: { error: "Connexion interrompue. Réessayez." },
        });
      }
      if (input.action === "add")
        current.items.push({
          ...input,
          id: randomUUID(),
          user_id: id,
          version: 1,
        });
      else if (input.action === "transfer_batch") {
        for (const row of input.lots) {
          const item = current.items.find((i) => i.id === row.id);
          if (row.amount === item.qte) item.congelo_id = input.congelo_id;
          else {
            current.items.push({
              ...item,
              id: randomUUID(),
              qte: row.amount,
              congelo_id: input.congelo_id,
              version: 1,
            });
            item.qte -= row.amount;
          }
          item.version++;
        }
      } else {
        const item = current.items.find((i) => i.id === input.item_id);
        if (input.action === "merge") {
          const keys = [
            "produit",
            "categorie",
            "unite",
            "date_entree",
            "date_peremption",
            "date_kind",
            "notes",
            "congelo_id",
          ];
          const match = current.items.find(
            (other) =>
              other.id !== item.id &&
              keys.every((key) => other[key] === item[key]),
          );
          match.qte += item.qte;
          match.version++;
          current.items = current.items.filter((other) => other.id !== item.id);
        }
        if (input.action === "use" || input.action === "discard")
          item.qte -= input.amount;
        else if (input.action === "inventory") item.qte = input.qte;
        else if (input.action === "transfer")
          item.congelo_id = input.congelo_id;
        else if (input.action === "edit") Object.assign(item, input);
        item.version++;
      }
      return route.fulfill({ json: { operation_id: input.operation_id } });
    }
    if (path === "/api/equipment") {
      const input = request.postDataJSON();
      changes.push(input);
      if (input.action === "add")
        current.equipments.push({
          id: randomUUID(),
          user_id: id,
          name: input.name,
          is_fridge: input.is_fridge,
          archived_at: null,
        });
      if (input.action === "delete")
        current.equipments = current.equipments.filter(
          (eq) => eq.id !== input.id,
        );
    }
    if (path === "/api/settings") {
      const input = request.postDataJSON();
      changes.push(input);
      if (input.type === "rules") current.rules = input.rules;
      if (input.type === "notifications")
        current.settings = {
          ntfy_topic: input.ntfy_topic,
          dlc_warning_days: input.dlc_warning_days,
        };
    }
    return route.fulfill({ json: { ok: true } });
  });
  const page = await context.newPage(),
    errors = [];
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Mes stocks", exact: true })
    .waitFor();
  await page
    .getByRole("heading", { name: "Courgettes", exact: true })
    .waitFor();
  for (const width of [320, 375, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Horizontal overflow at ${width}`,
    );
    await page.screenshot({ path: `../qa/stock-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Ajouter un produit", exact: false })
    .click();
  await page.getByLabel("Produit", { exact: true }).fill("Courgettes");
  await page.getByLabel("Quantité", { exact: true }).fill("0.5");
  await page.getByLabel("Unité", { exact: true }).fill("kg");
  await page.getByLabel("Catégorie", { exact: true }).fill("Légumes");
  await page.screenshot({ path: "../qa/add-mobile.png", fullPage: true });
  console.log("Mobile layout and add form ready");
  failNext = true;
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Connexion interrompue" })
    .waitFor();
  assert.equal(
    await page.getByLabel("Quantité", { exact: true }).inputValue(),
    "0.5",
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    changes[0].operation_id,
    changes[1].operation_id,
    "Retry must reuse operation id",
  );
  assert.equal(changes[1].date_kind, "estimated");
  assert(changes[1].date_peremption, "Default date should be calculated");
  await page
    .locator(".stock-card")
    .first()
    .getByRole("button", { name: "Utiliser", exact: true })
    .click();
  await page
    .getByLabel("Quantité à retirer (kg)", { exact: true })
    .fill("0.25");
  await page.getByRole("button", { name: "Confirmer l’utilisation" }).click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(changes.at(-1).amount, 0.25);
  await page
    .locator(".stock-card")
    .first()
    .getByText("Autres actions", { exact: true })
    .click();
  await page
    .locator(".stock-card")
    .first()
    .getByRole("button", { name: "Déplacer", exact: true })
    .click();
  await page.getByLabel("Destination").selectOption(g);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Déplacer", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(changes.at(-1).congelo_id, g);
  current.items.push({
    ...current.items[0],
    id: randomUUID(),
    produit: "Petits pois",
    congelo_id: g,
    qte: 2,
    version: 1,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Transférer des produits", exact: true })
    .click();
  await page.getByLabel("Équipement de départ").selectOption(g);
  await page.getByLabel("Destination", { exact: true }).selectOption(f);
  await page
    .getByRole("button", { name: "Tout sélectionner", exact: false })
    .click();
  await page.getByLabel("Quantité à transférer de Petits pois").fill("0.5");
  const transferButtonBox = await page
    .getByRole("button", { name: "Transférer 2 lots", exact: true })
    .boundingBox();
  assert(
    transferButtonBox.y + transferButtonBox.height <= 844,
    "Transfer button must remain fully visible",
  );
  await page.screenshot({ path: "../qa/transfer-mobile.png", fullPage: true });
  failNext = true;
  await page
    .getByRole("button", { name: "Transférer 2 lots", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Connexion interrompue" })
    .waitFor();
  const retryId = changes.at(-1).operation_id;
  await page
    .getByRole("button", { name: "Transférer 2 lots", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(changes.at(-1).operation_id, retryId);
  assert.equal(changes.at(-1).lots.length, 2);
  const mars = {
    ...current.items[0],
    id: randomUUID(),
    produit: "Bâtonnets glacés",
    notes: "Mars",
    congelo_id: f,
    qte: 2,
    date_entree: "2026-08-20",
    date_peremption: null,
    date_kind: "declared",
    version: 1,
  };
  current.items.push(mars, { ...mars, id: randomUUID(), qte: 4 });
  await page.reload();
  const marsCard = page
    .locator(".stock-card")
    .filter({ hasText: "Bâtonnets glacés" })
    .first();
  await marsCard.getByText("Autres actions", { exact: true }).click();
  await marsCard
    .getByRole("button", {
      name: "Regrouper avec un lot identique",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Confirmer le regroupement", exact: true })
    .click();
  await page.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    current.items.filter((i) => i.produit === "Bâtonnets glacés").length,
    1,
  );
  assert.equal(
    current.items.find((i) => i.produit === "Bâtonnets glacés").qte,
    6,
  );
  // Modal keyboard dismissal, focus return, and filters.
  await page
    .getByRole("button", { name: "Ajouter un produit", exact: false })
    .click();
  await page.keyboard.press("Escape");
  await page.locator("dialog").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Filtres", exact: false }).click();
  await page.getByLabel("Catégorie").selectOption("Légumes");
  await page
    .getByRole("button", { name: "Effacer les filtres", exact: true })
    .click();
  for (const path of ["/alerts", "/settings", "/inventory", "/history"]) {
    await page.goto(base + path);
    await page.locator("h1").waitFor();
    await page.waitForTimeout(100);
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Overflow at ${path}`,
    );
    await page.screenshot({
      path: `../qa/${path.slice(1)}-mobile.png`,
      fullPage: true,
    });
  }
  await page.goto(base + "/settings");
  await page.getByLabel("Nouvel équipement").fill("Frigo test");
  await page.getByLabel("Type", { exact: true }).selectOption("fridge");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const row = page.locator(".equipment-row").filter({ hasText: "Frigo test" });
  await row.waitFor();
  await row.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirmer la suppression", exact: true })
    .click();
  await row.waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Ajouter un équipement", exact: false })
    .click();
  const addDialog = page.getByRole("dialog", {
    name: "Ajouter un équipement",
    exact: true,
  });
  await addDialog.getByLabel("Nouvel équipement").fill("Ajout depuis le haut");
  await addDialog.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.locator("dialog").waitFor({ state: "detached" });
  await page
    .locator(".equipment-row")
    .filter({ hasText: "Ajout depuis le haut" })
    .waitFor();
  assert.equal(await page.getByLabel("Nouvel équipement").inputValue(), "");
  await page
    .getByRole("button", { name: "Créer et enregistrer un canal", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(
        'input[placeholder="frosti-mon-foyer-canal-prive"]',
      ).value.length === 39,
  );
  assert.match(current.settings.ntfy_topic, /^frosti-[a-f0-9]{32}$/);
  await page
    .getByLabel("Date par défaut · frigo (jours)", { exact: true })
    .fill("6");
  await page
    .getByRole("button", { name: "Enregistrer les délais", exact: true })
    .click();
  await page.waitForTimeout(200);
  assert.equal(current.rules[0].fridge_default_days, 6);
  assert.equal(typeof current.rules[0].fridge_default_days, "number");
  await page.goto(base + "/inventory");
  await page.getByLabel("Quantité réelle").first().waitFor();
  await page.getByLabel("Quantité réelle").first().fill("0.3");
  await page
    .locator(".stock-card")
    .first()
    .getByRole("button", { name: "Corriger", exact: true })
    .click();
  await page.waitForFunction(() => document.querySelector(".toast"));
  assert.equal(changes.at(-1).action, "inventory");
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "UI OK: responsive screens, auth/CSRF, estimated dates, batch transfer + retry, duplicate regrouping, equipment creation from top and bottom/deletion, Ntfy channel generation, category settings, inventory and history; no client errors.",
  );
  await context.close();
} finally {
  await browser.close();
  server.kill();
}
