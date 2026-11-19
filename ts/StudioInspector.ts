import {el} from './dom';

/** One value of something in the save, with the control that edits it. */
export type Field = {
    editor: Node;
    label: string;
    /** Set when the value looks wrong, the same way a table cell is marked. */
    warning?: boolean | undefined;
};

export type Inspector = {
    close: () => void;
};

/**
 * Show a panel of labelled editors over a corner of the map, for whatever was
 * selected there. It is not modal, so the map and the selection stay visible.
 * @param {HTMLElement} container - The element the map is in.
 * @param {string} title
 * @param {Field[]} fields
 * @param {function} onClose - Called once, when the panel goes away.
 * @return {Inspector}
 */
export function showInspector(container: HTMLElement, title: string, fields: Field[], onClose: () => void): Inspector {
    const panel = el('aside', 'map-inspector card shadow');
    panel.setAttribute('aria-label', `Editing ${title}`);
    const closeButton = el('button', 'btn-close ms-auto');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close');
    const head = el('div', 'card-header d-flex align-items-center gap-2');
    const heading = el('h6', 'mb-0 text-truncate', title);
    heading.title = title;
    head.append(heading, closeButton);
    const body = el('div', 'card-body');
    for (const field of fields) {
        // Each editor swaps itself in and out of its parent, so each gets a parent of its own
        const value = el('div', field.warning ? 'inspector-value inspector-warning' : 'inspector-value');
        value.append(field.editor);
        const row = el('div', 'inspector-field');
        row.append(el('div', 'inspector-label', field.label), value);
        body.append(row);
    }
    panel.append(head, body);
    let open = true;
    const close = () => {
        if (!open) return;
        open = false;
        panel.remove();
        onClose();
    };
    closeButton.addEventListener('click', close);
    container.append(panel);
    return {close};
}
