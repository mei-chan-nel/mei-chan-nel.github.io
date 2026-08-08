(function () {
  "use strict";

  const learningStorageKey = "info1LearningRecord:v1";

  const summarizeQuestionRecord = (record) => {
    if (!record || record.v !== 1 || !record.q || typeof record.q !== "object" || Array.isArray(record.q)) {
      return null;
    }
    let attempts = 0;
    let correct = 0;
    for (const item of Object.values(record.q)) {
      if (!Array.isArray(item)) continue;
      const itemAttempts = Number.isInteger(item[0]) && item[0] > 0 ? item[0] : 0;
      const itemCorrect = Number.isInteger(item[1]) ? Math.min(Math.max(item[1], 0), itemAttempts) : 0;
      attempts += itemAttempts;
      correct += itemCorrect;
    }
    if (!attempts) return null;
    return {
      attempts,
      correct,
      rate: Math.round((correct / attempts) * 100),
      summary: `これまで延べ${attempts}問に解答・正答率${Math.round((correct / attempts) * 100)}％`
    };
  };

  window.StudyAtlasHomeLearning = Object.freeze({ summarizeQuestionRecord });

  const summaryNode = document.querySelector("[data-home-app-summary]");
  if (!summaryNode) return;

  try {
    const record = JSON.parse(localStorage.getItem(learningStorageKey) || "null");
    const summary = summarizeQuestionRecord(record);
    summaryNode.textContent = summary?.summary || "学習履歴はこのブラウザに保存されます";
  } catch (_error) {
    summaryNode.textContent = "学習履歴はこのブラウザに保存されます";
  }
})();
