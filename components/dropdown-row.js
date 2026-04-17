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

  function mount(container, screenConfig, savedPayload, options) {
    const cfg = screenConfig || {};
    const opts = options || {};
    const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    const choices = Array.isArray(cfg.choices) ? cfg.choices : [];

    const saved = savedPayload && savedPayload.responses ? savedPayload.responses : {};
    const savedMap = saved.rowSelections || {};

    function render() {
      const html = [];
      html.push("<div class='dr-root'>");
      html.push("<h3>" + esc(cfg.title || cfg.scenarioTitle || "Row Classification") + "</h3>");
      if (cfg.prompt) {
        html.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }

      html.push("<table class='data-table dr-table'>");
      html.push("<thead><tr><th>" + esc(cfg.rowHeader || "Row") + "</th><th>" + esc(cfg.choiceHeader || "Classification") + "</th></tr></thead><tbody>");
      rows.forEach(function (row, idx) {
        const rowId = row.id || ("r" + String(idx + 1));
        html.push("<tr>");
        html.push("<td>" + esc(row.label || rowId) + "</td>");
        html.push("<td>");
        html.push("<select class='dr-select' data-row='" + esc(rowId) + "'" + (opts.locked ? " disabled" : "") + ">");
        html.push("<option value=''>Select...</option>");
        choices.forEach(function (ch) {
          const selected = savedMap[rowId] === ch.value ? " selected" : "";
          html.push("<option value='" + esc(ch.value) + "'" + selected + ">" + esc(ch.label) + "</option>");
        });
        html.push("</select>");
        html.push("</td>");
        html.push("</tr>");
      });
      html.push("</tbody></table>");
      html.push("<div class='ncs-error' data-error='dropdownRows'></div>");
      html.push("</div>");

      container.innerHTML = html.join("");

      if (typeof opts.onChange === "function") {
        container.querySelectorAll(".dr-select").forEach(function (el) {
          el.addEventListener("change", opts.onChange);
        });
      }
    }

    function getSelections() {
      const out = {};
      rows.forEach(function (row, idx) {
        const rowId = row.id || ("r" + String(idx + 1));
        const select = container.querySelector(".dr-select[data-row='" + rowId + "']");
        out[rowId] = select ? (select.value || null) : null;
      });
      return out;
    }

    function getResponsePayload() {
      return {
        componentType: "dropdown-row",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        responses: {
          rowSelections: getSelections()
        },
        meta: {
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      const errorEl = container.querySelector(".ncs-error[data-error='dropdownRows']");
      if (errorEl) {
        errorEl.textContent = "";
      }

      const selections = getSelections();
      const allDone = Object.keys(selections).every(function (k) {
        return selections[k];
      });

      if (!allDone) {
        if (errorEl) {
          errorEl.textContent = "Complete all row classifications.";
        }
        return { valid: false, payload: getResponsePayload() };
      }

      return { valid: true, payload: getResponsePayload() };
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

      const grading = cfg.grading || {};
      const itemId = grading.itemId || "dropdown_row";
      const answer = getSelections();
      return window.ScoringEngine.scoreItems(
        [
          {
            itemId: itemId,
            type: "dropdown-row",
            answerKey: grading.answerKey || {},
            maxScore: grading.maxScore || Object.keys(grading.answerKey || {}).length || 1
          }
        ],
        { [itemId]: answer }
      );
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

  window.DropdownRow = {
    mount: mount
  };
})();/* =====================================================
   components/dropdown-row.js
   Per-row dropdown classification widget.

   screen.question shape:
   {
     columns: ['Scenario', 'Classification'],
     rows: [{ id, text }],
     options: [{ value, label }]
   }

   getAnswer() → { rowId: selectedValue }
   ===================================================== */

const DropdownRowWidget = (() => {

  function render(container, screen, saved) {
    const { columns, rows, options } = screen.question;
    const savedMap = (saved && typeof saved === 'object') ? saved : {};

    const optHTML = options.map(o =>
      `<option value="${_esc(o.value)}">${_esc(o.label)}</option>`
    ).join('');

    const rowsHTML = rows.map(row => {
      const sel = savedMap[row.id] || '';
      return `
        <tr>
          <td>${_esc(row.text)}</td>
          <td>
            <select class="row-select" id="dr-${row.id}" data-row-id="${row.id}">
              <option value="">— select —</option>
              ${optHTML}
            </select>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="dropdown-table">
        <thead>
          <tr>${columns.map(c => `<th>${_esc(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>
      <button class="btn-check" id="dr-check-${screen.id}" style="margin-top:12px;">Check Answers</button>
      <div class="feedback hide" id="dr-fb-${screen.id}"></div>`;

    // Restore saved selections
    for (const [rowId, val] of Object.entries(savedMap)) {
      const el = document.getElementById(`dr-${rowId}`);
      if (el) el.value = val;
    }

    document.getElementById(`dr-check-${screen.id}`)
      .addEventListener('click', () => _check(screen));
  }

  function _check(screen) {
    const key = screen.answer.rows; // { rowId: correctValue }
    const fb  = document.getElementById(`dr-fb-${screen.id}`);
    let correct = 0, total = Object.keys(key).length;

    for (const [rowId, correctVal] of Object.entries(key)) {
      const el = document.getElementById(`dr-${rowId}`);
      if (!el) continue;
      const student = el.value;
      el.classList.remove('correct', 'wrong');
      if (student === correctVal) {
        el.classList.add('correct');
        correct++;
      } else if (student) {
        el.classList.add('wrong');
      }
    }

    if (fb) {
      if (correct === total) {
        fb.className = 'feedback correct';
        fb.textContent = `✓ All ${total} correct!`;
      } else {
        fb.className = 'feedback incorrect';
        fb.textContent = `${correct}/${total} correct. Highlighted rows show errors.`;
      }
    }
  }

  function getAnswer(screen) {
    const out = {};
    for (const row of screen.question.rows) {
      const el = document.getElementById(`dr-${row.id}`);
      if (el) out[row.id] = el.value;
    }
    return out;
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, getAnswer };
})();
