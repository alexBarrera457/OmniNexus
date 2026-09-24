"use strict";
function createHealthRouter({ memoryEnabled }) {
    const express = require("express");
    const router = express.Router();
    router.get("/health", (req, res) => {
        res.json({
            ok: true,
            name: "OMNI // NEXUS",
            version: "6.2",
            status: "online",
            tools: ["WEB", "CALCULATOR", "CLOCK", "CHAT"],
            memory: memoryEnabled,
            conversations: true
        });
    });
    return router;
}
module.exports = { createHealthRouter };
