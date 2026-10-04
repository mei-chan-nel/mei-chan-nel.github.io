import type { TraceEvent } from './types.js';
export function highlightScrollTop(options: {
  current: number; height: number; extent: number;
  targets?: { top: number; bottom: number }[]; sources?: { top: number; bottom: number }[]; padding?: number;
}): number;
export function createVariableScroll(pane: HTMLElement, rows: HTMLElement): {
  update(event: TraceEvent | null): void; reveal(): void;
};
