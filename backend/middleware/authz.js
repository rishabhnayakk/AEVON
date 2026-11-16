"use strict"

function requireRole(...allowedRoles) {
  if (!allowedRoles.length) throw new TypeError("At least one role is required")
  return function roleGuard(req, res, next) {
    if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" })
    if (!allowedRoles.includes(req.session.role)) return res.status(403).json({ error: "Insufficient permissions" })
    return next()
  }
}

module.exports = { requireRole }
