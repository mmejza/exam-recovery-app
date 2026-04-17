/*
  engine/scoring.test-examples.js
  Lightweight test examples for all supported scoring item types.
*/

(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./scoring"));
    return;
  }
  root.runScoringExamples = factory(root.ScoringEngine).runScoringExamples;
})(typeof window !== "undefined" ? window : globalThis, function (ScoringEngine) {
  "use strict";

  function assertEqual(actual, expected, label) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
      throw new Error(label + " failed. expected=" + JSON.stringify(expected) + " actual=" + JSON.stringify(actual));
    }
  }

  function pickCore(res) {
    return {
      itemScore: res.itemScore,
      maxScore: res.maxScore,
      percentage: res.percentage,
      feedbackCode: res.feedbackCode,
    };
  }

  function runScoringExamples() {
    const out = {};

    out.numeric = ScoringEngine.scoreItem(
      { type: "numeric", answer: 25, tolerance: 0.5, maxScore: 4 },
      24.7
    );
    assertEqual(pickCore(out.numeric), { itemScore: 4, maxScore: 4, percentage: 100, feedbackCode: "CORRECT" }, "numeric");

    out.mcq = ScoringEngine.scoreItem(
      { type: "mcq", answerKey: "B", maxScore: 2 },
      "C"
    );
    assertEqual(pickCore(out.mcq), { itemScore: 0, maxScore: 2, percentage: 0, feedbackCode: "WRONG_OPTION" }, "mcq");

    out.dropdownRow = ScoringEngine.scoreItem(
      { type: "dropdown-row", answerKey: { r1: "common", r2: "assignable" }, maxScore: 4 },
      { r1: "common", r2: "common" }
    );
    assertEqual(pickCore(out.dropdownRow), { itemScore: 2, maxScore: 4, percentage: 50, feedbackCode: "PARTIAL" }, "dropdown-row");

    out.dragDrop = ScoringEngine.scoreItem(
      {
        type: "drag-drop",
        answerKey: { a: "va", b: "waste", c: "va" },
        maxScore: 6,
      },
      { va: ["a", "b"], waste: ["c"] }
    );
    assertEqual(pickCore(out.dragDrop), { itemScore: 2, maxScore: 6, percentage: 33.33, feedbackCode: "PARTIAL" }, "drag-drop");

    out.ranking = ScoringEngine.scoreItem(
      {
        type: "ranking",
        correctOrder: ["inspect", "pack", "label", "ship"],
        maxScore: 8,
      },
      ["inspect", "label", "pack", "ship"]
    );
    assertEqual(pickCore(out.ranking), { itemScore: 4, maxScore: 8, percentage: 50, feedbackCode: "PARTIAL" }, "ranking");

    out.chartBucket = ScoringEngine.scoreItem(
      {
        type: "chart-bucket",
        answerKey: { p1: "in", p2: "out", p3: "in" },
        maxScore: 3,
      },
      { p1: "in", p2: "in", p3: "in" }
    );
    assertEqual(pickCore(out.chartBucket), { itemScore: 2, maxScore: 3, percentage: 66.67, feedbackCode: "PARTIAL" }, "chart-bucket");

    out.tableFillCell = ScoringEngine.scoreItem(
      {
        type: "table-fill",
        scoringMode: "cell",
        cells: [
          { id: "c1", answer: 10, tolerance: 0 },
          { id: "c2", answer: 20, tolerance: 1 },
        ],
        maxScore: 4,
      },
      { c1: 10, c2: 19.2 }
    );
    assertEqual(pickCore(out.tableFillCell), { itemScore: 4, maxScore: 4, percentage: 100, feedbackCode: "CORRECT" }, "table-fill-cell");

    out.tableFillRow = ScoringEngine.scoreItem(
      {
        type: "table-fill",
        scoringMode: "row",
        rows: [
          { cells: [ { id: "r1c1", answer: 5, tolerance: 0 }, { id: "r1c2", answer: 7, tolerance: 0 } ] },
          { cells: [ { id: "r2c1", answer: 3, tolerance: 0 }, { id: "r2c2", answer: 9, tolerance: 0 } ] },
        ],
        maxScore: 6,
      },
      { r1c1: 5, r1c2: 8, r2c1: 3, r2c2: 9 }
    );
    assertEqual(pickCore(out.tableFillRow), { itemScore: 3, maxScore: 6, percentage: 50, feedbackCode: "PARTIAL" }, "table-fill-row");

    out.branchFollowup = ScoringEngine.scoreItem(
      {
        type: "branch-followup",
        maxScore: 5,
        answerKeyByBranch: {
          high_variance: { type: "mcq", answerKey: "investigate" },
          stable_process: { type: "numeric", answer: 12, tolerance: 0.5 },
        },
      },
      {
        selectedBranch: "stable_process",
        answer: 11.7,
      }
    );
    assertEqual(pickCore(out.branchFollowup), { itemScore: 5, maxScore: 5, percentage: 100, feedbackCode: "CORRECT" }, "branch-followup");

    console.log("Scoring examples passed", out);
    return out;
  }

  return { runScoringExamples };
});
