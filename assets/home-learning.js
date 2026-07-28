(function () {
  "use strict";

  const learningStorageKey = "info1LearningRecord:v1";
  const fieldOrder = ["society", "digital", "network", "statistics", "programming"];
  const fieldLabels = {
    society: "情報社会",
    digital: "デジタル",
    network: "ネットワーク",
    statistics: "統計",
    programming: "プログラミング"
  };

  const knownTimestamp = (candidate) => (
    typeof candidate?.updatedAt === "number" && Number.isFinite(candidate.updatedAt) && candidate.updatedAt > 0
      ? candidate.updatedAt
      : null
  );

  const chooseCandidate = (questionCandidate, lectureCandidate) => {
    if (!questionCandidate) return lectureCandidate || null;
    if (!lectureCandidate) return questionCandidate;
    const questionTime = knownTimestamp(questionCandidate);
    const lectureTime = knownTimestamp(lectureCandidate);

    // A known time outranks an unknown legacy time. Exact ties and two unknown
    // times prefer the question exercise so the rule remains deterministic.
    if (questionTime !== null && lectureTime !== null) {
      return questionTime >= lectureTime ? questionCandidate : lectureCandidate;
    }
    if (questionTime !== null) return questionCandidate;
    if (lectureTime !== null) return lectureCandidate;
    return questionCandidate;
  };

  const summarizeQuestionRecord = (record) => {
    if (!record || record.v !== 1 || !record.q || typeof record.q !== "object" || Array.isArray(record.q)) {
      return null;
    }
    let attempts = 0;
    let correct = 0;
    let updatedAt = null;
    for (const item of Object.values(record.q)) {
      if (!Array.isArray(item)) continue;
      const itemAttempts = Number.isInteger(item[0]) && item[0] > 0 ? item[0] : 0;
      const itemCorrect = Number.isInteger(item[1]) ? Math.min(Math.max(item[1], 0), itemAttempts) : 0;
      const itemUpdatedAt = Number(item[3]);
      attempts += itemAttempts;
      correct += itemCorrect;
      if (Number.isFinite(itemUpdatedAt) && itemUpdatedAt > 0) {
        updatedAt = Math.max(updatedAt || 0, itemUpdatedAt);
      }
    }
    if (!attempts) return null;
    return {
      kind: "question",
      updatedAt,
      href: "./info1-quiz-app/app/",
      title: "前回の問題演習を続ける",
      summary: `これまで ${attempts}問に回答・正答率 ${Math.round((correct / attempts) * 100)}%`,
      action: "アプリへ移動"
    };
  };

  const newestLectureCandidate = (records) => {
    let newest = null;
    fieldOrder.forEach((field) => {
      const record = records?.[field];
      if (!record || typeof record.sectionId !== "string" || typeof record.sectionTitle !== "string") return;
      const candidate = {
        kind: "lecture",
        updatedAt: knownTimestamp(record),
        href: `./LectureNote/${field}.html#${encodeURIComponent(record.sectionId)}`,
        title: `${fieldLabels[field]}の${record.sectionTitle}から読む`,
        summary: "講義ノートのしおりから再開",
        action: "講義へ移動"
      };
      const newestTime = knownTimestamp(newest);
      const candidateTime = knownTimestamp(candidate);
      if (!newest || (candidateTime !== null && (newestTime === null || candidateTime > newestTime))) {
        newest = candidate;
      }
    });
    return newest;
  };

  window.StudyAtlasHomeLearning = Object.freeze({
    chooseCandidate,
    newestLectureCandidate,
    summarizeQuestionRecord
  });

  const starter = document.querySelector("[data-home-start]");
  const returnSection = document.querySelector("[data-home-return]");
  const returnLink = document.querySelector("[data-home-return-link]");
  const title = document.querySelector("[data-home-return-title]");
  const summary = document.querySelector("[data-home-return-summary]");
  const action = document.querySelector("[data-home-return-action]");
  if (!starter || !returnSection || !returnLink || !title || !summary || !action) return;

  try {
    const learningRecord = JSON.parse(localStorage.getItem(learningStorageKey) || "null");
    const questionCandidate = summarizeQuestionRecord(learningRecord);
    const lectureRecords = window.StudyAtlasLectureBookmarks?.readAll() || {};
    const lectureCandidate = newestLectureCandidate(lectureRecords);
    const candidate = chooseCandidate(questionCandidate, lectureCandidate);
    if (!candidate) return;

    returnLink.href = candidate.href;
    title.textContent = candidate.title;
    summary.textContent = candidate.summary;
    action.textContent = `${candidate.action} `;
    const arrow = document.createElement("b");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";
    action.appendChild(arrow);
    starter.hidden = true;
    returnSection.hidden = false;
  } catch (_error) {
    // Malformed or unavailable storage behaves like a first visit.
  }
})();
