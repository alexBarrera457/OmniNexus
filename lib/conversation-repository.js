"use strict";

function createConversationRepository(db) {
  const createConversation = (title = "Nueva conversación") => {
    const result = db.prepare("INSERT INTO nexus_conversations (title) VALUES (?)").run(title);
    return Number(result.lastInsertRowid);
  };

  const getConversations = () =>
    db
      .prepare(
        `
        SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
        FROM nexus_conversations c
        LEFT JOIN nexus_messages m ON m.conversation_id = c.id
        GROUP BY c.id
        ORDER BY c.updated_at DESC, c.id DESC
    `
      )
      .all();

  const getConversation = (id) =>
    db
      .prepare(
        `
        SELECT id, title, created_at, updated_at FROM nexus_conversations WHERE id = ?
    `
      )
      .get(id);

  const getMessages = (conversationId) =>
    db
      .prepare(
        `
        SELECT id, role, content, created_at FROM nexus_messages
        WHERE conversation_id = ? ORDER BY id ASC
    `
      )
      .all(conversationId);

  const saveMessage = (conversationId, role, content) => {
    db.prepare("INSERT INTO nexus_messages (conversation_id, role, content) VALUES (?, ?, ?)").run(
      conversationId,
      role,
      content
    );
    db.prepare("UPDATE nexus_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(
      conversationId
    );
  };

  const updateConversationTitle = (conversationId, title) => {
    db.prepare(
      "UPDATE nexus_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, conversationId);
  };

  const deleteConversation = (conversationId) => {
    db.prepare("DELETE FROM nexus_conversations WHERE id = ?").run(conversationId);
  };

  const clearMessages = (conversationId) => {
    db.prepare("DELETE FROM nexus_messages WHERE conversation_id = ?").run(conversationId);
    updateConversationTitle(conversationId, "Nueva conversación");
  };

  const searchConversations = (query) => {
    const search = `%${String(query).trim()}%`;
    return db
      .prepare(
        `
            SELECT DISTINCT c.id, c.title, c.created_at, c.updated_at
            FROM nexus_conversations c
            LEFT JOIN nexus_messages m ON m.conversation_id = c.id
            WHERE c.title LIKE ? OR m.content LIKE ?
            ORDER BY c.updated_at DESC, c.id DESC
        `
      )
      .all(search, search);
  };

  return {
    createConversation,
    getConversations,
    getConversation,
    getMessages,
    saveMessage,
    updateConversationTitle,
    deleteConversation,
    clearMessages,
    searchConversations,
  };
}

module.exports = { createConversationRepository };
