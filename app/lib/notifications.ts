import "server-only";
import { ApiError } from "./server";
export async function notify(topic: string, message: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(topic))
    throw new ApiError("Canal Ntfy invalide. Corrigez-le dans Réglages.");
  const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    body: message,
    headers: {
      Title: "Frosti - Stocks",
      Tags: "ice_cube",
      ...(process.env.FROSTI_PUBLIC_URL
        ? {
            Click: new URL("/alerts", process.env.FROSTI_PUBLIC_URL).toString(),
          }
        : {}),
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new ApiError(
      `Le service de notification a refusé l’envoi (HTTP ${response.status}).`,
      502,
    );
}
