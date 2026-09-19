"use strict";

const express = require("express");

function createMemoryRouter(repository) {
    const router = express.Router();

    router.get("/memory", (req, res, next) => {
        try {
            res.json({ memories: repository.getMemories() });
        } catch (error) {
            next(error);
        }
    });

    router.delete("/memory", (req, res, next) => {
        try {
            repository.deleteAllMemories();
            res.json({ ok: true, message: "Memoria eliminada." });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createMemoryRouter };
