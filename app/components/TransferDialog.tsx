"use client";
import { useRef, useState } from "react";
import Dialog from "./Dialog";
import { useApp } from "./AppProvider";
import { normalize } from "../lib/alerts";
import { Item } from "../lib/types";

export default function TransferDialog({
  initialSource,
  onClose,
}: {
  initialSource: string;
  onClose: () => void;
}) {
  const { data, mutation, busy } = useApp(),
    stock = data!;
  const active = stock.equipments.filter((e) => !e.archived_at);
  const [source, setSource] = useState(initialSource || active[0]?.id || "");
  const [target, setTarget] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<
    Record<string, { amount: string; version: number }>
  >({});
  const [error, setError] = useState("");
  const operation = useRef<{ key: string; id: string } | null>(null);
  const visible = stock.items.filter(
    (i) =>
      i.congelo_id === source &&
      i.qte > 0 &&
      normalize(i.produit).includes(normalize(search)),
  );
  const count = Object.keys(selected).length;
  function select(item: Item, checked: boolean) {
    setSelected((old) => {
      const next = { ...old };
      if (checked)
        next[item.id] = { amount: String(item.qte), version: item.version };
      else delete next[item.id];
      return next;
    });
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!navigator.onLine) {
      setError("Reconnectez-vous avant de transférer.");
      return;
    }
    const lots = Object.entries(selected)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, row]) => ({
        id,
        amount: Number(row.amount),
        version: row.version,
      }));
    const payload = {
      action: "transfer_batch",
      source_id: source,
      congelo_id: target,
      lots,
    };
    const key = JSON.stringify(payload);
    if (operation.current?.key !== key)
      operation.current = { key, id: crypto.randomUUID() };
    try {
      await mutation("/api/stock", {
        ...payload,
        operation_id: operation.current.id,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transfert impossible.");
    }
  }
  return (
    <Dialog title="Transférer des produits" busy={busy} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Équipement de départ
          <select
            aria-label="Équipement de départ"
            required
            value={source}
            disabled={busy}
            onChange={(e) => {
              setSource(e.target.value);
              setSelected({});
              setError("");
              if (target === e.target.value) setTarget("");
            }}
          >
            {active.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.is_fridge ? "Frigo" : "Congélateur"} · {eq.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination
          <select
            aria-label="Destination"
            required
            value={target}
            disabled={busy}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choisir un autre équipement</option>
            {active
              .filter((eq) => eq.id !== source)
              .map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.is_fridge ? "Frigo" : "Congélateur"} · {eq.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Rechercher un produit
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="inline-actions">
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => {
              if (
                new Set([...Object.keys(selected), ...visible.map((i) => i.id)])
                  .size > 100
              ) {
                setError("Transférez au maximum 100 lots à la fois.");
                return;
              }
              setSelected((old) => ({
                ...old,
                ...Object.fromEntries(
                  visible.map((i) => [
                    i.id,
                    old[i.id] ?? { amount: String(i.qte), version: i.version },
                  ]),
                ),
              }));
            }}
          >
            Tout sélectionner ({visible.length})
          </button>
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => setSelected({})}
          >
            Tout désélectionner
          </button>
        </div>
        <p className="muted">
          Sélectionnez un ou plusieurs lots, puis ajustez les quantités si vous
          n’en déplacez qu’une partie. Les dates et notes sont conservées.
        </p>
        <div className="transfer-list">
          {visible.map((item) => (
            <div className="transfer-row" key={item.id}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={!!selected[item.id]}
                  onChange={(e) => select(item, e.target.checked)}
                />
                <span>
                  <strong>{item.produit}</strong>
                  <small>
                    {item.qte} {item.unite} disponibles
                  </small>
                </span>
              </label>
              {selected[item.id] && (
                <label>
                  À déplacer ({item.unite})
                  <input
                    aria-label={`Quantité à transférer de ${item.produit}`}
                    type="number"
                    required
                    min="0.000001"
                    max={item.qte}
                    step="any"
                    inputMode="decimal"
                    disabled={busy}
                    value={selected[item.id].amount}
                    onChange={(e) =>
                      setSelected((old) => ({
                        ...old,
                        [item.id]: { ...old[item.id], amount: e.target.value },
                      }))
                    }
                  />
                </label>
              )}
            </div>
          ))}
        </div>
        {!visible.length && (
          <p>Aucun produit dans cet équipement avec cette recherche.</p>
        )}
        <p>
          {count} lot{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}.
          Le transfert est effectué en une seule opération.
        </p>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-footer">
          <button
            className="primary"
            disabled={busy || count < 1 || count > 100 || !target}
          >
            {busy
              ? "Transfert…"
              : `Transférer ${count} lot${count > 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
