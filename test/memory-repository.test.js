const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabase } = require("../lib/database");
const { createMemoryRepository } = require("../lib/memory-repository");

test("guarda, ordena y elimina recuerdos", () => {
  const db = createDatabase(":memory:");
  const repository = createMemoryRepository(db);
  repository.saveMemory("Prefiere respuestas concisas");
  repository.saveMemory("Trabaja con Node.js");

  assert.deepEqual(
    repository.getMemories().map((memory) => memory.content),
    ["Trabaja con Node.js", "Prefiere respuestas concisas"]
  );
  repository.deleteAllMemories();
  assert.equal(repository.getMemories().length, 0);
  db.close();
});
