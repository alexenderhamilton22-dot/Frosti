"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { APP_VERSION } from "../lib/version";
import { api } from "../lib/client";
import { useState } from "react";
export default function Navbar() {
  const path = usePathname(),
    { data } = useApp(),
    [error, setError] = useState(""),
    [loggingOut, setLoggingOut] = useState(false);
  if (path === "/login") return null;
  const logout = async () => {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", {});
      localStorage.removeItem("congelo_user_id");
      localStorage.removeItem("congelo_username");
      window.location.href = new URL("/login", window.location.origin).href;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Déconnexion impossible.");
      setLoggingOut(false);
    }
  };
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">
          <Image src="/icon-192.png" alt="" width={40} height={40} />
          <span>
            Frosti <span className="version">{APP_VERSION}</span>
            <small>{data?.username || "Mon foyer"}</small>
          </span>
        </Link>
        <button
          className="quiet"
          disabled={loggingOut}
          onClick={() => void logout()}
        >
          {loggingOut ? "…" : "Déconnexion"}
        </button>
      </header>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <nav className="bottomnav" aria-label="Navigation principale">
        {[
          { href: "/", name: "Stocks", icon: "❄" },
          { href: "/alerts", name: "À utiliser", icon: "◷" },
          { href: "/settings", name: "Réglages", icon: "⚙" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={path === link.href ? "page" : undefined}
            className={path === link.href ? "active" : ""}
          >
            <span aria-hidden="true">{link.icon}</span>
            {link.name}
          </Link>
        ))}
      </nav>
    </>
  );
}
