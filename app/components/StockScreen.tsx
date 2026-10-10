"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp, DataState } from "./AppProvider";
import Dialog from "./Dialog";
import EquipmentIcon from "./EquipmentIcon";
import TransferDialog from "./TransferDialog";
import { Item } from "../lib/types";
import { alertFor, defaultExpiry, localDay, normalize } from "../lib/alerts";
const units = [
  "pièce(s)",
  "portion(s)",
  "tranche(s)",
  "sachet(s)",
  "boîte(s)",
  "barquette(s)",
  "kg",
  "g",
  "L",
  "mL",
  "Bouteille 25cl",
  "Bouteille 33cl",
  "Bouteille 75cl",
];
type Mode = "stock" | "alerts" | "inventory";
type Action = "add" | "edit" | "use" | "discard" | "transfer" | "merge";
interface Choice {
  action: Action;
  item?: Item;
  copy?: boolean;
}
export default function StockScreen({ mode = "stock" }: { mode?: Mode }) {
  return (
    <DataState>
      <StockContent mode={mode} />
    </DataState>
  );
}
function StockContent({ mode }: { mode: Mode }) {
  const { data, refresh, loading, busy } = useApp(),
    stock = data!;
  const [search, setSearch] = useState(""),
    [equipment, setEquipment] = useState(""),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState(mode === "alerts" ? "urgent" : "name"),
    [advanced, setAdvanced] = useState(false),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [dateField, setDateField] = useState("date_peremption"),
    [choice, setChoice] = useState<Choice | null>(null);
  const [offline, setOffline] = useState(false);
  const [transferSource, setTransferSource] = useState<string | null>(null);
  useEffect(() => {
    const source = new URLSearchParams(window.location.search).get(
      "transferFrom",
    );
    if (source) queueMicrotask(() => setTransferSource(source));
  }, []);
  useEffect(() => {
    const key = "frosti_equipment_" + stock.username;
    const saved = localStorage.getItem(key);
    if (saved && stock.equipments.some((e) => e.id === saved && !e.archived_at))
      queueMicrotask(() => setEquipment(saved));
    const update = () => setOffline(!navigator.onLine);
    queueMicrotask(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [stock.username, stock.equipments]);
  const active = stock.equipments.filter((e) => !e.archived_at);
  const alerts = stock.items.filter((i) =>
    alertFor(i, stock.equipments, stock.rules, stock.settings),
  );
  const categories = Array.from(
    new Set([
      ...stock.categories.map((c) => c.name),
      ...stock.items.map((i) => i.categorie),
    ]),
  ).sort((a, b) => a.localeCompare(b, "fr"));
  const visible = stock.items
    .filter((i) => {
      if (i.qte <= 0 && mode !== "inventory") return false;
      if (
        mode === "alerts" &&
        !alertFor(i, stock.equipments, stock.rules, stock.settings)
      )
        return false;
      if (equipment && i.congelo_id !== equipment) return false;
      if (category && i.categorie !== category) return false;
      if (
        search &&
        !normalize(i.produit + " " + (i.notes ?? "")).includes(
          normalize(search),
        )
      )
        return false;
      const date =
        dateField === "date_entree" ? i.date_entree : i.date_peremption;
      if (
        (from || until) &&
        (!date || (from && date < from) || (until && date > until))
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "urgent")
        return (
          (alertFor(a, stock.equipments, stock.rules, stock.settings)?.order ??
            99999) -
            (alertFor(b, stock.equipments, stock.rules, stock.settings)
              ?.order ?? 99999) || a.produit.localeCompare(b.produit, "fr")
        );
      if (sort === "date")
        return (a.date_peremption ?? "9999").localeCompare(
          b.date_peremption ?? "9999",
        );
      if (sort === "entry")
        return (a.date_entree ?? "9999").localeCompare(b.date_entree ?? "9999");
      return a.produit.localeCompare(b.produit, "fr");
    });
  const clear = () => {
    setSearch("");
    setEquipment("");
    setCategory("");
    setFrom("");
    setUntil("");
    localStorage.removeItem("frosti_equipment_" + stock.username);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FOYER {stock.username}</p>
          <h1>
            {mode === "alerts"
              ? "À utiliser en priorité"
              : mode === "inventory"
                ? "Faire le point sur le stock"
                : "Mes stocks"}
          </h1>
          <p>
            {mode === "inventory"
              ? "Comparez les quantités au contenu réel, lot par lot."
              : mode === "alerts"
                ? "Des rappels pour choisir quoi utiliser ensuite."
                : "Tout retrouver. Utiliser juste ce qu’il faut."}
          </p>
        </div>
        <button
          className="quiet"
          disabled={loading}
          onClick={() => void refresh()}
          aria-label="Actualiser le stock"
        >
          {loading ? "…" : "↻"}
        </button>
      </div>
      {offline && (
        <div className="notice error" role="alert">
          Vous êtes hors connexion. Le stock affiché peut être ancien ; les
          modifications attendront votre reconnexion.
        </div>
      )}
      <div className="inline-actions stock-shortcuts">
        <Link className="button quiet" href="/settings#equipment">
          Équipements
        </Link>
        {mode !== "inventory" && (
          <button
            className="secondary"
            disabled={busy || offline || active.length < 2}
            onClick={() => setTransferSource(equipment || active[0]?.id || "")}
          >
            Transférer des produits
          </button>
        )}
        <Link className="button quiet" href="/settings#dates">
          Dates et alertes
        </Link>
      </div>
      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Rechercher un produit ou une note</span>
          <input
            type="search"
            placeholder="Chercher un produit ou une note…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Emplacement</span>
          <select
            value={equipment}
            onChange={(e) => {
              setEquipment(e.target.value);
              localStorage.setItem(
                "frosti_equipment_" + stock.username,
                e.target.value,
              );
            }}
          >
            <option value="">Tous les espaces</option>
            {active.map((e) => (
              <option key={e.id} value={e.id}>
                {e.is_fridge ? "Frigo" : "Congélateur"} · {e.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="quiet"
          aria-expanded={advanced}
          onClick={() => setAdvanced(!advanced)}
        >
          Filtres{category || from || until ? " •" : ""}
        </button>
      </div>
      {advanced && (
        <section className="panel filters">
          <label>
            Catégorie
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Toutes</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Trier par
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Nom</option>
              <option value="urgent">Priorité</option>
              <option value="date">Date limite</option>
              <option value="entry">Ancienneté</option>
            </select>
          </label>
          <label>
            Type de date
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
            >
              <option value="date_peremption">Date limite</option>
              <option value="date_entree">Date d’entrée</option>
            </select>
          </label>
          <label>
            Du
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Au
            <input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          <button className="quiet" onClick={clear}>
            Effacer les filtres
          </button>
        </section>
      )}
      {mode === "stock" && (
        <Link className="priority-banner" href="/alerts">
          <span>
            <strong>{alerts.length}</strong> lot{alerts.length > 1 ? "s" : ""} à
            vérifier
          </span>
          <span>À utiliser →</span>
        </Link>
      )}
      {mode === "alerts" && (
        <p className="muted">
          Sans date limite, les rappels suivent l’ancienneté et vos seuils. Ils
          ne garantissent pas la qualité du produit.{" "}
          <Link href="/settings">Régler les alertes</Link>
        </p>
      )}
      <div className="list-meta">
        <span>
          {visible.length} lot{visible.length > 1 ? "s" : ""}
          {equipment ? " dans cet espace" : ""}
        </span>
        <Link href={mode === "inventory" ? "/" : "/inventory"}>
          {mode === "inventory" ? "Retour aux stocks" : "Inventaire"}
        </Link>
        <Link href="/history">Historique</Link>
      </div>
      <div className="stock-list">
        {visible.map((item) => {
          const eq = stock.equipments.find((e) => e.id === item.congelo_id),
            alert = alertFor(
              item,
              stock.equipments,
              stock.rules,
              stock.settings,
            );
          return (
            <article className="stock-card" key={item.id}>
              <div className="item-heading">
                <div>
                  <h2>{item.produit}</h2>
                  <p className="item-location">
                    <EquipmentIcon fridge={!!eq?.is_fridge} />{" "}
                    {eq?.name ?? "Emplacement à vérifier"}
                    {eq?.archived_at ? " · archivé" : ""}
                    <span> · {item.categorie}</span>
                  </p>
                </div>
                <span className="quantity">
                  {new Intl.NumberFormat("fr-FR", {
                    maximumFractionDigits: 6,
                  }).format(item.qte)}
                  <small>{item.unite || "unité à vérifier"}</small>
                </span>
              </div>
              {alert && (
                <p
                  className={`status ${alert.level === "overdue" ? "overdue" : ""}`}
                >
                  {alert.label}
                </p>
              )}
              {!alert && (
                <p className="item-date">
                  {item.date_peremption
                    ? `${item.date_kind === "estimated" ? "Date indicative" : "Date limite"} : ${formatDate(item.date_peremption)}`
                    : item.date_entree
                      ? `Entré le ${formatDate(item.date_entree)}`
                      : "Date non renseignée"}
                </p>
              )}
              {item.notes && <p className="item-notes">{item.notes}</p>}
              {mode === "inventory" ? (
                <InventoryRow item={item} disabled={busy || offline} />
              ) : (
                <div className="card-actions">
                  <button
                    className="secondary"
                    disabled={busy || offline || item.qte <= 0}
                    onClick={() => setChoice({ action: "use", item })}
                  >
                    Utiliser
                  </button>
                  <details className="item-menu">
                    <summary aria-label={`Autres actions pour ${item.produit}`}>
                      Autres actions
                    </summary>
                    <div>
                      <button
                        onClick={() => setChoice({ action: "edit", item })}
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => setChoice({ action: "transfer", item })}
                      >
                        Déplacer
                      </button>
                      <button
                        onClick={() => setChoice({ action: "merge", item })}
                      >
                        Regrouper avec un lot identique
                      </button>
                      <button
                        onClick={() =>
                          setChoice({ action: "add", item, copy: true })
                        }
                      >
                        Nouvel achat similaire
                      </button>
                      <button
                        className="danger"
                        onClick={() => setChoice({ action: "discard", item })}
                      >
                        Jeter / retirer
                      </button>
                    </div>
                  </details>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <section className="panel empty">
          <h2>
            {stock.items.some((i) => i.qte > 0)
              ? "Aucun résultat avec ces filtres"
              : active.length
                ? "Votre stock est prêt à être rempli"
                : "Créez votre premier espace"}
          </h2>
          <p>
            {mode === "alerts"
              ? "Aucun lot ne correspond aux rappels actuels."
              : active.length
                ? "Ajoutez un produit ou élargissez la recherche."
                : "Un frigo ou un congélateur, puis ses produits."}
          </p>
          {active.length ? (
            <button className="quiet" onClick={clear}>
              Effacer les filtres
            </button>
          ) : (
            <Link className="button primary" href="/settings">
              Ajouter un équipement
            </Link>
          )}
        </section>
      )}
      <p className="sync">
        Actualisé à{" "}
        {new Date(stock.synchronizedAt).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      {mode !== "inventory" && (
        <button
          className="add-button primary"
          disabled={busy || offline || !active.length}
          onClick={() => setChoice({ action: "add" })}
        >
          + Ajouter un produit
        </button>
      )}
      {choice && (
        <StockDialog
          choice={choice}
          defaultEquipment={equipment || active[0]?.id || ""}
          onClose={() => setChoice(null)}
        />
      )}
      {transferSource !== null && (
        <TransferDialog
          initialSource={transferSource}
          onClose={() => setTransferSource(null)}
        />
      )}
    </>
  );
}
function formatDate(value: string) {
  return new Date(value + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function InventoryRow({ item, disabled }: { item: Item; disabled: boolean }) {
  const { mutation } = useApp(),
    version = useRef(item.version),
    [qty, setQty] = useState(String(item.qte)),
    [error, setError] = useState(""),
    operation = useRef<{ key: string; id: string } | null>(null);
  async function save() {
    setError("");
    const key = `${item.id}:${version.current}:${qty}`;
    if (operation.current?.key !== key)
      operation.current = { key, id: crypto.randomUUID() };
    try {
      await mutation("/api/stock", {
        action: "inventory",
        item_id: item.id,
        qte: Number(qty),
        version: version.current,
        operation_id: operation.current.id,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de corriger.");
    }
  }
  return (
    <div className="inventory-row">
      <label>
        Quantité réelle
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={qty}
          onChange={(e) => {
            if (Number(qty) === item.qte) version.current = item.version;
            setQty(e.target.value);
          }}
        />
      </label>
      <button
        className="secondary"
        disabled={disabled || qty === "" || Number(qty) === item.qte}
        onClick={() => void save()}
      >
        Corriger
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function StockDialog({
  choice,
  defaultEquipment,
  onClose,
}: {
  choice: Choice;
  defaultEquipment: string;
  onClose: () => void;
}) {
  const { data, mutation, busy } = useApp(),
    stock = data!,
    original = choice.item;
  const [produit, setProduit] = useState(original?.produit ?? ""),
    [category, setCategory] = useState(original?.categorie ?? ""),
    [qty, setQty] = useState(String(original?.qte ?? 1)),
    [unit, setUnit] = useState(original?.unite || "pièce(s)"),
    [entry, setEntry] = useState(
      choice.action === "edit" ? (original?.date_entree ?? "") : localDay(),
    ),
    [expiry, setExpiry] = useState(
      choice.action === "edit" ? (original?.date_peremption ?? "") : "",
    ),
    [notes, setNotes] = useState(
      choice.action === "edit" ? (original?.notes ?? "") : "",
    ),
    [equipment, setEquipment] = useState(
      choice.action === "transfer" ? "" : defaultEquipment,
    ),
    [amount, setAmount] = useState(
      String(
        choice.action === "discard"
          ? original?.qte
          : original?.unite === "kg" || original?.unite === "L"
            ? Math.min(original?.qte ?? 1, 0.1)
            : Math.min(original?.qte ?? 1, 1),
      ),
    ),
    [error, setError] = useState(""),
    [another, setAnother] = useState(false);
  const [useEstimate, setUseEstimate] = useState(choice.action === "add");
  const [dateKind, setDateKind] = useState(original?.date_kind ?? "declared");
  const estimate =
    choice.action === "add"
      ? defaultExpiry(
          category,
          stock.equipments.find((e) => e.id === equipment),
          stock.rules,
          entry,
        )
      : null;
  const effectiveExpiry = expiry || (useEstimate ? estimate : null);
  const operation = useRef<{ key: string; id: string } | null>(null);
  const editing = choice.action === "add" || choice.action === "edit";
  const title = {
    add: choice.copy ? "Nouvel achat similaire" : "Ajouter un produit",
    edit: "Modifier le lot",
    use: "Utiliser une quantité",
    discard: "Retirer du stock",
    transfer: "Déplacer le lot",
    merge: "Regrouper les lots identiques",
  }[choice.action];
  const categories = Array.from(
    new Set([
      ...stock.categories.map((c) => c.name),
      ...stock.items.map((i) => i.categorie),
    ]),
  );
  const products = Array.from(
    new Set([
      ...stock.templates.map((t) => t.name),
      ...stock.items.map((i) => i.produit),
    ]),
  );
  function selectProduct(value: string) {
    setProduit(value);
    if (choice.action === "add") {
      const template = stock.templates.find(
        (t) => normalize(t.name) === normalize(value),
      );
      const c = stock.categories.find((c) => c.id === template?.category_id);
      if (c) setCategory(c.name);
      const previous = stock.items.find(
        (i) => normalize(i.produit) === normalize(value),
      );
      if (previous) {
        setUnit(previous.unite || "pièce(s)");
        if (!c) setCategory(previous.categorie);
      }
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!navigator.onLine) {
      setError("Reconnectez-vous avant d’enregistrer.");
      return;
    }
    const input: Record<string, unknown> = {
      action: choice.action,
      item_id: original?.id,
    };
    if (editing)
      Object.assign(input, {
        produit,
        categorie: category,
        qte: Number(qty),
        unite: unit,
        date_entree: entry || null,
        date_peremption: effectiveExpiry || null,
        date_kind: expiry
          ? dateKind
          : effectiveExpiry
            ? "estimated"
            : "declared",
        notes: notes || null,
        version: original?.version,
      });
    if (choice.action === "add" || choice.action === "transfer")
      input.congelo_id = equipment;
    if (!editing && choice.action !== "merge") input.amount = Number(amount);
    if (choice.action === "merge") input.version = original?.version;
    const key = JSON.stringify(input);
    if (operation.current?.key !== key)
      operation.current = { key, id: crypto.randomUUID() };
    try {
      await mutation("/api/stock", {
        ...input,
        operation_id: operation.current.id,
      });
      if (choice.action === "add" && another) {
        setProduit("");
        setQty("1");
        setExpiry("");
        setNotes("");
        operation.current = null;
      } else onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’enregistrer.");
    }
  }
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
      <form onSubmit={save}>
        {editing ? (
          <>
            <label>
              Produit
              <input
                autoFocus
                list="product-options"
                required
                maxLength={200}
                value={produit}
                onChange={(e) => selectProduct(e.target.value)}
                placeholder="Ex. courgettes, lasagnes maison…"
              />
              <datalist id="product-options">
                {products.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </label>
            <div className="form-row">
              <label>
                Quantité
                <input
                  type="number"
                  required
                  min={choice.action === "add" ? "0.000001" : "0"}
                  step="any"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
              <label>
                Unité
                <input
                  list="unit-options"
                  required
                  maxLength={60}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
                <datalist id="unit-options">
                  {units.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </label>
            </div>
            <label>
              Catégorie
              <input
                required
                list="category-options"
                maxLength={200}
                placeholder="Ex. légumes, plats préparés…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <datalist id="category-options">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            {choice.action === "add" && (
              <label>
                Ranger dans
                <select
                  required
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                >
                  {stock.equipments
                    .filter((e) => !e.archived_at)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.is_fridge ? "Frigo" : "Congélateur"} · {e.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              Date limite de l’emballage (facultative)
              <input
                type="date"
                value={expiry}
                onChange={(e) => {
                  setExpiry(e.target.value);
                  setDateKind("declared");
                }}
              />
            </label>
            {expiry && dateKind === "estimated" && (
              <p className="muted">
                Ce lot porte une date indicative calculée. Une modification
                manuelle devient une date saisie.
              </p>
            )}
            {!expiry && estimate && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={useEstimate}
                  onChange={(e) => setUseEstimate(e.target.checked)}
                />
                Utiliser la date indicative par défaut : {formatDate(estimate)}
              </label>
            )}
            {!effectiveExpiry && (
              <p className="muted">
                Sans date, le rappel utilisera le délai de cette catégorie et de
                cet équipement, depuis la date d’entrée.
              </p>
            )}
            <details className="more">
              <summary>Plus de détails</summary>
              <label>
                Date d’entrée
                <input
                  type="date"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
              </label>
              <label>
                Notes
                <textarea
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Marque, tiroir, préparation…"
                />
              </label>
            </details>
            {choice.action === "add" && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={another}
                  onChange={(e) => setAnother(e.target.checked)}
                />
                Ajouter un autre produit ensuite
              </label>
            )}
          </>
        ) : choice.action === "merge" ? (
          <>
            <p>
              Regrouper <strong>{original?.produit}</strong> ({original?.qte}{" "}
              {original?.unite}) avec un autre lot strictement identique dans le
              même équipement ?
            </p>
            <p>
              Les quantités seront additionnées. Produit, catégorie, unité,
              dates et notes doivent correspondre. Vous pourrez annuler cette
              opération dans l’historique tant que les lots n’ont pas changé.
            </p>
          </>
        ) : (
          <>
            <p>
              <strong>{original?.produit}</strong> · {original?.qte}{" "}
              {original?.unite} disponibles
            </p>
            <label>
              {choice.action === "transfer"
                ? "Quantité à déplacer"
                : "Quantité à retirer"}{" "}
              ({original?.unite})
              <input
                autoFocus
                type="number"
                required
                min="0.000001"
                max={original?.qte}
                step="any"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="quiet"
              onClick={() => setAmount(String(original?.qte))}
            >
              Tout le lot
            </button>
            {choice.action === "transfer" && (
              <label>
                Destination
                <select
                  required
                  value={equipment}
                  onChange={(e) => setEquipment(e.target.value)}
                >
                  <option value="">Choisir un autre espace</option>
                  {stock.equipments
                    .filter(
                      (e) => !e.archived_at && e.id !== original?.congelo_id,
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.is_fridge ? "Frigo" : "Congélateur"} · {e.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {choice.action === "discard" && (
              <p className="notice">
                Ce retrait sera enregistré séparément d’une consommation. Vous
                pourrez l’annuler depuis l’historique si le lot n’a pas changé.
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button className="primary" disabled={busy}>
            {busy
              ? "Enregistrement…"
              : choice.action === "merge"
                ? "Confirmer le regroupement"
                : choice.action === "transfer"
                  ? "Déplacer"
                  : choice.action === "use"
                    ? "Confirmer l’utilisation"
                    : choice.action === "discard"
                      ? "Confirmer le retrait"
                      : "Enregistrer"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
