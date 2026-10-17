// Shared user interactions for the RAM row dialog in DOM integration checks.
export const ramContent = (address) =>
  document.querySelector(`tr[data-address="${address}"] .live-cell`)
    .textContent;
export function openRam(address) {
  document.querySelector(`tr[data-address="${address}"] .ram-row-edit`).click();
}
export function editRam(address, values) {
  openRam(address);
  for (const [key, id] of [
    ["op", "ram-edit-kind"],
    ["arg", "ram-edit-operand"],
  ]) {
    if (!(key in values)) continue;
    const input = document.getElementById(id);
    input.value = values[key];
    input.dispatchEvent(
      new Event(key === "op" ? "change" : "input", { bubbles: true }),
    );
  }
  document
    .getElementById("ram-edit-form")
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}
