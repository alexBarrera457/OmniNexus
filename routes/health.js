"use strict";
function createHealthRouter({ memoryEnabled, model = "gpt-4.1" } = {}) {
  const express = require("express");
  const router = express.Router();
  router.get("/health", (req, res) => {
    res.json({
      ok: true,
      name: "OMNI // NEXUS",
      version: "6.2",
      status: "online",
      provider: model,
      tools: ["WEB", "CALCULATOR", "CLOCK", "CHAT"],
      memory: memoryEnabled,
      conversations: true,
    });
  });
  return router;
}
module.exports = { createHealthRouter };
