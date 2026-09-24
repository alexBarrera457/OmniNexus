"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../lib/database");
const { createConversationRepository } = require("../lib/conversation-repository");
const { createMemoryRepository } = require("../lib/memory-repository");
const { createNexusService } = require("../services/nexus-service");
const { calculate } = require("../lib/calculator");

test("CALCULATOR tool: uses calculator when plan includes CALCULATOR", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const replies = ['{"tools":["CALCULATOR"]}', "El resultado es 5"];
  const client = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: replies.shift() } }] }),
      },
    },
  };
  const service = createNexusService({
    client,
    conversations,
    memories,
    calculate,
    webSearch: async () => {
      throw new Error("no debería llamarse");
    },
  });
  const id = conversations.createConversation();

  const result = await service.execute(id, "2 + 3");

  assert.equal(result.respuesta, "El resultado es 5");
  assert.deepEqual(result.tools, ["CALCULATOR"]);
  db.close();
});

test("CLOCK tool: provides time when plan includes CLOCK", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const replies = ['{"tools":["CLOCK"]}', "Son las 12:00"];
  const client = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: replies.shift() } }] }),
      },
    },
  };
  const service = createNexusService({
    client,
    conversations,
    memories,
    calculate,
    webSearch: async () => {
      throw new Error("no debería llamarse");
    },
  });
  const id = conversations.createConversation();

  const result = await service.execute(id, "¿Qué hora es?");

  assert.equal(result.respuesta, "Son las 12:00");
  assert.deepEqual(result.tools, ["CLOCK"]);
  db.close();
});

test("WEB tool: performs search when plan includes WEB", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const replies = ['{"tools":["WEB"]}', "Según la web, este es el resultado."];
  const client = {
    chat: {
      completions: {
        create: async () => ({ choices: [{ message: { content: replies.shift() } }] }),
      },
    },
  };
  const webSearch = async () => [
    { title: "Result", snippet: "Test result snippet", url: "http://example.com" },
  ];
  const service = createNexusService({ client, conversations, memories, calculate, webSearch });
  const id = conversations.createConversation();

  const result = await service.execute(id, "busca en internet info");

  assert.equal(result.respuesta, "Según la web, este es el resultado.");
  assert.deepEqual(result.tools, ["WEB"]);
  db.close();
});

test("error handling: execute throws when AI client fails", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const client = {
    chat: {
      completions: {
        create: async () => {
          throw new Error("Simulated client error");
        },
      },
    },
  };
  const service = createNexusService({
    client,
    conversations,
    memories,
    calculate,
    webSearch: async () => [],
  });
  const id = conversations.createConversation();

  await assert.rejects(async () => await service.execute(id, "hola"), /Simulated client error/);
  db.close();
});

test("empty AI response: throws 'La IA no devolvió contenido'", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const client = {
    chat: { completions: { create: async () => ({ choices: [{ message: { content: "" } }] }) } },
  };
  const service = createNexusService({
    client,
    conversations,
    memories,
    calculate,
    webSearch: async () => [],
  });
  const id = conversations.createConversation();

  await assert.rejects(
    async () => await service.execute(id, "hola"),
    /La IA no devolvió contenido/
  );
  db.close();
});

test("demo mode: resolves calculator, clock and chat offline without AI client", async () => {
  const db = createDatabase(":memory:");
  const conversations = createConversationRepository(db);
  const memories = createMemoryRepository(db);
  const service = createNexusService({
    client: null,
    conversations,
    memories,
    calculate,
    webSearch: async () => [],
    demoMode: true,
  });
  const id = conversations.createConversation();

  // Test math in demo mode
  const mathRes = await service.execute(id, "cuánto es (10 * 5) + 2");
  assert.ok(mathRes.respuesta.includes("52"));
  assert.deepEqual(mathRes.tools, ["CALCULATOR"]);

  // Test clock in demo mode
  const clockRes = await service.execute(id, "¿Qué hora es?");
  assert.ok(clockRes.respuesta.includes("fecha y hora actual"));
  assert.deepEqual(clockRes.tools, ["CLOCK"]);

  // Test greetings in demo mode
  const greetRes = await service.execute(id, "Hola nexus");
  assert.ok(greetRes.respuesta.includes("Modo Demo"));
  assert.deepEqual(greetRes.tools, ["CHAT"]);

  // Verify messages were stored
  const messages = conversations.getMessages(id);
  assert.equal(messages.length, 6);
  db.close();
});
