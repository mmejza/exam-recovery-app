(function (root) {
  "use strict";

  root.ModuleBScenarios = [
    {
      templateId: "B1-beverage-filling-line",
      title: "Beverage Filling Line Capability",
      context: "A beverage filler is missing target fill volume windows on one SKU and quality wants a fast capability read.",
      learningTargets: [
        "Distinguish common vs assignable causes",
        "Interpret capability context",
        "Use control chart cues"
      ],
      randomVars: {
        meanFill: { type: "float", min: 498.2, max: 501.4, decimals: 2 },
        stdevFill: { type: "float", min: 0.8, max: 1.9, decimals: 2 },
        usl: { type: "int", min: 503, max: 506 },
        lsl: { type: "int", min: 495, max: 498 },
        shiftIssue: {
          type: "choice",
          options: ["valve drift", "CO2 pressure spike", "operator reset", "sensor lag"]
        },
        specialPointIndex: { type: "int", min: 8, max: 19 },
        oocCount: { type: "choice", options: [1, 2, 3, 4] }
      },
      screens: [
        {
          id: "B1-S1",
          type: "numeric",
          title: "Capability Setup Check",
          prompt: "Compute tolerance band width (USL - LSL).",
          formula: "Band = usl - lsl",
          hints: ["Mean = {{meanFill}}, sigma = {{stdevFill}}"]
        },
        {
          id: "B1-S2",
          type: "dragdrop",
          title: "Cause Classification",
          prompt: "Classify each item as Common or Assignable cause.",
          zones: [
            { id: "common", label: "Common Cause" },
            { id: "assignable", label: "Assignable Cause" }
          ],
          items: [
            { id: "noise", label: "Minor ambient vibration" },
            { id: "issue", label: "{{shiftIssue}} at minute {{specialPointIndex}}" },
            { id: "wear", label: "Normal nozzle wear" },
            { id: "jam", label: "Sudden capper jam" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "B1-tight-band",
          when: "(usl - lsl) <= 8",
          gotoScreenId: "B1-S2",
          note: "Tighter tolerances prioritize special-cause review."
        }
      ]
    },
    {
      templateId: "B2-pharmacy-order-accuracy",
      title: "Pharmacy Order Accuracy Monitoring",
      context: "A central pharmacy tracks order-pick defects and wants better distinction between routine variation and special disruptions.",
      learningTargets: [
        "Classify variation sources",
        "Interpret defect trends",
        "Link process incidents to quality outcomes"
      ],
      randomVars: {
        dailyOrders: { type: "int", min: 420, max: 820 },
        observedDefects: { type: "int", min: 8, max: 38 },
        baselineDefectRate: { type: "float", min: 0.006, max: 0.028, decimals: 3 },
        outageMinutes: { type: "int", min: 12, max: 55 },
        incidentType: {
          type: "choice",
          options: ["scanner downtime", "barcode mismatch", "bin relabeling error", "network timeout"]
        },
        sampleSize: { type: "int", min: 40, max: 90 },
        oocCount: { type: "choice", options: [1, 2, 3, 4] }
      },
      screens: [
        {
          id: "B2-S1",
          type: "numeric",
          title: "Observed Defect Rate",
          prompt: "Compute observed defect rate = observedDefects / dailyOrders.",
          formula: "p = observedDefects / dailyOrders",
          hints: ["Compare with baseline {{baselineDefectRate}}."]
        },
        {
          id: "B2-S2",
          type: "dragdrop",
          title: "Signal Triage",
          prompt: "Classify each signal as Common or Assignable cause.",
          zones: [
            { id: "common", label: "Common Cause" },
            { id: "assignable", label: "Assignable Cause" }
          ],
          items: [
            { id: "background", label: "Normal pick complexity mix" },
            { id: "incident", label: "{{incidentType}} for {{outageMinutes}} minutes" },
            { id: "staffmix", label: "Routine shift mix variation" },
            { id: "labelswap", label: "Unexpected shelf label swap" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "B2-rate-spike",
          when: "(observedDefects / dailyOrders) > baselineDefectRate * 1.35",
          gotoScreenId: "B2-S2",
          note: "Spike above expected baseline triggers focused triage."
        }
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
