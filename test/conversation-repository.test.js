const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../lib/database");
const { createConversationRepository } = require("../lib/conversation-repository");

function createFixture() {
    const db = createDatabase(":memory:");
    return { db, repository: createConversationRepository(db) };
}

test("guarda, recupera y ordena mensajes de una conversación", () => {
    const { db, repository } = createFixture();
    const id = repository.createConversation("Proyecto NEXUS");
    repository.saveMessage(id, "user", "Hola");
    repository.saveMessage(id, "assistant", "¿En qué puedo ayudarte?");

    assert.equal(repository.getConversation(id).title, "Proyecto NEXUS");
    assert.deepEqual(repository.getMessages(id).map(message => message.role), ["user", "assistant"]);
    assert.equal(repository.getConversations()[0].message_count, 2);
    db.close();
});

test("busca y elimina conversaciones con borrado en cascada", () => {
    const { db, repository } = createFixture();
    const id = repository.createConversation("Plan de viaje");
    repository.saveMessage(id, "user", "Madrid en octubre");

    assert.equal(repository.searchConversations("octubre").length, 1);
    repository.deleteConversation(id);
    assert.equal(repository.getConversation(id), undefined);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM nexus_messages").get().total, 0);
    db.close();
});
