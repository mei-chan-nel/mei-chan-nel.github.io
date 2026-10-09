import {
  VIDEO_PROGRAMS,
  navigationForProgram,
} from "../../program-trace/video-programs.js";
import { defaultParameters } from "../../program-trace/examples.js";
import { traceDraft } from "./bridge.mjs";
import { fromProgram } from "./conversion.mjs";

export function videoOrigin(example, from = "") {
  const id = example.groupId ?? example.id,
    entry = VIDEO_PROGRAMS.find((e) => e.id === id);
  if (!entry) throw Error("指定された問題を読み込めません。");
  const allowed = [entry.archivePage, ...(entry.coursePages ?? [])],
    page = allowed.includes(from) ? from : entry.archivePage,
    navigation = navigationForProgram(entry, page);
  return {
    question: entry.id,
    from: page,
    backHref: "../" + navigation.primary.href,
    traceHref: `../../program-trace/run.html?from=${encodeURIComponent(page)}#${entry.id}`,
  };
}

export function videoEntry(search) {
  const query = new URLSearchParams(search),
    entry = VIDEO_PROGRAMS.find((e) => e.id === query.get("question"));
  if (!entry) throw Error("指定された問題を読み込めません。");
  return {
    ...videoOrigin(entry, query.get("from") ?? ""),
    title: entry.title,
    document: () => fromProgram(traceDraft(entry, defaultParameters(entry))),
  };
}
