import {el} from './dom';

export type Hotkey = {
    /** Returns false when the shortcut does not apply right now, so the key keeps its usual meaning. */
    action: () => boolean;
    /** The heading this is listed under in the shortcut list. */
    group: string;
    /** Modifiers, then the key, in lower case and separated by spaces: 'd', 'ctrl s', 'escape'. */
    keys: string;
    name: string;
};

const keyLabels: Record<string, string> = {
    alt: 'Alt',
    ctrl: 'Ctrl',
    escape: 'Esc',
    meta: 'Meta',
    shift: 'Shift',
    space: 'Space',
};

/**
 * Describe a key press the way shortcuts are registered.
 * @param {KeyboardEvent} e
 * @return {string}
 */
function eventKeys(e: KeyboardEvent): string {
    const key = e.key.toLowerCase();
    const parts: string[] = [];
    if (e.altKey) parts.push('alt');
    if (e.ctrlKey) parts.push('ctrl');
    if (e.metaKey) parts.push('meta');
    // Shift is part of how a symbol such as ? is typed, so it only counts with letters and named keys
    const symbol = key.length === 1 && key.toUpperCase() === key;
    if (e.shiftKey && !symbol) parts.push('shift');
    parts.push(key === ' ' ? 'space' : key);
    return parts.join(' ');
}

function isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
}

/**
 * Keyboard shortcuts for the whole app: commands are registered against a
 * description of the keys, and one listener dispatches them.
 */
export class HotkeyManager {
    private readonly commands = new Map<string, Hotkey>();

    constructor() {
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.repeat || e.isComposing) return;
            const command = this.commands.get(eventKeys(e));
            if (!command) return;
            // A plain key belongs to whatever is being typed into. Shortcuts with Ctrl work there too.
            const plain = !e.altKey && !e.ctrlKey && !e.metaKey;
            if (plain && isTyping(e.target)) return;
            // An open dialog, such as the shortcut list, has the keyboard to itself
            if (document.querySelector('dialog[open]')) return;
            if (command.action()) e.preventDefault();
        });
    }

    register(hotkey: Hotkey): void {
        const conflict = this.commands.get(hotkey.keys);
        if (conflict && conflict.name !== hotkey.name) {
            console.warn(`Shortcut ${hotkey.keys} moved from "${conflict.name}" to "${hotkey.name}"`);
        }
        this.commands.set(hotkey.keys, hotkey);
    }

    list(): Hotkey[] {
        return [...this.commands.values()];
    }

    /**
     * Show every registered shortcut, grouped the way they were registered.
     */
    showHelp(): void {
        document.querySelector('dialog.hotkey-help')?.remove();
        const dialog = el('dialog', 'hotkey-help');
        const close = el('button', 'btn-close ms-auto');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close');
        close.addEventListener('click', () => dialog.close());
        const head = el('div', 'd-flex align-items-center');
        head.append(el('h5', 'mb-0', 'Keyboard shortcuts'), close);
        dialog.append(head);
        const groups = new Map<string, Hotkey[]>();
        for (const hotkey of this.commands.values()) {
            groups.set(hotkey.group, (groups.get(hotkey.group) ?? []).concat(hotkey));
        }
        for (const [group, list] of groups) {
            dialog.append(el('h6', 'text-body-secondary mt-3 mb-2', group));
            const rows = el('div', 'hotkey-list');
            for (const hotkey of list) {
                const keys = el('span', 'hotkey-keys');
                hotkey.keys.split(' ').forEach((key, i) => {
                    if (i > 0) keys.append(' + ');
                    keys.append(el('kbd', '', keyLabels[key] ?? key.toUpperCase()));
                });
                rows.append(el('span', '', hotkey.name), keys);
            }
            dialog.append(rows);
        }
        dialog.addEventListener('close', () => dialog.remove());
        document.body.append(dialog);
        dialog.showModal();
    }
}

/** The one set of shortcuts for the page. */
export const hotkeys = new HotkeyManager();
