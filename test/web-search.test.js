const test = require("node:test");
const assert = require("node:assert/strict");
const { webSearch } = require("../services/web-search");

function response(body, { ok = true, status = 200, contentType = "application/json" } = {}) {
    return { ok, status, headers: new Headers({ "content-type": contentType }), json: async () => body };
}

test("normaliza resultados de la búsqueda", async () => {
    let requestedUrl;
    const result = await webSearch("  Node   JS ", {
        endpoint: "https://search.example/api",
        fetchImpl: async url => {
            requestedUrl = url;
            return response({ total: 8, results: [{ title: "Node", url: "https://nodejs.org", description: "Runtime" }] });
        }
    });

    assert.equal(requestedUrl, "https://search.example/api?q=Node%20JS");
    assert.deepEqual(result, { total: 8, results: [{ title: "Node", url: "https://nodejs.org", description: "Runtime" }] });
});

test("rechaza consultas vacías y respuestas no JSON", async () => {
    await assert.rejects(() => webSearch("   "), /vacía/);
    await assert.rejects(() => webSearch("node", { fetchImpl: async () => response({}, { contentType: "text/html" }) }), /JSON/);
});
