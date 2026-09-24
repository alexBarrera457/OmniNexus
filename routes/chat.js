"use strict";
const { validateChatRequest } = require("../lib/chat-validation");

function createChatRouter({ nexus, createConversation, getConversation, maxMessageLength = 20_000, maxRequestMessages = 50 }) {
    const express = require("express");
    const router = express.Router();

    router.post("/chat", async (req, res) => {
        try {
            const { messages, conversationId } = req.body;
            const validation = validateChatRequest(messages);
            if (!validation.ok) return res.status(validation.status).json({ error: validation.error });
            if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxRequestMessages) {
                return res.status(400).json({ error: "No se recibieron mensajes." });
            }
            const lastMessage = messages[messages.length - 1];
            const userText = String(lastMessage?.content || "").trim();
            if (lastMessage?.role !== "user" || !userText) {
                return res.status(400).json({ error: "Mensaje vacío." });
            }
            if (userText.length > maxMessageLength) {
                return res.status(413).json({ error: `El mensaje supera el límite de ${maxMessageLength} caracteres.` });
            }
            let activeConversationId = Number(conversationId);
            if (!Number.isInteger(activeConversationId) || activeConversationId <= 0) {
                activeConversationId = createConversation();
            }
            if (!getConversation(activeConversationId)) {
                return res.status(404).json({ error: "La conversación no existe." });
            }
            const result = await nexus.execute(activeConversationId, userText);
            res.json(result);
        } catch (error) {
            console.error("💥 NEXUS ERROR:", error);
            res.status(500).json({ error: error.message || "Error interno del servidor." });
        }
    });

    return router;
}

module.exports = { createChatRouter };
