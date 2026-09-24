"use strict";
function createRateLimiter({ windowMs = 60_000, limit = 30 } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= limit) {
      return res.status(429).json({ error: "Demasiadas solicitudes. Inténtalo en un minuto." });
    }
    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}
module.exports = { createRateLimiter };
