(function () {
  "use strict";

  const el = {
    root: null,
    token: null,
    progress: null,
    timer: null,
    save: null
  };

  function init() {
    el.root = document.getElementById("top-bar");
    el.token = document.getElementById("tb-token");
    el.progress = document.getElementById("tb-progress");
    el.timer = document.getElementById("tb-timer");
    el.save = document.getElementById("tb-save");
  }

  function setToken(token) {
    el.token.textContent = "Token: " + (token || "-");
  }

  function setProgress(current, total) {
    el.progress.textContent = "Progress: " + current + "/" + total;
  }

  function setTimer(seconds) {
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    el.timer.textContent = "Time: " + mm + ":" + ss;
  }

  function setDualTimer(overallSeconds, moduleSeconds, isLow) {
    const om = String(Math.floor(Math.max(0, overallSeconds) / 60)).padStart(2, "0");
    const os = String(Math.max(0, overallSeconds) % 60).padStart(2, "0");
    const mm = String(Math.floor(Math.max(0, moduleSeconds) / 60)).padStart(2, "0");
    const ms = String(Math.max(0, moduleSeconds) % 60).padStart(2, "0");

    el.timer.textContent = "Overall: " + om + ":" + os + " | Module: " + mm + ":" + ms;
    el.timer.classList.toggle("pill-warning", Boolean(isLow));
  }

  function setAutosave(text) {
    el.save.textContent = "Autosave: " + text;
  }

  function show(flag) {
    el.root.classList.toggle("hidden", !flag);
  }

  window.TopBar = {
    init,
    setToken,
    setProgress,
    setTimer,
    setDualTimer,
    setAutosave,
    show
  };
})();
