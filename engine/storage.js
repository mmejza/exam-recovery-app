/* =====================================================
   engine/storage.js  —  localStorage autosave layer
   ===================================================== */

const Storage = (function () {

  const KEY = 'om_recovery_lab_v1';
  let _autoTimer = null;

  /** Persist the full app state object */
  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Load the saved state, or return null */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  /** Remove saved state */
  function clear() {
    localStorage.removeItem(KEY);
  }

  /**
   * Start periodic autosave.
   * @param {Function} getState  — callable that returns current state
   * @param {Function} onSave    — called with 'saving' | 'saved' | 'error'
   * @param {number}   intervalMs
   */
  function startAutosave(getState, onSave, intervalMs = 15000) {
    stopAutosave();
    _autoTimer = setInterval(() => {
      onSave('saving');
      const ok = save(getState());
      setTimeout(() => onSave(ok ? 'saved' : 'error'), 400);
    }, intervalMs);
  }

  function stopAutosave() {
    if (_autoTimer) { clearInterval(_autoTimer); _autoTimer = null; }
  }

  return { save, load, clear, startAutosave, stopAutosave };
})();
