/* =====================================================
   engine/timer.js  —  Module countdown timer
   ===================================================== */

const Timer = (function () {

  /**
   * Create a countdown timer.
   * @param {number}   limitSeconds
   * @param {Function} onTick(remaining)   — called every second
   * @param {Function} onExpire()          — called when time hits 0
   * @returns timer object
   */
  function create(limitSeconds, onTick, onExpire) {

    let _remaining  = limitSeconds;
    let _interval   = null;
    let _startedAt  = null;   // Date.now() when latest start/resume
    let _snapshotAt = 0;      // remaining at latest start/resume

    function start() {
      if (_interval) return; // already running
      _snapshotAt = _remaining;
      _startedAt  = Date.now();
      _interval   = setInterval(_tick, 1000);
    }

    function pause() {
      if (!_interval) return;
      clearInterval(_interval);
      _interval  = null;
      _remaining = _snapshotAt - Math.floor((Date.now() - _startedAt) / 1000);
      _remaining = Math.max(0, _remaining);
    }

    function resume() {
      start(); // same logic
    }

    function setRemaining(seconds) {
      const wasRunning = !!_interval;
      if (wasRunning) pause();
      _remaining = Math.max(0, seconds);
      if (wasRunning) start();
    }

    function getRemaining() {
      if (_interval) {
        return Math.max(0, _snapshotAt - Math.floor((Date.now() - _startedAt) / 1000));
      }
      return _remaining;
    }

    function destroy() {
      if (_interval) clearInterval(_interval);
      _interval = null;
    }

    function _tick() {
      const now = Math.max(0, _snapshotAt - Math.floor((Date.now() - _startedAt) / 1000));
      onTick && onTick(now);
      if (now <= 0) {
        destroy();
        onExpire && onExpire();
      }
    }

    /** Format seconds as MM:SS */
    function format(seconds) {
      const s = Math.max(0, seconds);
      const m = String(Math.floor(s / 60)).padStart(2, '0');
      const sec = String(s % 60).padStart(2, '0');
      return `${m}:${sec}`;
    }

    return { start, pause, resume, setRemaining, getRemaining, destroy, format };
  }

  return { create };
})();
