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

  function buildTableHtml(table) {
    if (!table || !Array.isArray(table.headers) || !Array.isArray(table.rows)) {
      return "";
    }

    return "" +
      "<table class='data-table'>" +
      "<thead><tr>" +
      table.headers.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
      "</tr></thead>" +
      "<tbody>" +
      table.rows.map(function (row) {
        return "<tr>" + row.map(function (cell) {
          return "<td>" + esc(cell) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      "</tbody></table>";
  }

  function mount(container, screenConfig, savedPayload, options) {
    const cfg = screenConfig || {};
    const opts = options || {};
    const inputs = Array.isArray(cfg.inputs) ? cfg.inputs.slice(0, 4) : [];
    const saved = savedPayload && savedPayload.responses ? savedPayload.responses : {};
    const savedInputs = saved.inputs || {};

    const html = [];
    html.push("<div class='ncs-root'>");
    html.push("<h3>" + esc(cfg.scenarioTitle || cfg.title || "Calculation") + "</h3>");

    if (cfg.scenarioText) {
      html.push("<p class='widget-note'>" + esc(cfg.scenarioText) + "</p>");
    }

    html.push(buildTableHtml(cfg.dataTable));

    if (cfg.formulaBox) {
      html.push("<div class='formula'>" + esc(cfg.formulaBox) + "</div>");
    }

    if (cfg.roundingInstruction) {
      html.push("<p class='widget-note'><strong>Rounding:</strong> " + esc(cfg.roundingInstruction) + "</p>");
    }

    html.push("<div class='ncs-input-grid'>");
    inputs.forEach(function (inputDef) {
      const unit = inputDef.unit ? "<span class='ncs-unit'>" + esc(inputDef.unit) + "</span>" : "";
      const requiredTag = inputDef.required ? " <span class='ncs-required'>*</span>" : "";
      const initial = savedInputs[inputDef.id] && savedInputs[inputDef.id].value !== undefined
        ? savedInputs[inputDef.id].value
        : "";

      html.push("<div class='ncs-input-row'>");
      html.push("<label for='ncs-" + esc(inputDef.id) + "'>" + esc(inputDef.label) + requiredTag + "</label>");
      html.push("<div class='ncs-input-wrap'>");
      html.push("<input id='ncs-" + esc(inputDef.id) + "' type='number' step='any' value='" + esc(initial) + "' placeholder='" + esc(inputDef.placeholder || "") + "' />");
      html.push(unit);
      html.push("</div>");
      html.push("<div class='ncs-error' data-error='" + esc(inputDef.id) + "'></div>");
      html.push("</div>");
    });
    html.push("</div>");

    if (cfg.followupMcq && Array.isArray(cfg.followupMcq.options)) {
      const savedMcq = saved.followupMcq && saved.followupMcq.selected;
      html.push("<div class='ncs-mcq'>");
      html.push("<p><strong>Follow-up:</strong> " + esc(cfg.followupMcq.prompt || "Select one option") + "</p>");
      html.push("<div class='ncs-mcq-options'>");
      cfg.followupMcq.options.forEach(function (opt, idx) {
        const id = "ncs-mcq-" + idx;
        const checked = savedMcq === opt.value ? " checked" : "";
        html.push("<label for='" + esc(id) + "'>");
        html.push("<input id='" + esc(id) + "' type='radio' name='ncs-followup' value='" + esc(opt.value) + "'" + checked + " /> ");
        html.push(esc(opt.label));
        html.push("</label>");
      });
      html.push("</div>");
      html.push("<div class='ncs-error' data-error='followup'></div>");
      html.push("</div>");
    }

    html.push("</div>");
    container.innerHTML = html.join("");

    if (opts.locked) {
      container.querySelectorAll("input, select, textarea, button").forEach(function (el) {
        el.disabled = true;
      });
    }

    if (typeof opts.onChange === "function") {
      container.querySelectorAll("input").forEach(function (el) {
        el.addEventListener("input", opts.onChange);
        el.addEventListener("change", opts.onChange);
      });
    }

    function getResponsePayload() {
      const payload = {
        componentType: "numeric-calc-screen",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        templateId: cfg.templateId || null,
        responses: {
          inputs: {},
          followupMcq: null
        },
        meta: {
          roundingInstruction: cfg.roundingInstruction || null,
          capturedAt: new Date().toISOString()
        }
      };

      inputs.forEach(function (inputDef) {
        const inputEl = container.querySelector("#ncs-" + inputDef.id);
        const raw = inputEl ? inputEl.value.trim() : "";
        payload.responses.inputs[inputDef.id] = {
          value: raw === "" ? null : Number(raw),
          unit: inputDef.unit || null
        };
      });

      if (cfg.followupMcq) {
        const selected = container.querySelector("input[name='ncs-followup']:checked");
        payload.responses.followupMcq = {
          id: cfg.followupMcq.id || "followup",
          selected: selected ? selected.value : null
        };
      }

      return payload;
    }

    function clearErrors() {
      container.querySelectorAll(".ncs-error").forEach(function (el) {
        el.textContent = "";
      });
    }

    function setError(key, message) {
      const errorEl = container.querySelector(".ncs-error[data-error='" + key + "']");
      if (errorEl) {
        errorEl.textContent = message;
      }
    }

    function validate() {
      clearErrors();
      const payload = getResponsePayload();
      let valid = true;

      inputs.forEach(function (inputDef) {
        const val = payload.responses.inputs[inputDef.id].value;
        if (inputDef.required && (val === null || Number.isNaN(val))) {
          valid = false;
          setError(inputDef.id, "Required");
        }
      });

      if (cfg.followupMcq && cfg.followupMcq.required) {
        const selected = payload.responses.followupMcq && payload.responses.followupMcq.selected;
        if (!selected) {
          valid = false;
          setError("followup", "Required");
        }
      }

      return {
        valid: valid,
        payload: payload
      };
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
      const numericItems = grading.numericItems || [];
      const items = [];
      const answers = {};

      numericItems.forEach(function (rule) {
        const itemId = rule.itemId || rule.inputId;
        items.push({
          itemId: itemId,
          type: "numeric",
          answer: rule.answer,
          tolerance: rule.tolerance || 0,
          maxScore: rule.maxScore || 1
        });
        answers[itemId] = payload.responses.inputs[rule.inputId]
          ? payload.responses.inputs[rule.inputId].value
          : null;
      });

      if (grading.branchFollowup && cfg.followupMcq) {
        const branchItemId = grading.branchFollowup.itemId || (cfg.followupMcq.id || "followup") + "_branch";
        items.push({
          itemId: branchItemId,
          type: "branch-followup",
          answerKeyByBranch: grading.branchFollowup.answerKeyByBranch || {},
          maxScore: grading.branchFollowup.maxScore || 1
        });
        answers[branchItemId] = {
          selectedBranch: grading.branchFollowup.selectedBranch || cfg.followupMcq.branchId || "default",
          answer: payload.responses.followupMcq ? payload.responses.followupMcq.selected : null
        };
      } else if (grading.followupMcq && cfg.followupMcq) {
        const mcqId = grading.followupMcq.itemId || (cfg.followupMcq.id || "followup");
        items.push({
          itemId: mcqId,
          type: "mcq",
          answerKey: grading.followupMcq.answerKey,
          maxScore: grading.followupMcq.maxScore || 1
        });
        answers[mcqId] = payload.responses.followupMcq ? payload.responses.followupMcq.selected : null;
      }

      return window.ScoringEngine.scoreItems(items, answers);
    }

    return {
      validate: validate,
      isAnswered: function () {
        return validate().valid;
      },
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.NumericCalcScreen = {
    mount: mount
  };
})();
