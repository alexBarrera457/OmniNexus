const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate } = require("../lib/calculator");

test("resuelve precedencia, paréntesis y operadores unarios", () => {
  assert.equal(calculate("2 + 3 * (4 - 1)"), 11);
  assert.equal(calculate("-4 + 2"), -2);
  assert.equal(calculate("10 ÷ 4"), 2.5);
});

test("rechaza expresiones inseguras o inválidas", () => {
  assert.throws(() => calculate("process.exit()"));
  assert.throws(() => calculate("2 / 0"));
  assert.throws(() => calculate("(2 + 3"));
});
