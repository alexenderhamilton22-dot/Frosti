"use client";
import { useState } from "react";
import Link from "next/link";
import { DataState, useApp } from "../components/AppProvider";
import { api } from "../lib/client";
import { APP_VERSION } from "../lib/version";
import Dialog from "../components/Dialog";
import EquipmentIcon from "../components/EquipmentIcon";
import { normalize } from "../lib/alerts";
export default function Settings() {
  return (
    <DataState>
      <Content />
    </DataState>
  );
}
function Content() {
  const { data, mutation, busy } = useApp(),
    stock = data!,
    [name, setName] = useState(""),
    [fridge, setFridge] = useState(false),
    [error, setError] = useState(""),
    [topic, setTopic] = useState(stock.settings.ntfy_topic ?? ""),
    [days, setDays] = useState(stock.settings.dlc_warning_days),
    [testMessage, setTestMessage] = useState(""),
    [testing, setTesting] = useState(false),
    [adding, setAdding] = useState(false),
    [ruleSearch, setRuleSearch] = useState(""),
    [deleting, setDeleting] = useState<{ id: string; name: string } | null>(
      null,
    ),
    [editing, setEditing] = useState<{ id: string; name: string } | null>(null),
    [rules, setRules] = useState(() =>
      Array.from(
        new Set([
          ...stock.categories.map((c) => c.name),
          ...stock.items.map((i) => i.categorie),
          ...stock.rules.map((r) => r.categorie),
        ]),
      )
        .sort()
        .map((c) => {
          const rule = stock.rules.find((r) => r.categorie === c);
          return {
            categorie: c,
            fridge_days: rule?.fridge_days ?? 7,
            freezer_days: rule?.freezer_days ?? 90,
            fridge_default_days:
              rule?.fridge_default_days == null
                ? ""
                : String(rule.fridge_default_days),
            freezer_default_days:
              rule?.freezer_default_days == null
                ? ""
                : String(rule.freezer_default_days),
          };
        }),
    );
  async function change(path: string, input: unknown) {
    setError("");
    try {
      await mutation(path, input);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible d’enregistrer.");
      return false;
    }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (
      await change("/api/equipment", { action: "add", name, is_fridge: fridge })
    ) {
      setName("");
      setAdding(false);
    }
  }
  async function test() {
    setTestMessage("");
    setTesting(true);
    try {
      await api("/api/notifications/test", {});
      setTestMessage("Notification de test envoyée.");
    } catch (e) {
      setTestMessage(e instanceof Error ? e.message : "Échec de notification.");
    } finally {
      setTesting(false);
    }
  }
  const equipmentForm = (
    <form onSubmit={add} className="equipment-form">
      <label>
        Nouvel équipement
        <input
          required
          maxLength={200}
          placeholder="Ex. frigo cuisine"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Type
        <select
          aria-label="Type"
          value={fridge ? "fridge" : "freezer"}
          onChange={(e) => setFridge(e.target.value === "fridge")}
        >
          <option value="freezer">Congélateur</option>
          <option value="fridge">Frigo</option>
        </select>
      </label>
      <button className="secondary" disabled={busy}>
        Ajouter
      </button>
    </form>
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FOYER {stock.username}</p>
          <h1>Réglages</h1>
          <p>Vos espaces et vos habitudes, au même endroit.</p>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <div
        className="inline-actions settings-shortcuts"
        aria-label="Rubriques des réglages"
      >
        <a className="button quiet" href="#equipment">
          Équipements
        </a>
        <a className="button quiet" href="#notifications">
          Notifications
        </a>
        <a className="button quiet" href="#dates">
          Dates et délais
        </a>
      </div>
      <section className="panel" id="equipment">
        <div className="inline-actions">
          <h2>Mes équipements</h2>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              setAdding(true);
            }}
          >
            + Ajouter un équipement
          </button>
        </div>
        <p className="muted">
          Créez un frigo ou un congélateur. Pour le supprimer, transférez
          d’abord tous ses produits.
        </p>
        {!stock.archive_enabled && (
          <p className="muted">
            La suppression d’un équipement vide est disponible. L’archivage
            reste optionnel, après adaptation de Mealio.
          </p>
        )}
        <div className="equipment-list">
          {stock.equipments.map((eq) => (
            <div key={eq.id} className="equipment-row">
              <div>
                <strong>
                  <EquipmentIcon fridge={!!eq.is_fridge} /> {eq.name}
                </strong>
                <small>
                  {eq.archived_at
                    ? "Archivé"
                    : `${stock.items.filter((i) => i.congelo_id === eq.id && i.qte > 0).length} lots en stock`}
                </small>
              </div>
              <div className="equipment-actions">
                <button
                  className="quiet"
                  disabled={busy}
                  onClick={() => setEditing({ id: eq.id, name: eq.name })}
                >
                  Renommer
                </button>
                {stock.archive_enabled || eq.archived_at ? (
                  <button
                    className="quiet"
                    disabled={
                      busy || (!eq.archived_at && !stock.archive_enabled)
                    }
                    onClick={() =>
                      void change("/api/equipment", {
                        action: eq.archived_at ? "restore" : "archive",
                        id: eq.id,
                      })
                    }
                  >
                    {eq.archived_at ? "Réactiver" : "Archiver"}
                  </button>
                ) : null}
                <button
                  className="quiet danger"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setDeleting({ id: eq.id, name: eq.name });
                  }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
        {equipmentForm}
      </section>
      <section className="panel" id="notifications">
        <h2>Alertes et notifications</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change("/api/settings", {
              type: "notifications",
              ntfy_topic: topic,
              dlc_warning_days: days,
            });
          }}
        >
          <label>
            Alerter avant la date limite (jours)
            <input
              type="number"
              min="0"
              max="90"
              required
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
          </label>
          <label>
            Canal Ntfy
            <input
              placeholder="frosti-mon-foyer-canal-prive"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <p className="muted">
            Utilisez le même canal dans l’application Ntfy. Choisissez un nom
            long et difficile à deviner : le canal reçoit des informations sur
            vos stocks.
          </p>
          <div className="inline-actions">
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={async () => {
                const generated =
                  "frosti-" + crypto.randomUUID().replaceAll("-", "");
                if (
                  await change("/api/settings", {
                    type: "notifications",
                    ntfy_topic: generated,
                    dlc_warning_days: days,
                  })
                ) {
                  setTopic(generated);
                  setTestMessage(
                    "Canal créé et enregistré. Abonnez-vous dans Ntfy puis envoyez un test.",
                  );
                }
              }}
            >
              Créer et enregistrer un canal
            </button>
            <button className="secondary" disabled={busy}>
              Enregistrer
            </button>
            <button
              type="button"
              className="quiet"
              disabled={testing || busy}
              onClick={() => void test()}
            >
              {testing ? "Envoi…" : "Tester le canal enregistré"}
            </button>
          </div>
          {topic && /^[a-zA-Z0-9_-]{8,100}$/.test(topic) && (
            <p>
              <a
                href={`https://ntfy.sh/${encodeURIComponent(topic)}`}
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir ce canal dans Ntfy ↗
              </a>
            </p>
          )}
          <p className="muted">
            Sur votre téléphone : ouvrez Ntfy, choisissez « S’abonner », serveur
            ntfy.sh, puis copiez le nom du canal. Tous les membres du foyer
            peuvent s’abonner au même canal. Un nom aléatoire ne remplace pas un
            contrôle d’accès.
          </p>
          <p className="muted">
            Les rappels automatiques partent une fois par jour sur Vercel. En
            local, le bouton de test fonctionne mais le cron Vercel ne s’exécute
            pas.
          </p>
          {testMessage && <p role="status">{testMessage}</p>}
        </form>
      </section>
      <section className="panel" id="dates">
        <h2>Dates par défaut et rappels par catégorie</h2>
        <p className="muted">
          « Date par défaut » calcule une date indicative depuis la date
          d’entrée, proposée à l’ajout. Laissez vide pour ne pas en proposer. La
          date saisie sur l’emballage reste prioritaire.
        </p>
        <p className="muted">
          Sans date, un rappel apparaît après le nombre de jours choisi. Avec
          une date, l’anticipation définie dans les notifications s’applique.
          Les délais sont vos paramètres de suivi ; ils ne définissent pas une
          DLC sanitaire.
        </p>
        <label>
          Rechercher une catégorie
          <input
            type="search"
            value={ruleSearch}
            onChange={(e) => setRuleSearch(e.target.value)}
            placeholder="Viandes, légumes…"
          />
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change("/api/settings", {
              type: "rules",
              rules: rules.map((r) => ({
                ...r,
                fridge_default_days:
                  r.fridge_default_days === ""
                    ? null
                    : Number(r.fridge_default_days),
                freezer_default_days:
                  r.freezer_default_days === ""
                    ? null
                    : Number(r.freezer_default_days),
              })),
            });
          }}
        >
          <div className="rule-list">
            {rules.map((r, index) => (
              <div
                className="rule-row"
                key={r.categorie}
                hidden={
                  !!ruleSearch &&
                  !normalize(r.categorie).includes(normalize(ruleSearch))
                }
              >
                <strong>{r.categorie}</strong>
                <label>
                  Sans date · frigo (jours)
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    required
                    value={r.fridge_days}
                    onChange={(e) =>
                      setRules(
                        rules.map((r, i) =>
                          i === index
                            ? { ...r, fridge_days: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Sans date · congélateur (jours)
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    required
                    value={r.freezer_days}
                    onChange={(e) =>
                      setRules(
                        rules.map((r, i) =>
                          i === index
                            ? { ...r, freezer_days: Number(e.target.value) }
                            : r,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Date par défaut · frigo (jours)
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    placeholder="Aucune"
                    value={r.fridge_default_days}
                    onChange={(e) =>
                      setRules(
                        rules.map((row, i) =>
                          i === index
                            ? { ...row, fridge_default_days: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Date par défaut · congélateur (jours)
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    placeholder="Aucune"
                    value={r.freezer_default_days}
                    onChange={(e) =>
                      setRules(
                        rules.map((row, i) =>
                          i === index
                            ? { ...row, freezer_default_days: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <button className="secondary" disabled={busy}>
            Enregistrer les délais
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Suivi du foyer</h2>
        <p className="muted">Frosti {APP_VERSION}</p>
        <div className="inline-actions">
          <Link className="button quiet" href="/history">
            Historique des mouvements
          </Link>
          <Link className="button quiet" href="/inventory">
            Faire un inventaire
          </Link>
        </div>
        <p className="muted">
          Les catégories et produits restent compatibles avec le référentiel et
          le rangement de Mealio.
        </p>
        <p className="muted">
          Pour installer Frosti : utilisez « Installer » dans le navigateur, ou
          « Partager → Sur l’écran d’accueil » sur iPhone.
        </p>
      </section>
      {adding && (
        <Dialog
          title="Ajouter un équipement"
          busy={busy}
          onClose={() => setAdding(false)}
        >
          {equipmentForm}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {editing && (
        <Dialog
          title="Renommer l’équipement"
          busy={busy}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await change("/api/equipment", {
                  action: "rename",
                  id: editing.id,
                  name: editing.name,
                })
              )
                setEditing(null);
            }}
          >
            <label>
              Nom
              <input
                autoFocus
                required
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              Enregistrer
            </button>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog
          title="Supprimer l’équipement"
          busy={busy}
          onClose={() => setDeleting(null)}
        >
          <p>
            Supprimer <strong>{deleting.name}</strong> ?
          </p>
          {stock.items.some((i) => i.congelo_id === deleting.id) ? (
            <>
              <p>
                Il reste des produits dans cet équipement. Transférez-les avant
                de le supprimer.
              </p>
              <Link
                className="button secondary"
                href={`/?transferFrom=${deleting.id}`}
                onClick={() => setDeleting(null)}
              >
                Transférer ses produits
              </Link>
            </>
          ) : (
            <>
              <p>
                Il est vide. Cette suppression conserve l’historique. Les
                anciennes opérations nécessitant cet équipement ne pourront plus
                être annulées.
              </p>
              {error && (
                <p role="alert" className="notice error">
                  {error}
                </p>
              )}
              <button
                className="primary danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    await change("/api/equipment", {
                      action: "delete",
                      id: deleting.id,
                    })
                  )
                    setDeleting(null);
                }}
              >
                Confirmer la suppression
              </button>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
