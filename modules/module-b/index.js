/* =====================================================
   modules/module-b/index.js  —  Quality & SPC
   Four screens:
     B1 — Common vs Assignable Cause (dropdown-row)
     B2 — Process Capability: Cp & Cpk (multi-numeric)
     B3 — Control Chart OOC Identification (chart-plot)
     B4 — p-chart Calculations (table-fill)
   ===================================================== */

const ModuleB = (function () {

  const LABEL      = 'Module B — Quality & SPC';
  const SHORT      = 'Mod B: Quality';
  const MOD_CLASS  = 'mod-b';
  const TIME_LIMIT = 15 * 60;
  const POINTS_EACH = 25;

  /* ── Cause scenario pool ── */
  const COMMON_POOL = [
    { id:'c1', text: 'Random variation in incoming material hardness' },
    { id:'c2', text: 'Normal temperature fluctuations in the plant' },
    { id:'c3', text: 'Slight dimension variation from worn tooling (within spec)' },
    { id:'c4', text: 'Random differences in operator measurement readings' },
    { id:'c5', text: 'Natural vibration in aging conveyor system' },
    { id:'c6', text: 'Minor weight variation from supplier-provided raw material' },
  ];

  const ASSIGNABLE_POOL = [
    { id:'a1', text: 'Machine bearing failure causing sudden spike in defects' },
    { id:'a2', text: 'New untrained operator introduced to assembly line' },
    { id:'a3', text: 'Batch of non-conforming supplier material received' },
    { id:'a4', text: 'Coolant system failure causing elevated cutting temperature' },
    { id:'a5', text: 'Software update altered CNC cutting parameters overnight' },
    { id:'a6', text: 'Power surge causing erratic sensor readings' },
  ];

  /* ── B1: Common vs Assignable ── */
  function _genCauseClassification(rng) {
    const commons    = rng.sample(COMMON_POOL,    3);
    const assignable = rng.sample(ASSIGNABLE_POOL, 3);
    const allRows    = rng.shuffle([...commons, ...assignable]);

    const rowsMap = {};
    for (const r of commons)    rowsMap[r.id] = 'common';
    for (const r of assignable) rowsMap[r.id] = 'assignable';

    return {
      id:     'B1',
      type:   'dropdown-row',
      title:  'Common vs. Assignable Cause',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Quality — SPC Foundations',
        title: 'Precision Parts Co.: Cause Analysis',
        body: [
          'The quality team at Precision Parts Co. has flagged six situations that recently affected the production process. ' +
          'Classify each as <strong>Common Cause</strong> variation (inherent, random) or ' +
          '<strong>Assignable Cause</strong> variation (specific, identifiable event).',
        ],
        formulas: [
          `Common Cause:  natural, random variation always present in the\n` +
          `  process — manageable only by redesigning the process.\n\n` +
          `Assignable Cause (Special Cause):  specific, identifiable event\n` +
          `  that shifts the process — requires investigation & correction.`,
        ],
        tables: [],
      },
      question: {
        instruction: 'Select the correct classification for each situation.',
        columns: ['Situation', 'Classification'],
        rows: allRows.map(r => ({ id: r.id, text: r.text })),
        options: [
          { value: 'common',     label: 'Common Cause' },
          { value: 'assignable', label: 'Assignable Cause' },
        ],
      },
      answer: { rows: rowsMap },
      grading: { partialCredit: true },
    };
  }

  /* ── B2: Process Capability ── */
  function _genCapability(rng) {
    const nominal  = rng.int(50, 200);
    const halfSpec = rng.int(5, 20);
    const usl      = nominal + halfSpec;
    const lsl      = nominal - halfSpec;
    const mean     = nominal + rng.floatR(-halfSpec * 0.3, halfSpec * 0.3, 2);
    const sigma    = rng.floatR(halfSpec * 0.12, halfSpec * 0.35, 3);

    const cp   = Math.round(((usl - lsl) / (6 * sigma)) * 1000) / 1000;
    const cpkU = (usl - mean)  / (3 * sigma);
    const cpkL = (mean - lsl) / (3 * sigma);
    const cpk  = Math.round(Math.min(cpkU, cpkL) * 1000) / 1000;

    return {
      id:     'B2',
      type:   'multi-numeric',
      title:  'Process Capability (Cp & Cpk)',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Quality — Capability Analysis',
        title: 'Precision Parts Co.: Capability Study',
        body: [
          'A capability study was conducted on a critical dimension. ' +
          'The engineering team collected 100 samples and computed the process statistics below.',
          `A Cp ≥ 1.33 and Cpk ≥ 1.00 are generally required for a capable process.`,
        ],
        formulas: [
          `Cp  = (USL − LSL) / (6σ)\n` +
          `    = (${usl} − ${lsl}) / (6 × ${sigma})\n\n` +
          `Cpk = min[ (USL − μ) / 3σ,  (μ − LSL) / 3σ ]\n` +
          `    = min[ (${usl} − ${mean.toFixed(2)}) / (3 × ${sigma}),\n` +
          `           (${mean.toFixed(2)} − ${lsl}) / (3 × ${sigma}) ]`,
        ],
        tables: [
          {
            headers: ['Statistic', 'Value'],
            rows: [
              ['Upper Spec Limit (USL)', usl],
              ['Lower Spec Limit (LSL)', lsl],
              ['Process Mean (μ)', mean.toFixed(2)],
              ['Process Std Dev (σ)', sigma],
            ],
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Calculate Cp and Cpk. Round to 3 decimal places.',
        inputs: [
          { id: 'cp',  label: 'Cp',  placeholder: '0.000', step: 0.001 },
          { id: 'cpk', label: 'Cpk', placeholder: '0.000', step: 0.001 },
        ],
      },
      answer: {
        keys: [
          { id: 'cp',  value: cp,  tolerance: 0.01, points: Math.round(POINTS_EACH / 2) },
          { id: 'cpk', value: cpk, tolerance: 0.01, points: Math.round(POINTS_EACH / 2) },
        ],
      },
      grading: {},
    };
  }

  /* ── B3: Control Chart OOC ── */
  function _genControlChart(rng) {
    const cl    = rng.floatR(40, 120, 2);
    const range = rng.floatR(8, 25, 2);
    const sigma = range / 3;    // approximate σ from range
    const ucl   = cl + 3 * sigma;
    const lcl   = cl - 3 * sigma;

    const N = 20;
    const points = [];
    const oocIndices = new Set();

    // Choose 3–4 random positions for OOC points
    const oocPositions = rng.sample([...Array(N).keys()], rng.int(3, 4));

    for (let i = 0; i < N; i++) {
      let y;
      if (oocPositions.includes(i)) {
        // Point beyond 3σ — alternate above/below
        const direction = oocIndices.size % 2 === 0 ? 1 : -1;
        y = cl + direction * (3 * sigma + rng.float(0.2, 1.5) * sigma);
        oocIndices.add(i);
      } else {
        y = rng.normal(cl, sigma * 0.75);
        // clamp within limits
        y = Math.max(lcl + 0.3 * sigma, Math.min(ucl - 0.3 * sigma, y));
      }
      points.push({ x: String(i + 1), y: Math.round(y * 100) / 100 });
    }

    return {
      id:     'B3',
      type:   'chart-plot',
      title:  'Control Chart: Identify Out-of-Control Points',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Quality — x̄ Control Chart',
        title: 'Precision Parts Co.: SPC Monitoring',
        body: [
          'The x̄ control chart below shows 20 consecutive sample means from the production line. ' +
          'The control limits were computed from a baseline period when the process was in statistical control.',
          '<strong>Rule:</strong> A point is out-of-control (OOC) if it falls outside the 3σ control limits (UCL or LCL).',
        ],
        formulas: [
          `UCL  = ${ucl.toFixed(3)}\n` +
          `CL   = ${cl.toFixed(3)}\n` +
          `LCL  = ${lcl.toFixed(3)}\n\n` +
          `σ ≈ R̄ / d₂  (estimated from historical range)`,
        ],
        tables: [],
      },
      question: {
        instruction: 'Click on each data point you believe is out-of-control (OOC). Points turn red when flagged. Click again to unflag.',
        chartTitle: 'x̄ Control Chart',
        xLabel: 'Sample Number',
        yLabel: 'Sample Mean',
        yUnit:  '',
        centerLine: cl,
        ucl,
        lcl,
        sigma1: sigma,
        sigma2: 2 * sigma,
        points,
      },
      answer: {
        flagged: Array.from(oocIndices),
        totalPoints: POINTS_EACH,
      },
      grading: {},
    };
  }

  /* ── B4: p-chart Calculations ── */
  function _genPChart(rng) {
    const n       = rng.int(50, 150);   // sample size (constant)
    const k       = 5;                   // number of samples shown

    const pBar    = rng.floatR(0.05, 0.20, 4);
    const sigmaP  = Math.sqrt(pBar * (1 - pBar) / n);
    const ucl     = Math.round((pBar + 3 * sigmaP) * 10000) / 10000;
    const lcl     = Math.max(0, Math.round((pBar - 3 * sigmaP) * 10000) / 10000);

    // Generate sample data
    const totalNonconf = Math.round(pBar * n * k + rng.floatR(-2, 2, 0));
    const samples = [];
    let placed = 0;
    for (let i = 0; i < k; i++) {
      const nonconf = i < k - 1
        ? rng.int(Math.max(0, Math.round(pBar * n * 0.5)), Math.round(pBar * n * 1.5))
        : Math.max(0, totalNonconf - placed);
      placed += nonconf;
      const pi = Math.round((nonconf / n) * 10000) / 10000;
      samples.push({ sample: i + 1, nonconf, pi });
    }
    const actualPBar = Math.round((placed / (k * n)) * 10000) / 10000;
    const actualSigma = Math.sqrt(actualPBar * (1 - actualPBar) / n);
    const actualUCL   = Math.round((actualPBar + 3 * actualSigma) * 10000) / 10000;
    const actualLCL   = Math.max(0, Math.round((actualPBar - 3 * actualSigma) * 10000) / 10000);

    return {
      id:     'B4',
      type:   'table-fill',
      title:  'p-Chart Construction',
      points: POINTS_EACH,
      modClass: MOD_CLASS,
      scenario: {
        tag:   'Quality — p-Chart',
        title: 'Precision Parts Co.: Attribute Control Chart',
        body: [
          `${k} samples of size n = ${n} were inspected. The number of non-conforming units in each sample is recorded below.`,
          'Complete the p-chart calculations: p-bar, σ_p, UCL, and LCL.',
        ],
        formulas: [
          `p̄  = Σ(nonconforming) / (k × n)\n\n` +
          `σ_p = √[ p̄(1 − p̄) / n ]\n\n` +
          `UCL = p̄ + 3 σ_p\n` +
          `LCL = max(0,  p̄ − 3 σ_p)`,
        ],
        tables: [
          {
            headers: ['Sample', 'n', 'Nonconforming', 'pᵢ'],
            rows: samples.map(s => [s.sample, n, s.nonconf, s.pi.toFixed(4)]),
            modClass: MOD_CLASS,
          },
        ],
      },
      question: {
        instruction: 'Fill in the p-chart summary values. Round to 4 decimal places.',
        columns: ['p̄', 'σ_p', 'UCL', 'LCL'],
        rows: [
          {
            label: 'p-Chart Values',
            cells: [
              { id: 'pbar',    given: false, unit: '', value: actualPBar,    tolerance: 0.001 },
              { id: 'sigma_p', given: false, unit: '', value: Math.round(actualSigma * 10000)/10000, tolerance: 0.001 },
              { id: 'pcucl',   given: false, unit: '', value: actualUCL,     tolerance: 0.002 },
              { id: 'pclcl',   given: false, unit: '', value: actualLCL,     tolerance: 0.002 },
            ],
          },
        ],
      },
      answer: {
        cells: [
          { id: 'pbar',    value: actualPBar,    tolerance: 0.001, points: Math.round(POINTS_EACH / 4) },
          { id: 'sigma_p', value: Math.round(actualSigma*10000)/10000, tolerance: 0.001, points: Math.round(POINTS_EACH / 4) },
          { id: 'pcucl',   value: actualUCL,     tolerance: 0.002, points: Math.round(POINTS_EACH / 4) },
          { id: 'pclcl',   value: actualLCL,     tolerance: 0.002, points: Math.round(POINTS_EACH / 4) },
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
        _genCauseClassification(rng),
        _genCapability(rng),
        _genControlChart(rng),
        _genPChart(rng),
      ],
    };
  }

  return { generate, LABEL, SHORT, MOD_CLASS };
})();
