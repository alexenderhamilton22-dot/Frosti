export async function api<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: input === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: input === undefined ? {} : { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Réponse illisible. Réessayez." }));
  if (response.status === 401 && path !== "/api/auth/login") {
    window.location.href = new URL("/login", window.location.origin).href;
    throw new Error("Reconnectez-vous.");
  }
  if (!response.ok)
    throw new Error(data.error || "Impossible d’effectuer cette action.");
  return data as T;
}
