export function element(tag, className = '', text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
export function byId(id) {
    const node = document.getElementById(id);
    if (!node)
        throw new Error(`Missing element: ${id}`);
    return node;
}
export function button(label, action, className = 'button') {
    const node = element('button', className, label);
    node.type = 'button';
    node.addEventListener('click', () => {
        try {
            action();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '操作できませんでした。';
            const form = node.closest('form');
            if (form?.querySelector('.form-error'))
                showFormError(form, message);
            else
                showMessage(message, true);
        }
    });
    return node;
}
export function showMessage(message, error = false) {
    const node = byId('notice');
    node.textContent = message;
    node.hidden = !message;
    node.classList.toggle('is-error', error);
    node.setAttribute('role', error ? 'alert' : 'status');
}
export function showFormError(form, message) {
    const node = form.querySelector('.form-error');
    if (node) {
        node.textContent = message;
        node.hidden = !message;
    }
}
export function download(text, filename, host = document.body) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
    const link = element('a');
    link.href = url;
    link.download = filename;
    host.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function setupDialogs() {
    document.querySelectorAll('[data-close-dialog]').forEach(node => node.addEventListener('click', () => node.closest('dialog')?.close()));
}
export function diagnosticText(error) { return `${error.line}行目${error.column > 1 ? `・${error.column}文字目` : ''}：${error.message}`; }
