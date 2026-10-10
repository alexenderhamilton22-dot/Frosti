"use client";
import { useEffect } from "react";
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => reg.update())
        .catch(() => {});
    if ("caches" in window)
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith("frosti-"))
              .map((k) => caches.delete(k)),
          ),
        );
    localStorage.removeItem("congelo_user_id");
    localStorage.removeItem("congelo_username");
  }, []);
  return null;
}
