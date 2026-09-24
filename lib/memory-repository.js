"use strict";

function createMemoryRepository(db) {
  const saveMemory = (content) => {
    const result = db.prepare("INSERT INTO memories (content) VALUES (?)").run(content);
    return Number(result.lastInsertRowid);
  };

  const getMemories = (limit = 20) =>
    db
      .prepare(
        `
        SELECT id, content, created_at FROM memories ORDER BY id DESC LIMIT ?
    `
      )
      .all(limit);

  const deleteAllMemories = () => db.prepare("DELETE FROM memories").run();

  return { saveMemory, getMemories, deleteAllMemories };
}

module.exports = { createMemoryRepository };
