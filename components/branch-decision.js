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

  function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function mount(container, screenConfig, savedPayload, options) {
    const cfg = screenConfig || {};
    const opts = options || {};
    const metrics = Array.isArray(cfg.metrics) ? cfg.metrics : [];
    const decisionOptions = Array.isArray(cfg.options) ? cfg.options.slice(0, 4) : [];
    const followupByOption = cfg.followupByOption || {};

    const saved = savedPayload && savedPayload.responses ? savedPayload.responses : {};

    let chosenAction = saved.chosenAction || null;
    let locked = Boolean(saved.branchState && saved.branchState.locked);
    const followupAnswers = Object.assign({}, saved.followupAnswers || {});

    function optionById(id) {
      for (let i = 0; i < decisionOptions.length; i++) {
        if (decisionOptions[i].id === id) {
          return decisionOptions[i];
        }
      }
      return null;
    }

    function currentMetricsMap() {
      const out = {};
      const selected = optionById(chosenAction);
      const delta = selected && selected.delta ? selected.delta : {};

      metrics.forEach(function (m) {
        const base = asNumber(m.baseline);
        const d = asNumber(delta[m.id]);
        if (base === null) {
          out[m.id] = m.baseline;
          return;
        }
        out[m.id] = base + (d === null ? 0 : d);
      });

      return out;
    }

    function metricDisplay(metric, value) {
      const n = asNumber(value);
      if (n === null) {
        return String(value);
      }
      return String(Math.round(n * 100) / 100) + (metric.unit ? " " + metric.unit : "");
    }

    function renderDashboard() {
      const current = currentMetricsMap();
      const cards = metrics.map(function (m) {
        const base = m.baseline;
        const now = current[m.id];
        const changed = String(base) !== String(now);
        return "" +
          "<div class='bd-metric-card'>" +
          "  <div class='bd-metric-label'>" + esc(m.label || m.id) + "</div>" +
          "  <div class='bd-metric-values'>" +
          "    <span class='bd-metric-base'>Base: " + esc(metricDisplay(m, base)) + "</span>" +
          "    <span class='bd-metric-now" + (changed ? " bd-metric-now-changed" : "") + "'>Now: " + esc(metricDisplay(m, now)) + "</span>" +
          "  </div>" +
          "</div>";
      }).join("");

      return "" +
        "<section class='bd-dashboard'>" +
        "  <h4>" + esc(cfg.dashboardTitle || "Operational Dashboard") + "</h4>" +
        "  <div class='bd-metric-grid'>" + cards + "</div>" +
        "</section>";
    }

    function renderOptions() {
      const optionCards = decisionOptions.map(function (opt) {
        const selected = chosenAction === opt.id;
        const disabled = locked || opts.locked;
        return "" +
          "<button type='button' class='bd-option-card" + (selected ? " bd-option-selected" : "") + "' data-option='" + esc(opt.id) + "'" + (disabled ? " disabled" : "") + ">" +
          "  <strong>" + esc(opt.label) + "</strong>" +
          "  <span>" + esc(opt.description || "") + "</span>" +
          "</button>";
      }).join("");

      return "" +
        "<section class='bd-options'>" +
        "  <h4>Decision Options</h4>" +
        "  <div class='bd-options-grid'>" + optionCards + "</div>" +
        (locked ? "<p class='widget-note'>Decision locked after selection.</p>" : "") +
        "</section>";
    }

    function branchQuestions() {
      if (!chosenAction) {
        return [];
      }
      const list = followupByOption[chosenAction];
      return Array.isArray(list) ? list.slice(0, 3) : [];
    }

    function renderFollowups() {
      const questions = branchQuestions();
      if (!questions.length) {
        return "";
      }

      const html = [];
      html.push("<section class='bd-followups'>");
      html.push("<h4>Branch Follow-up</h4>");

      questions.forEach(function (q, idx) {
        const qid = q.id || ("q" + String(idx + 1));
        html.push("<div class='bd-followup'>");
        html.push("<p>" + esc(q.prompt || "Select one option") + "</p>");
        html.push("<div class='ncs-mcq-options'>");
        (q.options || []).forEach(function (opt, optIdx) {
          const id = "bd-mcq-" + esc(qid) + "-" + String(optIdx);
          const checked = followupAnswers[qid] === opt.value ? " checked" : "";
          html.push("<label for='" + id + "'>");
          html.push("<input id='" + id + "' type='radio' name='bd-followup-" + esc(qid) + "' value='" + esc(opt.value) + "' data-followup='" + esc(qid) + "'" + checked + (opts.locked ? " disabled" : "") + " /> " + esc(opt.label));
          html.push("</label>");
        });
        html.push("</div>");
        html.push("<div class='ncs-error' data-error='" + esc(qid) + "'></div>");
        html.push("</div>");
      });

      html.push("</section>");
      return html.join("");
    }

    function render() {
      const html = [];
      html.push("<div class='bd-root'>");
      html.push("<h3>" + esc(cfg.title || cfg.scenarioTitle || "Branching Decision") + "</h3>");
      if (cfg.prompt) {
        html.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }
      html.push(renderDashboard());
      html.push(renderOptions());
      html.push(renderFollowups());
      html.push("<div class='ncs-error' data-error='decision'></div>");
      html.push("</div>");

      container.innerHTML = html.join("");
      bindEvents();
    }

    function lockDecision(optionId) {
      if (opts.locked || locked) {
        return;
      }
      chosenAction = optionId;
      locked = true;
      render();
      notifyChange();
    }

    function bindEvents() {
      container.querySelectorAll("[data-option]").forEach(function (el) {
        el.addEventListener("click", function () {
          lockDecision(el.getAttribute("data-option"));
        });
      });

      container.querySelectorAll("input[data-followup]").forEach(function (el) {
        el.addEventListener("change", function () {
          const qid = el.getAttribute("data-followup");
          followupAnswers[qid] = el.value;
          notifyChange();
        });
      });
    }

    function notifyChange() {
      if (typeof opts.onChange === "function") {
        opts.onChange();
      }
    }

    function clearErrors() {
      container.querySelectorAll(".ncs-error").forEach(function (el) {
        el.textContent = "";
      });
    }

    function setError(key, message) {
      const el = container.querySelector(".ncs-error[data-error='" + key + "']");
      if (el) {
        el.textContent = message;
      }
    }

    function getResponsePayload() {
      const selected = optionById(chosenAction);
      return {
        componentType: "branch-decision",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        responses: {
          chosenAction: chosenAction,
          branchState: {
            locked: locked,
            baselineMetrics: metrics.reduce(function (acc, m) {
              acc[m.id] = m.baseline;
              return acc;
            }, {}),
            currentMetrics: currentMetricsMap(),
            appliedDelta: selected && selected.delta ? selected.delta : {}
          },
          followupAnswers: Object.assign({}, followupAnswers)
        },
        meta: {
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      clearErrors();
      const payload = getResponsePayload();
      let valid = true;

      if (!payload.responses.chosenAction) {
        valid = false;
        setError("decision", "Select one decision option.");
        return { valid: valid, payload: payload };
      }

      const questions = branchQuestions();
      questions.forEach(function (q, idx) {
        const qid = q.id || ("q" + String(idx + 1));
        if (q.required !== false && !payload.responses.followupAnswers[qid]) {
          valid = false;
          setError(qid, "Required");
        }
      });

      return { valid: valid, payload: payload };
    }

    function grade() {
      if (!window.ScoringEngine) {
        return {
          itemScore: 0,
          maxScore: 0,
          percentage: 0,
          feedbackCode: "SCORING_UNAVAILABLE",
          byItemId: {}
        };
      }

      const payload = getResponsePayload();
      const grading = cfg.grading || {};
      const items = [];
      const answers = {};

      if (grading.actionMcq) {
        const actionItemId = grading.actionMcq.itemId || "chosen_action";
        items.push({
          itemId: actionItemId,
          type: "mcq",
          answerKey: grading.actionMcq.answerKey,
          maxScore: grading.actionMcq.maxScore || 1
        });
        answers[actionItemId] = payload.responses.chosenAction;
      }

      const followupGradingByOption = grading.followupByOption || {};
      const selected = payload.responses.chosenAction;
      const followupDefs = selected && Array.isArray(followupGradingByOption[selected])
        ? followupGradingByOption[selected]
        : [];

      followupDefs.forEach(function (def, idx) {
        const qid = def.questionId || ("q" + String(idx + 1));
        const itemId = def.itemId || (selected + "_" + qid);
        items.push({
          itemId: itemId,
          type: "mcq",
          answerKey: def.answerKey,
          maxScore: def.maxScore || 1
        });
        answers[itemId] = payload.responses.followupAnswers[qid] || null;
      });

      if (!items.length) {
        return {
          itemScore: 0,
          maxScore: 0,
          percentage: 0,
          feedbackCode: "NO_GRADING_RULES",
          byItemId: {}
        };
      }

      return window.ScoringEngine.scoreItems(items, answers);
    }

    render();

    return {
      validate: validate,
      isAnswered: function () {
        return validate().valid;
      },
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.BranchDecision = {
    mount: mount
  };
})();