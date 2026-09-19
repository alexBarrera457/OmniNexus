const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../lib/database");
const { createConversationRepository } = require("../lib/conversation-repository");
const { createMemoryRepository } = require("../lib/memory-repository");
const { createNexusService } = require("../services/nexus-service");
const { calculate } = require("../lib/calculator");

test("orquesta una petición CHAT y persiste el intercambio", async () => {
    const db = createDatabase(":memory:");
    const conversations = createConversationRepository(db);
    const memories = createMemoryRepository(db);
    const replies = ['{"tools":["CHAT"]}', "Hola desde NEXUS"];
    const client = { chat: { completions: { create: async () => ({ choices: [{ message: { content: replies.shift() } }] }) } } };
    const service = createNexusService({ client, conversations, memories, calculate, webSearch: async () => { throw new Error("no debería llamarse"); } });
    const id = conversations.createConversation();

    const result = await service.execute(id, "Hola");

    assert.equal(result.respuesta, "Hola desde NEXUS");
    assert.deepEqual(result.tools, ["CHAT"]);
    assert.deepEqual(conversations.getMessages(id).map(message => message.content), ["Hola", "Hola desde NEXUS"]);
    db.close();
});
