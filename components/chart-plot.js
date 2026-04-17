/* =====================================================
   components/chart-plot.js
   Interactive SPC control chart.
   Students click data points to flag them as
   "out-of-control". Uses inline SVG.

   screen.question shape:
   {
     chartTitle: string,
     xLabel: string,
     yLabel: string,
     yUnit: string,
     centerLine: number,
     ucl: number,
     lcl: number,
     sigma1: number,  // optional zone lines
     sigma2: number,
     points: [{ x, y }]   // x = sample label string, y = value
   }

   getAnswer() → [index, index, ...]  (flagged point indices)
   ===================================================== */

const ChartPlotWidget = (() => {

  const W = 560, H = 260;
  const ML = 54, MR = 18, MT = 18, MB = 48;

  let _flagged = new Set();
  let _screenId = null;

  function render(container, screen, saved) {
    _screenId = screen.id;
    _flagged  = new Set(Array.isArray(saved) ? saved : []);

    container.innerHTML = `
      <p class="instr" style="font-size:.83rem;color:var(--muted);margin-bottom:10px;">
        Click any data point to <strong>flag</strong> it as out-of-control (turns red).
        Click again to unflag.
      </p>
      <div class="chart-wrapper" id="cp-wrap-${screen.id}"></div>
      <div class="chart-legend" id="cp-legend-${screen.id}"></div>
      <button class="btn-check" id="cp-check-${screen.id}" style="margin-top:10px;">Check Flags</button>
      <div class="feedback hide" id="cp-fb-${screen.id}"></div>`;

    _renderSVG(screen);

    document.getElementById(`cp-check-${screen.id}`)
      .addEventListener('click', () => _check(screen));
  }

  function _renderSVG(screen) {
    const q      = screen.question;
    const pts    = q.points;
    const wrap   = document.getElementById(`cp-wrap-${screen.id}`);
    if (!wrap) return;

    const plotW  = W - ML - MR;
    const plotH  = H - MT - MB;

    // Y range: add 15% padding above/below control limits
    const allY   = [q.ucl, q.lcl, ...pts.map(p => p.y)];
    const minY   = Math.min(...allY) - (q.ucl - q.lcl) * 0.15;
    const maxY   = Math.max(...allY) + (q.ucl - q.lcl) * 0.15;

    const xScale = i  => ML + (i / (pts.length - 1)) * plotW;
    const yScale = v  => MT + plotH - ((v - minY) / (maxY - minY)) * plotH;

    // Build SVG
    let svg = `<svg class="spc-svg" viewBox="0 0 ${W} ${H}"
      xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">`;

    // Background
    svg += `<rect x="${ML}" y="${MT}" width="${plotW}" height="${plotH}"
      fill="#fafbfc" stroke="var(--border)" stroke-width="1"/>`;

    // Zone shading (if sigma lines provided)
    if (q.sigma2) {
      svg += _hband(ML, plotW, yScale(q.sigma2), yScale(q.ucl),   '#fee2e2', 0.5);
      svg += _hband(ML, plotW, yScale(q.lcl),    yScale(-q.sigma2+q.centerLine+(q.centerLine-q.sigma2)), '#fee2e2', 0.5);
    }

    // Reference lines
    svg += _hline(xScale, q.ucl,        yScale, W, '#ef4444', '6 4', 'UCL');
    svg += _hline(xScale, q.centerLine, yScale, W, '#22c55e', '',    'CL');
    svg += _hline(xScale, q.lcl,        yScale, W, '#ef4444', '6 4', 'LCL');
    if (q.sigma1) {
      svg += _hline(xScale, q.centerLine + q.sigma1, yScale, W, '#f59e0b', '3 3', '+1σ');
      svg += _hline(xScale, q.centerLine - q.sigma1, yScale, W, '#f59e0b', '3 3', '−1σ');
    }
    if (q.sigma2) {
      svg += _hline(xScale, q.centerLine + q.sigma2, yScale, W, '#f97316', '3 3', '+2σ');
      svg += _hline(xScale, q.centerLine - q.sigma2, yScale, W, '#f97316', '3 3', '−2σ');
    }

    // Data line
    const linePts = pts.map((p, i) => `${xScale(i)},${yScale(p.y)}`).join(' ');
    svg += `<polyline points="${linePts}" fill="none" stroke="#1a5f9e" stroke-width="1.5"/>`;

    // Data points (circles)
    for (let i = 0; i < pts.length; i++) {
      const cx   = xScale(i).toFixed(1);
      const cy   = yScale(pts[i].y).toFixed(1);
      const fill = _flagged.has(i) ? '#b71c1c' : '#1a5f9e';
      const stroke = _flagged.has(i) ? '#7f1010' : '#134b80';
      svg += `<circle class="spc-point${_flagged.has(i) ? ' flagged':''}"
        cx="${cx}" cy="${cy}" r="5"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5"
        data-idx="${i}" data-screen="${screen.id}"
        style="cursor:pointer;">
        <title>Sample ${pts[i].x}: ${pts[i].y.toFixed(3)}</title>
      </circle>`;
    }

    // X-axis labels (every 2nd)
    for (let i = 0; i < pts.length; i++) {
      if (i % 2 === 0 || pts.length <= 10) {
        svg += `<text x="${xScale(i).toFixed(1)}" y="${H - MB + 14}"
          font-size="9" text-anchor="middle" fill="#56637a">${pts[i].x}</text>`;
      }
    }

    // Y-axis labels
    const yTicks = 4;
    for (let t = 0; t <= yTicks; t++) {
      const v = minY + (t / yTicks) * (maxY - minY);
      svg += `<text x="${ML - 6}" y="${(yScale(v) + 3).toFixed(1)}"
        font-size="9" text-anchor="end" fill="#56637a">${v.toFixed(2)}</text>`;
    }

    // Axis titles
    svg += `<text x="${ML + plotW / 2}" y="${H - 4}"
      font-size="10" text-anchor="middle" fill="var(--muted)">${_esc(q.xLabel)}</text>`;
    svg += `<text transform="rotate(-90)" x="${-(MT + plotH/2)}" y="12"
      font-size="10" text-anchor="middle" fill="var(--muted)">${_esc(q.yLabel)}</text>`;

    svg += `</svg>`;
    wrap.innerHTML = svg;

    // Attach point click listeners
    wrap.querySelectorAll('.spc-point').forEach(pt => {
      pt.addEventListener('click', () => {
        const idx = Number(pt.dataset.idx);
        if (_flagged.has(idx)) _flagged.delete(idx);
        else                   _flagged.add(idx);
        _renderSVG(screen); // re-draw
      });
    });

    // Legend
    const legendEl = document.getElementById(`cp-legend-${screen.id}`);
    if (legendEl) {
      legendEl.innerHTML = `
        <div class="legend-item">
          <div class="legend-swatch" style="background:#ef4444;border:2px dashed #ef4444;height:2px;"></div> UCL / LCL
        </div>
        <div class="legend-item">
          <div class="legend-swatch" style="background:#22c55e;"></div> Center Line
        </div>
        <div class="legend-item">
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#b71c1c"/></svg> Flagged (OOC)
        </div>
        <div class="legend-item">
          <svg width="12" height="12"><circle cx="6" cy="6" r="5" fill="#1a5f9e"/></svg> Normal
        </div>`;
    }
  }

  function _hline(xScale, value, yScale, W, color, dash, label) {
    const x1 = xScale(0) - 2;
    const x2 = W - 18;
    const y  = yScale(value).toFixed(1);
    const da = dash ? `stroke-dasharray="${dash}"` : '';
    return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"
      stroke="${color}" stroke-width="1.5" ${da}/>
      <text x="${x2 + 2}" y="${(Number(y) + 4).toFixed(1)}"
        font-size="9" fill="${color}">${label}</text>`;
  }

  function _hband(ml, pw, y1, y2, fill, opacity) {
    const top  = Math.min(y1, y2);
    const hgt  = Math.abs(y2 - y1);
    return `<rect x="${ml}" y="${top.toFixed(1)}" width="${pw}" height="${hgt.toFixed(1)}"
      fill="${fill}" opacity="${opacity}"/>`;
  }

  function _check(screen) {
    const correctSet = new Set(screen.answer.flagged);
    const fb         = document.getElementById(`cp-fb-${screen.id}`);
    let hit = 0, fp = 0;
    _flagged.forEach(i => { if (correctSet.has(i)) hit++; else fp++; });
    const miss = correctSet.size - hit;

    if (!fb) return;
    if (hit === correctSet.size && fp === 0) {
      fb.className = 'feedback correct';
      fb.textContent = `✓ All ${correctSet.size} out-of-control point(s) correctly identified!`;
    } else {
      fb.className = 'feedback partial';
      fb.textContent = `Hits: ${hit}/${correctSet.size} correct flags — False positives: ${fp} — Missed: ${miss}`;
    }
  }

  function getAnswer() {
    return Array.from(_flagged);
  }

  function _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, getAnswer };
})();
