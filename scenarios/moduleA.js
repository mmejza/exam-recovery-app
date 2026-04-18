(function (root) {
  "use strict";

  root.ModuleAScenarios = [
    {
      templateId: "A1-meal-kit-packing-line",
      title: "Meal-Kit Packing Line Balancing",
      context: "A meal-kit operation is redesigning a packing line to reduce waiting and improve throughput before evening dispatch.",
      learningTargets: [
        "Identify value-added vs non-value-added activity",
        "Compute takt time and staffing need",
        "Estimate flow efficiency"
      ],
      randomVars: {
        dailyDemand: { type: "int", min: 180, max: 320 },
        availableMinutes: { type: "int", min: 390, max: 450 },
        totalWorkContent: { type: "int", min: 95, max: 170 },
        vaMinutes: { type: "int", min: 38, max: 88 },
        nvaMinutes: { type: "int", min: 22, max: 74 },
        delayReason: {
          type: "choice",
          options: ["label reprint", "ingredient refill", "scanner reset", "tray shortage"]
        }
      },
      screens: [
        {
          id: "A1-S1",
          type: "numeric",
          title: "Takt Time",
          prompt: "Compute takt time in minutes per order.",
          formula: "Takt = availableMinutes / dailyDemand",
          hints: ["Use {{availableMinutes}} and {{dailyDemand}}."]
        },
        {
          id: "A1-S2",
          type: "dragdrop",
          title: "Waste Sorting",
          prompt: "Sort each activity into Value-Added or Waste.",
          zones: [
            { id: "va", label: "Value-Added" },
            { id: "waste", label: "Waste" }
          ],
          items: [
            { id: "seal", label: "Sealing meal-kit carton" },
            { id: "wait", label: "Waiting for {{delayReason}}" },
            { id: "pick", label: "Picking recipe inserts" },
            { id: "recount", label: "Recounting due to mismatch" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "A1-low-flow-efficiency",
          when: "vaMinutes / (vaMinutes + nvaMinutes) < 0.55",
          gotoScreenId: "A1-S2",
          note: "Emphasize waste sorting when flow efficiency is low."
        }
      ]
    },
    {
      templateId: "A2-campus-print-shop",
      title: "Campus Print Shop Flow Improvement",
      context: "The campus print shop sees heavy deadline spikes and wants to stabilize turnaround for student jobs.",
      learningTargets: [
        "Estimate queue pressure",
        "Classify causes of waiting",
        "Link staffing to takt"
      ],
      randomVars: {
        ordersPerDay: { type: "int", min: 110, max: 240 },
        openMinutes: { type: "int", min: 420, max: 540 },
        avgProcessing: { type: "float", min: 2.4, max: 5.8, decimals: 1 },
        setupLossMinutes: { type: "int", min: 20, max: 70 },
        urgentShare: { type: "float", min: 0.18, max: 0.42, decimals: 2 },
        bottleneckStation: {
          type: "choice",
          options: ["wide-format printer", "cutting table", "binding station", "proof desk"]
        }
      },
      screens: [
        {
          id: "A2-S1",
          type: "numeric",
          title: "Adjusted Takt",
          prompt: "Compute adjusted takt using openMinutes - setupLossMinutes as available time.",
          formula: "Adjusted takt = (openMinutes - setupLossMinutes) / ordersPerDay",
          hints: ["Bottleneck today is {{bottleneckStation}}."]
        },
        {
          id: "A2-S2",
          type: "dragdrop",
          title: "Quick Triage",
          prompt: "Classify each event as Value-Added or Waste.",
          zones: [
            { id: "va", label: "Value-Added" },
            { id: "waste", label: "Waste" }
          ],
          items: [
            { id: "trim", label: "Trimming final brochure edges" },
            { id: "rush", label: "Interrupting queue for urgent re-run" },
            { id: "proof", label: "Customer proof confirmation" },
            { id: "idle", label: "Idle waiting at {{bottleneckStation}}" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "A2-high-urgent-share",
          when: "urgentShare > 0.30",
          gotoScreenId: "A2-S2",
          note: "Higher urgent mix triggers waste triage focus."
        }
      ]
    }
    ,
    {
      templateId: "A3-clinic-patient-discharge",
      title: "Outpatient Clinic Discharge Flow",
      context: "A busy outpatient clinic wants to reduce patient wait time after treatment by streamlining its discharge process before the afternoon rush.",
      learningTargets: [
        "Identify value-added vs non-value-added activity",
        "Compute takt time and staffing need",
        "Estimate flow efficiency"
      ],
      randomVars: {
        dailyPatients: { type: "int", min: 120, max: 260 },
        clinicMinutes: { type: "int", min: 420, max: 510 },
        totalWorkContent: { type: "int", min: 80, max: 160 },
        vaMinutes: { type: "int", min: 35, max: 85 },
        nvaMinutes: { type: "int", min: 18, max: 68 },
        delayReason: {
          type: "choice",
          options: ["prescription printout queue", "insurance verification hold", "room turnover wait", "chart retrieval delay"]
        }
      },
      screens: [
        {
          id: "A3-S1",
          type: "numeric",
          title: "Takt Time",
          prompt: "Compute takt time in minutes per patient.",
          formula: "Takt = clinicMinutes / dailyPatients",
          hints: ["Use {{clinicMinutes}} available minutes and {{dailyPatients}} patients."]
        },
        {
          id: "A3-S2",
          type: "dragdrop",
          title: "Waste Sorting",
          prompt: "Sort each discharge activity into Value-Added or Waste.",
          zones: [
            { id: "va", label: "Value-Added" },
            { id: "waste", label: "Waste" }
          ],
          items: [
            { id: "instruct", label: "Nurse reviewing discharge instructions with patient" },
            { id: "wait", label: "Patient waiting due to {{delayReason}}" },
            { id: "rx", label: "Pharmacist dispensing prescribed medication" },
            { id: "reenter", label: "Re-entering data already captured during intake" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "A3-low-flow-efficiency",
          when: "vaMinutes / (vaMinutes + nvaMinutes) < 0.55",
          gotoScreenId: "A3-S2",
          note: "Emphasize waste sorting when flow efficiency is low."
        }
      ]
    },
    {
      templateId: "A4-fulfillment-center-packing",
      title: "E-Commerce Fulfillment Center Packing Line",
      context: "An e-commerce fulfillment center is preparing for a peak sales period and needs to rebalance its packing line to hit daily shipment targets.",
      learningTargets: [
        "Identify value-added vs non-value-added activity",
        "Compute takt time and staffing need",
        "Estimate flow efficiency"
      ],
      randomVars: {
        ordersPerShift: { type: "int", min: 800, max: 1800 },
        shiftMinutes: { type: "int", min: 420, max: 480 },
        totalWorkContent: { type: "int", min: 90, max: 175 },
        vaMinutes: { type: "int", min: 40, max: 90 },
        nvaMinutes: { type: "int", min: 20, max: 72 },
        delayReason: {
          type: "choice",
          options: ["conveyor jam", "tape gun refill", "label misread", "bin replenishment pause"]
        }
      },
      screens: [
        {
          id: "A4-S1",
          type: "numeric",
          title: "Takt Time",
          prompt: "Compute takt time in minutes per order for the shift.",
          formula: "Takt = shiftMinutes / ordersPerShift",
          hints: ["Use {{shiftMinutes}} and {{ordersPerShift}}."]
        },
        {
          id: "A4-S2",
          type: "dragdrop",
          title: "Waste Sorting",
          prompt: "Sort each packing line activity into Value-Added or Waste.",
          zones: [
            { id: "va", label: "Value-Added" },
            { id: "waste", label: "Waste" }
          ],
          items: [
            { id: "pack", label: "Placing items into shipping carton" },
            { id: "wait", label: "Line stoppage due to {{delayReason}}" },
            { id: "label", label: "Applying verified shipping label" },
            { id: "search", label: "Searching for correct box size" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "A4-low-flow-efficiency",
          when: "vaMinutes / (vaMinutes + nvaMinutes) < 0.55",
          gotoScreenId: "A4-S2",
          note: "Emphasize waste sorting when flow efficiency is low."
        }
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
