(function () {
  "use strict";

  const storageKey = "info1LectureBookmark:v1";
  const fields = ["society", "digital", "network", "statistics", "programming"];

  const normalizeRecord = (value, expectedField = "") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const field = expectedField || value.field;
    if (!fields.includes(field) || value.field !== field) return null;
    if (typeof value.sectionId !== "string" || typeof value.sectionTitle !== "string") return null;
    if (!Number.isInteger(value.sectionIndex) || value.sectionIndex < 0) return null;
    if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return null;
    return {
      field,
      sectionId: value.sectionId,
      sectionTitle: value.sectionTitle,
      sectionIndex: value.sectionIndex,
      updatedAt: value.updatedAt
    };
  };

  const readAll = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      const records = {};
      if (stored?.fields && typeof stored.fields === "object" && !Array.isArray(stored.fields)) {
        fields.forEach((field) => {
          const record = normalizeRecord(stored.fields[field], field);
          if (record) records[field] = record;
        });
        return records;
      }
      const singleRecord = normalizeRecord(stored);
      if (singleRecord) records[singleRecord.field] = singleRecord;
      return records;
    } catch (_error) {
      return {};
    }
  };

  const get = (field) => readAll()[field] || null;

  const write = (field, section, sectionIndex) => {
    if (!fields.includes(field) || !section || typeof section.id !== "string") return;
    const records = readAll();
    records[field] = {
      field,
      sectionId: section.id,
      sectionTitle: section.short || section.title,
      sectionIndex,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify({ v: 1, fields: records }));
    } catch (_error) {
      // Storage can be unavailable in private or restricted browsing modes.
    }
  };

  window.StudyAtlasLectureBookmarks = { storageKey, readAll, get, write };
})();
