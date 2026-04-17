/* =====================================================
   engine/grader.js  —  Auto-grading engine
   Supports: numeric, classify (dragdrop/dropdown-row),
             multi-select (chart-plot), table-fill
   ===================================================== */

const Grader = (function () {

  /**
   * Grade a single screen's answer against its key.
   *
   * @param {object} screen   — screen definition (has .type, .answer, .grading)
   * @param {*}      response — student response (shape depends on type)
   * @returns {{ earned: number, possible: number, pct: number, details: object }}
   */
  function gradeScreen(screen, response) {
    if (response === null || response === undefined) {
      return _result(0, screen.points, {});
    }

    switch (screen.type) {
      case 'numeric':       return _gradeNumeric(screen, response);
      case 'multi-numeric': return _gradeMultiNumeric(screen, response);
      case 'dragdrop':      return _gradeClassify(screen, response);
      case 'dropdown-row':  return _gradeDropdownRow(screen, response);
      case 'chart-plot':    return _gradeMultiSelect(screen, response);
      case 'table-fill':    return _gradeTableFill(screen, response);
      default:              return _result(0, screen.points, {});
    }
  }

  /** Grade a module: array of screens + answers map → totals */
  function gradeModule(screens, answers) {
    let earned = 0, possible = 0;
    const details = {};
    for (const s of screens) {
      const r = gradeScreen(s, answers[s.id]);
      earned   += r.earned;
      possible += r.possible;
      details[s.id] = r;
    }
    const pct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    return { earned, possible, pct, details };
  }

  /* ── helpers ── */

  function _result(earned, possible, details) {
    const pct = possible > 0 ? Math.round((earned / possible) * 100) : 0;
    return { earned, possible, pct, details };
  }

  /* single numeric */
  function _gradeNumeric(screen, response) {
    const val     = Number(response);
    const correct = screen.answer.value;
    const tol     = screen.grading.tolerance || 0;
    if (isNaN(val)) return _result(0, screen.points, { correct, student: response });

    const diff = Math.abs(val - correct);
    let earned  = 0;

    if (diff <= tol) {
      earned = screen.points; // full credit
    } else if (screen.grading.partialTolerance && diff <= screen.grading.partialTolerance) {
      earned = Math.round(screen.points * 0.5); // half credit
    }

    return _result(earned, screen.points, { correct, student: val, diff });
  }

  /* multiple numeric sub-questions: response = { key: value, ... } */
  function _gradeMultiNumeric(screen, response) {
    const keys     = screen.answer.keys; // array of {id, value, tolerance, points}
    let earned = 0, possible = 0;
    const details = {};

    for (const k of keys) {
      possible += k.points;
      const val  = Number(response[k.id]);
      const diff = Math.abs(val - k.value);
      const tol  = k.tolerance || 0;
      let pts = 0;
      if (!isNaN(val) && diff <= tol) {
        pts = k.points;
      } else if (!isNaN(val) && k.partialTol && diff <= k.partialTol) {
        pts = Math.round(k.points * 0.5);
      }
      earned += pts;
      details[k.id] = { correct: k.value, student: val, diff, earned: pts };
    }

    return _result(earned, possible, details);
  }

  /* classify: response = { zoneId: [itemId, ...], ... }  */
  function _gradeClassify(screen, response) {
    const key       = screen.answer.classification; // { itemId: correctZoneId }
    const ptsEach   = screen.points / Object.keys(key).length;
    let earned = 0;
    const details   = {};

    for (const [itemId, correctZone] of Object.entries(key)) {
      // find which zone the student placed this item
      let studentZone = null;
      for (const [zone, items] of Object.entries(response)) {
        if (Array.isArray(items) && items.includes(itemId)) { studentZone = zone; break; }
      }
      const correct = studentZone === correctZone;
      const pts     = correct ? ptsEach : 0;
      earned += pts;
      details[itemId] = { correct: correctZone, student: studentZone, ok: correct, pts };
    }

    return _result(Math.round(earned), screen.points, details);
  }

  /* dropdown per row: response = { rowId: selectedValue } */
  function _gradeDropdownRow(screen, response) {
    const key     = screen.answer.rows; // { rowId: correctValue }
    const ptsEach = screen.points / Object.keys(key).length;
    let earned = 0;
    const details = {};

    for (const [rowId, correct] of Object.entries(key)) {
      const student = response[rowId];
      const ok      = student === correct;
      const pts     = ok ? ptsEach : 0;
      earned += pts;
      details[rowId] = { correct, student, ok, pts };
    }
    return _result(Math.round(earned), screen.points, details);
  }

  /* chart multi-select: response = [index, index, ...]  */
  function _gradeMultiSelect(screen, response) {
    const correctSet  = new Set(screen.answer.flagged);
    const studentSet  = new Set(Array.isArray(response) ? response : []);
    const totalItems  = screen.answer.totalPoints || correctSet.size * 2;

    let correct = 0, false_pos = 0;
    for (const idx of correctSet) {
      if (studentSet.has(idx)) correct++;
    }
    for (const idx of studentSet) {
      if (!correctSet.has(idx)) false_pos++;
    }

    // Points: (correct hits - false positives) / total correct × screen.points, min 0
    const raw    = Math.max(0, correct - false_pos);
    const earned = Math.round((raw / correctSet.size) * screen.points);

    return _result(Math.min(earned, screen.points), screen.points, {
      hit: correct, miss: correctSet.size - correct, falsePos: false_pos,
    });
  }

  /* table fill: response = { cellId: value } */
  function _gradeTableFill(screen, response) {
    const cells   = screen.answer.cells; // [{ id, value, tolerance, points }]
    let earned = 0, possible = 0;
    const details = {};

    for (const c of cells) {
      possible += c.points;
      const val  = Number(response[c.id]);
      const diff = Math.abs(val - c.value);
      const tol  = c.tolerance || 0;
      let pts = 0;
      if (!isNaN(val) && diff <= tol) pts = c.points;
      else if (!isNaN(val) && c.partialTol && diff <= c.partialTol) pts = Math.round(c.points * 0.5);
      earned += pts;
      details[c.id] = { correct: c.value, student: val, diff, earned: pts };
    }
    return _result(earned, possible, details);
  }

  /**
   * Convert total module score percentage to recovery credit.
   * Scale: 0-100% module score → 0-10 recovery points (linear).
   */
  function toRecoveryCredit(totalEarned, totalPossible, maxRecovery = 10) {
    if (totalPossible === 0) return 0;
    const pct = totalEarned / totalPossible;
    return Math.round(pct * maxRecovery * 10) / 10; // one decimal
  }

  return { gradeScreen, gradeModule, toRecoveryCredit };
})();
