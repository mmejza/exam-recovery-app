/*
  engine/timer-engine.js
  Dual countdown timer for overall session and module timing.
*/

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  root.TimerEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function create(options) {
    const cfg = options || {};
    let overallRemaining = Number(cfg.overallSeconds || 0);
    let moduleRemaining = Number(cfg.moduleSeconds || 0);
    const lowThreshold = Number(cfg.lowThresholdSeconds || 60);
    let intervalId = null;

    function tick() {
      overallRemaining = Math.max(0, overallRemaining - 1);
      moduleRemaining = Math.max(0, moduleRemaining - 1);

      const low = overallRemaining <= lowThreshold || moduleRemaining <= lowThreshold;
      if (typeof cfg.onTick === "function") {
        cfg.onTick({
          overallRemaining,
          moduleRemaining,
          low,
        });
      }

      if (moduleRemaining === 0 && typeof cfg.onModuleExpire === "function") {
        cfg.onModuleExpire();
      }

      if (overallRemaining === 0 && typeof cfg.onOverallExpire === "function") {
        cfg.onOverallExpire();
      }

      if (overallRemaining === 0 || moduleRemaining === 0) {
        stop();
      }
    }

    function start() {
      if (intervalId) {
        return;
      }
      intervalId = setInterval(tick, 1000);
    }

    function stop() {
      if (!intervalId) {
        return;
      }
      clearInterval(intervalId);
      intervalId = null;
    }

    function setRemaining(nextOverall, nextModule) {
      if (Number.isFinite(nextOverall)) {
        overallRemaining = Math.max(0, Number(nextOverall));
      }
      if (Number.isFinite(nextModule)) {
        moduleRemaining = Math.max(0, Number(nextModule));
      }
    }

    function getRemaining() {
      return {
        overallRemaining,
        moduleRemaining,
      };
    }

    return {
      start,
      stop,
      setRemaining,
      getRemaining,
    };
  }

  return {
    create,
  };
});
