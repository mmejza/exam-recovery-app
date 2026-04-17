(function () {
  "use strict";

  function mount(container, config, savedValue, options) {
    const opts = options || {};
    const placements = Object.assign({}, savedValue || {});

    container.innerHTML = "" +
      "<h3>Response</h3>" +
      "<p class='widget-note'>Drag each item into the correct category.</p>" +
      "<div class='drag-list' id='drag-list'></div>" +
      "<div class='drop-zones' id='drop-zones'></div>";

    const dragList = container.querySelector("#drag-list");
    const zoneWrap = container.querySelector("#drop-zones");

    config.zones.forEach(function (zone) {
      const zoneEl = document.createElement("section");
      zoneEl.className = "drop-zone";
      zoneEl.dataset.zone = zone.id;
      zoneEl.innerHTML = "<h4>" + zone.label + "</h4>";
      zoneEl.addEventListener("dragover", function (e) { e.preventDefault(); });
      zoneEl.addEventListener("drop", function (e) {
        if (opts.locked) {
          return;
        }
        e.preventDefault();
        const itemId = e.dataTransfer.getData("text/plain");
        placements[itemId] = zone.id;
        renderItems();
        if (typeof opts.onChange === "function") {
          opts.onChange();
        }
      });
      zoneWrap.appendChild(zoneEl);
    });

    function makeChip(item) {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.textContent = item.label;
      chip.draggable = !opts.locked;
      chip.dataset.item = item.id;
      chip.addEventListener("dragstart", function (e) {
        if (opts.locked) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("text/plain", item.id);
      });
      return chip;
    }

    function renderItems() {
      dragList.innerHTML = "";
      container.querySelectorAll(".drop-zone").forEach(function (z) {
        const title = z.querySelector("h4");
        z.innerHTML = "";
        z.appendChild(title);
      });

      config.items.forEach(function (item) {
        const targetZone = placements[item.id];
        const chip = makeChip(item);
        if (!targetZone) {
          dragList.appendChild(chip);
          return;
        }
        const zoneEl = container.querySelector(".drop-zone[data-zone='" + targetZone + "']");
        if (zoneEl) {
          zoneEl.appendChild(chip);
        } else {
          dragList.appendChild(chip);
        }
      });
    }

    renderItems();

    return {
      getValue: function () {
        return Object.assign({}, placements);
      },
      isAnswered: function () {
        return config.items.every(function (item) {
          return Boolean(placements[item.id]);
        });
      }
    };
  }

  window.DragDropWidget = { mount };
})();
