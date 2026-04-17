(function () {
  "use strict";

  const el = {
    root: null,
    warning: null,
    prev: null,
    next: null
  };

  function init() {
    el.root = document.getElementById("bottom-bar");
    el.warning = document.getElementById("bb-warning");
    el.prev = document.getElementById("btn-prev");
    el.next = document.getElementById("btn-next");
  }

  function bind(onPrev, onNext) {
    el.prev.onclick = onPrev;
    el.next.onclick = onNext;
  }

  function setButtons(hasPrev, nextLabel, nextDisabled) {
    el.prev.disabled = !hasPrev;
    el.next.textContent = nextLabel || "Next";
    el.next.disabled = Boolean(nextDisabled);
  }

  function setWarning(message) {
    el.warning.textContent = message || "";
  }

  function show(flag) {
    el.root.classList.toggle("hidden", !flag);
  }

  window.BottomBar = {
    init,
    bind,
    setButtons,
    setWarning,
    show
  };
})();
