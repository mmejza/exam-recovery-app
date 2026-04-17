(function () {
  "use strict";

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mount(container, screenConfig, savedPayload, options) {
    const cfg = screenConfig || {};
    const opts = options || {};

    const xBuckets = Array.isArray(cfg.xBuckets) && cfg.xBuckets.length
      ? cfg.xBuckets
      : [
          { id: "p1", label: "1" }, { id: "p2", label: "2" }, { id: "p3", label: "3" }, { id: "p4", label: "4" }, { id: "p5", label: "5" },
          { id: "p6", label: "6" }, { id: "p7", label: "7" }, { id: "p8", label: "8" }, { id: "p9", label: "9" }, { id: "p10", label: "10" }
        ];
    const yBuckets = Array.isArray(cfg.yBuckets) && cfg.yBuckets.length
      ? cfg.yBuckets
      : [
          { id: "40", label: "40" },
          { id: "45", label: "45" },
          { id: "50", label: "50" },
          { id: "55", label: "55" },
          { id: "60", label: "60" },
          { id: "65", label: "65" }
        ];

    const pointCount = clamp(Number(cfg.pointCount || xBuckets.length || 10), 8, 12);
    const lineCfg = cfg.lines || {};
    const requireAll = cfg.requireAllPoints !== false;

    const saved = savedPayload && savedPayload.responses ? savedPayload.responses : {};
    const savedPoints = Array.isArray(saved.points) ? saved.points : [];
    const savedMcq = saved.followupMcq && saved.followupMcq.selected ? saved.followupMcq.selected : null;

    const points = [];
    for (let i = 0; i < pointCount; i++) {
      const x = xBuckets[i] || { id: "p" + String(i + 1), label: String(i + 1) };
      const loaded = savedPoints[i] || null;
      points.push({
        pointId: x.id,
        xBucket: x.id,
        yBucket: loaded && loaded.yBucket ? loaded.yBucket : null
      });
    }

    const width = 760;
    const height = 360;
    const margin = { top: 24, right: 20, bottom: 48, left: 52 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    function getXPos(index) {
      if (pointCount === 1) {
        return margin.left + plotW / 2;
      }
      return margin.left + (index / (pointCount - 1)) * plotW;
    }

    function getYPos(yIndex) {
      if (yBuckets.length <= 1) {
        return margin.top + plotH / 2;
      }
      return margin.top + plotH - (yIndex / (yBuckets.length - 1)) * plotH;
    }

    function yIndexById(id) {
      for (let i = 0; i < yBuckets.length; i++) {
        if (String(yBuckets[i].id) === String(id)) {
          return i;
        }
      }
      return -1;
    }

    function lineY(id) {
      const idx = yIndexById(id);
      return idx >= 0 ? getYPos(idx) : null;
    }

    function buildSvgMarkup() {
      const parts = [];
      parts.push("<svg class='cpp-svg' viewBox='0 0 " + width + " " + height + "' role='img' aria-label='Control chart plotting area'>");
      parts.push("<rect x='" + margin.left + "' y='" + margin.top + "' width='" + plotW + "' height='" + plotH + "' class='cpp-plot-bg'></rect>");

      for (let yi = 0; yi < yBuckets.length; yi++) {
        const gy = getYPos(yi);
        parts.push("<line x1='" + margin.left + "' y1='" + gy + "' x2='" + (margin.left + plotW) + "' y2='" + gy + "' class='cpp-grid'></line>");
        parts.push("<text x='" + (margin.left - 10) + "' y='" + (gy + 4) + "' class='cpp-axis-label cpp-axis-left'>" + esc(yBuckets[yi].label) + "</text>");
      }

      for (let xi = 0; xi < pointCount; xi++) {
        const gx = getXPos(xi);
        parts.push("<line x1='" + gx + "' y1='" + margin.top + "' x2='" + gx + "' y2='" + (margin.top + plotH) + "' class='cpp-grid cpp-grid-v'></line>");
        parts.push("<text x='" + gx + "' y='" + (margin.top + plotH + 22) + "' class='cpp-axis-label cpp-axis-bottom'>" + esc((xBuckets[xi] || { label: String(xi + 1) }).label) + "</text>");
      }

      parts.push("<line x1='" + margin.left + "' y1='" + (margin.top + plotH) + "' x2='" + (margin.left + plotW) + "' y2='" + (margin.top + plotH) + "' class='cpp-axis'></line>");
      parts.push("<line x1='" + margin.left + "' y1='" + margin.top + "' x2='" + margin.left + "' y2='" + (margin.top + plotH) + "' class='cpp-axis'></line>");

      const centerY = lineY(lineCfg.center);
      const uclY = lineY(lineCfg.ucl);
      const lclY = lineY(lineCfg.lcl);
      if (centerY !== null) {
        parts.push("<line x1='" + margin.left + "' y1='" + centerY + "' x2='" + (margin.left + plotW) + "' y2='" + centerY + "' class='cpp-line cpp-center'></line>");
      }
      if (uclY !== null) {
        parts.push("<line x1='" + margin.left + "' y1='" + uclY + "' x2='" + (margin.left + plotW) + "' y2='" + uclY + "' class='cpp-line cpp-ucl'></line>");
      }
      if (lclY !== null) {
        parts.push("<line x1='" + margin.left + "' y1='" + lclY + "' x2='" + (margin.left + plotW) + "' y2='" + lclY + "' class='cpp-line cpp-lcl'></line>");
      }

      parts.push("<polyline id='cpp-polyline' class='cpp-series' points=''></polyline>");
      parts.push("<g id='cpp-points'></g>");
      parts.push("</svg>");
      return parts.join("");
    }

    function render() {
      const html = [];
      html.push("<div class='cpp-root'>");
      html.push("<h3>" + esc(cfg.title || cfg.scenarioTitle || "Chart Point Plot") + "</h3>");
      if (cfg.prompt) {
        html.push("<p class='widget-note'>" + esc(cfg.prompt) + "</p>");
      }
      html.push(buildSvgMarkup());
      html.push("<div class='cpp-controls'>");
      html.push("<button type='button' class='btn btn-secondary' id='cpp-clear-last'>Clear Last</button>");
      html.push("<button type='button' class='btn btn-secondary' id='cpp-reset'>Reset All</button>");
      html.push("</div>");

      if (cfg.followupMcq && Array.isArray(cfg.followupMcq.options)) {
        html.push("<div class='ncs-mcq'>");
        html.push("<p><strong>Follow-up:</strong> " + esc(cfg.followupMcq.prompt || "Select one option") + "</p>");
        html.push("<div class='ncs-mcq-options'>");
        cfg.followupMcq.options.forEach(function (opt, idx) {
          const id = "cpp-mcq-" + String(idx);
          const checked = savedMcq === opt.value ? " checked" : "";
          html.push("<label for='" + esc(id) + "'>");
          html.push("<input id='" + esc(id) + "' type='radio' name='cpp-followup' value='" + esc(opt.value) + "'" + checked + " /> ");
          html.push(esc(opt.label));
          html.push("</label>");
        });
        html.push("</div>");
        html.push("<div class='ncs-error' data-error='followup'></div>");
        html.push("</div>");
      }

      html.push("<div class='ncs-error' data-error='points'></div>");
      html.push("</div>");

      container.innerHTML = html.join("");
      drawSeries();

      const svg = container.querySelector(".cpp-svg");
      svg.addEventListener("click", onPlotClick);
      container.querySelector("#cpp-clear-last").addEventListener("click", clearLast);
      container.querySelector("#cpp-reset").addEventListener("click", resetAll);

      if (typeof opts.onChange === "function") {
        container.querySelectorAll("input[type='radio']").forEach(function (el) {
          el.addEventListener("change", opts.onChange);
        });
      }

      if (opts.locked) {
        container.querySelectorAll("input, button").forEach(function (el) {
          el.disabled = true;
        });
      }
    }

    function onPlotClick(event) {
      if (opts.locked) {
        return;
      }

      const svg = container.querySelector(".cpp-svg");
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * width;
      const y = ((event.clientY - rect.top) / rect.height) * height;

      const xNorm = clamp((x - margin.left) / plotW, 0, 1);
      const yNorm = clamp((margin.top + plotH - y) / plotH, 0, 1);

      const xIndex = clamp(Math.round(xNorm * (pointCount - 1)), 0, pointCount - 1);
      const yIndex = clamp(Math.round(yNorm * (yBuckets.length - 1)), 0, yBuckets.length - 1);

      points[xIndex].yBucket = yBuckets[yIndex].id;
      drawSeries();
      notifyChange();
    }

    function clearLast() {
      if (opts.locked) {
        return;
      }
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].yBucket !== null) {
          points[i].yBucket = null;
          break;
        }
      }
      drawSeries();
      notifyChange();
    }

    function resetAll() {
      if (opts.locked) {
        return;
      }
      points.forEach(function (p) {
        p.yBucket = null;
      });
      drawSeries();
      notifyChange();
    }

    function drawSeries() {
      const pointsLayer = container.querySelector("#cpp-points");
      const polyline = container.querySelector("#cpp-polyline");
      const series = [];
      pointsLayer.innerHTML = "";

      points.forEach(function (p, i) {
        const yi = yIndexById(p.yBucket);
        if (yi < 0) {
          return;
        }
        const cx = getXPos(i);
        const cy = getYPos(yi);
        series.push(String(cx) + "," + String(cy));

        const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        marker.setAttribute("cx", String(cx));
        marker.setAttribute("cy", String(cy));
        marker.setAttribute("r", "4.5");
        marker.setAttribute("class", "cpp-point");
        pointsLayer.appendChild(marker);
      });

      polyline.setAttribute("points", series.join(" "));
    }

    function notifyChange() {
      if (typeof opts.onChange === "function") {
        opts.onChange();
      }
    }

    function clearErrors() {
      container.querySelectorAll(".ncs-error").forEach(function (el) {
        el.textContent = "";
      });
    }

    function setError(key, message) {
      const errorEl = container.querySelector(".ncs-error[data-error='" + key + "']");
      if (errorEl) {
        errorEl.textContent = message;
      }
    }

    function getResponsePayload() {
      const pointToBucket = {};
      const pointRows = points.map(function (p) {
        pointToBucket[p.pointId] = p.yBucket;
        return {
          pointId: p.pointId,
          xBucket: p.xBucket,
          yBucket: p.yBucket
        };
      });

      const selected = container.querySelector("input[name='cpp-followup']:checked");

      return {
        componentType: "chart-point-plot",
        screenId: cfg.id || null,
        moduleKey: cfg.moduleKey || null,
        responses: {
          points: pointRows,
          pointToBucket: pointToBucket,
          followupMcq: cfg.followupMcq
            ? {
                id: cfg.followupMcq.id || "followup",
                selected: selected ? selected.value : null
              }
            : null
        },
        meta: {
          pointCount: pointCount,
          capturedAt: new Date().toISOString()
        }
      };
    }

    function validate() {
      clearErrors();
      const payload = getResponsePayload();
      let valid = true;

      if (requireAll) {
        const allPlotted = payload.responses.points.every(function (p) {
          return p.yBucket !== null;
        });
        if (!allPlotted) {
          valid = false;
          setError("points", "Plot all points before continuing.");
        }
      }

      if (cfg.followupMcq && cfg.followupMcq.required) {
        const selected = payload.responses.followupMcq && payload.responses.followupMcq.selected;
        if (!selected) {
          valid = false;
          setError("followup", "Required");
        }
      }

      return {
        valid: valid,
        payload: payload
      };
    }

    function grade() {
      if (!window.ScoringEngine) {
        return {
          itemScore: 0,
          maxScore: 0,
          percentage: 0,
          feedbackCode: "SCORING_UNAVAILABLE",
          byItemId: {}
        };
      }

      const payload = getResponsePayload();
      const grading = cfg.grading || {};
      const items = [];
      const answers = {};

      if (grading.chartItem) {
        const chartItemId = grading.chartItem.itemId || "chart_plot";
        items.push({
          itemId: chartItemId,
          type: "chart-bucket",
          answerKey: grading.chartItem.answerKey || {},
          maxScore: grading.chartItem.maxScore || pointCount
        });
        answers[chartItemId] = payload.responses.pointToBucket || {};
      }

      if (grading.followupMcq && cfg.followupMcq) {
        const mcqId = grading.followupMcq.itemId || (cfg.followupMcq.id || "followup");
        items.push({
          itemId: mcqId,
          type: "mcq",
          answerKey: grading.followupMcq.answerKey,
          maxScore: grading.followupMcq.maxScore || 1
        });
        answers[mcqId] = payload.responses.followupMcq ? payload.responses.followupMcq.selected : null;
      }

      return window.ScoringEngine.scoreItems(items, answers);
    }

    render();

    return {
      validate: validate,
      isAnswered: function () {
        return validate().valid;
      },
      reset: resetAll,
      clearLast: clearLast,
      getResponsePayload: getResponsePayload,
      grade: grade
    };
  }

  window.ChartPointPlot = {
    mount: mount
  };
})();