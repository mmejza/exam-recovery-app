(function (root) {
  "use strict";

  root.ModuleCScenarios = [
    {
      templateId: "C1-sporting-goods-distributor",
      title: "Sporting Goods Distributor Replenishment",
      context: "A regional sporting goods distributor is balancing lead time risk and carrying cost across seasonal items.",
      learningTargets: [
        "Interpret inventory position",
        "Compare replenishment tradeoffs",
        "Connect service level to safety stock"
      ],
      randomVars: {
        annualDemand: { type: "int", min: 12000, max: 34000 },
        orderCost: { type: "int", min: 70, max: 210 },
        holdCost: { type: "float", min: 1.4, max: 4.8, decimals: 2 },
        leadTimeDays: { type: "int", min: 4, max: 19 },
  
        productFamily: {
          type: "choice",
          options: ["trail footwear", "team uniforms", "fitness accessories", "camping gear"]
        }
      },
      screens: [
        {
          id: "C1-S1",
          type: "numeric",
          title: "Cycle Stock Baseline",
          prompt: "Estimate cycle stock using EOQ/2 after computing EOQ.",
          formula: "EOQ = sqrt((2 * annualDemand * orderCost) / holdCost)",
          hints: ["Focus family: {{productFamily}}"]
        },
        {
          id: "C1-S2",
          type: "dragdrop",
          title: "Inventory Type Mapping",
          prompt: "Classify each inventory item type.",
          zones: [
            { id: "cycle", label: "Cycle Stock" },
            { id: "safety", label: "Safety Stock" },
            { id: "pipeline", label: "Pipeline Stock" }
          ],
          items: [
            { id: "truck", label: "Goods in transit for {{leadTimeDays}} days" },
            { id: "buffer", label: "Extra reserve for forecast error" },
            { id: "batch", label: "Regular replenishment batch" },
            { id: "dock", label: "Expected inbound already ordered" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "C1-long-lead",
          when: "leadTimeDays >= 12",
          gotoScreenId: "C1-S2",
          note: "Long lead time should emphasize stock type tradeoffs."
        }
      ]
    },
    {
      templateId: "C2-pet-supply-wholesaler",
      title: "Pet Supply Wholesaler Network Planning",
      context: "A pet supply wholesaler is evaluating service reliability versus inventory exposure across fulfillment nodes.",
      learningTargets: [
        "Estimate reorder implications",
        "Differentiate stock categories",
        "Evaluate lead-time variability impact"
      ],
      randomVars: {
        weeklyDemand: { type: "int", min: 900, max: 2600 },
        reorderIntervalWeeks: { type: "int", min: 1, max: 5 },
        holdRatePct: { type: "float", min: 0.16, max: 0.31, decimals: 2 },
        skuCost: { type: "float", min: 8.5, max: 26.5, decimals: 2 },
        serviceTarget: { type: "float", min: 0.92, max: 0.99, decimals: 2 },
        disruption: {
          type: "choice",
          options: ["port delay", "carrier miss", "supplier lot hold", "storm reroute"]
        }
      },
      screens: [
        {
          id: "C2-S1",
          type: "numeric",
          title: "Review-Period Demand",
          prompt: "Compute expected demand over the reorder interval.",
          formula: "Review demand = weeklyDemand * reorderIntervalWeeks",
          hints: ["Service target is {{serviceTarget}}."]
        },
        {
          id: "C2-S2",
          type: "dragdrop",
          title: "Node Stock Decision",
          prompt: "Classify each stock policy signal.",
          zones: [
            { id: "cycle", label: "Cycle Stock" },
            { id: "safety", label: "Safety Stock" },
            { id: "pipeline", label: "Pipeline Stock" }
          ],
          items: [
            { id: "forecast", label: "Regular replenishment quantity" },
            { id: "risk", label: "Extra inventory for {{disruption}} risk" },
            { id: "transit", label: "On-water supplier shipment" },
            { id: "reserve", label: "Protection for lead-time variance" }
          ]
        }
      ],
      branchRules: [
        {
          ruleId: "C2-high-service",
          when: "serviceTarget >= 0.97",
          gotoScreenId: "C2-S2",
          note: "Higher service targets tend to increase safety stock focus."
        }
      ]
    }
  ];
})(typeof window !== "undefined" ? window : globalThis);
