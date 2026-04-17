(function (root) {
  "use strict";

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function asRenderedText(input, vars) {
    if (typeof input !== "string") {
      return input;
    }
    return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (_, key) {
      if (Object.prototype.hasOwnProperty.call(vars, key)) {
        return String(vars[key]);
      }
      return "";
    });
  }

  function renderTemplateValues(value, vars) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return renderTemplateValues(item, vars);
      });
    }

    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = renderTemplateValues(value[key], vars);
      });
      return out;
    }

    return asRenderedText(value, vars);
  }

  function instantiateRandomVars(random, defs) {
    const out = {};
    Object.keys(defs || {}).forEach(function (name) {
      const def = defs[name] || {};
      if (def.type === "int") {
        out[name] = random.randomInt(def.min, def.max);
        return;
      }
      if (def.type === "float") {
        out[name] = random.randomFloat(def.min, def.max, def.decimals);
        return;
      }
      if (def.type === "choice") {
        out[name] = random.randomChoice(def.options || []);
        return;
      }
      out[name] = def.value;
    });
    return out;
  }

  function modulesMap() {
    return {
      A: root.ModuleAScenarios || [],
      B: root.ModuleBScenarios || [],
      C: root.ModuleCScenarios || [],
    };
  }

  function moduleKeySeedOffset(moduleKey) {
    const offsets = { A: 101, B: 202, C: 303 };
    return offsets[moduleKey] || 0;
  }

  function chooseTemplate(moduleKey, studentId, attemptNumber, secretSalt) {
    const templates = modulesMap()[moduleKey] || [];
    if (!templates.length) {
      return null;
    }

    const random = root.SeededRandom.createSeededRandom(
      studentId,
      Number(attemptNumber) + moduleKeySeedOffset(moduleKey),
      secretSalt
    );

    const index = random.randomInt(0, templates.length - 1);
    return deepClone(templates[index]);
  }

  function loadScenario(moduleKey, studentId, attemptNumber, secretSalt) {
    const template = chooseTemplate(moduleKey, studentId, attemptNumber, secretSalt);
    if (!template) {
      return null;
    }

    const random = root.SeededRandom.createSeededRandom(
      studentId,
      Number(attemptNumber) + moduleKeySeedOffset(moduleKey) + 9000,
      secretSalt
    );

    const randomVars = instantiateRandomVars(random, template.randomVars);

    return {
      moduleKey: moduleKey,
      templateId: template.templateId,
      title: asRenderedText(template.title, randomVars),
      context: asRenderedText(template.context, randomVars),
      learningTargets: renderTemplateValues(template.learningTargets, randomVars),
      randomVars: randomVars,
      screens: renderTemplateValues(template.screens, randomVars),
      branchRules: renderTemplateValues(template.branchRules, randomVars),
      debug: {
        templateSeed: root.SeededRandom.deriveSeed(studentId, Number(attemptNumber) + moduleKeySeedOffset(moduleKey), secretSalt),
        varsSeed: root.SeededRandom.deriveSeed(studentId, Number(attemptNumber) + moduleKeySeedOffset(moduleKey) + 9000, secretSalt),
      },
    };
  }

  const api = {
    loadScenario: loadScenario,
  };

  root.ScenarioLoader = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  // Sample debug log required for quick validation.
  if (typeof console !== "undefined" && root.SeededRandom) {
    const sample = loadScenario("A", "demo-student", 1, "OM2026");
    console.log("[ScenarioLoader] Sample instantiated scenario", sample);
  }
})(typeof window !== "undefined" ? window : globalThis);
