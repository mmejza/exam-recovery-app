/*
  engine/scoring.js
  Reusable scoring engine for OM Recovery Lab.

  Supported types:
  - numeric
  - mcq
  - dropdown-row
  - drag-drop
  - ranking
  - chart-bucket
  - table-fill
  - branch-followup
*/

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }
  root.ScoringEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function roundPct(itemScore, maxScore) {
    if (!maxScore) {
      return 0;
    }
    return Math.round((itemScore / maxScore) * 10000) / 100;
  }

  function result(itemScore, maxScore, feedbackCode) {
    return {
      itemScore: Number(itemScore || 0),
      maxScore: Number(maxScore || 0),
      percentage: roundPct(Number(itemScore || 0), Number(maxScore || 0)),
      feedbackCode: feedbackCode,
    };
  }

  function feedbackFromRatio(score, max) {
    if (max <= 0) {
      return "NO_SCORE";
    }
    if (score <= 0) {
      return "INCORRECT";
    }
    if (score >= max) {
      return "CORRECT";
    }
    return "PARTIAL";
  }

  function scoreNumeric(item, response) {
    const max = Number(item.maxScore || 1);
    const student = asNumber(response);
    const correct = asNumber(item.answer);
    const tol = Number(item.tolerance || 0);

    if (student === null || correct === null) {
      return result(0, max, "INVALID_RESPONSE");
    }

    const ok = Math.abs(student - correct) <= tol;
    return result(ok ? max : 0, max, ok ? "CORRECT" : "OUT_OF_TOLERANCE");
  }

  function scoreMcq(item, response) {
    const max = Number(item.maxScore || 1);
    const ok = String(response) === String(item.answerKey);
    return result(ok ? max : 0, max, ok ? "CORRECT" : "WRONG_OPTION");
  }

  function scoreDropdownRow(item, response) {
    const answerKey = item.answerKey || {};
    const rowIds = Object.keys(answerKey);
    const max = Number(item.maxScore || rowIds.length || 1);
    const perRow = max / (rowIds.length || 1);

    let score = 0;
    for (let i = 0; i < rowIds.length; i++) {
      const rowId = rowIds[i];
      if (response && String(response[rowId]) === String(answerKey[rowId])) {
        score += perRow;
      }
    }

    score = Math.round(score * 1000) / 1000;
    return result(score, max, feedbackFromRatio(score, max));
  }

  function findZoneForItem(placementByZone, itemId) {
    const zones = Object.keys(placementByZone || {});
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i];
      const items = placementByZone[zone] || [];
      if (Array.isArray(items) && items.indexOf(itemId) >= 0) {
        return zone;
      }
    }
    return null;
  }

  function scoreDragDrop(item, response) {
    const answerKey = item.answerKey || {};
    const itemIds = Object.keys(answerKey);
    const max = Number(item.maxScore || itemIds.length || 1);
    const perCard = max / (itemIds.length || 1);

    let score = 0;
    for (let i = 0; i < itemIds.length; i++) {
      const itemId = itemIds[i];
      const expectedZone = answerKey[itemId];

      // Supports either shape:
      // 1) { itemId: zoneId }
      // 2) { zoneId: [itemId, ...] }
      let studentZone = null;
      if (response && typeof response === "object" && !Array.isArray(response)) {
        if (Object.prototype.hasOwnProperty.call(response, itemId) && typeof response[itemId] === "string") {
          studentZone = response[itemId];
        } else {
          studentZone = findZoneForItem(response, itemId);
        }
      }

      if (studentZone === expectedZone) {
        score += perCard;
      }
    }

    score = Math.round(score * 1000) / 1000;
    return result(score, max, feedbackFromRatio(score, max));
  }

  function scoreRanking(item, response) {
    const correct = item.correctOrder || [];
    const student = Array.isArray(response) ? response : [];
    const max = Number(item.maxScore || correct.length || 1);
    const perPosition = max / (correct.length || 1);

    let score = 0;
    for (let i = 0; i < correct.length; i++) {
      if (student[i] === correct[i]) {
        score += perPosition;
      }
    }

    score = Math.round(score * 1000) / 1000;
    return result(score, max, feedbackFromRatio(score, max));
  }

  function scoreChartBucket(item, response) {
    // answerKey shape: { pointId: bucketId }
    const answerKey = item.answerKey || {};
    const pointIds = Object.keys(answerKey);
    const max = Number(item.maxScore || pointIds.length || 1);
    const perPoint = max / (pointIds.length || 1);

    let score = 0;
    for (let i = 0; i < pointIds.length; i++) {
      const pointId = pointIds[i];
      const expectedBucket = String(answerKey[pointId]);
      const got = response ? String(response[pointId]) : "";
      if (got === expectedBucket) {
        score += perPoint;
      }
    }

    score = Math.round(score * 1000) / 1000;
    return result(score, max, feedbackFromRatio(score, max));
  }

  function scoreTableFill(item, response) {
    const mode = item.scoringMode === "row" ? "row" : "cell";

    if (mode === "row") {
      const rows = item.rows || [];
      const max = Number(item.maxScore || rows.length || 1);
      const perRow = max / (rows.length || 1);

      let score = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.cells || [];
        const rowOk = cells.every(function (cell) {
          const student = asNumber(response ? response[cell.id] : null);
          const correct = asNumber(cell.answer);
          const tol = Number(cell.tolerance || 0);
          return student !== null && correct !== null && Math.abs(student - correct) <= tol;
        });

        if (rowOk) {
          score += perRow;
        }
      }

      score = Math.round(score * 1000) / 1000;
      return result(score, max, feedbackFromRatio(score, max));
    }

    const cells = item.cells || [];
    const max = Number(item.maxScore || cells.length || 1);
    const perCell = max / (cells.length || 1);

    let score = 0;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const student = asNumber(response ? response[cell.id] : null);
      const correct = asNumber(cell.answer);
      const tol = Number(cell.tolerance || 0);
      if (student !== null && correct !== null && Math.abs(student - correct) <= tol) {
        score += perCell;
      }
    }

    score = Math.round(score * 1000) / 1000;
    return result(score, max, feedbackFromRatio(score, max));
  }

  function scoreBranchFollowup(item, response) {
    // item.answerKeyByBranch shape:
    // {
    //   branchIdA: { type: 'mcq'|'numeric'|..., ...ruleFields },
    //   branchIdB: { ... }
    // }
    const selectedBranch = response ? response.selectedBranch : null;
    const answer = response ? response.answer : undefined;
    const branchRules = item.answerKeyByBranch || {};
    const branchRule = selectedBranch ? branchRules[selectedBranch] : null;

    const max = Number(item.maxScore || 1);

    if (!selectedBranch) {
      return result(0, max, "MISSING_BRANCH");
    }

    if (!branchRule) {
      return result(0, max, "UNKNOWN_BRANCH");
    }

    // Branch rule can be a literal answer key or nested typed rule.
    if (!branchRule.type) {
      const ok = String(answer) === String(branchRule.answerKey);
      return result(ok ? max : 0, max, ok ? "CORRECT" : "WRONG_FOR_BRANCH");
    }

    const nestedItem = Object.assign({ maxScore: max }, branchRule);
    return scoreItem(nestedItem, answer);
  }

  function scoreItem(item, response) {
    if (!item || !item.type) {
      return result(0, 0, "INVALID_ITEM");
    }

    switch (item.type) {
      case "numeric":
        return scoreNumeric(item, response);
      case "mcq":
        return scoreMcq(item, response);
      case "dropdown-row":
        return scoreDropdownRow(item, response);
      case "drag-drop":
      case "dragdrop":
        return scoreDragDrop(item, response);
      case "ranking":
        return scoreRanking(item, response);
      case "chart-bucket":
        return scoreChartBucket(item, response);
      case "table-fill":
        return scoreTableFill(item, response);
      case "branch-followup":
        return scoreBranchFollowup(item, response);
      default:
        return result(0, Number(item.maxScore || 0), "UNSUPPORTED_TYPE");
    }
  }

  function scoreItems(items, answersByItemId) {
    const list = Array.isArray(items) ? items : [];
    const answers = answersByItemId || {};

    let totalScore = 0;
    let totalMax = 0;
    const byItemId = {};

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const itemId = item.itemId || "item_" + i;
      const scored = scoreItem(item, answers[itemId]);
      byItemId[itemId] = scored;
      totalScore += scored.itemScore;
      totalMax += scored.maxScore;
    }

    totalScore = Math.round(totalScore * 1000) / 1000;
    totalMax = Math.round(totalMax * 1000) / 1000;

    return {
      itemScore: totalScore,
      maxScore: totalMax,
      percentage: roundPct(totalScore, totalMax),
      feedbackCode: feedbackFromRatio(totalScore, totalMax),
      byItemId: byItemId,
    };
  }

  return {
    scoreItem,
    scoreItems,
  };
});
