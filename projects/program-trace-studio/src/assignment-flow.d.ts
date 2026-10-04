import type { Read, TraceEvent } from './types.js';
export interface AssignmentLink { source: Read; target: Read; self: boolean }
export interface Box { left: number; right: number; top: number; bottom: number }
export interface Point { x: number; y: number }
export function assignmentLinks(event?: TraceEvent | null): AssignmentLink[];
export function crossesBox(a: Point, b: Point, box: Box): boolean;
export function routeAssignment(source: Box, target: Box, obstacles: Box[], bounds: { width: number; height: number }): Point[] | null;
export function createAssignmentFlow(table: HTMLElement, rows: HTMLElement): {
  update(event: TraceEvent | null): void; redraw(): void;
};
