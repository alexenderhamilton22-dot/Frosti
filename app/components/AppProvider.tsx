"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Bootstrap } from "../lib/types";
import { api } from "../lib/client";
interface State {
  data: Bootstrap | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  mutation: (path: string, input: unknown) => Promise<void>;
  busy: boolean;
  message: string;
  clearMessage: () => void;
}
const Context = createContext<State | null>(null);
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("Provider absent");
  return value;
}
export default function AppProvider({ children }: { children: ReactNode }) {
  const path = usePathname(),
    login = path === "/login";
  const [data, setData] = useState<Bootstrap | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const sequence = useRef(0),
    mutationLock = useRef(false);
  const refresh = useCallback(async () => {
    await Promise.resolve();
    const current = ++sequence.current;
    setLoading(true);
    try {
      const next = await api<Bootstrap>("/api/bootstrap");
      if (current === sequence.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (current === sequence.current)
        setError(e instanceof Error ? e.message : "Connexion impossible.");
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (login) return;
    queueMicrotask(() => void refresh());
    const update = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
    };
  }, [login, refresh]);
  const mutation = async (path: string, input: unknown) => {
    if (mutationLock.current)
      throw new Error("Une opération est déjà en cours.");
    mutationLock.current = true;
    setBusy(true);
    try {
      await api(path, input);
      setMessage("Enregistré.");
      await refresh();
    } finally {
      mutationLock.current = false;
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        loading,
        error,
        refresh,
        mutation,
        busy,
        message,
        clearMessage: () => setMessage(""),
      }}
    >
      {children}
      {!login && message && (
        <div className="toast" role="status">
          ✓ {message}
          <button
            onClick={() => setMessage("")}
            aria-label="Fermer la confirmation"
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function DataState({ children }: { children: ReactNode }) {
  const { data, loading, error, refresh } = useApp();
  if (!data)
    return (
      <div className="panel empty" role="status">
        <h1>{loading ? "Chargement du foyer…" : "Stock indisponible"}</h1>
        {error && (
          <>
            <p>{error}</p>
            <button onClick={() => void refresh()}>Réessayer</button>
          </>
        )}
      </div>
    );
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error} <button onClick={() => void refresh()}>Réessayer</button>
        </div>
      )}
      {children}
    </>
  );
}
