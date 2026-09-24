"use strict";
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const DEFAULT_MODEL = process.env.OMNIROUTE_MODEL || "gpt-4.1";
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_REQUEST_MESSAGES = 50;
const MEMORY_CAPTURE_ENABLED = process.env.ENABLE_MEMORY === "true";
module.exports = {
  PORT,
  HOST,
  DEFAULT_MODEL,
  MAX_MESSAGE_LENGTH,
  MAX_REQUEST_MESSAGES,
  MEMORY_CAPTURE_ENABLED,
};
