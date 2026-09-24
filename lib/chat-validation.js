"use strict";

const MAX_MESSAGE_LENGTH = 20_000;
const MAX_REQUEST_MESSAGES = 50;

function validateChatRequest(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_REQUEST_MESSAGES) {
    return { ok: false, status: 400, error: "No se recibieron mensajes válidos." };
  }

  const lastMessage = messages.at(-1);
  const userText = typeof lastMessage?.content === "string" ? lastMessage.content.trim() : "";
  if (lastMessage?.role !== "user" || !userText) {
    return {
      ok: false,
      status: 400,
      error: "El último mensaje debe ser del usuario y no estar vacío.",
    };
  }
  if (userText.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 413,
      error: `El mensaje supera el límite de ${MAX_MESSAGE_LENGTH} caracteres.`,
    };
  }
  return { ok: true, userText };
}

module.exports = { MAX_MESSAGE_LENGTH, MAX_REQUEST_MESSAGES, validateChatRequest };
