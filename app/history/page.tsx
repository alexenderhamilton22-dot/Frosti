"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApp, DataState } from "../components/AppProvider";
import { api } from "../lib/client";
import { Movement } from "../lib/types";
import { normalize } from "../lib/alerts";
const labels: Record<string, string> = {
  add: "Ajout",
  edit: "Modification",
  use: "Consommation",
  discard: "Retrait / jet",
  transfer: "Transfert",
  transfer_batch: "Transfert groupé",
  merge: "Regroupement de lots identiques",
  correction_foyer: "Correction du foyer",
  inventory: "Inventaire",
  undo: "Annulation",
  insert: "Ajout externe",
  update: "Modification externe",
  delete: "Suppression externe",
};
export default function History() {
  return (
    <DataState>
      <Content />
    </DataState>
  );
}
function Content() {
  const { mutation, busy } = useApp(),
    [movements, setMovements] = useState<Movement[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [hasMore, setHasMore] = useState(false),
    [search, setSearch] = useState(""),
    [since, setSince] = useState(""),
    [until, setUntil] = useState(""),
    [pendingUndo, setPendingUndo] = useState<string | null>(null),
    ids = useRef(new Map<string, string>());
  const load = useCallback(
    async (offset = 0) => {
      await Promise.resolve();
      setLoading(true);
      setError("");
      try {
        const result = await api<{ movements: Movement[]; hasMore: boolean }>(
          `/api/history?offset=${offset}&since=${since}&until=${until}`,
        );
        setMovements((old) =>
          offset ? [...old, ...result.movements] : result.movements,
        );
        setHasMore(result.hasMore);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Historique indisponible.");
      } finally {
        setLoading(false);
      }
    },
    [since, until],
  );
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  async function undo(original: string) {
    setError("");
    if (!ids.current.has(original))
      ids.current.set(original, crypto.randomUUID());
    try {
      await mutation("/api/stock", {
        action: "undo",
        original_operation_id: original,
        operation_id: ids.current.get(original),
      });
      setPendingUndo(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’annuler.");
    }
  }
  const visible = movements.filter(
    (m) =>
      !search ||
      normalize(
        (m.after_row?.produit ?? m.before_row?.produit ?? "") +
          " " +
          (labels[m.kind] ?? m.kind),
      ).includes(normalize(search)),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LES MOUVEMENTS DU FOYER</p>
          <h1>Historique</h1>
          <p>
            Les actions de Frosti et les écritures externes, depuis la
            migration.
          </p>
        </div>
      </div>
      <Link href="/">← Retour aux stocks</Link>
      <section className="panel filters">
        <label>
          Rechercher dans les mouvements chargés
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Produit ou action"
          />
        </label>
        <label>
          Du
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
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
      </section>
      {error && (
        <p role="alert" className="notice error">
          {error}{" "}
          <button className="quiet" onClick={() => void load()}>
            Actualiser
          </button>
        </p>
      )}
      <div className="stock-list">
        {visible.map((m) => (
          <article className="panel movement" key={m.id}>
            <div>
              <p className="eyebrow">
                {labels[m.kind] ?? m.kind} ·{" "}
                {m.origin === "frosti"
                  ? "Frosti"
                  : m.origin === "maintenance"
                    ? "Maintenance"
                    : "Mealio / externe"}
              </p>
              <h2>{m.after_row?.produit ?? m.before_row?.produit ?? "Lot"}</h2>
              <p>
                {m.before_row
                  ? `${m.before_row.qte} ${m.before_row.unite}`
                  : "Nouveau lot"}{" "}
                →{" "}
                {m.after_row
                  ? `${m.after_row.qte} ${m.after_row.unite}`
                  : "Supprimé"}
              </p>
              <small>
                {new Date(m.created_at).toLocaleString("fr-FR", {
                  timeZone: "Europe/Paris",
                })}
                {m.kind === "transfer" || m.kind === "transfer_batch"
                  ? " · emplacement modifié"
                  : ""}
              </small>
            </div>
            {m.undone_by ? (
              <span className="status">Annulé</span>
            ) : (
              m.kind !== "undo" &&
              m.origin !== "maintenance" && (
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => setPendingUndo(m.operation_id)}
                >
                  Annuler l’opération
                </button>
              )
            )}
            {pendingUndo === m.operation_id && !m.undone_by && (
              <div className="notice">
                <p>
                  Annuler toute cette opération ? Un transfert partiel restaure
                  ses deux lots. Si le stock a changé depuis, l’annulation sera
                  refusée.
                </p>
                <div className="inline-actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void undo(m.operation_id)}
                  >
                    Confirmer l’annulation
                  </button>
                  <button
                    className="quiet"
                    disabled={busy}
                    onClick={() => setPendingUndo(null)}
                  >
                    Garder
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {loading && <p role="status">Chargement des mouvements…</p>}
      {!loading && !visible.length && (
        <p className="panel empty">Aucun mouvement dans cette sélection.</p>
      )}
      {hasMore && (
        <button
          className="secondary"
          disabled={loading}
          onClick={() => void load(movements.length)}
        >
          Charger les 100 suivants
        </button>
      )}
    </>
  );
}
