/* =====================================================
   modules/module-c/index.js  —  Inventory & Supply Chain
   Four screens:
     C1 — Inventory Type Classification (dragdrop)
     C2 — Inventory Turns & Days of Supply (multi-numeric)
     C3 — Holding Cost & EOQ (multi-numeric)
     C4 — Speed-Inventory Tradeoff (table-fill)
   ===================================================== */

const ModuleC = (function () {

  const LABEL      = 'Module C — Inventory & Supply Chain';
  const SHORT      = 'Mod C: Inventory';
  const MOD_CLASS  = 'mod-c';
  const TIME_LIMIT = 20 * 60;
  const POINTS_EACH = 25;

  /* ── Inventory item pools ── */
  const RM_POOL = [
    { id:'rm1', text: 'Steel coils awaiting cutting', color:'#b5610d' },
    { id:'rm2', text: 'Bulk resin pellets in silo', color:'#b5610d' },
    { id:'rm3', text: 'Unprocessed lumber in yard', color:'#b5610d' },
    { id:'rm4', text: 'Electronic components in receiving dock', color:'#b5610d' },
    { id:'rm5', text: 'Cotton bales before spinning', color:'#b5610d' },
  ];

  const WIP_POOL = [
    { id:'wip1', text: 'Partly welded frames on assembly line', color:'#856404' },
    { id:'wip2', text: 'Circuit boards awaiting solder inspection', color:'#856404' },
    { id:'wip3', text: 'Painted bodies waiting final trim', color:'#856404' },
    { id:'wip4', text: 'Machined parts between stations', color:'#856404' },
    { id:'wip5', text: 'Fabric cut pieces waiting sewing', color:'#856404' },
  ];

  const FG_POOL = [
    { id:'fg1', text: 'Boxed units in finished goods warehouse', color:'#2e6b5e' },
    { id:'fg2', text: 'Palletized product awaiting shipping', color:'#2e6b5e' },
    { id:'fg3', text: 'Completed assemblies in dispatch area', color:'#2e6b5e' },
    { id:'fg4', text: 'Labeled cartons in DC ready for delivery', color:'#2e6b5e' },
    { id:'fg5', text: 'Tested units staged for customer pickup', color:'#2e6b5e' },
  ];

  /* ── C1: Inventory Type Classification ── */
  function _genInventoryTypes(rng) {
    const rmItems  = rng.sample(RM_POOL,  3);
    const wipItems = rng.sample(WIP_POOL, 2);
    const fgItems  = rng.sample(FG_POOL,  2);
    const allItems = rng.shuffle([...rmItems, ...wipItems, ...fgItems]);

    const classification = {};
    rmItems.forEach(i  => classification[i.id] = 'rm');
    wipItems.forEach(i => classification[i.id] = 'wip');
    fgItems.forEach(i  => classification[i.id] = 'fg');

    return {
      id:     'C1',
      type:   'dragdrop',
      title:  'Inventory Type Classification',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Inventory — Fundamentals',
        title: 'SwiftFlow Electronics: Inventory Audit',
        body: [
          'SwiftFlow Electronics manufactures consumer electronics across three production stages. ' +
          'The operations team is categorizing items found throughout the facility.',
          'Drag each item into the correct inventory category.',
        ],
        formulas: [
          `Raw Materials (RM):  inputs not yet entered production.\n\n` +
          `Work-In-Process (WIP):  partially transformed items\n` +
          `  between production stages.\n\n` +
          `Finished Goods (FG):  completed items ready for\n` +
          `  delivery or sale.`,
        ],
        tables: [],
      },
      question: {
        instruction: 'Classify each inventory item by dragging it to the correct zone.',
        items: allItems,
        zones: [
          { id: 'rm',  label: '📦 Raw Materials' },
          { id: 'wip', label: '🔧 Work-In-Process' },
          { id: 'fg',  label: '✅ Finished Goods' },
        ],
      },
      answer: { classification },
      grading: { partialCredit: true },
    };
  }

  /* ── C2: Inventory Turns & Days of Supply ── */
  function _genTurnsDOS(rng) {
    const avgInventory = rng.int(500_000, 5_000_000) / 100;          // $ value
    const cogsPerUnit  = rng.floatR(10, 80, 2);
    const annualUnits  = rng.int(5000, 80000);
    const cogs         = Math.round(cogsPerUnit * annualUnits);
    const turns        = Math.round((cogs / avgInventory) * 100) / 100;
    const dos          = Math.round((avgInventory / (cogs / 365)) * 10) / 10;

    return {
      id:     'C2',
      type:   'multi-numeric',
      title:  'Inventory Turns & Days of Supply',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Inventory — Performance Metrics',
        title: 'SwiftFlow Electronics: Inventory Efficiency',
        body: [
          'The CFO wants to evaluate inventory efficiency using two standard metrics: ' +
          'inventory turns and days of supply.',
        ],
        formulas: [
          `Inventory Turns = COGS / Average Inventory\n\n` +
          `Days of Supply  = Average Inventory / (COGS ÷ 365)\n` +
          `                = 365 / Inventory Turns`,
        ],
        tables: [
          {
            headers: ['Parameter', 'Value'],
            rows: [
              ['Annual COGS', `$${cogs.toLocaleString()}`],
              ['Average Inventory (at cost)', `$${avgInventory.toLocaleString()}`],
            ],
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Calculate inventory turns (2 decimal places) and days of supply (1 decimal place).',
        inputs: [
          { id: 'turns', label: 'Inventory Turns', unit: 'turns/yr', placeholder: '0.00', step: 0.01 },
          { id: 'dos',   label: 'Days of Supply',  unit: 'days',     placeholder: '0.0',  step: 0.1  },
        ],
      },
      answer: {
        keys: [
          { id: 'turns', value: turns, tolerance: 0.05, points: Math.round(POINTS_EACH / 2) },
          { id: 'dos',   value: dos,   tolerance: 1,    points: Math.round(POINTS_EACH / 2) },
        ],
      },
      grading: {},
    };
  }

  /* ── C3: Holding Cost & EOQ ── */
  function _genHoldingCostEOQ(rng) {
    const D   = rng.int(2000, 15000);         // annual demand (units)
    const S   = rng.int(20, 120);              // ordering cost ($)
    const C   = rng.floatR(5, 40, 2);         // unit cost ($)
    const i   = rng.pick([0.20, 0.25, 0.30]); // holding rate
    const H   = Math.round(C * i * 100) / 100; // holding cost per unit per year

    const eoq    = Math.round(Math.sqrt((2 * D * S) / H));
    const orders = Math.round((D / eoq) * 10) / 10;         // orders/yr
    const annualHoldCost = Math.round((eoq / 2) * H * 100) / 100;

    return {
      id:     'C3',
      type:   'multi-numeric',
      title:  'Holding Cost & EOQ',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Inventory — EOQ Model',
        title: 'SwiftFlow Electronics: Order Policy',
        body: [
          `SwiftFlow purchases component XC-${rng.int(100,999)} from a single supplier. ` +
          'Determine the Economic Order Quantity (EOQ), the annual number of orders, ' +
          'and the annual holding cost at EOQ.',
        ],
        formulas: [
          `H   = i × C   (holding cost per unit per year)\n\n` +
          `EOQ = √( 2DS / H )\n\n` +
          `Orders/yr  = D / EOQ\n\n` +
          `Annual Holding Cost = (EOQ / 2) × H`,
        ],
        tables: [
          {
            headers: ['Parameter', 'Symbol', 'Value'],
            rows: [
              ['Annual Demand',   'D', `${D.toLocaleString()} units/yr`],
              ['Ordering Cost',   'S', `$${S} per order`],
              ['Unit Cost',       'C', `$${C}`],
              ['Holding Rate',    'i', `${(i * 100).toFixed(0)}% of unit cost`],
              ['Holding Cost (H = i×C)', 'H', `$${H}/unit/yr`],
            ],
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Calculate EOQ (whole units), orders per year (1 dp), and annual holding cost.',
        inputs: [
          { id: 'eoq',      label: 'EOQ',              unit: 'units',   placeholder: '0',   step: 1    },
          { id: 'orders',   label: 'Orders / Year',    unit: 'orders',  placeholder: '0.0', step: 0.1  },
          { id: 'holdcost', label: 'Annual Holding $',  unit: '$',       placeholder: '0.00',step: 0.01 },
        ],
      },
      answer: {
        keys: [
          { id: 'eoq',      value: eoq,               tolerance: 2,    points: Math.round(POINTS_EACH * 0.4) },
          { id: 'orders',   value: orders,            tolerance: 0.2,  points: Math.round(POINTS_EACH * 0.3) },
          { id: 'holdcost', value: annualHoldCost,    tolerance: 5,    points: Math.round(POINTS_EACH * 0.3) },
        ],
      },
      grading: {},
    };
  }

  /* ── C4: Speed-Inventory Tradeoff ── */
  function _genSpeedInventoryTradeoff(rng) {
    // Two supplier options with different lead times → different inventory levels
    const dRate    = rng.int(100, 400);   // daily demand (units/day)
    const stdDev   = rng.int(10, 50);     // daily demand std dev
    const zScore   = rng.pick([1.65, 1.96, 2.05]); // service level z

    // Option A: fast supplier (shorter lead time, higher unit cost)
    const ltA      = rng.int(1, 4);       // lead time (days)
    const costA    = rng.floatR(8, 20, 2);
    const cycleA   = Math.round(dRate * ltA / 2);
    const safetyA  = Math.round(zScore * stdDev * Math.sqrt(ltA));
    const totalA   = cycleA + safetyA;

    // Option B: slow supplier (longer lead time, lower unit cost)
    const ltB      = rng.int(5, 14);
    const costB    = Math.round((costA - rng.floatR(1.5, 3.5, 2)) * 100) / 100;
    const cycleB   = Math.round(dRate * ltB / 2);
    const safetyB  = Math.round(zScore * stdDev * Math.sqrt(ltB));
    const totalB   = cycleB + safetyB;

    return {
      id:     'C4',
      type:   'table-fill',
      title:  'Speed-Inventory Tradeoff',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Inventory — Supplier Strategy',
        title: 'SwiftFlow Electronics: Supplier Selection',
        body: [
          'SwiftFlow is evaluating two supplier options for a key component. ' +
          'A faster supplier reduces lead time but at higher unit cost. ' +
          'Complete the inventory comparison table using the formulas shown.',
          `Use z = ${zScore} for the chosen service level in the safety stock formula.`,
        ],
        formulas: [
          `Cycle Stock     = Demand Rate × Lead Time / 2\n\n` +
          `Safety Stock    = z × σ_d × √(Lead Time)\n` +
          `  where σ_d = daily demand std dev\n\n` +
          `Total Inventory = Cycle Stock + Safety Stock`,
        ],
        tables: [
          {
            headers: ['Parameter', 'Value'],
            rows: [
              ['Daily Demand (avg)', `${dRate} units/day`],
              ['Daily Demand Std Dev (σ_d)', `${stdDev} units`],
              ['Service Level z', zScore],
            ],
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Complete all blank cells in the comparison table.',
        columns: ['Lead Time (days)', 'Unit Cost ($)', 'Cycle Stock (units)', 'Safety Stock (units)', 'Total Inventory (units)'],
        rows: [
          {
            label: 'Supplier A (Fast)',
            cells: [
              { given: true,  value: ltA,   unit: 'days' },
              { given: true,  value: costA, unit: '$' },
              { id: 'cycleA', given: false, value: cycleA, unit: 'units', tolerance: 2 },
              { id: 'safeA',  given: false, value: safetyA, unit: 'units', tolerance: 3 },
              { id: 'totalA', given: false, value: totalA, unit: 'units', tolerance: 4 },
            ],
          },
          {
            label: 'Supplier B (Slow)',
            cells: [
              { given: true,  value: ltB,   unit: 'days' },
              { given: true,  value: costB, unit: '$' },
              { id: 'cycleB', given: false, value: cycleB, unit: 'units', tolerance: 2 },
              { id: 'safeB',  given: false, value: safetyB, unit: 'units', tolerance: 3 },
              { id: 'totalB', given: false, value: totalB, unit: 'units', tolerance: 4 },
            ],
          },
        ],
      },
      answer: {
        cells: [
          { id: 'cycleA', value: cycleA,  tolerance: 2, points: Math.round(POINTS_EACH * 0.17) },
          { id: 'safeA',  value: safetyA, tolerance: 3, points: Math.round(POINTS_EACH * 0.17) },
          { id: 'totalA', value: totalA,  tolerance: 4, points: Math.round(POINTS_EACH * 0.17) },
          { id: 'cycleB', value: cycleB,  tolerance: 2, points: Math.round(POINTS_EACH * 0.17) },
          { id: 'safeB',  value: safetyB, tolerance: 3, points: Math.round(POINTS_EACH * 0.16) },
          { id: 'totalB', value: totalB,  tolerance: 4, points: Math.round(POINTS_EACH * 0.16) },
        ],
      },
      grading: {},
    };
  }

  /* ── Public ── */
  function generate(rng) {
    return {
      label:     LABEL,
      shortLabel: SHORT,
      modClass:  MOD_CLASS,
      timeLimit: TIME_LIMIT,
      screens: [
        _genInventoryTypes(rng),
        _genTurnsDOS(rng),
        _genHoldingCostEOQ(rng),
        _genSpeedInventoryTradeoff(rng),
      ],
    };
  }

  return { generate, LABEL, SHORT, MOD_CLASS };
})();
