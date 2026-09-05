(() => {
  "use strict";

  const QUESTION_DATA_URL = "/info1-quiz-app/data/questions/completed_questions.json";
  const APP_URL = "/info1-quiz-app/app/";
  const DEFAULT_LIMIT = 5;

  function shuffle(values) {
    const shuffled = [...values];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  async function startChallenge(button) {
    const tag = String(button.dataset.tag || "").trim();
    const excludeStem = String(button.dataset.excludeStem || "").trim();
    const requestedLimit = Number.parseInt(button.dataset.limit || String(DEFAULT_LIMIT), 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : DEFAULT_LIMIT;
    const message = button.closest("[data-term-challenge]")?.querySelector("[data-term-challenge-message]");

    if (!tag) {
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "問題を選んでいます…";
    if (message) {
      message.textContent = "";
    }

    try {
      const response = await fetch(QUESTION_DATA_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const questions = await response.json();
      if (!Array.isArray(questions)) {
        throw new TypeError("問題データの形式が正しくありません。");
      }

      const candidates = questions.filter((question) => {
        const tags = Array.isArray(question?.tags)
          ? question.tags.map((value) => String(value).trim())
          : [];
        if (!tags.includes(tag)) {
          return false;
        }
        if (excludeStem && String(question?.stem || "").trim() === excludeStem) {
          return false;
        }
        return Boolean(String(question?.id || "").trim());
      });

      const selected = shuffle(candidates).slice(0, Math.min(limit, candidates.length));
      const ids = selected.map((question) => String(question.id).trim()).filter(Boolean);

      if (!ids.length) {
        button.textContent = "関連する問題はありません";
        button.disabled = true;
        if (message) {
          message.textContent = "";
        }
        return;
      }

      const appUrl = new URL(APP_URL, window.location.origin);
      appUrl.searchParams.set("challenge", ids.join(","));
      window.location.href = appUrl.href;
    } catch (error) {
      console.error("用語ページから問題を選べませんでした。", error);
      button.disabled = false;
      button.textContent = originalLabel;
      if (message) {
        message.textContent = "問題を読み込めませんでした。時間をおいてもう一度お試しください。";
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-term-challenge-button]");
    if (!button || button.disabled) {
      return;
    }
    event.preventDefault();
    void startChallenge(button);
  });
})();
