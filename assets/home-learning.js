(function () {
  "use strict";

  const storageKey = "info1LearningRecord:v1";
  const starter = document.querySelector("[data-home-start]");
  const returnCard = document.querySelector("[data-home-return]");
  const summary = document.querySelector("[data-home-return-summary]");
  if (!starter || !returnCard || !summary) return;

  try {
    const record = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!record || record.v !== 1 || !record.q || typeof record.q !== "object" || Array.isArray(record.q)) return;
    let attempts = 0;
    let correct = 0;
    for (const item of Object.values(record.q)) {
      if (!Array.isArray(item)) continue;
      const itemAttempts = Number.isInteger(item[0]) && item[0] > 0 ? item[0] : 0;
      const itemCorrect = Number.isInteger(item[1]) ? Math.min(Math.max(item[1], 0), itemAttempts) : 0;
      attempts += itemAttempts;
      correct += itemCorrect;
    }
    if (!attempts) return;
    const rate = Math.round((correct / attempts) * 100);
    summary.textContent = `これまで ${attempts}問に回答・正答率 ${rate}%`;
    starter.hidden = true;
    returnCard.hidden = false;
  } catch (_error) {
    // A malformed or unavailable record should behave like a first visit.
  }
})();
