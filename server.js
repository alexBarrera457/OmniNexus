"use strict";
const express = require("express");
const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const helmet = require("helmet");
const {
  PORT,
  HOST,
  DEFAULT_MODEL,
  DEMO_MODE,
  MEMORY_CAPTURE_ENABLED,
  MAX_MESSAGE_LENGTH,
  MAX_REQUEST_MESSAGES,
} = require("./lib/config");
const { createRateLimiter } = require("./lib/middleware");
const { createDatabase } = require("./lib/database");
const { createConversationRepository } = require("./lib/conversation-repository");
const { createMemoryRepository } = require("./lib/memory-repository");
const { createNexusService } = require("./services/nexus-service");
const { createConversationsRouter } = require("./routes/conversations");
const { createMemoryRouter } = require("./routes/memory");
const { createChatRouter } = require("./routes/chat");
const { createHealthRouter } = require("./routes/health");
const { calculate } = require("./lib/calculator");
const { webSearch } = require("./services/web-search");

// Database
const db = createDatabase(process.env.NEXUS_DB_PATH || "./nexus-memory.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(
  `CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
);
db.exec(
  `CREATE TABLE IF NOT EXISTS nexus_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT 'Nueva conversación', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`
);
db.exec(
  `CREATE TABLE IF NOT EXISTS nexus_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (conversation_id) REFERENCES nexus_conversations(id) ON DELETE CASCADE)`
);

// Repositories
const conversations = createConversationRepository(db);
const { saveMemory, getMemories, deleteAllMemories } = createMemoryRepository(db);

// AI Client
const client = new OpenAI({
  baseURL: process.env.OMNIROUTE_BASE_URL || "http://localhost:20128/v1",
  apiKey: process.env.OMNIROUTE_API_KEY || "omniroute-local",
});

// Nexus Service
const nexus = createNexusService({
  client,
  conversations,
  memories: { getMemories },
  webSearch,
  calculate,
  demoMode: DEMO_MODE,
  captureMemory:
    MEMORY_CAPTURE_ENABLED && !DEMO_MODE
      ? async (text) => {
          try {
            const response = await client.chat.completions.create({
              model: DEFAULT_MODEL,
              messages: [
                {
                  role: "system",
                  content: `Analiza el mensaje del usuario.\nDetermina si contiene información útil para recordar en futuras conversaciones.\nPuedes guardar:\n- proyectos\n- estudios\n- preferencias\n- objetivos\n- tecnologías utilizadas\n- información relevante sobre sus proyectos\nNO guardes:\n- contraseñas\n- API keys\n- datos bancarios\n- información extremadamente sensible\nSi NO hay nada útil responde exactamente:\nNONE\nSi hay información útil, devuelve solamente la memoria.`,
                },
                { role: "user", content: text },
              ],
            });
            const memory = response.choices?.[0]?.message?.content?.trim();
            if (memory && memory !== "NONE" && memory.length < 500) {
              saveMemory(memory);
              console.log(`💾 MEMORY SAVED → ${memory}`);
            }
          } catch (error) {
            console.error("⚠️ MEMORY ERROR:", error.message);
          }
        }
      : null,
});

// Express App
const app = express();
app.use(express.json({ limit: "256kb" }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(createRateLimiter());
const frontendDir = fs.existsSync(path.join(__dirname, "dist")) ? "dist" : "public";
app.use(express.static(path.join(__dirname, frontendDir)));
app.use("/api", createConversationsRouter(conversations));
app.use("/api", createMemoryRouter({ getMemories, deleteAllMemories }));
app.use(
  "/api",
  createChatRouter({
    nexus,
    createConversation: conversations.createConversation,
    getConversation: conversations.getConversation,
    maxMessageLength: MAX_MESSAGE_LENGTH,
    maxRequestMessages: MAX_REQUEST_MESSAGES,
  })
);
app.use(
  "/api",
  createHealthRouter({
    memoryEnabled: MEMORY_CAPTURE_ENABLED,
    model: DEFAULT_MODEL,
    demoMode: DEMO_MODE,
  })
);

module.exports = app;

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(
      `\n🤖 OMNI // NEXUS v6.2 ${DEMO_MODE ? "[MODO DEMO LOCAL ✦]" : ""} → http://${HOST}:${PORT}\n`
    );
  });
}
