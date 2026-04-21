(function () {
  "use strict";

  const SCENARIO_SALT = "OM-C-MVP-2026";
  const OVERALL_LIMIT_SECONDS = 45 * 60;
  const MODULE_LIMIT_SECONDS = 16 * 60;
  const LOW_TIME_THRESHOLD_SECONDS = 90;
  const MODULE_SEQUENCE = ["A", "B", "C"];
  const DEV_MODE = window.location.search.includes("dev=1");
  const RESET_ON_LOAD = window.location.search.includes("reset=1");
  const PREFILL_TOKEN = (function () {
    const p = new URLSearchParams(window.location.search).get("token");
    return p ? p.trim() : "";
  }());
  const WELCOME_SCREEN_ID = "welcome";
  const WELCOME_SCREEN = {
    id: WELCOME_SCREEN_ID,
    type: "intro",
    title: "Welcome to OM Recovery Lab",
    intro: "Start a fresh attempt by entering your student token and accepting the session policies."
  };
  const APP_STORAGE_KEYS = ["om-recovery-lab-session-v2", "om_recovery_lab_v1"];
  const APP_STORAGE_PREFIXES = ["om-recovery-lab-", "om_recovery_lab_"];
  const RECOVERY_CREDIT_CONFIG = {
    moduleKeys: ["A", "B", "C"],
    scale: [
      { minScore: 85, maxScore: 100, recoveryPercent: 40 },
      { minScore: 75, maxScore: 84.9999, recoveryPercent: 30 },
      { minScore: 65, maxScore: 74.9999, recoveryPercent: 20 },
      { minScore: 55, maxScore: 64.9999, recoveryPercent: 10 },
      { minScore: 0, maxScore: 54.9999, recoveryPercent: 0 }
    ]
  };
  const INTEGRITY_RULES = {
    shortCompletionRatio: 0.25,
    highAnswerChangeThreshold: 60
  };

  const DEFAULT_BUILD = {
    moduleKey: MODULE_SEQUENCE[0],
    screens: [],
    screenOrder: [],
    questionScreenIds: [],
    weights: {}
  };

  const ACTIVE_MODULE_KEY = MODULE_SEQUENCE[0];

  if (!Array.isArray(window.SCREENS) || window.SCREENS.length === 0) {
    window.SCREENS = Array.isArray(DEFAULT_BUILD.screens) ? DEFAULT_BUILD.screens : [];
  }

  let state = {
    studentToken: "",
    consentAccepted: false,
    currentScreen: WELCOME_SCREEN_ID,
    overallSecondsLeft: OVERALL_LIMIT_SECONDS,
    moduleSecondsLeft: MODULE_LIMIT_SECONDS,
    moduleSubmitted: false,
    submitReason: null,
    scenario: null,
    moduleTemplateId: null,
    activeModuleKey: ACTIVE_MODULE_KEY,
    screenOrder: DEFAULT_BUILD.screenOrder,
    questionScreenIds: DEFAULT_BUILD.questionScreenIds,
    weights: DEFAULT_BUILD.weights,
    answersByScreen: {},
    gradesByScreen: {},
    moduleScoresByKey: createEmptyModuleMap(null),
    moduleConfidenceByKey: createEmptyModuleMap(null),
    moduleCompletionMeta: createEmptyModuleMap(null),
    itemResponsesByModule: createEmptyModuleMap(null),
    itemScoresByModule: createEmptyModuleMap(null),
    moduleDurationsSecByKey: createEmptyModuleMap(null),
    moduleStartIsoByKey: createEmptyModuleMap(null),
    moduleEndIsoByKey: createEmptyModuleMap(null),
    answerChangeCountByModule: createEmptyModuleMap(0),
    responsePathSignatureByModule: createEmptyModuleMap(null),
    attemptHistoryByStudent: {},
    attemptNumber: 1,
    appStartIso: null,
    appEndIso: null,
    backendSubmitStatus: "idle",
    backendSubmitMessage: "",
    confidence: 50,
    continueConfirmed: false,
    lastSavedAt: null
  };

  let activeWidget = null;
  let timer = null;

  const appRoot = document.getElementById("app");

  function clearAppLocalStorage() {
    if (typeof localStorage === "undefined") {
      return;
    }

    const keys = Object.keys(localStorage);
    keys.forEach(function (key) {
      if (APP_STORAGE_KEYS.includes(key)) {
        localStorage.removeItem(key);
        return;
      }

      const isAppPrefixed = APP_STORAGE_PREFIXES.some(function (prefix) {
        return key.indexOf(prefix) === 0;
      });
      if (isAppPrefixed) {
        localStorage.removeItem(key);
      }
    });
  }

  function reloadWithoutResetFlag() {
    const url = new URL(window.location.href);
    url.searchParams.delete("reset");
    // keep ?token= so renderWelcome can pre-fill the field
    window.location.replace(url.toString());
  }

  if (RESET_ON_LOAD) {
    clearAppLocalStorage();
    reloadWithoutResetFlag();
    return;
  }

  if (DEV_MODE) {
    clearAppLocalStorage();
  }

  function init() {
    TopBar.init();
    BottomBar.init();
    BottomBar.bind(onPrev, onNext);

    if (DEV_MODE) {
      showDevModeBanner();
      showResetButton();
    }

    if (!DEV_MODE) {
      hydrateSession();
    }
    applyRouteFromHash();
    window.addEventListener("hashchange", applyRouteFromHash);

    SessionStore.startAutosave(
      function () { return state; },
      function (status) {
        if (status === "saving") {
          TopBar.setAutosave("Saving...");
          return;
        }
        if (status === "saved") {
          state.lastSavedAt = Date.now();
          TopBar.setAutosave("Saved " + new Date(state.lastSavedAt).toLocaleTimeString());
          return;
        }
        TopBar.setAutosave("Save error");
      },
      15000
    );

    if (state.studentToken && state.consentAccepted && !state.moduleSubmitted) {
      startDualTimers();
    }
  }

  function hydrateSession() {
    const saved = SessionStore.load();
    if (!saved) {
      return;
    }

    state = Object.assign({}, state, saved);
    state.answersByScreen = Object.assign({}, saved.answersByScreen || {});
    state.gradesByScreen = Object.assign({}, saved.gradesByScreen || {});
    state.screenOrder = Array.isArray(saved.screenOrder) && saved.screenOrder.length
      ? saved.screenOrder
      : DEFAULT_BUILD.screenOrder;
    state.questionScreenIds = Array.isArray(saved.questionScreenIds) && saved.questionScreenIds.length
      ? saved.questionScreenIds
      : DEFAULT_BUILD.questionScreenIds;
    state.weights = Object.assign({}, DEFAULT_BUILD.weights, saved.weights || {});
    state.activeModuleKey = String(saved.activeModuleKey || ACTIVE_MODULE_KEY).toUpperCase();
    state.moduleScoresByKey = mergeModuleMap(saved.moduleScoresByKey, null);
    state.moduleConfidenceByKey = mergeModuleMap(saved.moduleConfidenceByKey, null);
    state.moduleCompletionMeta = mergeModuleMap(saved.moduleCompletionMeta, null);
    state.itemResponsesByModule = mergeModuleMap(saved.itemResponsesByModule, null);
    state.itemScoresByModule = mergeModuleMap(saved.itemScoresByModule, null);
    state.moduleDurationsSecByKey = mergeModuleMap(saved.moduleDurationsSecByKey, null);
    state.moduleStartIsoByKey = mergeModuleMap(saved.moduleStartIsoByKey, null);
    state.moduleEndIsoByKey = mergeModuleMap(saved.moduleEndIsoByKey, null);
    state.answerChangeCountByModule = mergeModuleMap(saved.answerChangeCountByModule, 0);
    state.responsePathSignatureByModule = mergeModuleMap(saved.responsePathSignatureByModule, null);
    state.attemptHistoryByStudent = saved.attemptHistoryByStudent && typeof saved.attemptHistoryByStudent === "object"
      ? saved.attemptHistoryByStudent
      : {};
    state.attemptNumber = Number(saved.attemptNumber) > 0 ? Number(saved.attemptNumber) : 1;
    state.appStartIso = saved.appStartIso || null;
    state.appEndIso = saved.appEndIso || null;
    state.backendSubmitStatus = String(saved.backendSubmitStatus || "idle");
    state.backendSubmitMessage = String(saved.backendSubmitMessage || "");

    const validCurrentScreen = state.currentScreen === WELCOME_SCREEN_ID || state.screenOrder.includes(state.currentScreen);
    if (!validCurrentScreen) {
      state.currentScreen = (!state.studentToken || !state.consentAccepted)
        ? WELCOME_SCREEN_ID
        : state.screenOrder[0];
    }

    const rebuilt = buildModuleForStudent(state.activeModuleKey, state.studentToken || "demo-student", saved.scenario);
    if (rebuilt) {
      window.SCREENS = rebuilt.screens;
      state.scenario = rebuilt.scenario;
      state.moduleTemplateId = rebuilt.templateId;
      state.screenOrder = Array.isArray(saved.screenOrder) && saved.screenOrder.length
        ? saved.screenOrder
        : rebuilt.screenOrder;
      state.questionScreenIds = Array.isArray(saved.questionScreenIds) && saved.questionScreenIds.length
        ? saved.questionScreenIds
        : rebuilt.questionScreenIds;
      state.weights = Object.assign({}, rebuilt.weights, saved.weights || {});
    }
  }

  function applyRouteFromHash() {
    const rawHash = location.hash ? location.hash.replace("#", "") : "";
    const route = rawHash || state.currentScreen || WELCOME_SCREEN_ID;
    const valid = route === WELCOME_SCREEN_ID || state.screenOrder.includes(route)
      ? route
      : WELCOME_SCREEN_ID;

    const resolved = guardRoute(valid);

    // goTo() already called render() and set the hash. If the hash change was
    // caused by goTo() (i.e. the resolved route matches what is already current),
    // skip the redundant second render to avoid double-firing side effects such
    // as sendResultsToBackend.
    // Exception: always render on the very first call (initialRenderDone is false).
    if (resolved === state.currentScreen && applyRouteFromHash._initialRenderDone) {
      return;
    }
    applyRouteFromHash._initialRenderDone = true;

    state.currentScreen = resolved;
    persistState(false);
    render();
  }

  function guardRoute(route) {
    const introId = state.screenOrder[0];
    const summaryId = state.screenOrder[state.screenOrder.length - 1];

    if (!state.studentToken || !state.consentAccepted) {
      return WELCOME_SCREEN_ID;
    }

    if (state.moduleSubmitted && (route === introId || state.questionScreenIds.includes(route))) {
      return summaryId;
    }

    return route;
  }

  function goTo(screenId) {
    state.currentScreen = guardRoute(screenId);
    location.hash = "#" + state.currentScreen;
    persistState(false);
    render();
  }

  function render() {
    const screens = Array.isArray(window.SCREENS) ? window.SCREENS : [];
    if (!screens.length) {
      TopBar.show(true);
      BottomBar.show(false);
      TopBar.setToken(state.studentToken || "-");
      TopBar.setProgress(0, 0);
      TopBar.setDualTimer(state.overallSecondsLeft, state.moduleSecondsLeft, false);
      appRoot.innerHTML = "" +
        "<section class='screen-card'>" +
        "  <h2>Module Configuration Error</h2>" +
        "  <p>Screen definitions did not load. Refresh the page. If this persists, clear site data/local storage and relaunch.</p>" +
        "</section>";
      return;
    }

    if (state.currentScreen === WELCOME_SCREEN_ID) {
      TopBar.show(false);
      BottomBar.show(false);
      TopBar.setToken(state.studentToken || "-");
      TopBar.setProgress(0, state.screenOrder.length);
      TopBar.setDualTimer(state.overallSecondsLeft, state.moduleSecondsLeft, false);
      TopBar.setAutosave(state.lastSavedAt
        ? "Saved " + new Date(state.lastSavedAt).toLocaleTimeString()
        : "Idle");
      renderWelcome(WELCOME_SCREEN);
      return;
    }

    const screen = screens.find(function (s) {
      return s.id === state.currentScreen;
    });

    if (!screen) {
      goTo(WELCOME_SCREEN_ID);
      return;
    }

      const showBars = screen.type !== "intro" || screen.id !== WELCOME_SCREEN_ID;
    TopBar.show(showBars);
    BottomBar.show(showBars);

    TopBar.setToken(state.studentToken || "-");
    TopBar.setProgress(state.screenOrder.indexOf(screen.id) + 1, state.screenOrder.length);
    TopBar.setDualTimer(state.overallSecondsLeft, state.moduleSecondsLeft, isLowTime());

    if (state.lastSavedAt) {
      TopBar.setAutosave("Saved " + new Date(state.lastSavedAt).toLocaleTimeString());
    } else {
      TopBar.setAutosave("Idle");
    }

    BottomBar.setWarning("");

    if (screen.type === "intro") {
      renderModuleIntro(screen);
      return;
    }

    if (screen.type === "summary") {
      renderSummary(screen);
      return;
    }

    renderQuestionScreen(screen);
    updateNavState();
  }

  function renderWelcome(screen) {
    appRoot.innerHTML = "" +
      "<section class='screen-card'>" +
      "  <h2>" + escapeHtml(screen.title) + "</h2>" +
      "  <p>" + escapeHtml(screen.intro) + "</p>" +
      "  <div class='policy-box'>" +
      "    <strong>Session Policies</strong>" +
      "    <ul>" +
      "      <li><strong>Open-resource policy:</strong> You may use notes and course materials.</li>" +
      "      <li><strong>Individual-work policy:</strong> Collaboration is not allowed.</li>" +
      "      <li><strong>Identification policy:</strong> You must enter your official student ID number exactly as recorded by the institution.</li>" +
      "      <li><strong>Verification policy:</strong> If you enter an incorrect student ID number, credit is not guaranteed and your submission may not be verifiable.</li>" +
      "      <li><strong>Evidence policy:</strong> If your ID was entered incorrectly, you may submit supporting evidence for instructor review: a final summary screenshot, exported CSV/JSON files, and both the entered and correct student ID numbers.</li>" +
      "      <li><strong>Credit determination:</strong> Instructor will compare submitted evidence against backend logs and course records before deciding whether credit can be awarded.</li>" +
      "    </ul>" +
      "  </div>" +
      "  <div class='form-row'>" +
      "    <label for='student-token'>Student ID No.</label>" +
      "    <input id='student-token' type='text' placeholder='Enter your token' value='" + escapeHtml(PREFILL_TOKEN || state.studentToken) + "'" + (PREFILL_TOKEN ? " readonly style='background:#f3f4f6;cursor:not-allowed;'" : "") + " />" +
      "    <p style='font-size:0.9rem;color:#111827;margin-top:6px;'><strong>Student Token must be your official student ID number.</strong></p>" +
      (PREFILL_TOKEN ? "    <p style='font-size:0.85rem;color:#6b7280;margin-top:4px;'>Your Student ID No. has been carried over from your previous attempt.</p>" : "") +
      "  </div>" +
      "  <div class='consent-row'>" +
      "    <input id='policy-ack' type='checkbox' " + (state.consentAccepted ? "checked" : "") + " />" +
      "    <label for='policy-ack'>I acknowledge and agree to all policies above, including the requirement to enter my official student ID number correctly.</label>" +
      "  </div>" +
      "  <button class='btn btn-primary' id='btn-start' type='button' disabled>Start Lab</button>" +
      "</section>";

    const tokenInput = document.getElementById("student-token");
    const ack = document.getElementById("policy-ack");
    const startBtn = document.getElementById("btn-start");

    function showStartMessage(text, color) {
      let msg = document.getElementById("attempt-limit-msg");
      if (!msg) {
        msg = document.createElement("p");
        msg.id = "attempt-limit-msg";
        msg.style.fontWeight = "bold";
        msg.style.marginTop = "0.75rem";
        startBtn.parentNode.insertBefore(msg, startBtn.nextSibling);
      }
      msg.style.color = color || "#555";
      msg.textContent = text;
    }

    function refreshStartEnabled() {
      const token = tokenInput.value.trim();
      startBtn.disabled = !(token && ack.checked);
    }

    tokenInput.addEventListener("input", refreshStartEnabled);
    ack.addEventListener("change", refreshStartEnabled);
    refreshStartEnabled();

    startBtn.addEventListener("click", function () {
      const token = tokenInput.value.trim();
      if (!token || !ack.checked) {
        return;
      }

      startBtn.disabled = true;
      startBtn.textContent = "Checking eligibility...";

      checkAttemptLimit(token, function (result) {
        if (result.error) {
          startBtn.disabled = false;
          startBtn.textContent = "Start Lab";
          showStartMessage(result.error, "#c0392b");
          return;
        }

        if (!result.allowed) {
          startBtn.disabled = true;
          startBtn.textContent = "Attempt Limit Reached";
          showStartMessage(
            "You have already completed " + result.count + " attempt(s). The maximum is 2. Contact your instructor if you believe this is an error.",
            "#c0392b"
          );
          return;
        }

        // Eligible — proceed with normal start flow
        // Remove ?token= from URL bar now that it has been consumed
        // Remove ?token= and ?score1= from URL bar now that they have been consumed
        if (new URLSearchParams(window.location.search).has("token") || new URLSearchParams(window.location.search).has("score1")) {
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("token");
          cleanUrl.searchParams.delete("score1");
          window.history.replaceState(null, "", cleanUrl.toString());
        }
        state.studentToken = token;
        state.consentAccepted = true;
        if (!state.appStartIso) {
          state.appStartIso = new Date().toISOString();
        }
        state.attemptNumber = result.count + 1;

        if (!state.overallSecondsLeft || state.overallSecondsLeft <= 0) {
          state.overallSecondsLeft = OVERALL_LIMIT_SECONDS;
        }
        if (!state.moduleSecondsLeft || state.moduleSecondsLeft <= 0) {
          state.moduleSecondsLeft = MODULE_LIMIT_SECONDS;
        }

        persistState(false);

        if (!state.moduleSubmitted) {
          initializeModuleForStudent(token);
          startDualTimers();
        }

        goTo(state.screenOrder[0]);
      });
    });
  }

    function renderModuleIntro(screen) {
      var scenarioBlock = "";
      if (screen.scenarioTitle) {
        scenarioBlock =
          "<div class='policy-box'>" +
          "  <strong>Scenario</strong>" +
          "  <p class='widget-note'><strong>" + escapeHtml(screen.scenarioTitle) + "</strong></p>" +
          (screen.scenarioDescription ? "  <p>" + escapeHtml(screen.scenarioDescription) + "</p>" : "") +
          "</div>";
      }
      appRoot.innerHTML = "" +
        "<section class='screen-card'>" +
        "  <h2>" + escapeHtml(screen.title) + "</h2>" +
        "  <p>" + escapeHtml(screen.intro || "Review the module overview, then continue when ready.") + "</p>" +
        scenarioBlock +
        "  <div class='policy-box'>" +
        "    <strong>Current Module</strong>" +
        "    <p class='widget-note'>" + escapeHtml(screen.tag || ("Module " + state.activeModuleKey)) + "</p>" +
        "  </div>" +
        "</section>";

      updateNavState();
    }

  function initializeModuleForStudent(studentToken, moduleKey, existingScenario) {
    const targetModuleKey = String(moduleKey || getFirstPendingModuleKey() || ACTIVE_MODULE_KEY).toUpperCase();
    const built = buildModuleForStudent(targetModuleKey, studentToken, existingScenario);
    if (!built) {
      return;
    }

    window.SCREENS = built.screens;
    state.scenario = built.scenario;
    state.moduleTemplateId = built.templateId;
    state.activeModuleKey = String(built.moduleKey || targetModuleKey).toUpperCase();
    state.moduleStartIsoByKey[state.activeModuleKey] = state.moduleStartIsoByKey[state.activeModuleKey] || new Date().toISOString();
    state.moduleEndIsoByKey[state.activeModuleKey] = null;
    state.screenOrder = built.screenOrder;
    state.questionScreenIds = built.questionScreenIds;
    state.weights = Object.assign({}, built.weights);
    state.answersByScreen = {};
    state.gradesByScreen = {};
    state.moduleSubmitted = false;
    state.submitReason = null;
    state.confidence = 50;
    state.continueConfirmed = false;
    state.currentScreen = built.screenOrder[0];
  }

  function getFirstPendingModuleKey() {
    const moduleScores = mergeModuleMap(state.moduleScoresByKey, null);
    return MODULE_SEQUENCE.find(function (key) {
      return !Number.isFinite(moduleScores[key]);
    }) || null;
  }

  function getNextModuleKey(currentModuleKey) {
    const current = String(currentModuleKey || "").toUpperCase();
    const idx = MODULE_SEQUENCE.indexOf(current);
    if (idx < 0 || idx >= MODULE_SEQUENCE.length - 1) {
      return null;
    }
    return MODULE_SEQUENCE[idx + 1];
  }

  function getScenarioVar(scenario, key, fallback) {
    const vars = scenario && scenario.randomVars ? scenario.randomVars : {};
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key];
    }
    return fallback;
  }

  function buildModuleForStudent(moduleKey, studentToken, existingScenario) {
    const key = String(moduleKey || ACTIVE_MODULE_KEY).toUpperCase();
    const scenario = existingScenario || (window.ScenarioLoader
      ? window.ScenarioLoader.loadScenario(key, studentToken, state.attemptNumber || 1, SCENARIO_SALT)
      : null);

    if (key === "A") {
      return buildModuleAFromScenario(scenario);
    }
    if (key === "B") {
      return buildModuleBFromScenario(scenario);
    }
    if (key === "C" && window.ModuleCConfig) {
      const builtC = window.ModuleCConfig.buildModuleCFromScenario(scenario, studentToken);
      builtC.scenario = scenario;
      return builtC;
    }
    return null;
  }

  function buildModuleAFromScenario(scenario) {
    const templateId = String((scenario && scenario.templateId) || "A-default");
    const isPrintShop = templateId.indexOf("campus-print-shop") >= 0;

    const title = String((scenario && scenario.title) || "Module A");
    const context = String((scenario && scenario.context) || "Lean operations diagnostics.");

    // --- Available time and demand (used in A-05 Takt & Manpower) ---
    const availMin = isPrintShop
      ? Number(getScenarioVar(scenario, "openMinutes", 480)) - Number(getScenarioVar(scenario, "setupLossMinutes", 45))
      : Number(getScenarioVar(scenario, "availableMinutes", 420));
    const demand = isPrintShop
      ? Number(getScenarioVar(scenario, "ordersPerDay", 200))
      : Number(getScenarioVar(scenario, "dailyDemand", 250));
    const totalWorkContent = Number(getScenarioVar(scenario, "totalWorkContent", 140));
    const takt = roundTo(availMin / Math.max(1, demand), 2);
    const operators = Math.ceil(totalWorkContent / Math.max(0.01, takt));

    // --- VA Flow % (A-03) ---
    const vaMin = Number(getScenarioVar(scenario, "vaMinutes", 55));
    const nvaMin = Number(getScenarioVar(scenario, "nvaMinutes", 45));
    const totalFlowMin = vaMin + nvaMin;
    const vaFlowPct = roundTo((vaMin / Math.max(1, totalFlowMin)) * 100, 1);

    // --- Kanban Cards (A-04) ---
    const demandPerHr = roundTo(demand / Math.max(0.01, availMin / 60), 1);
    const kanbanL = 2.0;
    const kanbanAlpha = Number(getScenarioVar(scenario, "kanbanAlpha", 0.15));
    const kanbanC = Math.max(5, Math.round(demand / 20));
    const kanbanN = Math.ceil((demandPerHr * kanbanL * (1 + kanbanAlpha)) / Math.max(1, kanbanC));

    // --- Waste cards (A-02) ---
    const wasteRows = isPrintShop
      ? [
        { id: "trim", label: "Trimming final brochure edges" },
        { id: "rush", label: "Interrupting queue for urgent re-run" },
        { id: "proof", label: "Customer proof confirmation" },
        { id: "idle", label: "Idle waiting at bottleneck station" },
        { id: "inspect", label: "Final quality check before customer handoff" },
        { id: "search", label: "Searching for misplaced job order" }
      ]
      : [
        { id: "seal", label: "Sealing meal-kit carton" },
        { id: "wait", label: "Waiting for refill/reset" },
        { id: "pick", label: "Picking recipe inserts" },
        { id: "recount", label: "Recounting due to mismatch" },
        { id: "label", label: "Applying shipping label to sealed box" },
        { id: "rework", label: "Replacing incorrect item found during check" }
      ];

    const wasteKey = isPrintShop
      ? { trim: "va", proof: "va", inspect: "va", rush: "waste", idle: "waste", search: "waste" }
      : { seal: "va", pick: "va", label: "va", wait: "waste", recount: "waste", rework: "waste" };

    const introId = "a01-intro";
    const q1Id = "a02-waste";
    const q2Id = "a03-va-flow";
    const q3Id = "a04-kanban";
    const q4Id = "a05-takt-manpower";
    const summaryId = "a06-summary";

    const screens = [
      {
        id: introId,
        moduleKey: "A",
        title: "A-01 Intro",
        tag: "Module A",
        type: "intro",
        intro: "Module A covers lean waste classification, flow efficiency, kanban sizing, and takt-time-based manpower planning.",
        scenarioTitle: title,
        scenarioDescription: context
      },
      {
        id: q1Id,
        moduleKey: "A",
        templateId: templateId,
        title: "A-02 Waste Sorting",
        tag: "Module A - Waste Identification",
        type: "dragdrop-classification",
        weight: 25,
        context: "Classify each activity as Value-Added (VA) or Waste.",
        widget: {
          title: "Waste Sorting",
          prompt: "Assign all cards to the correct bin.",
          bins: [
            { id: "va", label: "Value-Added" },
            { id: "waste", label: "Waste" }
          ],
          cards: wasteRows,
          requireAllAssignments: true,
          grading: {
            answerKey: wasteKey,
            maxScore: wasteRows.length
          }
        }
      },
      {
        id: q2Id,
        moduleKey: "A",
        templateId: templateId,
        title: "A-03 VA Flow Percentage",
        tag: "Module A - Flow Efficiency",
        type: "numeric-calc",
        weight: 25,
        context: context,
        scenarioTitle: title,
        scenarioText: "Calculate the percentage of total flow time that is value-added.",
        formulaBox: "VA Flow % = VA Time / (VA Time + NVA Time) \u00d7 100",
        roundingInstruction: "Round to one decimal place.",
        dataTable: {
          headers: ["Metric", "Value"],
          rows: [
            ["VA time", String(vaMin) + " min"],
            ["NVA time", String(nvaMin) + " min"],
            ["Total flow time", String(totalFlowMin) + " min"]
          ]
        },
        inputs: [
          { id: "va_pct", label: "VA Flow %", unit: "%", required: true, placeholder: "e.g. 55.0" }
        ],
        grading: {
          numericItems: [
            { itemId: "a03_va_pct", inputId: "va_pct", answer: vaFlowPct, tolerance: 0.5, maxScore: 1 }
          ]
        }
      },
      {
        id: q3Id,
        moduleKey: "A",
        templateId: templateId,
        title: "A-04 Kanban Card Calculation",
        tag: "Module A - Pull Systems",
        type: "numeric-calc",
        weight: 25,
        context: context,
        scenarioTitle: title,
        scenarioText: "Determine the number of kanban cards needed to authorize pull between workstations.",
        formulaBox: "N = \u2308 D \u00d7 L \u00d7 (1 + \u03b1) / C \u2309\nD = demand/hr,  L = lead time (hrs),  \u03b1 = safety factor,  C = container size",
        roundingInstruction: "Always round UP to the nearest whole card.",
        dataTable: {
          headers: ["Parameter", "Symbol", "Value"],
          rows: [
            ["Demand rate", "D", String(demandPerHr) + " units/hr"],
            ["Replenishment lead time", "L", String(kanbanL) + " hrs"],
            ["Safety factor", "\u03b1", String(kanbanAlpha)],
            ["Container size", "C", String(kanbanC) + " units/card"]
          ]
        },
        inputs: [
          { id: "kanban_n", label: "Number of Kanban Cards", unit: "cards", required: true, placeholder: "0" }
        ],
        grading: {
          numericItems: [
            { itemId: "a04_kanban_n", inputId: "kanban_n", answer: kanbanN, tolerance: 0, maxScore: 1 }
          ]
        }
      },
      {
        id: q4Id,
        moduleKey: "A",
        templateId: templateId,
        title: "A-05 Takt Time & Manpower",
        tag: "Module A - Line Balancing",
        type: "numeric-calc",
        weight: 25,
        context: context,
        scenarioTitle: title,
        scenarioText: "Calculate takt time and the minimum number of operators needed to meet demand.",
        formulaBox: "Takt = Available Time / Demand\nOperators = \u2308 Total Work Content / Takt \u2309",
        roundingInstruction: "Takt to 2 decimals; operators round UP.",
        dataTable: {
          headers: ["Metric", "Value"],
          rows: [
            [isPrintShop ? "Adjusted available time" : "Available time", String(availMin) + " min"],
            [isPrintShop ? "Orders per day" : "Daily demand", String(demand) + " units"],
            ["Total work content", String(totalWorkContent) + " min"]
          ]
        },
        inputs: [
          { id: "takt", label: "Takt time", unit: "min/unit", required: true, placeholder: "e.g. 2.00" },
          { id: "operators", label: "Min. operators", unit: "operators", required: true, placeholder: "0" }
        ],
        grading: {
          numericItems: [
            { itemId: "a05_takt", inputId: "takt", answer: takt, tolerance: 0.03, maxScore: 1 },
            { itemId: "a05_operators", inputId: "operators", answer: operators, tolerance: 0, maxScore: 1 }
          ]
        }
      },
      {
        id: summaryId,
        moduleKey: "A",
        title: "A-06 Module Summary",
        tag: "Module A",
        type: "summary"
      }
    ];

    return {
      moduleKey: "A",
      templateId: templateId,
      title: title,
      scenario: scenario,
      screens: screens,
      screenOrder: screens.map(function (s) { return s.id; }),
      questionScreenIds: [q1Id, q2Id, q3Id, q4Id],
      weights: {
        "a02-waste": 25,
        "a03-va-flow": 25,
        "a04-kanban": 25,
        "a05-takt-manpower": 25
      }
    };
  }

  function buildModuleBFromScenario(scenario) {
    const templateId = String((scenario && scenario.templateId) || "B-default");
    const isPharmacy = templateId.indexOf("pharmacy-order-accuracy") >= 0;

    const title = String((scenario && scenario.title) || "Module B");
    const context = String((scenario && scenario.context) || "Quality and SPC diagnostics.");

    // --- Cause cards (B-02) ---
    const causeRows = isPharmacy
      ? [
        { id: "background", label: "Normal pick complexity mix" },
        { id: "incident", label: "Unexpected incident disruption" },
        { id: "staffmix", label: "Routine shift mix variation" },
        { id: "labelswap", label: "Unexpected shelf label swap" },
        { id: "trainingvar", label: "Slight variation from new staff training cycle" },
        { id: "systemdown", label: "Inventory system outage halting picks" }
      ]
      : [
        { id: "noise", label: "Minor ambient vibration" },
        { id: "issue", label: "Shift-level disruption event" },
        { id: "wear", label: "Normal component wear" },
        { id: "jam", label: "Sudden capper jam" },
        { id: "temp", label: "Normal seasonal temperature fluctuation" },
        { id: "powerspike", label: "Unexpected power surge tripping equipment" }
      ];

    const answerKey = isPharmacy
      ? { background: "common", staffmix: "common", trainingvar: "common", incident: "assignable", labelswap: "assignable", systemdown: "assignable" }
      : { noise: "common", wear: "common", temp: "common", issue: "assignable", jam: "assignable", powerspike: "assignable" };

    // --- Process Capability (B-03): Cp & Cpk ---
    const usl = Number(getScenarioVar(scenario, "usl", 505));
    const lsl = Number(getScenarioVar(scenario, "lsl", 495));
    const meanFill = Number(getScenarioVar(scenario, "meanFill", 500));
    const stdevFill = Number(getScenarioVar(scenario, "stdevFill", 1.5));
    const sigma = Math.max(0.001, stdevFill);
    const cp = roundTo((usl - lsl) / (6 * sigma), 3);
    const cpkU = (usl - meanFill) / (3 * sigma);
    const cpkL = (meanFill - lsl) / (3 * sigma);
    const cpk = roundTo(Math.min(cpkU, cpkL), 3);

    // --- Control Chart OOC Count (B-04) ---
    const cl = roundTo(meanFill, 2);
    const ucl = roundTo(cl + 3 * sigma, 3);
    const lclChart = roundTo(cl - 3 * sigma, 3);
    // Seeded OOC count: 1-4 points placed outside limits.
    // OOC candidate slots (0-indexed): 2, 6, 4, 0 (i.e., positions 3, 7, 5, 1).
    // OOC values alternate above/below: +3.5σ, -3.8σ, +3.6σ, -3.4σ
    const oocCount = Number(getScenarioVar(scenario, "oocCount", 2));
    const OOC_SLOTS   = [2, 6, 4, 0];
    const OOC_OFFSETS = [3.5, -3.8, 3.6, -3.4];
    // Base in-control offsets for all 8 positions
    const baseOffsets = [0.5, -1.2, 0.8, 1.1, -0.3, 0.6, -1.5, 0.9];
    const rawOffsets  = baseOffsets.slice();
    for (var _i = 0; _i < oocCount; _i++) {
      rawOffsets[OOC_SLOTS[_i]] = OOC_OFFSETS[_i];
    }
    const sampleMeans = rawOffsets.map(function (off) { return roundTo(cl + off * sigma, 3); });
    const sampleRows = sampleMeans.map(function (v, i) { return [String(i + 1), String(v)]; });

    // --- p-Chart (B-05) ---
    const n = isPharmacy ? Math.max(10, Number(getScenarioVar(scenario, "sampleSize", 60))) : 50;
    const totalNonconf = isPharmacy ? Number(getScenarioVar(scenario, "observedDefects", 20)) : 18;
    const nc0 = Math.max(0, Math.round(totalNonconf * 0.18));
    const nc1 = Math.max(0, Math.round(totalNonconf * 0.22));
    const nc2 = Math.max(0, Math.round(totalNonconf * 0.20));
    const nc3 = Math.max(0, Math.round(totalNonconf * 0.25));
    const nc4 = Math.max(0, totalNonconf - nc0 - nc1 - nc2 - nc3);
    const sampleNonconfs = [nc0, nc1, nc2, nc3, nc4];
    const totalNC = sampleNonconfs.reduce(function (s, v) { return s + v; }, 0);
    const actualPBar = roundTo(totalNC / (5 * n), 4);
    const actualSigmaP = roundTo(Math.sqrt(actualPBar * (1 - actualPBar) / Math.max(1, n)), 4);
    const pUCL = roundTo(actualPBar + 3 * actualSigmaP, 4);
    const pLCL = roundTo(Math.max(0, actualPBar - 3 * actualSigmaP), 4);
    const pSampleRows = sampleNonconfs.map(function (nc, i) {
      return [String(i + 1), String(n), String(nc), roundTo(nc / Math.max(1, n), 4).toFixed(4)];
    });

    const introId = "b01-intro";
    const q1Id = "b02-cause";
    const q2Id = "b03-capability";
    const q3Id = "b04-control-chart";
    const q4Id = "b05-pchart";
    const summaryId = "b06-summary";

    const screens = [
      {
        id: introId,
        moduleKey: "B",
        title: "B-01 Intro",
        tag: "Module B",
        type: "intro",
        intro: "Module B covers process variation sources, capability indices (Cp & Cpk), control chart OOC identification, and p-chart construction.",
        scenarioTitle: title,
        scenarioDescription: context
      },
      {
        id: q1Id,
        moduleKey: "B",
        templateId: templateId,
        title: "B-02 Cause Classification",
        tag: "Module B - SPC Foundations",
        type: "dragdrop-classification",
        weight: 25,
        context: "Classify each process signal as Common Cause or Assignable Cause.",
        widget: {
          title: "Cause Classification",
          prompt: "Assign all cards to the correct bin.",
          bins: [
            { id: "common", label: "Common Cause" },
            { id: "assignable", label: "Assignable Cause" }
          ],
          cards: causeRows,
          requireAllAssignments: true,
          grading: {
            answerKey: answerKey,
            maxScore: causeRows.length
          }
        }
      },
      {
        id: q2Id,
        moduleKey: "B",
        templateId: templateId,
        title: "B-03 Process Capability (Cp & Cpk)",
        tag: "Module B - Capability Analysis",
        type: "numeric-calc",
        weight: 25,
        context: context,
        scenarioTitle: title,
        scenarioText: "Compute Cp and Cpk from the process statistics. Cp \u2265 1.33 and Cpk \u2265 1.00 indicate a capable process.",
        formulaBox: "Cp  = (USL \u2212 LSL) / (6\u03c3)\nCpk = min[ (USL \u2212 \u03bc) / 3\u03c3,  (\u03bc \u2212 LSL) / 3\u03c3 ]",
        roundingInstruction: "Round to 3 decimal places.",
        dataTable: {
          headers: ["Statistic", "Value"],
          rows: [
            ["USL", String(usl)],
            ["LSL", String(lsl)],
            ["Process Mean (\u03bc)", String(meanFill)],
            ["Process Std Dev (\u03c3)", String(stdevFill)]
          ]
        },
        inputs: [
          { id: "cp", label: "Cp", placeholder: "0.000", required: true },
          { id: "cpk", label: "Cpk", placeholder: "0.000", required: true }
        ],
        grading: {
          numericItems: [
            { itemId: "b03_cp", inputId: "cp", answer: cp, tolerance: 0.01, maxScore: 1 },
            { itemId: "b03_cpk", inputId: "cpk", answer: cpk, tolerance: 0.01, maxScore: 1 }
          ]
        }
      },
      {
        id: q3Id,
        moduleKey: "B",
        templateId: templateId,
        title: "B-04 Control Chart: OOC Identification",
        tag: "Module B - SPC Monitoring",
        type: "numeric-calc",
        weight: 25,
        context: context,
        scenarioTitle: title,
        scenarioText: "Eight consecutive sample means are shown. A point is out-of-control (OOC) if it falls outside the 3\u03c3 limits.",
        formulaBox: "UCL = " + String(ucl) + "\u2003CL = " + String(cl) + "\u2003LCL = " + String(lclChart),
        roundingInstruction: "Enter the OOC count as a whole number.",
        dataTable: {
          headers: ["Sample", "x\u0305"],
          rows: sampleRows
        },
        inputs: [
          { id: "ooc_count", label: "Number of OOC points", unit: "points", required: true, placeholder: "0" }
        ],
        grading: {
          numericItems: [
            { itemId: "b04_ooc_count", inputId: "ooc_count", answer: oocCount, tolerance: 0, maxScore: 1 }
          ]
        }
      },
      {
        id: q4Id,
        moduleKey: "B",
        templateId: templateId,
        title: "B-05 p-Chart Construction",
        tag: "Module B - Attribute Control Chart",
        type: "table-fill",
        weight: 25,
        context: context,
        table: {
          headers: ["Sample", "n", "Nonconforming", "p\u1d35"],
          rows: pSampleRows
        },
        formula: "p\u0304 = \u03a3(nonconforming) / (k \u00d7 n)\n\u03c3\u209a = \u221a[p\u0304(1\u2212p\u0304)/n]\nUCL = p\u0304 + 3\u03c3\u209a\nLCL = max(0, p\u0304 \u2212 3\u03c3\u209a)",
        prompt: "Complete the p-chart summary values using the sample data (n = " + String(n) + ", k = 5). Round to 4 decimal places.",
        columns: [
          { id: "metric", label: "Metric", readOnly: true },
          { id: "value", label: "Value (4 decimals)", editable: true, placeholder: "0.0000" }
        ],
        rows: [
          { id: "pbar", values: { metric: "p\u0304 (average proportion defective)", value: "" } },
          { id: "sigma_p", values: { metric: "\u03c3\u209a (standard deviation of proportion)", value: "" } },
          { id: "pcucl", values: { metric: "UCL", value: "" } },
          { id: "pclcl", values: { metric: "LCL (use 0 if negative)", value: "" } }
        ],
        validation: { requireAllEditable: true },
        grading: {
          itemId: "b05_pchart",
          scoringMode: "cell",
          maxScore: 4,
          cells: [
            { id: "pbar__value", answer: actualPBar, tolerance: 0.001 },
            { id: "sigma_p__value", answer: actualSigmaP, tolerance: 0.001 },
            { id: "pcucl__value", answer: pUCL, tolerance: 0.002 },
            { id: "pclcl__value", answer: pLCL, tolerance: 0.002 }
          ]
        }
      },
      {
        id: summaryId,
        moduleKey: "B",
        title: "B-06 Module Summary",
        tag: "Module B",
        type: "summary"
      }
    ];

    return {
      moduleKey: "B",
      templateId: templateId,
      title: title,
      scenario: scenario,
      screens: screens,
      screenOrder: screens.map(function (s) { return s.id; }),
      questionScreenIds: [q1Id, q2Id, q3Id, q4Id],
      weights: {
        "b02-cause": 25,
        "b03-capability": 25,
        "b04-control-chart": 25,
        "b05-pchart": 25
      }
    };
  }

  function renderQuestionScreen(screen) {
    appRoot.innerHTML = "" +
      "<section class='module-layout'>" +
      "  <article class='panel' id='scenario-panel'></article>" +
      "  <article class='panel' id='widget-panel'></article>" +
      "</section>";

    renderScenario(screen);
    mountWidget(screen);
  }

  function renderScenario(screen) {
    const left = document.getElementById("scenario-panel");
    let html = "" +
      "<span class='scenario-tag'>" + escapeHtml(screen.tag) + "</span>" +
      "<h3>" + escapeHtml(screen.title) + "</h3>" +
      "<p>" + escapeHtml(screen.context) + "</p>";

    if (screen.table) {
      html += "<table class='data-table'><thead><tr>" +
        screen.table.headers.map(function (h) { return "<th>" + escapeHtml(h) + "</th>"; }).join("") +
        "</tr></thead><tbody>" +
        screen.table.rows.map(function (row) {
          return "<tr>" + row.map(function (cell) {
            return "<td>" + escapeHtml(String(cell)) + "</td>";
          }).join("") + "</tr>";
        }).join("") +
        "</tbody></table>";
    }

    if (screen.formula) {
      html += "<div class='formula'>" + escapeHtml(screen.formula) + "</div>";
    }

    if (screen.chartBars) {
      html += "<div class='mini-chart'>" +
        screen.chartBars.map(function (height) {
          return "<div style='height:" + Number(height) + "%;'></div>";
        }).join("") +
        "</div>";
    }

    if (state.moduleSubmitted) {
      html += "<p class='lock-note'>This module is submitted. Responses are locked.</p>";
    }

    left.innerHTML = html;
  }

  function mountWidget(screen) {
    const right = document.getElementById("widget-panel");
    const opts = {
      locked: state.moduleSubmitted,
      onChange: function () {
        collectCurrentAnswer();
        updateNavState();
      }
    };

    const saved = state.answersByScreen[screen.id] || null;

    if (screen.type === "numeric-calc") {
      activeWidget = NumericCalcScreen.mount(right, screen, saved, opts);
      return;
    }

    if (screen.type === "dropdown-row") {
      activeWidget = DropdownRow.mount(right, screen, saved, opts);
      return;
    }

    if (screen.type === "branch-decision") {
      activeWidget = BranchDecision.mount(right, screen, saved, opts);
      return;
    }

    if (screen.type === "table-fill") {
      activeWidget = TableFill.mount(right, screen, saved, opts);
      return;
    }

    if (screen.type === "chart-point-plot") {
      activeWidget = ChartPointPlot.mount(right, screen, saved, opts);
      return;
    }

    if (screen.type === "dragdrop-classification") {
      const widgetCfg = Object.assign({}, screen.widget, {
        id: screen.id,
        moduleKey: screen.moduleKey,
        cardSetId: screen.cardSetId
      });
      activeWidget = DragDropClassification.mount(right, widgetCfg, saved, opts);
      return;
    }

    activeWidget = null;
  }

  function renderSummary(screen) {
    collectCurrentAnswer();
    persistState(false);

    const rawScore = computeRawScore();
    const confidenceValue = Number.isFinite(state.confidence) ? Number(state.confidence) : 50;
    const finalResults = computeFinalResults();
    const showInstructor = isInstructorViewEnabled();

    // Send final scores to backend when all modules are complete.
    if (finalResults.isComplete && state.backendSubmitStatus === "idle") {
      sendResultsToBackend(finalResults);
    }
    const instructorSummary = buildIntegritySummary();

    const detailRows = state.questionScreenIds.map(function (screenId) {
      const s = window.SCREENS.find(function (row) { return row.id === screenId; });
      const label = s ? s.title : screenId;
      const weight = Number(state.weights[screenId] || 0);
      const g = state.gradesByScreen[screenId];
      const pct = g && Number.isFinite(g.percentage) ? Number(g.percentage) : 0;
      const weighted = roundTo((weight * pct) / 100, 2);
      return "<tr><td>" + escapeHtml(label) + "</td><td>" + escapeHtml(String(weight)) + "</td><td>" + escapeHtml(String(roundTo(pct, 2))) + "%</td><td>" + escapeHtml(String(weighted)) + "</td></tr>";
    }).join("");

    const pendingModules = finalResults.pendingModules.length
      ? "<p class='widget-note'>Complete modules: " + escapeHtml(finalResults.pendingModules.join(", ")) + " to unlock final recovery results.</p>"
      : "";

    const finalResultsHtml = finalResults.isComplete
      ? "" +
      "  <section class='final-results'>" +
      "    <h3>Final Results Workflow</h3>" +
      "    <div class='summary-grid'>" +
      "      <div class='summary-item'><h3>Overall App Score</h3><p class='summary-big'>" + escapeHtml(String(finalResults.overallScore)) + " / 100</p></div>" +
      "      <div class='summary-item'><h3>Recovery Credit Earned</h3><p class='summary-big'>" + escapeHtml(String(finalResults.recoveryCreditPercent)) + "%</p></div>" +
      "      <div class='summary-item'><h3>Module A Score</h3><p class='summary-big'>" + escapeHtml(String(finalResults.moduleScores.A)) + "</p></div>" +
      "      <div class='summary-item'><h3>Module B Score</h3><p class='summary-big'>" + escapeHtml(String(finalResults.moduleScores.B)) + "</p></div>" +
      "      <div class='summary-item'><h3>Module C Score</h3><p class='summary-big'>" + escapeHtml(String(finalResults.moduleScores.C)) + "</p></div>" +
      "    </div>" +
      "    <p class='encouragement-note'>" + escapeHtml(finalResults.encouragementMessage) + "</p>" +
      "    <div class='export-actions'>" +
      "      <button class='btn btn-secondary' id='btn-export-json' type='button'>Download JSON</button>" +
      "      <button class='btn btn-secondary' id='btn-export-csv' type='button'>Download CSV</button>" +
      "    </div>" +
      "    <p class='widget-note' id='export-status'></p>" +
      "    <p class='widget-note' id='backend-submit-status'></p>" +
      "    <button class='btn btn-secondary' id='btn-retry-submit' type='button' style='display:none'>Retry Backend Submit</button>" +
      "    <hr style='margin:1.5rem 0' />" +
      "    <h3>Start a New Attempt</h3>" +
      "    <p class='widget-note'>You may take up to 2 attempts. Starting a new attempt will clear this session.</p>" +
      "    <button class='btn btn-secondary' id='btn-new-attempt' type='button'>Start New Attempt</button>" +
      "    <p class='widget-note' id='new-attempt-status'></p>" +
      "  </section>"
      : pendingModules;

    const instructorPanelHtml = showInstructor
      ? "" +
      "  <section class='final-results instructor-panel'>" +
      "    <h3>Instructor Export and Analytics</h3>" +
      "    <p class='widget-note'>Integrity flags: " + escapeHtml(instructorSummary.flagCodes.join(", ") || "NONE") + "</p>" +
      "    <div class='summary-grid'>" +
      "      <div class='summary-item'><h3>Student ID</h3><p>" + escapeHtml(String(state.studentToken || "")) + "</p></div>" +
      "      <div class='summary-item'><h3>Attempt Number</h3><p>" + escapeHtml(String(state.attemptNumber || 1)) + "</p></div>" +
      "      <div class='summary-item'><h3>Seed</h3><p>" + escapeHtml(String(resolveSeedForExport() || "")) + "</p></div>" +
      "      <div class='summary-item'><h3>Answer Changes</h3><p>" + escapeHtml(String(sumAnswerChanges())) + "</p></div>" +
      "    </div>" +
      "    <div class='export-actions'>" +
      "      <button class='btn btn-secondary' id='btn-instructor-export-json' type='button'>Instructor JSON</button>" +
      "      <button class='btn btn-secondary' id='btn-instructor-export-csv' type='button'>Instructor CSV</button>" +
      "    </div>" +
      "    <p class='widget-note' id='instructor-export-status'></p>" +
      "  </section>"
      : "";

    appRoot.innerHTML = "" +
      "<section class='screen-card'>" +
      "  <h2>" + escapeHtml(screen.title) + "</h2>" +
      "  <p>Module submitted" + (state.submitReason ? " (" + escapeHtml(state.submitReason) + ")" : "") + ". Responses are locked.</p>" +
      "  <div class='summary-grid'>" +
      "    <div class='summary-item'><h3>Raw Module Score</h3><p class='summary-big'>" + escapeHtml(String(rawScore)) + " / 100</p></div>" +
      "    <div class='summary-item'><h3>Confidence</h3><label for='confidence-slider'>How confident are you in your answers?</label><input id='confidence-slider' type='range' min='0' max='100' step='1' value='" + escapeHtml(String(confidenceValue)) + "' /><p id='confidence-value'>" + escapeHtml(String(confidenceValue)) + "%</p></div>" +
      "  </div>" +
      "  <table class='data-table summary-table'><thead><tr><th>Screen</th><th>Weight</th><th>Screen %</th><th>Weighted</th></tr></thead><tbody>" + detailRows + "</tbody></table>" +
      "  <p class='widget-note'>No backtracking is allowed after module submission.</p>" +
      "  <button class='btn btn-primary' id='btn-continue' type='button'>Continue</button>" +
      "  <p class='widget-note' id='continue-status'>" + (state.continueConfirmed ? "Continue recorded." : "") + "</p>" +
      finalResultsHtml +
      instructorPanelHtml +
      "</section>";

    BottomBar.setButtons(false, "Locked", true);
    BottomBar.setWarning(state.moduleSubmitted ? "Module is submitted. Navigation is locked." : "");

    const slider = document.getElementById("confidence-slider");
    const sliderValue = document.getElementById("confidence-value");
    slider.addEventListener("input", function () {
      state.confidence = Number(slider.value);
      sliderValue.textContent = String(state.confidence) + "%";
      persistState(false);
    });

    document.getElementById("btn-continue").addEventListener("click", function () {
      state.continueConfirmed = true;
      persistState(false);

      const nextKey = getNextModuleKey(state.activeModuleKey);
      if (nextKey) {
        state.moduleSecondsLeft = MODULE_LIMIT_SECONDS;
        initializeModuleForStudent(state.studentToken, nextKey, null);
        stopDualTimers();
        startDualTimers();
        goTo(state.screenOrder[0]);
        return;
      }

      const status = document.getElementById("continue-status");
      if (status) {
        status.textContent = "Continue recorded.";
      }
    });

    if (finalResults.isComplete) {
      const jsonBtn = document.getElementById("btn-export-json");
      const csvBtn = document.getElementById("btn-export-csv");
      const exportStatus = document.getElementById("export-status");
      const retrySubmitBtn = document.getElementById("btn-retry-submit");

      updateBackendSubmitUi();

      if (retrySubmitBtn) {
        retrySubmitBtn.addEventListener("click", function () {
          state.backendSubmitStatus = "idle";
          state.backendSubmitMessage = "";
          persistState(false);
          sendResultsToBackend(finalResults);
        });
      }

      if (jsonBtn) {
        jsonBtn.addEventListener("click", function () {
          const payload = buildFinalExportPayload(finalResults);
          const json = JSON.stringify(payload, null, 2);
          const fileName = buildExportFileName("json");
          triggerDownload(fileName, json, "application/json;charset=utf-8");
          exportStatus.textContent = "JSON export downloaded.";
        });
      }

      if (csvBtn) {
        csvBtn.addEventListener("click", function () {
          const payload = buildFinalExportPayload(finalResults);
          const csv = buildFinalCsv(payload);
          const fileName = buildExportFileName("csv");
          triggerDownload(fileName, csv, "text/csv;charset=utf-8");
          exportStatus.textContent = "CSV export downloaded.";
        });
      }

      const newAttemptBtn = document.getElementById("btn-new-attempt");
      const newAttemptStatus = document.getElementById("new-attempt-status");
      if (newAttemptBtn) {
        newAttemptBtn.addEventListener("click", function () {
          const token = String(state.studentToken || "").trim();
          newAttemptBtn.disabled = true;
          newAttemptBtn.textContent = "Checking eligibility...";
          checkAttemptLimit(token, function (result) {
            if (result.error) {
              newAttemptBtn.disabled = false;
              newAttemptBtn.textContent = "Start New Attempt";
              if (newAttemptStatus) {
                newAttemptStatus.style.color = "#c0392b";
                newAttemptStatus.textContent = result.error;
              }
              return;
            }

            if (!result.allowed) {
              newAttemptBtn.textContent = "Attempt Limit Reached";
              if (newAttemptStatus) {
                newAttemptStatus.style.color = "#c0392b";
                newAttemptStatus.textContent = "You have already used " + result.count + " of 2 allowed attempts.";
              }
              return;
            }
            // Eligible — navigate to reset URL to start fresh
            const url = new URL(window.location.href);
            url.searchParams.set("reset", "1");
            url.searchParams.set("token", token);
            window.location.href = url.toString();
          });
        });
      }
    }

    if (showInstructor) {
      const exportStatus = document.getElementById("instructor-export-status");
      const instructorJsonBtn = document.getElementById("btn-instructor-export-json");
      const instructorCsvBtn = document.getElementById("btn-instructor-export-csv");

      if (instructorJsonBtn) {
        instructorJsonBtn.addEventListener("click", function () {
          const payload = buildInstructorExportPayload(finalResults);
          const json = JSON.stringify(payload, null, 2);
          triggerDownload(buildExportFileName("instructor.json"), json, "application/json;charset=utf-8");
          exportStatus.textContent = "Instructor JSON export downloaded.";
        });
      }

      if (instructorCsvBtn) {
        instructorCsvBtn.addEventListener("click", function () {
          const payload = buildInstructorExportPayload(finalResults);
          const csv = buildInstructorCsv(payload);
          triggerDownload(buildExportFileName("instructor.csv"), csv, "text/csv;charset=utf-8");
          exportStatus.textContent = "Instructor CSV export downloaded.";
        });
      }
    }
  }

  function computeRawScore() {
    let total = 0;
    state.questionScreenIds.forEach(function (screenId) {
      const weight = Number(state.weights[screenId] || 0);
      const grade = state.gradesByScreen[screenId];
      if (!grade || !Number.isFinite(grade.maxScore) || grade.maxScore <= 0) {
        return;
      }
      total += weight * (Number(grade.itemScore || 0) / Number(grade.maxScore));
    });
    return roundTo(total, 2);
  }

  function updateNavState() {
    const introId = state.screenOrder[0];
    const summaryId = state.screenOrder[state.screenOrder.length - 1];
    if (state.currentScreen === summaryId) {
      return;
    }

    if (state.currentScreen === introId) {
      BottomBar.setButtons(false, "Start Module", false);
      BottomBar.setWarning("");
      return;
    }

    const idx = state.screenOrder.indexOf(state.currentScreen);
    const hasPrev = !state.moduleSubmitted && idx > 1;
    const atLastQuestion = state.currentScreen === state.questionScreenIds[state.questionScreenIds.length - 1];
    const nextLabel = atLastQuestion ? "Submit Module" : "Next";
    const nextDisabled = state.moduleSubmitted || !canAdvance();

    BottomBar.setButtons(hasPrev, nextLabel, nextDisabled);

    if (isLowTime()) {
      BottomBar.setWarning("Low time warning: submit soon.");
    } else {
      BottomBar.setWarning("");
    }
  }

  function onPrev() {
    if (state.moduleSubmitted) {
      return;
    }

    BottomBar.setWarning("");
    collectCurrentAnswer();

    const idx = state.screenOrder.indexOf(state.currentScreen);
    if (idx <= 1) {
      return;
    }

    goTo(state.screenOrder[idx - 1]);
  }

  function onNext() {
    if (state.moduleSubmitted) {
      return;
    }

    if (!canAdvance()) {
      BottomBar.setWarning("Complete required fields before continuing.");
      updateNavState();
      return;
    }

    collectCurrentAnswer();

    const idx = state.screenOrder.indexOf(state.currentScreen);
    const atLastQuestion = state.currentScreen === state.questionScreenIds[state.questionScreenIds.length - 1];

    if (atLastQuestion) {
      submitModule("MANUAL_SUBMIT");
      return;
    }

    if (idx < state.screenOrder.length - 1) {
      goTo(state.screenOrder[idx + 1]);
    }
  }

  function canAdvance() {
    if (state.moduleSubmitted) {
      return false;
    }

    if (state.questionScreenIds.includes(state.currentScreen)) {
      return Boolean(activeWidget && activeWidget.isAnswered());
    }

    return true;
  }

  function collectCurrentAnswer() {
    if (!activeWidget || state.moduleSubmitted) {
      return;
    }

    const moduleKey = String(state.activeModuleKey || ACTIVE_MODULE_KEY).toUpperCase();
    const priorPayload = state.answersByScreen[state.currentScreen] || null;

    const payload = typeof activeWidget.getResponsePayload === "function"
      ? activeWidget.getResponsePayload()
      : (typeof activeWidget.getValue === "function" ? activeWidget.getValue() : null);

    if (!payload) {
      return;
    }

    if (!arePayloadsEqual(priorPayload, payload)) {
      state.answerChangeCountByModule[moduleKey] = Number(state.answerChangeCountByModule[moduleKey] || 0) + 1;
    }

    state.answersByScreen[state.currentScreen] = payload;

    if (!state.itemResponsesByModule[moduleKey] || typeof state.itemResponsesByModule[moduleKey] !== "object") {
      state.itemResponsesByModule[moduleKey] = {};
    }
    state.itemResponsesByModule[moduleKey][state.currentScreen] = payload;

    if (typeof activeWidget.grade === "function") {
      state.gradesByScreen[state.currentScreen] = activeWidget.grade();
      if (!state.itemScoresByModule[moduleKey] || typeof state.itemScoresByModule[moduleKey] !== "object") {
        state.itemScoresByModule[moduleKey] = {};
      }
      state.itemScoresByModule[moduleKey][state.currentScreen] = state.gradesByScreen[state.currentScreen];
    }

    persistState(false);
  }

  function startDualTimers() {
    if (timer) {
      return;
    }

    timer = TimerEngine.create({
      overallSeconds: state.overallSecondsLeft,
      moduleSeconds: state.moduleSecondsLeft,
      lowThresholdSeconds: LOW_TIME_THRESHOLD_SECONDS,
      onTick: function (t) {
        state.overallSecondsLeft = t.overallRemaining;
        state.moduleSecondsLeft = t.moduleRemaining;
        TopBar.setDualTimer(t.overallRemaining, t.moduleRemaining, t.low);
        const current = window.SCREENS.find(function (s) { return s.id === state.currentScreen; });
        if (current && current.type !== "intro") {
          updateNavState();
        }
        if (t.overallRemaining % 15 === 0 || t.moduleRemaining % 15 === 0) {
          persistState(true);
        }
      },
      onModuleExpire: function () {
        submitModule("MODULE_TIME_EXPIRED");
      },
      onOverallExpire: function () {
        submitModule("OVERALL_TIME_EXPIRED");
      }
    });

    timer.start();
  }

  function stopDualTimers() {
    if (!timer) {
      return;
    }
    timer.stop();
    timer = null;
  }

  function submitModule(reasonCode) {
    if (state.moduleSubmitted) {
      return;
    }

    collectCurrentAnswer();
    state.moduleSubmitted = true;
    state.submitReason = reasonCode;
    recordCurrentModuleScore(reasonCode);
    finalizeCurrentModuleTiming();

    const nextModuleKey = reasonCode === "OVERALL_TIME_EXPIRED"
      ? null
      : getNextModuleKey(state.activeModuleKey);

    if (!nextModuleKey) {
      state.appEndIso = new Date().toISOString();
      recordAttemptHistory();
      stopDualTimers();
    }

    // Always navigate to the current module's summary first.
    // For inter-module transitions the Continue button in renderSummary
    // will initialize the next module and advance to its intro screen.
    persistState(false);
    goTo(state.screenOrder[state.screenOrder.length - 1]);
  }

  function isLowTime() {
    return state.overallSecondsLeft <= LOW_TIME_THRESHOLD_SECONDS || state.moduleSecondsLeft <= LOW_TIME_THRESHOLD_SECONDS;
  }

  function persistState(isAuto) {
    const ok = SessionStore.save(state);
    if (ok) {
      state.lastSavedAt = Date.now();
      TopBar.setAutosave(isAuto ? "Saved (auto)" : "Saved");
    } else {
      TopBar.setAutosave("Save error");
    }
  }

  function resetSession() {
    stopDualTimers();
    SessionStore.clear();
    state = {
      studentToken: "",
      consentAccepted: false,
      currentScreen: WELCOME_SCREEN_ID,
      overallSecondsLeft: OVERALL_LIMIT_SECONDS,
      moduleSecondsLeft: MODULE_LIMIT_SECONDS,
      moduleSubmitted: false,
      submitReason: null,
      scenario: null,
      moduleTemplateId: null,
      activeModuleKey: ACTIVE_MODULE_KEY,
      screenOrder: DEFAULT_BUILD.screenOrder,
      questionScreenIds: DEFAULT_BUILD.questionScreenIds,
      weights: DEFAULT_BUILD.weights,
      answersByScreen: {},
      gradesByScreen: {},
      moduleScoresByKey: createEmptyModuleMap(null),
      moduleConfidenceByKey: createEmptyModuleMap(null),
      moduleCompletionMeta: createEmptyModuleMap(null),
      itemResponsesByModule: createEmptyModuleMap(null),
      itemScoresByModule: createEmptyModuleMap(null),
      moduleDurationsSecByKey: createEmptyModuleMap(null),
      moduleStartIsoByKey: createEmptyModuleMap(null),
      moduleEndIsoByKey: createEmptyModuleMap(null),
      answerChangeCountByModule: createEmptyModuleMap(0),
      responsePathSignatureByModule: createEmptyModuleMap(null),
      attemptHistoryByStudent: {},
      attemptNumber: 1,
      appStartIso: null,
      appEndIso: null,
      backendSubmitStatus: "idle",
      backendSubmitMessage: "",
      confidence: 50,
      continueConfirmed: false,
      lastSavedAt: null
    };
  }

  function showResetButton() {
    const topBarRight = document.querySelector("#top-bar .tb-right");
    if (!topBarRight || document.getElementById("dev-reset-btn")) {
      return;
    }

    const btn = document.createElement("button");
    btn.id = "dev-reset-btn";
    btn.type = "button";
    btn.className = "btn btn-secondary dev-reset-btn";
    btn.textContent = "Reset Session";
    btn.addEventListener("click", function () {
      const ok = window.confirm("Reset local session data for this lab?");
      if (!ok) {
        return;
      }
      resetApp();
    });

    topBarRight.appendChild(btn);
  }

  function showDevModeBanner() {
    if (document.getElementById("dev-mode-banner")) {
      return;
    }

    const banner = document.createElement("div");
    banner.id = "dev-mode-banner";
    banner.className = "dev-mode-banner";
    banner.textContent = "DEV MODE: session restore disabled";
    document.body.appendChild(banner);
  }

  function createEmptyModuleMap(defaultValue) {
    const map = {};
    RECOVERY_CREDIT_CONFIG.moduleKeys.forEach(function (key) {
      map[key] = defaultValue;
    });
    return map;
  }

  function mergeModuleMap(input, defaultValue) {
    const base = createEmptyModuleMap(defaultValue);
    if (!input || typeof input !== "object") {
      return base;
    }
    RECOVERY_CREDIT_CONFIG.moduleKeys.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        base[key] = input[key];
      }
    });
    return base;
  }

  function recordCurrentModuleScore(reasonCode) {
    const moduleKey = String(state.activeModuleKey || ACTIVE_MODULE_KEY).toUpperCase();
    if (!RECOVERY_CREDIT_CONFIG.moduleKeys.includes(moduleKey)) {
      return;
    }

    state.moduleScoresByKey[moduleKey] = roundTo(computeRawScore(), 2);
    state.moduleConfidenceByKey[moduleKey] = Number.isFinite(state.confidence) ? Number(state.confidence) : null;
    state.moduleCompletionMeta[moduleKey] = {
      submittedAt: new Date().toISOString(),
      submitReason: reasonCode || null,
      templateId: state.moduleTemplateId || null
    };
  }

  function computeFinalResults() {
    const moduleScores = mergeModuleMap(state.moduleScoresByKey, null);
    const pendingModules = RECOVERY_CREDIT_CONFIG.moduleKeys.filter(function (key) {
      return !Number.isFinite(moduleScores[key]);
    });
    const isComplete = pendingModules.length === 0;

    if (!isComplete) {
      return {
        moduleScores: moduleScores,
        pendingModules: pendingModules,
        isComplete: false,
        overallScore: null,
        recoveryCreditPercent: null,
        encouragementMessage: ""
      };
    }

    const total = RECOVERY_CREDIT_CONFIG.moduleKeys.reduce(function (sum, key) {
      return sum + Number(moduleScores[key]);
    }, 0);
    const overallScore = roundTo(total / RECOVERY_CREDIT_CONFIG.moduleKeys.length, 2);
    const recoveryCreditPercent = resolveRecoveryPercent(overallScore);

    return {
      moduleScores: moduleScores,
      pendingModules: [],
      isComplete: true,
      overallScore: overallScore,
      recoveryCreditPercent: recoveryCreditPercent,
      encouragementMessage: buildEncouragementMessage(overallScore, state.attemptNumber)
    };
  }

  /**
   * checkAttemptLimit
   * Queries the backend for how many completed attempts exist for this student.
   * Calls callback(allowed: boolean, count: number).
   * Falls back to allowing the attempt if the network call fails.
   */
  function checkAttemptLimit(studentToken, callback) {
    var MAX_ATTEMPTS = 2;
    var token = String(studentToken || "").trim();
    if (!token) {
      callback({ allowed: true, count: 0, error: null });
      return;
    }
    var url = "https://om-recovery-worker.michael-mejza.workers.dev/attempts?student_id=" + encodeURIComponent(token);
    fetch(url, { method: "GET" })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.body || result.body.success === false) {
          callback({
            allowed: false,
            count: 0,
            error: "Unable to verify attempt eligibility right now. Check your connection and try again."
          });
          return;
        }
        var count = Number(result.body.count) || 0;
        callback({ allowed: count < MAX_ATTEMPTS, count: count, error: null });
      })
      .catch(function (err) {
        console.warn("checkAttemptLimit: network error.", err);
        callback({
          allowed: false,
          count: 0,
          error: "Unable to verify attempt eligibility right now. Check your connection and try again."
        });
      });
  }

  function updateBackendSubmitUi() {
    var statusNode = document.getElementById("backend-submit-status");
    var retryBtn = document.getElementById("btn-retry-submit");
    if (!statusNode) {
      return;
    }

    if (state.backendSubmitStatus === "pending") {
      statusNode.textContent = state.backendSubmitMessage || "Submitting final results to backend...";
    } else if (state.backendSubmitStatus === "success") {
      statusNode.textContent = state.backendSubmitMessage || "Final results recorded successfully.";
    } else if (state.backendSubmitStatus === "failed") {
      statusNode.textContent = state.backendSubmitMessage || "Backend submission failed. Retry below.";
    } else {
      statusNode.textContent = "";
    }

    if (retryBtn) {
      retryBtn.style.display = state.backendSubmitStatus === "failed" ? "inline-block" : "none";
      retryBtn.disabled = state.backendSubmitStatus === "pending";
    }
  }

  /**
   * sendResultsToBackend
   * Fire-and-forget POST to the Cloudflare Worker → Apps Script backend.
   * Does not block the UI or affect local scoring/display.
   */
  function sendResultsToBackend(finalResults) {
    if (state.backendSubmitStatus === "pending" || state.backendSubmitStatus === "success") {
      updateBackendSubmitUi();
      return;
    }

    console.log("FINAL SUBMIT FUNCTION RAN");

    var studentId     = String(state.studentToken      || "localtest").trim();
    var canvasUserId  = String(state.canvasUserId      || "").trim();
    var seed          = String(resolveSeedForExport()  || "localtest");
    var moduleAScore  = Number(finalResults.moduleScores && finalResults.moduleScores.A) || 0;
    var moduleBScore  = Number(finalResults.moduleScores && finalResults.moduleScores.B) || 0;
    var moduleCScore  = Number(finalResults.moduleScores && finalResults.moduleScores.C) || 0;
    var appScore      = Number(finalResults.overallScore)          || 0;
    var recovery      = Number(finalResults.recoveryCreditPercent) || 0;

    var payload = {
      action:         "submitAttempt",
      student_id:     studentId,
      canvas_user_id: canvasUserId || "unset",
      seed:           seed,
      module_a:       moduleAScore,
      module_b:       moduleBScore,
      module_c:       moduleCScore,
      app_score:      appScore,
      recovery:       recovery,
      submitted_at:   new Date().toISOString()
    };

    console.log("ABOUT TO SEND TO BACKEND", payload);

    state.backendSubmitStatus = "pending";
    state.backendSubmitMessage = "Submitting final results to backend...";
    persistState(false);
    updateBackendSubmitUi();

    fetch("https://om-recovery-worker.michael-mejza.workers.dev/submit", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          return { ok: res.ok, status: res.status, body: body };
        });
      })
      .then(function (result) {
        var body = result.body || {};
        if (!result.ok || body.success === false) {
          throw new Error(String(body.message || ("Backend submit failed (HTTP " + result.status + ").")));
        }

        var assignedAttempt = Number(body.assignedAttempt);
        if (assignedAttempt > 0) {
          state.attemptNumber = assignedAttempt;
        }

        state.backendSubmitStatus = "success";
        state.backendSubmitMessage = assignedAttempt > 0
          ? "Final results recorded. Attempt #" + assignedAttempt + " confirmed."
          : "Final results recorded successfully.";
        persistState(false);
        updateBackendSubmitUi();
        console.log("Backend response body:", body);
      })
      .catch(function (err) {
        state.backendSubmitStatus = "failed";
        state.backendSubmitMessage = String(err && err.message ? err.message : "Backend submit error. Please retry.");
        persistState(false);
        updateBackendSubmitUi();
        console.error("Backend submit error:", err);
      });
  }

  function resolveRecoveryPercent(overallScore) {
    const score = Number(overallScore);
    const rule = RECOVERY_CREDIT_CONFIG.scale.find(function (r) {
      return score >= Number(r.minScore) && score <= Number(r.maxScore);
    });
    return rule ? Number(rule.recoveryPercent) : 0;
  }

  function buildEncouragementMessage(overallScore, attemptNumber) {
    const score = Number(overallScore);
    const isFirstAttempt = !attemptNumber || Number(attemptNumber) <= 1;

    if (score === 100) {
      return "Perfect score. Outstanding work across all modules.";
    }
    if (score >= 85) {
      return isFirstAttempt
        ? "Excellent work. You may stop here or use your second attempt to push even higher."
        : "Excellent work. You showed strong recovery across all modules.";
    }
    if (score >= 75) {
      return isFirstAttempt
        ? "Great job. Consider using your second attempt — you have a strong foundation to build on."
        : "Great job. Your recovery effort was consistent and effective.";
    }
    if (score >= 65) {
      return isFirstAttempt
        ? "Good progress. Review the areas below and use your second attempt to improve."
        : "Good progress. Your instructor will apply your highest score toward your recovery credit.";
    }
    if (score >= 55) {
      return isFirstAttempt
        ? "Solid effort. Study the concepts covered in each module and use your second attempt."
        : "Solid effort. Your instructor will apply your highest score toward your recovery credit.";
    }
    return isFirstAttempt
      ? "Keep going. Review the fundamentals and use your second attempt to improve your score."
      : "Keep going. Your instructor will apply your highest score toward your recovery credit.";
  }

  function buildFinalExportPayload(finalResults) {
    const nowIso = new Date().toISOString();
    return {
      exportType: "om-recovery-lab-final-results",
      generatedAt: nowIso,
      studentToken: state.studentToken || null,
      completionStatus: {
        allModulesComplete: finalResults.isComplete,
        pendingModules: finalResults.pendingModules.slice()
      },
      moduleScores: finalResults.moduleScores,
      overallScore: finalResults.overallScore,
      recoveryCreditPercent: finalResults.recoveryCreditPercent,
      encouragementMessage: finalResults.encouragementMessage,
      moduleConfidenceByKey: mergeModuleMap(state.moduleConfidenceByKey, null),
      moduleCompletionMeta: mergeModuleMap(state.moduleCompletionMeta, null),
      recoveryCreditConfig: RECOVERY_CREDIT_CONFIG
    };
  }

  function resolveAttemptNumber(studentToken) {
    const key = String(studentToken || "").trim();
    if (!key) {
      return 1;
    }
    const history = state.attemptHistoryByStudent[key];
    return Array.isArray(history) ? history.length + 1 : 1;
  }

  function recordAttemptHistory() {
    const studentId = String(state.studentToken || "").trim();
    if (!studentId) {
      return;
    }
    if (!state.attemptHistoryByStudent[studentId] || !Array.isArray(state.attemptHistoryByStudent[studentId])) {
      state.attemptHistoryByStudent[studentId] = [];
    }
    const signatures = buildResponsePathSignatures();
    const entry = {
      attemptNumber: Number(state.attemptNumber || 1),
      endedAt: state.appEndIso || new Date().toISOString(),
      responsePathSignatureByModule: signatures
    };
    state.attemptHistoryByStudent[studentId].push(entry);
  }

  function finalizeCurrentModuleTiming() {
    const moduleKey = String(state.activeModuleKey || ACTIVE_MODULE_KEY).toUpperCase();
    if (!RECOVERY_CREDIT_CONFIG.moduleKeys.includes(moduleKey)) {
      return;
    }
    const startIso = state.moduleStartIsoByKey[moduleKey] || state.appStartIso;
    const endIso = new Date().toISOString();
    state.moduleEndIsoByKey[moduleKey] = endIso;
    if (startIso) {
      const sec = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000));
      state.moduleDurationsSecByKey[moduleKey] = sec;
    }
    state.responsePathSignatureByModule[moduleKey] = buildSingleModuleResponsePathSignature(moduleKey);
  }

  function arePayloadsEqual(a, b) {
    try {
      return JSON.stringify(a || null) === JSON.stringify(b || null);
    } catch (_) {
      return false;
    }
  }

  function buildResponsePathSignatures() {
    const signatures = createEmptyModuleMap(null);
    RECOVERY_CREDIT_CONFIG.moduleKeys.forEach(function (key) {
      signatures[key] = buildSingleModuleResponsePathSignature(key);
    });
    return signatures;
  }

  function buildSingleModuleResponsePathSignature(moduleKey) {
    const bucket = state.itemResponsesByModule[moduleKey];
    if (!bucket || typeof bucket !== "object") {
      return null;
    }
    const orderedKeys = Object.keys(bucket).sort();
    const compact = orderedKeys.map(function (screenId) {
      const payload = bucket[screenId];
      return [screenId, payload ? payload.responses || payload : null];
    });
    try {
      return JSON.stringify(compact);
    } catch (_) {
      return null;
    }
  }

  function sumAnswerChanges() {
    return RECOVERY_CREDIT_CONFIG.moduleKeys.reduce(function (sum, key) {
      return sum + Number(state.answerChangeCountByModule[key] || 0);
    }, 0);
  }

  function buildIntegritySummary() {
    const flags = [];
    const reasons = [];
    const totalDuration = RECOVERY_CREDIT_CONFIG.moduleKeys.reduce(function (sum, key) {
      return sum + Number(state.moduleDurationsSecByKey[key] || 0);
    }, 0);
    const expectedDuration = RECOVERY_CREDIT_CONFIG.moduleKeys.length * MODULE_LIMIT_SECONDS;
    const shortThreshold = Math.round(expectedDuration * Number(INTEGRITY_RULES.shortCompletionRatio));

    if (totalDuration > 0 && totalDuration <= shortThreshold) {
      flags.push("SHORT_TIME");
      reasons.push("Total completion time is extremely short for all modules.");
    }

    const answerChanges = sumAnswerChanges();
    if (answerChanges >= Number(INTEGRITY_RULES.highAnswerChangeThreshold)) {
      flags.push("HIGH_CHANGES");
      reasons.push("Answer-change count is unusually high.");
    }

    const repeated = hasRepeatedIdenticalPathAcrossAttempts();
    if (repeated) {
      flags.push("REPEATED_PATH");
      reasons.push("Response path appears identical across attempts.");
    }

    return {
      hasFlags: flags.length > 0,
      flagCodes: flags,
      reasons: reasons,
      metrics: {
        totalDurationSec: totalDuration,
        shortDurationThresholdSec: shortThreshold,
        answerChanges: answerChanges
      }
    };
  }

  function hasRepeatedIdenticalPathAcrossAttempts() {
    const studentId = String(state.studentToken || "").trim();
    if (!studentId) {
      return false;
    }
    const history = state.attemptHistoryByStudent[studentId];
    if (!Array.isArray(history) || !history.length) {
      return false;
    }
    const current = JSON.stringify(buildResponsePathSignatures());
    return history.some(function (entry) {
      return JSON.stringify(entry.responsePathSignatureByModule || {}) === current;
    });
  }

  function resolveSeedForExport() {
    if (state.scenario && state.scenario.debug && state.scenario.debug.varsSeed) {
      return state.scenario.debug.varsSeed;
    }
    return null;
  }

  function isInstructorViewEnabled() {
    if (typeof location === "undefined") {
      return DEV_MODE;
    }
    return DEV_MODE || /(^|&)instructor=1(&|$)/.test(String(location.search || "").replace(/^\?/, ""));
  }

  function resetApp() {
    clearAppLocalStorage();
    location.reload();
  }

  function buildInstructorExportPayload(finalResults) {
    const integrity = buildIntegritySummary();
    const moduleTimes = createEmptyModuleMap(null);
    RECOVERY_CREDIT_CONFIG.moduleKeys.forEach(function (key) {
      moduleTimes[key] = {
        startTime: state.moduleStartIsoByKey[key] || null,
        endTime: state.moduleEndIsoByKey[key] || null,
        durationSec: Number.isFinite(state.moduleDurationsSecByKey[key])
          ? Number(state.moduleDurationsSecByKey[key])
          : null
      };
    });

    return {
      exportType: "om-recovery-lab-instructor-analytics",
      generatedAt: new Date().toISOString(),
      studentId: state.studentToken || null,
      attemptNumber: Number(state.attemptNumber || 1),
      seed: resolveSeedForExport(),
      startTime: state.appStartIso || null,
      endTime: state.appEndIso || null,
      moduleTimes: moduleTimes,
      itemResponses: mergeModuleMap(state.itemResponsesByModule, null),
      itemScores: mergeModuleMap(state.itemScoresByModule, null),
      moduleScores: mergeModuleMap(state.moduleScoresByKey, null),
      overallScore: finalResults.overallScore,
      recoveryCredit: finalResults.recoveryCreditPercent,
      integritySummary: integrity,
      responsePathSignatureByModule: buildResponsePathSignatures()
    };
  }

  function buildInstructorCsv(payload) {
    const moduleTimes = payload.moduleTimes || {};
    const integrity = payload.integritySummary || {};
    const headers = [
      "studentId",
      "attemptNumber",
      "seed",
      "startTime",
      "endTime",
      "moduleATimeSec",
      "moduleBTimeSec",
      "moduleCTimeSec",
      "moduleAScore",
      "moduleBScore",
      "moduleCScore",
      "overallScore",
      "recoveryCredit",
      "integrityFlags",
      "integrityReasons",
      "itemResponsesJson",
      "itemScoresJson"
    ];
    const row = [
      payload.studentId,
      payload.attemptNumber,
      payload.seed,
      payload.startTime,
      payload.endTime,
      moduleTimes.A ? moduleTimes.A.durationSec : null,
      moduleTimes.B ? moduleTimes.B.durationSec : null,
      moduleTimes.C ? moduleTimes.C.durationSec : null,
      payload.moduleScores ? payload.moduleScores.A : null,
      payload.moduleScores ? payload.moduleScores.B : null,
      payload.moduleScores ? payload.moduleScores.C : null,
      payload.overallScore,
      payload.recoveryCredit,
      integrity.flagCodes ? integrity.flagCodes.join("|") : "",
      integrity.reasons ? integrity.reasons.join("|") : "",
      JSON.stringify(payload.itemResponses || {}),
      JSON.stringify(payload.itemScores || {})
    ].map(csvEscapeCell);
    return headers.join(",") + "\n" + row.join(",") + "\n";
  }

  function buildFinalCsv(payload) {
    const headers = [
      "studentToken",
      "moduleAScore",
      "moduleBScore",
      "moduleCScore",
      "overallScore",
      "recoveryCreditPercent",
      "encouragementMessage",
      "generatedAt"
    ];

    const row = [
      payload.studentToken,
      payload.moduleScores ? payload.moduleScores.A : null,
      payload.moduleScores ? payload.moduleScores.B : null,
      payload.moduleScores ? payload.moduleScores.C : null,
      payload.overallScore,
      payload.recoveryCreditPercent,
      payload.encouragementMessage,
      payload.generatedAt
    ].map(csvEscapeCell);

    return headers.join(",") + "\n" + row.join(",") + "\n";
  }

  function csvEscapeCell(value) {
    const raw = value === null || value === undefined ? "" : String(value);
    return "\"" + raw.replace(/\"/g, "\"\"") + "\"";
  }

  function buildExportFileName(ext) {
    const token = (state.studentToken || "student").replace(/[^a-zA-Z0-9_-]/g, "-");
    return "om-recovery-final-results-" + token + "." + ext;
  }

  function triggerDownload(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function roundTo(value, decimals) {
    const d = Number.isFinite(decimals) ? decimals : 2;
    const m = Math.pow(10, d);
    return Math.round(Number(value) * m) / m;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  init();
})();
