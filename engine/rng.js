/* =====================================================
   engine/rng.js
   Deterministic seeded randomization utility for OM Recovery Lab.
   Seed source: FNV-1a hash of "studentId|attemptNumber|secretSalt"
   PRNG: mulberry32
   ===================================================== */

(function (root) {
  "use strict";

  function fnv1a(str) {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deriveSeed(studentId, attemptNumber, secretSalt) {
    const key = [
      String(studentId || "").trim(),
      Number(attemptNumber) || 0,
      String(secretSalt || "").trim(),
    ].join("|");
    return fnv1a(key);
  }

  function createSeededRandom(studentId, attemptNumber, secretSalt) {
    const seed = deriveSeed(studentId, attemptNumber, secretSalt);
    const next = mulberry32(seed);

    function randomInt(min, max) {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(next() * (hi - lo + 1));
    }

    function randomFloat(min, max, decimals) {
      const lo = Math.min(min, max);
      const hi = Math.max(min, max);
      const value = lo + next() * (hi - lo);
      const d = Number.isFinite(decimals) ? Math.max(0, decimals) : 2;
      const m = Math.pow(10, d);
      return Math.round(value * m) / m;
    }

    function randomChoice(array) {
      if (!Array.isArray(array) || array.length === 0) {
        return undefined;
      }
      return array[randomInt(0, array.length - 1)];
    }

    function shuffle(array) {
      const out = Array.isArray(array) ? array.slice() : [];
      for (let i = out.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    }

    return {
      seed,
      randomInt,
      randomFloat,
      randomChoice,
      shuffle,

      // Backward-compatible aliases for earlier app code.
      next,
      int: randomInt,
      float: function (min, max) {
        const lo = Math.min(min, max);
        const hi = Math.max(min, max);
        return lo + next() * (hi - lo);
      },
      floatR: randomFloat,
      pick: randomChoice,
      create: createSeededRandom,
    };
  }

  const api = {
    deriveSeed,
    createSeededRandom,

    // Backward-compatible entrypoint.
    create: createSeededRandom,
  };

  root.SeededRandom = api;
  root.RNG = root.RNG || api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
