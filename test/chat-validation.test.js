const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_MESSAGE_LENGTH, validateChatRequest } = require("../lib/chat-validation");

test("acepta el último mensaje de usuario y devuelve texto limpio", () => {
    assert.deepEqual(validateChatRequest([{ role: "user", content: "  hola  " }]), { ok: true, userText: "hola" });
});

test("rechaza arrays vacíos, roles incorrectos y mensajes demasiado largos", () => {
    assert.equal(validateChatRequest([]).status, 400);
    assert.equal(validateChatRequest([{ role: "assistant", content: "hola" }]).status, 400);
    assert.equal(validateChatRequest([{ role: "user", content: "x".repeat(MAX_MESSAGE_LENGTH + 1) }]).status, 413);
});
