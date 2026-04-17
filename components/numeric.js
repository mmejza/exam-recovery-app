(function () {
  "use strict";

  function mount(container, config, savedValue, options) {
    const opts = options || {};
    container.innerHTML = "" +
      "<h3>Response</h3>" +
      "<label for='numeric-input'>" + config.prompt + "</label>" +
      "<input id='numeric-input' type='number' step='0.01' value='" + (savedValue ?? "") + "' />" +
      "<p class='widget-note'>Enter a numeric value. Example: 12.5</p>";

    const input = container.querySelector("#numeric-input");
    if (opts.locked) {
      input.disabled = true;
    }
    if (typeof opts.onChange === "function") {
      input.addEventListener("input", opts.onChange);
    }

    return {
      getValue: function () {
        const raw = input.value.trim();
        return raw === "" ? null : Number(raw);
      },
      isAnswered: function () {
        return input.value.trim() !== "";
      }
    };
  }

  window.NumericWidget = { mount };
})();
