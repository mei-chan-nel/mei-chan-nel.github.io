export type ControlKey = 'next' | 'reset' | 'edit' | 'play' | 'speed';
export function createFullscreen(options: {
  runner: HTMLElement; surface: HTMLElement; mount: HTMLElement; entryButton: HTMLButtonElement;
  controls: Record<ControlKey, HTMLButtonElement>; speedPanel: HTMLElement;
  closeSpeed(): void; onLayout(): void;
}): {
  sync(): void; leave(options?: { restoreHistory?: boolean }): void; readonly active: boolean;
  control(key: ControlKey): HTMLButtonElement; containsSpeedControl(node: Node): boolean;
};
