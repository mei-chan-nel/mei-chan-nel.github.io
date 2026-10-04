export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id); if (!node) throw new Error(`Missing element: ${id}`); return node as T;
}
export function button(label: string, action: () => void, className = 'button'): HTMLButtonElement {
  const node = element('button', className, label); node.type = 'button'; node.addEventListener('click', () => {
    try { action(); } catch (error) {
      const message = error instanceof Error ? error.message : '操作できませんでした。';
      const form = node.closest('form'); if (form?.querySelector('.form-error')) showFormError(form, message); else showMessage(message, true);
    }
  }); return node;
}
export function showMessage(message: string, error = false): void {
  const node = byId('notice'); node.textContent = message; node.hidden = !message; node.classList.toggle('is-error', error);
  node.setAttribute('role', error ? 'alert' : 'status');
}
export function showFormError(form: HTMLElement, message: string): void {
  const node = form.querySelector<HTMLElement>('.form-error'); if (node) { node.textContent = message; node.hidden = !message; }
}
export function download(text: string, filename: string, host: HTMLElement = document.body): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = element('a'); link.href = url; link.download = filename; host.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function setupDialogs(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-close-dialog]').forEach(node => node.addEventListener('click', () => node.closest('dialog')?.close()));
}
export function diagnosticText(error: { message: string; line: number; column: number }): string { return `${error.line}行目${error.column > 1 ? `・${error.column}文字目` : ''}：${error.message}`; }
