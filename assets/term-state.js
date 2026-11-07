(() => {
  "use strict";

  const CONFIG = Object.freeze({
    storageKey: "studyAtlasTerms:v1",
    preferencesKey: "studyAtlasTermPreferences:v1",
    learningKey: "info1LearningRecord:v1",
    legacyLearningKey: "info1QuizStats:v4",
    readTimeMs: 10_000,
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

  function matchRanges(text, words) {
    let normalized = "";
    const starts = [], ends = [];
    for (const match of String(text).matchAll(/[^\p{M}\uFF9E\uFF9F][\p{M}\uFF9E\uFF9F]*|[\p{M}\uFF9E\uFF9F]+/gu)) {
      const part = match[0].normalize("NFKC").toLowerCase();
      normalized += part;
      for (let i = 0; i < part.length; i++) { starts.push(match.index); ends.push(match.index + match[0].length); }
    }
    const ranges = [];
    for (const word of words) {
      if (!word) continue;
      let index = normalized.indexOf(word);
      while (index >= 0) {
        ranges.push([starts[index], ends[index + word.length - 1]]);
        index = normalized.indexOf(word, index + word.length);
      }
    }
    ranges.sort((a,b) => a[0]-b[0] || b[1]-a[1]);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1],range[1]);
      else merged.push(range);
    }
    return merged;
  }

  function excerpt(body, words, length = 110) {
    const matches = matchRanges(body, words);
    if (!matches.length) return "";
    const position = matches[0][0];
    const start = Math.max(body.lastIndexOf("。", position - 1), body.lastIndexOf("\n", position - 1), body.lastIndexOf("！", position - 1), body.lastIndexOf("？", position - 1)) + 1;
    const end = Math.max(start + length, matches[0][1] + 90);
    return `${start ? "…" : ""}${body.slice(start, end)}${end < body.length ? "…" : ""}`;
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

  function mergeCoverage(ranges) {
    const sorted = (Array.isArray(ranges) ? ranges : []).filter(range => Array.isArray(range) && range.length === 2 && range.every(Number.isFinite))
      .map(([start,end]) => [Math.max(0,start),Math.min(1,end)]).filter(([start,end])=>end>start).sort((a,b)=>a[0]-b[0]);
    const merged = [];
    for (const [start,end] of sorted) {
      const last=merged.at(-1);
      if (last && start<=last[1]) last[1]=Math.max(last[1],end);
      else merged.push([start,end]);
    }
    return merged;
  }
  const coverageRatio = ranges => mergeCoverage(ranges).reduce((sum,[start,end])=>sum+end-start,0);
  const visibleRange = (rect,viewportHeight) => rect.height>0 ? mergeCoverage([[Math.max(0,-rect.top/rect.height),Math.min(1,(viewportHeight-rect.top)/rect.height)]]) : [];

  function cleanStates(value) {
    if (!object(value) || value.v !== 1 || !object(value.terms)) return {};
    return Object.fromEntries(Object.entries(value.terms).filter(([, state]) => object(state)).map(([tag, state]) => [tag, {
      read: state.read === true,
      manualUnread: state.manualUnread === true,
      favorite: state.favorite === true,
      time: Number.isFinite(state.time) ? Math.min(CONFIG.readTimeMs, Math.max(0, state.time)) : 0,
      coverage: mergeCoverage(state.coverage),
      reach: coverageRatio(state.coverage),
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
      const state = { read: false, favorite: false, time: 0, reach: 0, coverage: [], ...states[tag] };
      transform(state);
      memory = { ...states, [tag]: state };
      try { storage.setItem(CONFIG.storageKey, JSON.stringify({ v: 1, terms: memory })); failed = false; }
      catch (_) { failed = true; onError(); }
      return state;
    }
    return {
      read,
      reload() { failed = false; return read(); },
      toggleRead: (tag) => update(tag, (state) => {
        state.read = !state.read;
        state.manualUnread = !state.read;
        if (!state.read) { state.time = 0; state.reach = 0; state.coverage = []; }
      }),
      beginReading: (tag) => update(tag, (state) => { state.manualUnread = false; }),
      toggleFavorite: (tag) => update(tag, (state) => { state.favorite = !state.favorite; }),
      progress: (tag, elapsed, ranges) => update(tag, (state) => {
        if (state.manualUnread) return;
        state.time = Math.min(CONFIG.readTimeMs, state.time + Math.max(0, elapsed));
        state.coverage = mergeCoverage([...state.coverage, ...ranges]);
        state.reach = coverageRatio(state.coverage);
        if (state.time >= CONFIG.readTimeMs || state.reach >= CONFIG.readReach) state.read = true;
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
    recommendationScores, searchRank, matchRanges, excerpt, selectTerms, createStore, lazyData, createReadingClock, mergeCoverage, coverageRatio, visibleRange });
})();
