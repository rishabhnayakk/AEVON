"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const { requireRole } = require("./authz")

function invoke(guard, session) {
  const result = { status: null, body: null, next: false }
  const res = { status(code) { result.status = code; return this }, json(body) { result.body = body; return this } }
  guard({ session }, res, () => { result.next = true })
  return result
}

test("role guard rejects missing sessions", () => {
  assert.equal(invoke(requireRole("admin"), {}).status, 401)
})

test("role guard rejects authenticated users with the wrong role", () => {
  assert.equal(invoke(requireRole("admin"), { userId: "u1", role: "student" }).status, 403)
})

test("role guard permits an allowed role", () => {
  assert.equal(invoke(requireRole("admin", "teacher"), { userId: "u1", role: "teacher" }).next, true)
})
