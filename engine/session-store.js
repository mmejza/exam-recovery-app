/*
  engine/session-store.js
  Lightweight localStorage session persistence + autosave helper.
*/

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  root.SessionStore = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const KEY = "om-recovery-lab-session-v2";
  let autosaveId = null;

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function startAutosave(getState, onStatus, intervalMs) {
    stopAutosave();
    const every = Number(intervalMs) > 0 ? Number(intervalMs) : 15000;
    autosaveId = setInterval(function () {
      if (onStatus) {
        onStatus("saving");
      }
      const ok = save(getState());
      if (onStatus) {
        onStatus(ok ? "saved" : "error");
      }
    }, every);
  }

  function stopAutosave() {
    if (!autosaveId) {
      return;
    }
    clearInterval(autosaveId);
    autosaveId = null;
  }

  return {
    save,
    load,
    clear,
    startAutosave,
    stopAutosave,
  };
});
