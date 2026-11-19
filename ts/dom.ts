/**
 * Create an element with a class attribute and, optionally, text content.
 * @param {string} tag
 * @param {string} className
 * @param {string} text
 * @return {HTMLElement}
 */
export function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = '',
    text?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (typeof text !== 'undefined') element.textContent = text;
    return element;
}

/**
 * Create a decorative Bootstrap icon, hidden from assistive technology.
 * @param {string} name - The icon class, for example 'bi-download'.
 * @return {HTMLElement}
 */
export function icon(name: string): HTMLElement {
    const i = el('i', `bi ${name}`);
    i.setAttribute('aria-hidden', 'true');
    return i;
}

export function iconButton(className: string, iconName: string, text: string): HTMLButtonElement {
    const button = el('button', className);
    button.type = 'button';
    button.append(icon(iconName), ' ' + text);
    return button;
}

/**
 * Hand a file to the browser as a download.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = el('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
}
