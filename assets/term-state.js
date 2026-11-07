(() => {
  "use strict";

  const CONFIG = Object.freeze({
    storageKey: "studyAtlasTerms:v1",
    preferencesKey: "studyAtlasTermPreferences:v1",
    learningKey: "info1LearningRecord:v1",
    legacyLearningKey: "info1QuizStats:v4",
    readTimeMs: 20_000,
    readReach: 0.7,
    wrongWeight: 1,
    recoveredWeight: 0.5,
    baseCoefficient: 0.5,
    ratioCoefficient: 0.5,
  });
  const normalize = (text) => String(text || "").normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
  const keywords = (query) => [...new Set(normalize(query).split(" ").filter(Boolean))];
  const object = (value) => value && typeof value === "object" && !Array.isArray(value);
  const count = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

  function questionState(record) {
    if (!Array.isArray(record)) return null;
    const attempts = count(record[0]);
    if (!attempts) return null;
    const correct = Math.min(count(record[1]), attempts);
    const history = String(record[4] || "").replace(/[^01]/g, "");
    const last = record[2] === 1 || record[2] === 0 ? record[2] : history ? Number(history.at(-1)) : -1;
    return { wrong: correct < attempts || history.includes("0"), last };
  }

  function loadLearning(storage) {
    try {
      const value = JSON.parse(storage.getItem(CONFIG.learningKey) || "null");
      if (value?.v === 1 && object(value.q)) return value.q;
    } catch (_) { /* A damaged record must not prevent browsing. */ }
    try {
      const legacy = JSON.parse(storage.getItem(CONFIG.legacyLearningKey) || "null");
      if (object(legacy)) return Object.fromEntries(Object.entries(legacy).map(([id, item]) => [id, [item?.attempts, item?.correct, -1]]));
    } catch (_) { /* Storage may be disabled. */ }
    return {};
  }
  const hasWrongHistory = (records) => Object.values(records).some((record) => questionState(record)?.wrong);

  function recommendationScores(records, questionTags) {
    const totals = new Map();
    for (const [id, tags] of Object.entries(questionTags)) {
      const state = questionState(records[id]);
      if (!state) continue;
      for (const tag of new Set(tags)) {
        const item = totals.get(tag) || { W: 0, C: 0 };
        // Legacy records lack a final result: use the unrecovered weight until a new answer records it.
        if (state.wrong) item.W += state.last === 1 ? CONFIG.recoveredWeight : CONFIG.wrongWeight;
        else if (state.last !== 0) item.C += 1;
        totals.set(tag, item);
      }
    }
    return new Map([...totals].map(([tag, { W, C }]) => [tag, W === 0 ? 0 : W * (CONFIG.baseCoefficient + CONFIG.ratioCoefficient * W / (W + C))]));
  }

  function searchRank(titles, body, words) {
    const normalizedTitles = titles.map(normalize);
    const normalizedBody = normalize(body);
    if (!words.every((word) => normalizedTitles.some((title) => title.includes(word)) || normalizedBody.includes(word))) return null;
    const phrase = words.join(" ");
    const titleMatches = words.filter((word) => normalizedTitles.some((title) => title.includes(word))).length;
    const exact = normalizedTitles.some((title) => title === phrase);
    const prefix = normalizedTitles.some((title) => title.startsWith(phrase));
    const partial = normalizedTitles.some((title) => title.includes(phrase));
    return [exact ? 4 : prefix ? 3 : partial ? 2 : titleMatches ? 1 : 0,
      titleMatches,
      words.filter((word) => normalizedTitles.some((title) => title === word)).length,
      words.filter((word) => normalizedTitles.some((title) => title.startsWith(word))).length];
  }

  function excerpt(body, words, length = 110) {
    // Map normalized characters back to source offsets so NFKC expansions do not shift the excerpt.
    let normalized = "";
    const offsets = [];
    // Keep voiced marks with their base character (e.g. half-width ｶﾞ → ガ).
    for (const match of String(body).matchAll(/[^\p{M}\uFF9E\uFF9F][\p{M}\uFF9E\uFF9F]*|[\p{M}\uFF9E\uFF9F]+/gu)) {
      const part = match[0].normalize("NFKC").toLowerCase();
      normalized += part;
      for (let index = 0; index < part.length; index += 1) offsets.push(match.index);
    }
    const matches = words.map((word) => normalized.indexOf(word)).filter((index) => index >= 0);
    if (!matches.length) return "";
    const start = Math.max(0, offsets[Math.min(...matches)] - 28);
    return `${start ? "…" : ""}${body.slice(start, start + length)}${start + length < body.length ? "…" : ""}`;
  }

  function selectTerms(terms, { view, filter, query, scores, states, searchData }) {
    const words = keywords(query);
    return terms.flatMap((term, order) => {
      const state = states[term.tag] || {};
      const score = scores.get(term.tag) || 0;
      if (view === "recommended" && score <= 0) return [];
      if (filter === "unread" && state.read || filter === "read" && !state.read || filter === "favorite" && !state.favorite) return [];
      const article = searchData?.[term.tag];
      const rank = words.length ? searchRank([term.tag, article?.title || term.tag], article?.body || "", words) : [];
      if (rank === null) return [];
      return [{ ...term, order, score, rank, excerpt: words.length ? excerpt(article?.body || "", words) : "" }];
    }).sort((left, right) => {
      for (let index = 0; index < left.rank.length; index += 1) {
        if (left.rank[index] !== right.rank[index]) return right.rank[index] - left.rank[index];
      }
      return (view === "recommended" ? right.score - left.score : 0) || left.order - right.order;
    });
  }

  function cleanStates(value) {
    if (!object(value) || value.v !== 1 || !object(value.terms)) return {};
    return Object.fromEntries(Object.entries(value.terms).filter(([, state]) => object(state)).map(([tag, state]) => [tag, {
      read: state.read === true || state.favorite === true,
      favorite: state.favorite === true,
      time: Number.isFinite(state.time) ? Math.min(CONFIG.readTimeMs, Math.max(0, state.time)) : 0,
      reach: Number.isFinite(state.reach) ? Math.min(1, Math.max(0, state.reach)) : 0,
    }]));
  }

  function createStore(storage, onError = () => {}) {
    let memory = {};
    let failed = false;
    function read() {
      try {
        if (!failed) memory = cleanStates(JSON.parse(storage.getItem(CONFIG.storageKey) || "null"));
      } catch (_) { failed = true; onError(); }
      return memory;
    }
    function update(tag, transform) {
      const states = read();
      const state = { read: false, favorite: false, time: 0, reach: 0, ...states[tag] };
      transform(state);
      state.read = state.read || state.favorite;
      memory = { ...states, [tag]: state };
      try { storage.setItem(CONFIG.storageKey, JSON.stringify({ v: 1, terms: memory })); failed = false; }
      catch (_) { failed = true; onError(); }
      return state;
    }
    return {
      read,
      reload() { failed = false; return read(); },
      toggleFavorite: (tag) => update(tag, (state) => { state.favorite = !state.favorite; }),
      progress: (tag, elapsed, reach) => update(tag, (state) => {
        state.time = Math.min(CONFIG.readTimeMs, state.time + Math.max(0, elapsed));
        state.reach = Math.max(state.reach, reach);
        if (state.time >= CONFIG.readTimeMs && state.reach >= CONFIG.readReach) state.read = true;
      }),
    };
  }

  function lazyData(fetcher, validate = () => true) {
    let cached;
    let pending;
    return () => {
      if (cached) return Promise.resolve(cached);
      if (!pending) pending = Promise.resolve().then(fetcher).then((data) => {
        if (!validate(data)) throw new TypeError("Invalid term data");
        cached = data;
        return data;
      }).finally(() => { pending = null; });
      return pending;
    };
  }

  const reachRatio = (rect, viewportHeight) => rect.height > 0 ? Math.min(1, Math.max(0, (viewportHeight - rect.top) / rect.height)) : 0;
  const createReadingClock = (now, active) => {
    let previous = now;
    let running = active;
    return (time, nextActive) => {
      const elapsed = running ? Math.max(0, time - previous) : 0;
      previous = time;
      running = nextActive;
      return elapsed;
    };
  };

  window.StudyAtlasTerms = Object.freeze({ CONFIG, normalize, keywords, questionState, loadLearning, hasWrongHistory,
    recommendationScores, searchRank, excerpt, selectTerms, createStore, lazyData, reachRatio, createReadingClock });
})();
