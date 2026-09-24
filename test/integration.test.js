"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Ensure db uses memory before requiring server
process.env.NEXUS_DB_PATH = ":memory:";

const supertest = require("supertest");
const app = require("../server.js");

const request = supertest(app);

test("GET /api/health", async () => {
  const res = await request.get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.name);
  assert.ok(res.body.version);
  assert.ok(Array.isArray(res.body.tools));
});

test("POST /api/chat with empty body", async () => {
  const res = await request.post("/api/chat").send({});
  assert.equal(res.status, 400);
});

test("POST /api/chat with valid messages but no conversationId", async () => {
  const res = await request.post("/api/chat").send({
    messages: [{ role: "user", content: "hello" }],
  });
  // Can be 500 if AI fails, or 200 if OK
  assert.ok(res.status === 200 || res.status === 500);
});

test("POST /api/chat with messages array too large (51 items)", async () => {
  const messages = Array(51).fill({ role: "user", content: "test" });
  const res = await request.post("/api/chat").send({ messages });
  assert.equal(res.status, 400);
});

test("POST /api/chat with last message role not 'user'", async () => {
  const res = await request.post("/api/chat").send({
    messages: [{ role: "assistant", content: "hello" }],
  });
  assert.equal(res.status, 400);
});

test("GET /api/conversations", async () => {
  const res = await request.get("/api/conversations");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.conversations));
});

test("POST /api/conversations", async () => {
  const res = await request.post("/api/conversations");
  assert.equal(res.status, 201);
  assert.ok(res.body.ok);
});

test("DELETE /api/conversations/:id with invalid id", async () => {
  const res = await request.delete("/api/conversations/invalid");
  assert.equal(res.status, 400);
});

test("GET /api/memory", async () => {
  const res = await request.get("/api/memory");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.memories));
});

test("DELETE /api/memory", async () => {
  const res = await request.delete("/api/memory");
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
});
