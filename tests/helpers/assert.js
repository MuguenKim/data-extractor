const assert = {
  equal(actual, expected, msg = "") {
    if (actual !== expected) throw new Error(`${msg} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  },
  ok(cond, msg = "") {
    if (!cond) throw new Error(msg || "Assertion failed");
  },
  near(actual, expected, tol = 1e-6, msg = "") {
    if (Math.abs(actual - expected) > tol) throw new Error(`${msg} Expected ~${expected}, got ${actual}`);
  },
  between(x, a, b, msg = "") {
    if (!(x >= a && x <= b)) throw new Error(`${msg} Expected ${x} in [${a}, ${b}]`);
  }
};

module.exports = { assert };

