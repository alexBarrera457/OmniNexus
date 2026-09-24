"use strict";

function calculate(expression) {
  const normalized = String(expression || "")
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .trim();

  if (!normalized || normalized.length > 200) {
    throw new Error("Expresión matemática no válida.");
  }

  const tokens = normalized.match(/\d+(?:\.\d+)?|[()+\-*/%]/g) || [];
  if (tokens.join("") !== normalized.replace(/\s/g, "")) {
    throw new Error("Expresión matemática no válida.");
  }

  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const factor = () => {
    if (peek() === "+") {
      consume();
      return factor();
    }
    if (peek() === "-") {
      consume();
      return -factor();
    }
    if (peek() === "(") {
      consume();
      const value = parseExpression();
      if (consume() !== ")") throw new Error("Paréntesis sin cerrar.");
      return value;
    }
    const token = consume();
    if (!token || !/^\d/.test(token)) throw new Error("Expresión matemática no válida.");
    return Number(token);
  };
  const term = () => {
    let value = factor();
    while (["*", "/", "%"].includes(peek())) {
      const operator = consume();
      const right = factor();
      if ((operator === "/" || operator === "%") && right === 0) {
        throw new Error("No se puede dividir entre cero.");
      }
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  };
  const parseExpression = () => {
    let value = term();
    while (["+", "-"].includes(peek())) {
      value = consume() === "+" ? value + term() : value - term();
    }
    return value;
  };

  const result = parseExpression();
  if (position !== tokens.length || !Number.isFinite(result)) {
    throw new Error("Resultado matemático no válido.");
  }
  return result;
}

module.exports = { calculate };
