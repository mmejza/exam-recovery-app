/*
  engine/rng.test-harness.js
  Small harness proving deterministic seeded randomization.

  Browser:
    1) load engine/rng.js
    2) load this file

  Node:
    node -e "const h=require('./engine/rng.test-harness.js'); h.runSeededRandomHarness();"
*/

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./rng"));
    return;
  }
  root.runSeededRandomHarness = factory(root.SeededRandom).runSeededRandomHarness;
})(typeof window !== "undefined" ? window : globalThis, function (SeededRandom) {
  "use strict";

  function snapshot(studentId, attemptNumber, secretSalt) {
    const rng = SeededRandom.createSeededRandom(studentId, attemptNumber, secretSalt);
    return {
      seed: rng.seed,
      int: rng.randomInt(10, 99),
      float: rng.randomFloat(1, 5, 3),
      choice: rng.randomChoice(["A", "B", "C", "D"]),
      shuffled: rng.shuffle([1, 2, 3, 4, 5, 6]),
    };
  }

  function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function runSeededRandomHarness() {
    const a1 = snapshot("S12345", 1, "OM2026");
    const a2 = snapshot("S12345", 1, "OM2026");
    const b1 = snapshot("S12345", 2, "OM2026");

    const sameInputsReproduce = deepEqual(a1, a2);
    const differentAttemptChanges = !deepEqual(a1, b1);

    const report = {
      sameInputsReproduce,
      differentAttemptChanges,
      sampleRunA: a1,
      sampleRunB: b1,
    };

    if (!sameInputsReproduce || !differentAttemptChanges) {
      console.error("Seeded RNG harness failed", report);
      throw new Error("Seeded RNG harness failed");
    }

    console.log("Seeded RNG harness passed", report);
    return report;
  }

  return { runSeededRandomHarness };
});
