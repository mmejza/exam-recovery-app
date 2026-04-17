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
    const columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    const saved = savedPayload && savedPayload.responses ? savedPayload.responses : {};
    const savedCells = saved.cells || {};
    const savedFollowup = saved.followupMcq && saved.followupMcq.selected ? saved.followupMcq.selected : null;

    function cellKey(rowId, colId) {
      return String(rowId) + "__" + String(colId);
    }

    function buildTable() {
      const out = [];
      out.push("<div class='tf-root'>");
      out.push("<h3>" + esc(cfg.title || cfg.scenarioTitle || "Table Fill") + "</h3>");
      if (cfg.prompt) {
        out.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }
      out.push("<table class='data-table tf-table'><thead><tr>");
      columns.forEach(function (col) {
        out.push("<th>" + esc(col.label || col.id) + "</th>");
      });
      out.push("</tr></thead><tbody>");

      rows.forEach(function (row, rowIndex) {
        out.push("<tr data-row='" + esc(row.id || String(rowIndex)) + "'>");
        columns.forEach(function (col) {
          const editable = col.editable === true && col.readOnly !== true;
          const rowId = row.id || String(rowIndex);
          const key = cellKey(rowId, col.id);
          const defaultValue = row.values && row.values[col.id] !== undefined ? row.values[col.id] : "";
          const savedValue = savedCells[key] !== undefined ? savedCells[key] : defaultValue;

          out.push("<td>");
          if (editable) {
            const placeholder = col.placeholder || "";
            out.push("<input class='tf-input' data-cell='" + esc(key) + "' type='number' step='any' value='" + esc(savedValue) + "' placeholder='" + esc(placeholder) + "' />");
          } else {
            out.push("<span class='tf-readonly'>" + esc(defaultValue) + "</span>");
          }
          out.push("</td>");
        });
        out.push("</tr>");
        out.push("<tr class='tf-row-error-wrap'><td colspan='" + String(columns.length) + "'><div class='ncs-error tf-row-error' data-row-error='" + esc(row.id || String(rowIndex)) + "'></div></td></tr>");
      });

      out.push("</tbody></table>");
      if (cfg.followupMcq && Array.isArray(cfg.followupMcq.options)) {
        out.push("<div class='ncs-mcq'>");
        out.push("<p><strong>Follow-up:</strong> " + esc(cfg.followupMcq.prompt || "Select one option") + "</p>");
        out.push("<div class='ncs-mcq-options'>");
        cfg.followupMcq.options.forEach(function (opt, idx) {
          const id = "tf-mcq-" + String(idx);
          const checked = savedFollowup === opt.value ? " checked" : "";
          out.push("<label for='" + esc(id) + "'>");
          out.push("<input id='" + esc(id) + "' type='radio' name='tf-followup' value='" + esc(opt.value) + "'" + checked + " /> ");
          out.push(esc(opt.label));
          out.push("</label>");
        });
        out.push("</div>");
        out.push("<div class='ncs-error' data-error='followup'></div>");
        out.push("</div>");
      }
      out.push("<div class='ncs-error' data-error='table'></div>");
      out.push("</div>");
      return out.join("");
    }

    function notifyChange() {
      if (typeof opts.onChange === "function") {
        opts.onChange();
      }
    }

    function bind() {
      if (typeof opts.onChange === "function") {
        container.querySelectorAll(".tf-input").forEach(function (el) {
          el.addEventListener("input", notifyChange);
          el.addEventListener("change", notifyChange);
        });
        container.querySelectorAll("input[name='tf-followup']").forEach(function (el) {
          el.addEventListener("change", notifyChange);
        });
      }

      if (opts.locked) {
        container.querySelectorAll(".tf-input").forEach(function (el) {
          el.disabled = true;
        });
      }
    }

    function clearErrors() {
      container.querySelectorAll(".ncs-error").forEach(function (el) {
        el.textContent = "";
      });
    }

    function setRowError(rowId, message) {
      const el = container.querySelector("[data-row-error='" + String(rowId) + "']");
      if (el) {
        el.textContent = message;
      }
    }

    function setTableError(message) {
      const el = container.querySelector(".ncs-error[data-error='table']");
      if (el) {
        el.textContent = message;
      }
    }

    function getResponsePayload() {
      const cells = {};
      const rowValues = [];

      rows.forEach(function (row, rowIndex) {
        const rowId = row.id || String(rowIndex);
        const rowObj = { rowId: rowId, cells: {} };

        columns.forEach(function (col) {
          const key = cellKey(rowId, col.id);
          const editable = col.editable === true && col.readOnly !== true;
          if (editable) {
            const input = container.querySelector("[data-cell='" + key + "']");
            const raw = input ? input.value.trim() : "";
            const value = raw === "" ? null : asNumber(raw);
            cells[key] = value;
            rowObj.cells[col.id] = value;
          } else {
            rowObj.cells[col.id] = row.values && row.values[col.id] !== undefined ? row.values[col.id] : null;
          }
        });

        rowValues.push(rowObj);
      });

      return {
        componentType: "table-fill",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        responses: {
          rows: rowValues,
          cells: cells,
          followupMcq: cfg.followupMcq
            ? {
                id: cfg.followupMcq.id || "followup",
                selected: (function () {
                  const selected = container.querySelector("input[name='tf-followup']:checked");
                  return selected ? selected.value : null;
                })()
              }
            : null
        },
        meta: {
          scoringMode: cfg.grading && cfg.grading.scoringMode ? cfg.grading.scoringMode : "cell",
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      clearErrors();
      const payload = getResponsePayload();
      let valid = true;

      const validation = cfg.validation || {};
      const requiredEditable = validation.requireAllEditable !== false;

      if (requiredEditable) {
        rows.forEach(function (row, rowIndex) {
          const rowId = row.id || String(rowIndex);
          let rowMissing = false;
          columns.forEach(function (col) {
            const editable = col.editable === true && col.readOnly !== true;
            if (!editable) {
              return;
            }
            const key = cellKey(rowId, col.id);
            const value = payload.responses.cells[key];
            if (value === null || value === undefined || Number.isNaN(value)) {
              rowMissing = true;
            }
          });
          if (rowMissing) {
            valid = false;
            setRowError(rowId, "Complete editable cells for this row.");
          }
        });
      }

      const rowRules = Array.isArray(validation.rowRules) ? validation.rowRules : [];
      rowRules.forEach(function (rule) {
        const rowId = rule.rowId;
        const checks = Array.isArray(rule.cells) ? rule.cells : [];
        for (let i = 0; i < checks.length; i++) {
          const check = checks[i];
          const key = cellKey(rowId, check.id);
          const value = payload.responses.cells[key];
          if (check.required && (value === null || Number.isNaN(value))) {
            valid = false;
            setRowError(rowId, check.message || "Invalid row value.");
            break;
          }
          if (value !== null && Number.isFinite(check.min) && value < Number(check.min)) {
            valid = false;
            setRowError(rowId, check.message || "Value below allowed minimum.");
            break;
          }
          if (value !== null && Number.isFinite(check.max) && value > Number(check.max)) {
            valid = false;
            setRowError(rowId, check.message || "Value above allowed maximum.");
            break;
          }
        }
      });

      if (!valid) {
        setTableError("Fix validation errors before continuing.");
      }

      if (cfg.followupMcq && cfg.followupMcq.required) {
        const selected = payload.responses.followupMcq && payload.responses.followupMcq.selected;
        if (!selected) {
          valid = false;
          const followupErr = container.querySelector(".ncs-error[data-error='followup']");
          if (followupErr) {
            followupErr.textContent = "Required";
          }
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
      const scoringMode = grading.scoringMode === "row" ? "row" : "cell";
      const itemId = grading.itemId || "table_fill";

      const tableFillItem = {
        itemId: itemId,
        type: "table-fill",
        scoringMode: scoringMode,
        maxScore: grading.maxScore
      };

      if (scoringMode === "row") {
        tableFillItem.rows = Array.isArray(grading.rows) ? grading.rows : [];
      } else {
        tableFillItem.cells = Array.isArray(grading.cells) ? grading.cells : [];
      }

      const items = [tableFillItem];
      const answers = { table_fill: payload.responses.cells, [itemId]: payload.responses.cells };

      if (grading.followupMcq && cfg.followupMcq) {
        const mcqItemId = grading.followupMcq.itemId || (cfg.followupMcq.id || "followup");
        items.push({
          itemId: mcqItemId,
          type: "mcq",
          answerKey: grading.followupMcq.answerKey,
          maxScore: grading.followupMcq.maxScore || 1
        });
        answers[mcqItemId] = payload.responses.followupMcq ? payload.responses.followupMcq.selected : null;
      }

      return window.ScoringEngine.scoreItems(items, answers);
    }

    container.innerHTML = buildTable();
    bind();

    return {
      validate: validate,
      isAnswered: function () {
        return validate().valid;
      },
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.TableFill = {
    mount: mount
  };
})();
