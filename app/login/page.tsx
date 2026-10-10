"use client";
import { useState } from "react";
import Image from "next/image";
import { APP_VERSION } from "../lib/version";
import { api } from "../lib/client";
export default function Login() {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { username, password });
      localStorage.removeItem("congelo_user_id");
      localStorage.removeItem("congelo_username");
      window.location.href = new URL("/", window.location.origin).href;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connexion impossible.");
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <section className="panel">
        <Image src="/icon-192.png" alt="" width={64} height={64} />
        <p className="eyebrow">LE STOCK DE VOTRE FOYER</p>
        <h1>Bienvenue dans Frosti</h1>
        <p className="muted">{APP_VERSION}</p>
        <p>Retrouvez vos frigos et congélateurs.</p>
        <form onSubmit={submit}>
          <label>
            Nom du foyer
            <input
              autoComplete="username"
              autoCapitalize="none"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Mot de passe
            <div className="password">
              <input
                autoComplete="current-password"
                required
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="quiet"
                aria-label={
                  visible
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                onClick={() => setVisible(!visible)}
              >
                {visible ? "Masquer" : "Voir"}
              </button>
            </div>
          </label>
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Connexion…" : "Ouvrir mon foyer"}
          </button>
        </form>
      </section>
    </div>
  );
}
