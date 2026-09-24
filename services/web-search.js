"use strict";

const DEFAULT_ENDPOINT = "https://puri.li/api/search";

async function webSearch(
  query,
  { fetchImpl = fetch, endpoint = DEFAULT_ENDPOINT, timeoutMs = 15_000 } = {}
) {
  const cleanQuery = String(query || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleanQuery) throw new Error("Consulta WEB vacía.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${endpoint}?q=${encodeURIComponent(cleanQuery)}`;
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "OMNI-NEXUS/6.2" },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Web HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("json")) {
      throw new Error(`El buscador no devolvió JSON (${contentType || "sin content-type"}).`);
    }

    const data = await response.json();
    const results = Array.isArray(data.results)
      ? data.results
          .filter((result) => result && (result.title || result.url || result.description))
          .map((result) => ({
            title: String(result.title || "Sin título"),
            url: String(result.url || ""),
            description: String(result.description || ""),
          }))
      : [];

    if (!results.length) throw new Error("El buscador devolvió 0 resultados válidos.");
    return { results, total: Number(data.total) || results.length };
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(`Timeout del buscador WEB (${timeoutMs}ms).`, { cause: error });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { webSearch };
