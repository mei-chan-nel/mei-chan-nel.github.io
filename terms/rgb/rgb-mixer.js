(() => {
  "use strict";

  const mixer = document.querySelector("[data-rgb-mixer]");
  if (!mixer) return;

  const preview = mixer.querySelector("[data-rgb-preview]");
  const rgbValue = mixer.querySelector("[data-rgb-value]");
  const channels = ["red", "green", "blue"].map((color) => ({
    input: mixer.querySelector(`#rgb-${color}`),
    output: mixer.querySelector(`#rgb-${color}-value`),
  }));

  function updateColor() {
    const values = channels.map(({ input, output }) => {
      output.value = input.value;
      return input.value;
    });
    preview.style.backgroundColor = `rgb(${values.join(", ")})`;
    rgbValue.value = `RGB(${values.join(", ")})`;
  }

  channels.forEach(({ input }) => input.addEventListener("input", updateColor));
  updateColor();
  mixer.disabled = false;
})();
