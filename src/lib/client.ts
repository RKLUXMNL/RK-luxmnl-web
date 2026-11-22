export async function api<T = Record<string, unknown>>(
  path: string,
  data?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(path, {
    method: data === undefined ? "GET" : method,
    headers:
      data === undefined ? undefined : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: "no-store",
  });
  const result = await response.json();
  if (
    response.status === 401 &&
    path.startsWith("/api/admin/") &&
    typeof window !== "undefined"
  )
    window.location.replace("/admin/login");
  if (!response.ok)
    throw Error(result.error || "The request could not be completed.");
  return result;
}
