"use strict";

const express = require("express");

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function createConversationsRouter(repository) {
  const router = express.Router();

  router.post("/conversations", (req, res, next) => {
    try {
      const rawTitle = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const title = rawTitle.slice(0, 120) || "Nueva conversación";
      const id = repository.createConversation(title);
      res.status(201).json({ ok: true, conversation: repository.getConversation(id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations", (req, res, next) => {
    try {
      res.json({ conversations: repository.getConversations() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/search/:query", (req, res, next) => {
    try {
      res.json({ conversations: repository.searchConversations(req.params.query) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/conversations/:id", (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });
      const conversation = repository.getConversation(id);
      if (!conversation) return res.status(404).json({ error: "Conversación no encontrada." });
      res.json({ conversation, messages: repository.getMessages(id) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/conversations/:id/messages", (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });
      if (!repository.getConversation(id))
        return res.status(404).json({ error: "Conversación no encontrada." });
      repository.clearMessages(id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/conversations/:id", (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      if (!id) return res.status(400).json({ error: "ID inválido." });
      if (!repository.getConversation(id))
        return res.status(404).json({ error: "Conversación no encontrada." });
      repository.deleteConversation(id);
      res.json({ ok: true, message: "Conversación eliminada." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createConversationsRouter };
