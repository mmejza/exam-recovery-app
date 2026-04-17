(function () {
  "use strict";

  const SCREEN_IDS = {
    intro: "c01-intro",
    typesPurpose: "c02-types-purposes-inventory",
    turnsDos: "c03-turns-days-of-supply",
    holdingCost: "c04-holding-cost",
    speedTradeoff: "c05-speed-inventory-tradeoff",
    summary: "c06-summary"
  };

  const WEIGHTS = {};
  WEIGHTS[SCREEN_IDS.typesPurpose] = 20;
  WEIGHTS[SCREEN_IDS.turnsDos] = 30;
  WEIGHTS[SCREEN_IDS.holdingCost] = 25;
  WEIGHTS[SCREEN_IDS.speedTradeoff] = 25;

  function roundTo(value, decimals) {
    const d = Number.isFinite(decimals) ? decimals : 2;
    const m = Math.pow(10, d);
    return Math.round(Number(value) * m) / m;
  }

  function buildModuleCFromScenario(scenario, studentToken) {
    const vars = scenario && scenario.randomVars ? scenario.randomVars : {};
    const token = studentToken || "demo-student";

    const seeded = window.SeededRandom
      ? window.SeededRandom.createSeededRandom(token, 3999, "OM-C-MVP-2026")
      : {
          randomChoice: function (arr) { return arr[0]; },
          randomInt: function (a, b) { return Math.round((a + b) / 2); },
          shuffle: function (arr) { return arr.slice(); }
        };

    const annualDemand = Number(vars.annualDemand || 22000);
    const holdCost = Number(vars.holdCost || 2.8);
    const leadTimeDays = Number(vars.leadTimeDays || 10);
    const demandPerDay = Number(vars.demandPerDay || 95);
    const productFamily = String(vars.productFamily || "general merchandise");

    const avgInventoryUnits = seeded.randomInt(
      Math.max(800, Math.round(annualDemand / 22)),
      Math.max(1600, Math.round(annualDemand / 10))
    );

    const turns = roundTo(annualDemand / avgInventoryUnits, 2);
    const daysSupply = roundTo(avgInventoryUnits / Math.max(1, demandPerDay), 1);

    const skuRows = [
      {
        id: "sku1",
        values: {
          sku: "C-101",
          avgUnits: seeded.randomInt(900, 1500),
          unitCost: seeded.randomInt(12, 22),
          carryRate: 0.2,
          annualHoldingCost: ""
        }
      },
      {
        id: "sku2",
        values: {
          sku: "C-204",
          avgUnits: seeded.randomInt(700, 1200),
          unitCost: seeded.randomInt(18, 30),
          carryRate: 0.24,
          annualHoldingCost: ""
        }
      },
      {
        id: "sku3",
        values: {
          sku: "C-330",
          avgUnits: seeded.randomInt(600, 1100),
          unitCost: seeded.randomInt(26, 40),
          carryRate: 0.18,
          annualHoldingCost: ""
        }
      }
    ];

    const holdingRowDefs = skuRows.map(function (row) {
      const answer = roundTo(Number(row.values.avgUnits) * Number(row.values.unitCost) * Number(row.values.carryRate), 2);
      return {
        rowId: row.id,
        cells: [
          {
            id: row.id + "__annualHoldingCost",
            answer: answer,
            tolerance: 0.2
          }
        ]
      };
    });

    const dropdownRows = [
      { id: "r_cycle", label: "Batch replenishment stock for regular order quantity" },
      { id: "r_safety", label: "Buffer stock for demand and lead-time uncertainty" },
      { id: "r_pipeline", label: "Inventory currently in transit to destination" },
      { id: "r_decouple", label: "Inventory that isolates upstream/downstream stage mismatch" }
    ];

    const dropdownChoices = [
      { value: "cycle", label: "Cycle stock for replenishment rhythm" },
      { value: "safety", label: "Safety stock for variability protection" },
      { value: "pipeline", label: "Pipeline stock during transportation" },
      { value: "decoupling", label: "Decoupling stock between stages" }
    ];

    const dropdownAnswerKey = {
      r_cycle: "cycle",
      r_safety: "safety",
      r_pipeline: "pipeline",
      r_decouple: "decoupling"
    };

    const screens = [
      {
        id: SCREEN_IDS.intro,
        title: "C-01 Intro",
        intro: "Module C MVP focuses on inventory roles, turnover, holding cost, and speed-inventory tradeoffs. Complete C-02 through C-05 for auto-graded credit.",
        tag: "Module C",
        type: "intro"
      },
      {
        id: SCREEN_IDS.typesPurpose,
        moduleKey: "C",
        templateId: scenario ? scenario.templateId : "C-default",
        title: "C-02 Types and Purposes of Inventory",
        tag: "Module C - Inventory Classification",
        type: "dropdown-row",
        weight: WEIGHTS[SCREEN_IDS.typesPurpose],
        context: "Match each inventory situation to the best type/purpose classification.",
        prompt: "Select the best matching type for each row.",
        rowHeader: "Inventory Situation",
        choiceHeader: "Type and Purpose",
        rows: dropdownRows,
        choices: dropdownChoices,
        grading: {
          itemId: "c02_dropdown",
          answerKey: dropdownAnswerKey,
          maxScore: 4
        }
      },
      {
        id: SCREEN_IDS.turnsDos,
        moduleKey: "C",
        templateId: scenario ? scenario.templateId : "C-default",
        title: "C-03 Turns and Days-of-Supply",
        scenarioTitle: "Inventory Turnover",
        tag: "Module C - Turnover",
        type: "numeric-calc",
        weight: WEIGHTS[SCREEN_IDS.turnsDos],
        scenarioText: "Compute inventory turns and days-of-supply for the seeded scenario.",
        context: "Product family: " + productFamily + ".",
        formulaBox: "Turns = Annual Demand / Average Inventory,  Days-of-Supply = Average Inventory / Daily Demand",
        roundingInstruction: "Turns to 2 decimals; days-of-supply to 1 decimal.",
        dataTable: {
          headers: ["Metric", "Value"],
          rows: [
            ["Annual demand", String(annualDemand) + " units"],
            ["Average inventory", String(avgInventoryUnits) + " units"],
            ["Daily demand", String(demandPerDay) + " units/day"],
            ["Lead time", String(leadTimeDays) + " days"]
          ]
        },
        inputs: [
          { id: "turns", label: "Inventory turns", unit: "turns/year", required: true, placeholder: "e.g. 8.25" },
          { id: "daysSupply", label: "Days-of-supply", unit: "days", required: true, placeholder: "e.g. 42.5" }
        ],
        grading: {
          numericItems: [
            { itemId: "c03_turns", inputId: "turns", answer: turns, tolerance: 0.03, maxScore: 1 },
            { itemId: "c03_days_supply", inputId: "daysSupply", answer: daysSupply, tolerance: 0.1, maxScore: 1 }
          ]
        }
      },
      {
        id: SCREEN_IDS.holdingCost,
        moduleKey: "C",
        templateId: scenario ? scenario.templateId : "C-default",
        title: "C-04 Holding Cost",
        tag: "Module C - Cost of Inventory",
        type: "table-fill",
        weight: WEIGHTS[SCREEN_IDS.holdingCost],
        context: "Calculate annual holding cost for each SKU.",
        prompt: "Use: annual holding cost = avg units x unit cost x carrying rate.",
        columns: [
          { id: "sku", label: "SKU", readOnly: true },
          { id: "avgUnits", label: "Average Units", readOnly: true },
          { id: "unitCost", label: "Unit Cost ($)", readOnly: true },
          { id: "carryRate", label: "Carrying Rate", readOnly: true },
          { id: "annualHoldingCost", label: "Annual Holding Cost ($)", editable: true, placeholder: "0.00" }
        ],
        rows: skuRows,
        validation: {
          requireAllEditable: true,
          rowRules: skuRows.map(function (row) {
            return {
              rowId: row.id,
              cells: [
                {
                  id: "annualHoldingCost",
                  required: true,
                  min: 0,
                  max: 1000000,
                  message: "Enter a non-negative holding cost."
                }
              ]
            };
          })
        },
        grading: {
          itemId: "c04_holding_table",
          scoringMode: "row",
          maxScore: holdingRowDefs.length,
          rows: holdingRowDefs
        }
      },
      {
        id: SCREEN_IDS.speedTradeoff,
        moduleKey: "C",
        templateId: scenario ? scenario.templateId : "C-default",
        title: "C-05 Speed-Inventory Tradeoff",
        tag: "Module C - Tradeoff Decision",
        type: "branch-decision",
        weight: WEIGHTS[SCREEN_IDS.speedTradeoff],
        context: "Choose one policy and evaluate resulting performance effects.",
        prompt: "Select one action. Dashboard updates, decision locks, and branch follow-up appears.",
        dashboardTitle: "Inventory Network Dashboard",
        metrics: [
          { id: "leadTime", label: "Lead Time", baseline: leadTimeDays, unit: "days" },
          { id: "inventory", label: "Avg Inventory", baseline: avgInventoryUnits, unit: "units" },
          { id: "logisticsCost", label: "Logistics Cost", baseline: 18, unit: "$/unit" },
          { id: "serviceLevel", label: "Service Level", baseline: 95, unit: "%" }
        ],
        options: [
          { id: "faster_transport_higher_cost", label: "Faster transport / higher cost", description: "Premium lanes improve response speed.", delta: { leadTime: -2, inventory: -600, logisticsCost: 5, serviceLevel: 2 } },
          { id: "slower_transport_lower_cost", label: "Slower transport / lower cost", description: "Lower freight spend with longer transit.", delta: { leadTime: 2, inventory: 700, logisticsCost: -4, serviceLevel: -2 } },
          { id: "centralize_inventory", label: "Centralize inventory", description: "Pool stock to reduce total inventory.", delta: { leadTime: 1, inventory: -1400, logisticsCost: 1, serviceLevel: -1 } },
          { id: "decentralize_inventory", label: "Decentralize inventory", description: "Regional stock for faster local fulfillment.", delta: { leadTime: -1, inventory: 1200, logisticsCost: 2, serviceLevel: 2 } }
        ],
        followupByOption: {
          faster_transport_higher_cost: [
            { id: "f1", prompt: "What is the immediate cost impact?", options: [{ value: "cost_up", label: "Cost increases" }, { value: "cost_down", label: "Cost decreases" }] },
            { id: "f2", prompt: "What is the likely inventory effect?", options: [{ value: "inv_down", label: "Inventory tends to decrease" }, { value: "inv_up", label: "Inventory tends to increase" }] }
          ],
          slower_transport_lower_cost: [
            { id: "s1", prompt: "What happens to lead time?", options: [{ value: "lead_up", label: "Lead time increases" }, { value: "lead_down", label: "Lead time decreases" }] },
            { id: "s2", prompt: "What happens to freight spending?", options: [{ value: "cost_down", label: "Cost decreases" }, { value: "cost_up", label: "Cost increases" }] }
          ],
          centralize_inventory: [
            { id: "c1", prompt: "What is the expected inventory pooling effect?", options: [{ value: "inv_down", label: "Total inventory decreases" }, { value: "inv_up", label: "Total inventory increases" }] },
            { id: "c2", prompt: "What can happen to response speed?", options: [{ value: "speed_down", label: "Response speed may decrease" }, { value: "speed_up", label: "Response speed always increases" }] }
          ],
          decentralize_inventory: [
            { id: "d1", prompt: "How does service responsiveness usually change?", options: [{ value: "service_up", label: "Usually improves" }, { value: "service_down", label: "Usually worsens" }] },
            { id: "d2", prompt: "How does inventory position typically change?", options: [{ value: "inv_up", label: "Inventory tends to increase" }, { value: "inv_down", label: "Inventory tends to decrease" }] }
          ]
        },
        grading: {
          followupByOption: {
            faster_transport_higher_cost: [
              { questionId: "f1", itemId: "c05_f1", answerKey: "cost_up", maxScore: 1 },
              { questionId: "f2", itemId: "c05_f2", answerKey: "inv_down", maxScore: 1 }
            ],
            slower_transport_lower_cost: [
              { questionId: "s1", itemId: "c05_s1", answerKey: "lead_up", maxScore: 1 },
              { questionId: "s2", itemId: "c05_s2", answerKey: "cost_down", maxScore: 1 }
            ],
            centralize_inventory: [
              { questionId: "c1", itemId: "c05_c1", answerKey: "inv_down", maxScore: 1 },
              { questionId: "c2", itemId: "c05_c2", answerKey: "speed_down", maxScore: 1 }
            ],
            decentralize_inventory: [
              { questionId: "d1", itemId: "c05_d1", answerKey: "service_up", maxScore: 1 },
              { questionId: "d2", itemId: "c05_d2", answerKey: "inv_up", maxScore: 1 }
            ]
          }
        }
      },
      {
        id: SCREEN_IDS.summary,
        title: "C-06 Module Summary",
        tag: "Module C",
        type: "summary"
      }
    ];

    return {
      moduleKey: "C",
      templateId: scenario ? scenario.templateId : "C-default",
      title: scenario ? scenario.title : "Module C MVP",
      screens: screens,
      screenOrder: screens.map(function (s) { return s.id; }),
      questionScreenIds: [
        SCREEN_IDS.typesPurpose,
        SCREEN_IDS.turnsDos,
        SCREEN_IDS.holdingCost,
        SCREEN_IDS.speedTradeoff
      ],
      weights: WEIGHTS,
      derived: {
        turns: turns,
        daysSupply: daysSupply,
        holdCost: holdCost
      }
    };
  }

  window.ModuleCConfig = {
    ids: SCREEN_IDS,
    weights: WEIGHTS,
    buildModuleCFromScenario: buildModuleCFromScenario
  };

  const defaultScenario = window.ScenarioLoader
    ? window.ScenarioLoader.loadScenario("C", "demo-student", 1, "OM-C-MVP-2026")
    : null;
  const defaultBuild = buildModuleCFromScenario(defaultScenario, "demo-student");
  window.SCREENS = defaultBuild.screens;
})();
