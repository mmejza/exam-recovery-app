/* =====================================================
   modules/module-a/index.js  —  Lean Operations
   Four screens:
     A1 — Waste Classification (dragdrop)
     A2 — VA Flow % (numeric)
     A3 — Kanban Cards (numeric)
     A4 — Takt Time & Manpower (multi-numeric)
   ===================================================== */

const ModuleA = (function () {

  const LABEL      = 'Module A — Lean Operations';
  const SHORT      = 'Mod A: Lean';
  const MOD_CLASS  = 'mod-a';
  const TIME_LIMIT = 20 * 60; // 20 minutes
  const POINTS_EACH = 25;     // 25 pts × 4 screens = 100 pts

  /* ── Item pools ── */
  const VA_POOL = [
    { id:'va1', text:'Welding structural frame to specification' },
    { id:'va2', text:'Assembling circuit board per customer BOM' },
    { id:'va3', text:'Machining part to drawing tolerances' },
    { id:'va4', text:'Painting product in customer-specified color' },
    { id:'va5', text:'Final assembly of product kit' },
    { id:'va6', text:'Cutting raw material to customer dimension' },
    { id:'va7', text:'Molding plastic component to blueprint' },
    { id:'va8', text:'Software compilation for customer build' },
  ];

  const NVA_POOL = [
    { id:'nva1', text:'Walking to retrieve tools from storage room' },
    { id:'nva2', text:'Waiting for approval signature from manager' },
    { id:'nva3', text:'Reworking defective parts after failed QC' },
    { id:'nva4', text:'Moving pallets between two warehouses' },
    { id:'nva5', text:'Overproducing units before customer order' },
    { id:'nva6', text:'Storing finished goods waiting for shipment' },
    { id:'nva7', text:'Printing reports nobody reviews' },
    { id:'nva8', text:'Searching for misplaced work order form' },
  ];

  const PROCESS_STEPS = [
    'Receiving', 'Machining', 'Assembly', 'Painting',
    'Inspection', 'Packaging', 'Shipping', 'Testing',
  ];

  /* ── Public generate() ── */
  function generate(rng) {
    return {
      label:     LABEL,
      shortLabel: SHORT,
      modClass:  MOD_CLASS,
      timeLimit: TIME_LIMIT,
      screens: [
        _genWaste(rng),
        _genVAFlow(rng),
        _genKanban(rng),
        _genTaktManpower(rng),
      ],
    };
  }

  /* ── A1: Waste Classification ── */
  function _genWaste(rng) {
    const vaItems  = rng.sample(VA_POOL,  4).map(i => ({ ...i, color:'var(--mod-a)' }));
    const nvaItems = rng.sample(NVA_POOL, 4).map(i => ({ ...i, color:'#c0392b' }));
    const allItems = rng.shuffle([...vaItems, ...nvaItems]);

    const classification = {};
    for (const i of vaItems)  classification[i.id] = 'va';
    for (const i of nvaItems) classification[i.id] = 'nva';

    return {
      id:     'A1',
      type:   'dragdrop',
      title:  'Waste Identification',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Lean — TIMWOOD Framework',
        title: 'Greenfield Manufacturing: Process Audit',
        body: [
          'Greenfield Manufacturing is conducting a lean audit of its production line. ' +
          'The operations team has listed eight activities currently performed on the floor.',
          'Your task is to classify each activity as <strong>Value-Added (VA)</strong> ' +
          '— activities the customer would pay for — or <strong>Non-Value-Added (NVA)</strong> ' +
          '— waste in any of the TIMWOOD categories.',
        ],
        formulas: [
          `Value-Added (VA): transforms material/information in a way\n` +
          `  the customer explicitly values and would pay for.\n\n` +
          `Non-Value-Added (NVA — TIMWOOD):\n` +
          `  T = Transport   I = Inventory   M = Motion\n` +
          `  W = Waiting     O = Overproduction\n` +
          `  O = Overprocessing  D = Defects/Rework`,
        ],
        tables: [],
      },
      question: {
        instruction: 'Drag each activity chip into the correct classification zone.',
        items: allItems,
        zones: [
          { id: 'va',  label: '✅ Value-Added (VA)' },
          { id: 'nva', label: '❌ Non-Value-Added (NVA)' },
        ],
      },
      answer: { classification },
      grading: { partialCredit: true },
    };
  }

  /* ── A2: VA Flow % ── */
  function _genVAFlow(rng) {
    const stepNames = rng.sample(PROCESS_STEPS, 5);
    const steps = stepNames.map(name => {
      const va    = rng.int(5, 25);         // VA time (min)
      const total = va + rng.int(5, 30);    // total ≥ va
      return { name, va, total };
    });

    const sumVA    = steps.reduce((s, r) => s + r.va,    0);
    const sumTotal = steps.reduce((s, r) => s + r.total, 0);
    const vaPct    = Math.round((sumVA / sumTotal) * 1000) / 10; // 1 dp

    return {
      id:     'A2',
      type:   'numeric',
      title:  'VA Flow Percentage',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Lean — Flow Analysis',
        title: 'Greenfield Manufacturing: Process Mapping',
        body: [
          'After mapping the production flow, the team recorded the Value-Added (VA) time ' +
          'and total elapsed time for each of the five process steps shown below.',
          'Calculate the <strong>VA Flow Percentage</strong> for this process.',
        ],
        formulas: [
          `VA Flow % = ( Σ VA Time ) / ( Σ Total Time ) × 100\n` +
          `           = ( ${sumVA} ) / ( ${sumTotal} ) × 100\n` +
          `           = ${vaPct} %`,
        ],
        tables: [
          {
            headers: ['Step', 'VA Time (min)', 'Total Time (min)'],
            rows: steps.map(s => [s.name, s.va, s.total]),
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Calculate the VA Flow % for this entire process. Round to one decimal place.',
        inputs: [
          { id: 'va_pct', label: 'VA Flow %', unit: '%', placeholder: '0.0', min: 0, max: 100, step: 0.1 },
        ],
      },
      answer: { value: vaPct },
      grading: { tolerance: 1 },
    };
  }

  /* ── A3: Kanban Cards ── */
  function _genKanban(rng) {
    const D = rng.int(50, 150);          // demand rate (units/hr)
    const L = rng.floatR(0.5, 3.0, 1);  // lead time (hrs)
    const alpha = rng.floatR(0.05, 0.20, 2); // safety factor
    const C = rng.int(10, 40);           // container size

    const N = Math.ceil((D * L * (1 + alpha)) / C);

    return {
      id:     'A3',
      type:   'numeric',
      title:  'Kanban Card Calculation',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Lean — Pull Systems',
        title: 'Greenfield Manufacturing: Kanban Sizing',
        body: [
          'The plant is implementing a kanban pull system between the machining cell and assembly line. ' +
          'Given the parameters below, calculate how many kanban cards to authorize.',
        ],
        formulas: [
          `N = ⌈ D × L × (1 + α) / C ⌉\n\n` +
          `Where:\n` +
          `  D = demand rate (units/hr)\n` +
          `  L = replenishment lead time (hrs)\n` +
          `  α = safety stock factor\n` +
          `  C = container / card size (units)\n` +
          `  ⌈ ⌉ = ceiling (round up)`,
        ],
        tables: [
          {
            headers: ['Parameter', 'Symbol', 'Value'],
            rows: [
              ['Demand rate', 'D', `${D} units/hr`],
              ['Lead time', 'L', `${L} hrs`],
              ['Safety factor', 'α', alpha],
              ['Container size', 'C', `${C} units/card`],
            ],
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: `Calculate the number of kanban cards (N). Always round UP to the nearest whole card.`,
        inputs: [
          { id: 'kanban_n', label: 'Number of Kanban Cards', unit: 'cards', placeholder: '0', min: 1, step: 1 },
        ],
      },
      answer: { value: N },
      grading: { tolerance: 0 },
    };
  }

  /* ── A4: Takt Time & Manpower ── */
  function _genTaktManpower(rng) {
    const shiftMin  = rng.pick([420, 480, 510]);  // shift length
    const breakMin  = rng.pick([30, 45, 60]);       // break time
    const availMin  = shiftMin - breakMin;
    const availSec  = availMin * 60;
    const demand    = rng.int(200, 500);            // units/day

    // Takt time (seconds)
    const takt = Math.round((availSec / demand) * 10) / 10;

    // Task times (sum = work content)
    const numTasks = rng.int(4, 7);
    const tasks    = [];
    let twc = 0;
    for (let i = 0; i < numTasks; i++) {
      const t = rng.int(20, 80); // seconds
      tasks.push(t);
      twc += t;
    }
    const operators = Math.ceil(twc / takt);

    return {
      id:     'A4',
      type:   'multi-numeric',
      title:  'Takt Time & Manpower',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Lean — Line Balancing',
        title: 'Greenfield Manufacturing: Staffing the Assembly Line',
        body: [
          'The plant needs to balance the final assembly line to meet customer demand. ' +
          'Use the shift data and task list to determine the takt time and minimum operator count.',
        ],
        formulas: [
          `Takt Time (s) = Available Time (s) / Customer Demand\n` +
          `              = ${availSec} / ${demand} = ${takt} s\n\n` +
          `No. Operators = ⌈ Total Work Content / Takt Time ⌉\n` +
          `              = ⌈ ${twc} / ${takt} ⌉ = ${operators}`,
        ],
        tables: [
          {
            headers: ['Parameter', 'Value'],
            rows: [
              ['Shift length', `${shiftMin} min`],
              ['Planned breaks', `${breakMin} min`],
              ['Available time', `${availMin} min = ${availSec} s`],
              ['Customer demand', `${demand} units/shift`],
            ],
            modClass: MOD_CLASS,
          },
          {
            headers: ['Task #', 'Task Time (s)'],
            rows: tasks.map((t, i) => [`Task ${i+1}`, t]),
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Calculate both the takt time and the minimum number of operators required.',
        inputs: [
          { id: 'takt',      label: 'Takt Time',            unit: 'seconds',   placeholder: '0.0', step: 0.1 },
          { id: 'operators', label: 'Min. No. of Operators', unit: 'operators', placeholder: '0',   step: 1   },
        ],
      },
      answer: {
        keys: [
          { id: 'takt',      value: takt,      tolerance: 1.5, points: Math.round(POINTS_EACH / 2) },
          { id: 'operators', value: operators, tolerance: 0,   points: Math.round(POINTS_EACH / 2) },
        ],
      },
      grading: {},
    };
  }

  return { generate, LABEL, SHORT, MOD_CLASS };
})();
