(function () {
  "use strict";

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mount(container, config, savedPayload, options) {
    const cfg = config || {};
    const opts = options || {};
    const bins = Array.isArray(cfg.bins) ? cfg.bins : [];
    const cards = Array.isArray(cfg.cards) ? cfg.cards : [];
    const requireAll = cfg.requireAllAssignments !== false;

    const savedMap = savedPayload && savedPayload.responses && savedPayload.responses.cardToBin
      ? savedPayload.responses.cardToBin
      : {};

    const cardToBin = {};
    cards.forEach(function (c) {
      cardToBin[c.id] = savedMap[c.id] || null;
    });

    let draggedId = null;

    function render() {
      const html = [];
      html.push("<div class='ddc-root'>");
      html.push("<h3>" + esc(cfg.title || "Classification") + "</h3>");
      if (cfg.prompt) {
        html.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }

      html.push("<section class='ddc-unassigned'>");
      html.push("<h4>Cards</h4>");
      html.push("<div class='ddc-card-row' data-zone='__unassigned'></div>");
      html.push("</section>");

      html.push("<section class='ddc-bins'>");
      bins.forEach(function (bin) {
        html.push("<article class='ddc-bin' data-zone='" + esc(bin.id) + "'>");
        html.push("<h4>" + esc(bin.label) + "</h4>");
        html.push("<div class='ddc-card-row' data-zone='" + esc(bin.id) + "'></div>");
        html.push("</article>");
      });
      html.push("</section>");

      // Keyboard fallback: choose bin per card.
      html.push("<section class='ddc-fallback'>");
      html.push("<h4>Keyboard Fallback</h4>");
      cards.forEach(function (card) {
        html.push("<div class='ddc-fallback-row'>");
        html.push("<label for='ddc-select-" + esc(card.id) + "'>" + esc(card.label) + "</label>");
        html.push("<select id='ddc-select-" + esc(card.id) + "' data-card='" + esc(card.id) + "'>");
        html.push("<option value=''>Unassigned</option>");
        bins.forEach(function (bin) {
          const selected = cardToBin[card.id] === bin.id ? " selected" : "";
          html.push("<option value='" + esc(bin.id) + "'" + selected + ">" + esc(bin.label) + "</option>");
        });
        html.push("</select>");
        html.push("</div>");
      });
      html.push("</section>");

      html.push("<div class='ddc-error' id='ddc-error'></div>");
      html.push("</div>");

      container.innerHTML = html.join("");
      attachInteractions();
      paintCards();

      if (opts.locked) {
        container.querySelectorAll("select").forEach(function (el) {
          el.disabled = true;
        });
      }
    }

    function attachInteractions() {
      container.querySelectorAll(".ddc-bin, .ddc-unassigned").forEach(function (zoneEl) {
        zoneEl.addEventListener("dragover", function (e) {
          if (!opts.locked) {
            e.preventDefault();
          }
        });
        zoneEl.addEventListener("drop", function (e) {
          if (opts.locked) {
            return;
          }
          e.preventDefault();
          if (!draggedId) {
            return;
          }
          const zone = zoneEl.classList.contains("ddc-unassigned")
            ? null
            : zoneEl.getAttribute("data-zone");
          cardToBin[draggedId] = zone;
          syncFallbackSelect(draggedId);
          paintCards();
          notifyChange();
        });
      });

      container.querySelectorAll(".ddc-fallback select").forEach(function (selectEl) {
        selectEl.addEventListener("change", function () {
          if (opts.locked) {
            return;
          }
          const cardId = selectEl.getAttribute("data-card");
          const zone = selectEl.value || null;
          cardToBin[cardId] = zone;
          paintCards();
          notifyChange();
        });
      });
    }

    function createCardEl(card) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ddc-card";
      btn.textContent = card.label;
      btn.setAttribute("draggable", opts.locked ? "false" : "true");
      btn.setAttribute("data-card", card.id);
      btn.setAttribute("aria-label", card.label);

      btn.addEventListener("dragstart", function () {
        if (opts.locked) {
          return;
        }
        draggedId = card.id;
      });
      btn.addEventListener("dragend", function () {
        draggedId = null;
      });

      return btn;
    }

    function paintCards() {
      container.querySelectorAll(".ddc-card-row").forEach(function (row) {
        row.innerHTML = "";
      });

      cards.forEach(function (card) {
        const zone = cardToBin[card.id];
        const rowSelector = zone
          ? ".ddc-card-row[data-zone='" + zone + "']"
          : ".ddc-card-row[data-zone='__unassigned']";
        const row = container.querySelector(rowSelector);
        if (row) {
          row.appendChild(createCardEl(card));
        }
      });
    }

    function syncFallbackSelect(cardId) {
      const selectEl = container.querySelector("#ddc-select-" + cardId);
      if (selectEl) {
        selectEl.value = cardToBin[cardId] || "";
      }
    }

    function notifyChange() {
      if (typeof opts.onChange === "function") {
        opts.onChange();
      }
    }

    function getFinalMapping() {
      const out = {};
      cards.forEach(function (card) {
        out[card.id] = cardToBin[card.id] || null;
      });
      return out;
    }

    function getResponsePayload() {
      return {
        componentType: "dragdrop-classification",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        cardSetId: cfg.cardSetId || null,
        responses: {
          cardToBin: getFinalMapping()
        },
        meta: {
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      const errorEl = container.querySelector("#ddc-error");
      if (!requireAll) {
        if (errorEl) {
          errorEl.textContent = "";
        }
        return { valid: true, payload: getResponsePayload() };
      }

      const missing = cards.filter(function (card) {
        return !cardToBin[card.id];
      });

      if (missing.length > 0) {
        if (errorEl) {
          errorEl.textContent = "Assign every card before continuing.";
        }
        return { valid: false, payload: getResponsePayload() };
      }

      if (errorEl) {
        errorEl.textContent = "";
      }
      return { valid: true, payload: getResponsePayload() };
    }

    function grade() {
      if (!window.ScoringEngine) {
        return {
          itemScore: 0,
          maxScore: 0,
          percentage: 0,
          feedbackCode: "SCORING_UNAVAILABLE"
        };
      }

      const mapping = getFinalMapping();
      const grading = cfg.grading || {};
      return window.ScoringEngine.scoreItem(
        {
          type: "drag-drop",
          answerKey: grading.answerKey || {},
          maxScore: grading.maxScore || Object.keys(grading.answerKey || {}).length || 1
        },
        mapping
      );
    }

    render();

    return {
      isAnswered: function () {
        return validate().valid;
      },
      validate: validate,
      getValue: getFinalMapping,
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.DragDropClassification = {
    mount: mount
  };
})();(function () {
  "use strict";

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mount(container, config, savedPayload, options) {
    const cfg = config || {};
    const opts = options || {};
    const bins = Array.isArray(cfg.bins) ? cfg.bins : [];
    const cards = Array.isArray(cfg.cards) ? cfg.cards : [];
    const requireAll = cfg.requireAllAssignments !== false;

    const savedMap = savedPayload && savedPayload.responses && savedPayload.responses.cardToBin
      ? savedPayload.responses.cardToBin
      : {};

    const cardToBin = {};
    cards.forEach(function (c) {
      cardToBin[c.id] = savedMap[c.id] || null;
    });

    let draggedId = null;

    function render() {
      const html = [];
      html.push("<div class='ddc-root'>");
      html.push("<h3>" + esc(cfg.title || "Classification") + "</h3>");
      if (cfg.prompt) {
        html.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }

      html.push("<section class='ddc-unassigned'>");
      html.push("<h4>Cards</h4>");
      html.push("<div class='ddc-card-row' data-zone='__unassigned'></div>");
      html.push("</section>");

      html.push("<section class='ddc-bins'>");
      bins.forEach(function (bin) {
        html.push("<article class='ddc-bin' data-zone='" + esc(bin.id) + "'>");
        html.push("<h4>" + esc(bin.label) + "</h4>");
        html.push("<div class='ddc-card-row' data-zone='" + esc(bin.id) + "'></div>");
        html.push("</article>");
      });
      html.push("</section>");

      // Keyboard fallback: choose bin per card.
      html.push("<section class='ddc-fallback'>");
      html.push("<h4>Keyboard Fallback</h4>");
      cards.forEach(function (card) {
        html.push("<div class='ddc-fallback-row'>");
        html.push("<label for='ddc-select-" + esc(card.id) + "'>" + esc(card.label) + "</label>");
        html.push("<select id='ddc-select-" + esc(card.id) + "' data-card='" + esc(card.id) + "'>");
        html.push("<option value=''>Unassigned</option>");
        bins.forEach(function (bin) {
          const selected = cardToBin[card.id] === bin.id ? " selected" : "";
          html.push("<option value='" + esc(bin.id) + "'" + selected + ">" + esc(bin.label) + "</option>");
        });
        html.push("</select>");
        html.push("</div>");
      });
      html.push("</section>");

      html.push("<div class='ddc-error' id='ddc-error'></div>");
      html.push("</div>");

      container.innerHTML = html.join("");
      attachInteractions();
      paintCards();

      if (opts.locked) {
        container.querySelectorAll("select").forEach(function (el) {
          el.disabled = true;
        });
      }
    }

    function attachInteractions() {
      container.querySelectorAll(".ddc-bin, .ddc-unassigned").forEach(function (zoneEl) {
        zoneEl.addEventListener("dragover", function (e) {
          if (!opts.locked) {
            e.preventDefault();
          }
        });
        zoneEl.addEventListener("drop", function (e) {
          if (opts.locked) {
            return;
          }
          e.preventDefault();
          if (!draggedId) {
            return;
          }
          const zone = zoneEl.classList.contains("ddc-unassigned")
            ? null
            : zoneEl.getAttribute("data-zone");
          cardToBin[draggedId] = zone;
          syncFallbackSelect(draggedId);
          paintCards();
          notifyChange();
        });
      });

      container.querySelectorAll(".ddc-fallback select").forEach(function (selectEl) {
        selectEl.addEventListener("change", function () {
          if (opts.locked) {
            return;
          }
          const cardId = selectEl.getAttribute("data-card");
          const zone = selectEl.value || null;
          cardToBin[cardId] = zone;
          paintCards();
          notifyChange();
        });
      });
    }

    function createCardEl(card) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ddc-card";
      btn.textContent = card.label;
      btn.setAttribute("draggable", opts.locked ? "false" : "true");
      btn.setAttribute("data-card", card.id);
      btn.setAttribute("aria-label", card.label);

      btn.addEventListener("dragstart", function () {
        if (opts.locked) {
          return;
        }
        draggedId = card.id;
      });
      btn.addEventListener("dragend", function () {
        draggedId = null;
      });

      return btn;
    }

    function paintCards() {
      container.querySelectorAll(".ddc-card-row").forEach(function (row) {
        row.innerHTML = "";
      });

      cards.forEach(function (card) {
        const zone = cardToBin[card.id];
        const rowSelector = zone
          ? ".ddc-card-row[data-zone='" + zone + "']"
          : ".ddc-card-row[data-zone='__unassigned']";
        const row = container.querySelector(rowSelector);
        if (row) {
          row.appendChild(createCardEl(card));
        }
      });
    }

    function syncFallbackSelect(cardId) {
      const selectEl = container.querySelector("#ddc-select-" + cardId);
      if (selectEl) {
        selectEl.value = cardToBin[cardId] || "";
      }
    }

    function notifyChange() {
      if (typeof opts.onChange === "function") {
        opts.onChange();
      }
    }

    function getFinalMapping() {
      const out = {};
      cards.forEach(function (card) {
        out[card.id] = cardToBin[card.id] || null;
      });
      return out;
    }

    function getResponsePayload() {
      return {
        componentType: "dragdrop-classification",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        cardSetId: cfg.cardSetId || null,
        responses: {
          cardToBin: getFinalMapping()
        },
        meta: {
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      const errorEl = container.querySelector("#ddc-error");
      if (!requireAll) {
        if (errorEl) {
          errorEl.textContent = "";
        }
        return { valid: true, payload: getResponsePayload() };
      }

      const missing = cards.filter(function (card) {
        return !cardToBin[card.id];
      });

      if (missing.length > 0) {
        if (errorEl) {
          errorEl.textContent = "Assign every card before continuing.";
        }
        return { valid: false, payload: getResponsePayload() };
      }

      if (errorEl) {
        errorEl.textContent = "";
      }
      return { valid: true, payload: getResponsePayload() };
    }

    function grade() {
      if (!window.ScoringEngine) {
        return {
          itemScore: 0,
          maxScore: 0,
          percentage: 0,
          feedbackCode: "SCORING_UNAVAILABLE"
        };
      }

      const mapping = getFinalMapping();
      const grading = cfg.grading || {};
      return window.ScoringEngine.scoreItem(
        {
          type: "drag-drop",
          answerKey: grading.answerKey || {},
          maxScore: grading.maxScore || Object.keys(grading.answerKey || {}).length || 1
        },
        mapping
      );
    }

    render();

    return {
      isAnswered: function () {
        return validate().valid;
      },
      validate: validate,
      getValue: getFinalMapping,
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.DragDropClassification = {
    mount: mount
  };
})();