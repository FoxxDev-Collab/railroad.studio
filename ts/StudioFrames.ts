import {FramesJsonError, framesFromJson, framesToJson} from './FramesJson';
import {downloadBlob, el, iconButton} from './dom';
import {Frame} from './Railroad';
import {Studio} from './Studio';

const plural = (n: number, noun: string) => `${n.toLocaleString('en-US')} ${noun}${n === 1 ? '' : 's'}`;

function row(labelText: string, ...content: (Node | string)[]): HTMLElement {
    const div = el('div', 'row mb-3');
    const body = el('div', 'col-9 col-lg-7');
    body.append(...content);
    div.append(el('div', 'col col-3 col-form-label', labelText), body);
    return div;
}

/**
 * Controls for moving the list of frames in and out of the save: export it as
 * JSON, import it again (possibly after editing it), or remove every frame.
 * @param {Studio} studio
 * @param {HTMLElement} container
 */
export function renderFrameTransfer(studio: Studio, container: HTMLElement): void {
    const frames = () => studio.railroad.frames;
    const result = el('div', 'frame-transfer-result');
    result.setAttribute('role', 'status');
    const say = (kind: 'success' | 'danger' | 'secondary', ...content: (Node | string)[]) => {
        const alert = el('div', `alert alert-${kind} mb-3`);
        alert.append(...content);
        result.replaceChildren(alert);
        return alert;
    };
    const apply = (next: Frame[], done: string) => {
        try {
            studio.replaceFrames(next);
        } catch (e) {
            console.log(e);
            say('danger', 'The save could not be written with those frames, so nothing was changed. ' +
                `(${e instanceof Error ? e.message : String(e)})`);
            return;
        }
        studio.setTitle(done);
        say('success', `${done}. Download the save to keep the change.`);
    };
    // Export
    const btnExport = iconButton('btn btn-secondary', 'bi-filetype-json', 'Download frames as JSON');
    btnExport.addEventListener('click', () => {
        const name = studio.originalFilename.replace(/\.sav$/i, '') + '-frames.json';
        downloadBlob(new Blob([framesToJson(frames())], {type: 'application/json'}), name);
        say('secondary', `Downloaded ${plural(frames().length, 'frame')} as ${name}.`);
    });
    // Import
    const file = el('input', 'form-control');
    file.type = 'file';
    file.accept = '.json,application/json';
    file.setAttribute('aria-label', 'Frames JSON file to import');
    const offer = (imported: Frame[], name: string) => {
        const existing = frames().length;
        const alert = say('secondary', `${name} holds ${plural(imported.length, 'frame')}. `);
        const buttons = el('div', 'hstack gap-2 flex-wrap mt-2');
        const replace = el('button', 'btn btn-primary', `Replace the ${plural(existing, 'frame')} in this save`);
        replace.type = 'button';
        replace.addEventListener('click', () => apply(imported,
            `Replaced ${plural(existing, 'frame')} with ${plural(imported.length, 'frame')}`));
        const add = el('button', 'btn btn-outline-primary', `Add to the ${plural(existing, 'frame')} in this save`);
        add.type = 'button';
        add.addEventListener('click', () => apply(frames().concat(imported),
            `Added ${plural(imported.length, 'frame')}`));
        buttons.append(replace, add);
        alert.append(buttons);
    };
    file.addEventListener('change', () => {
        const chosen = file.files?.[0];
        if (!chosen) return;
        chosen.text()
            .then((text) => offer(framesFromJson(text), chosen.name))
            .catch((e: unknown) => {
                const problems = e instanceof FramesJsonError ? e.problems : [String(e)];
                const list = el('ul', 'mb-0');
                list.append(...problems.map((problem) => el('li', '', problem)));
                say('danger', `${chosen.name} was not imported:`, list);
            })
            // Let the same file be chosen again after it has been fixed
            .finally(() => file.value = '');
    });
    // Remove
    const btnRemove = iconButton('btn btn-outline-danger', 'bi-trash', 'Remove all frames');
    btnRemove.addEventListener('click', () => {
        const existing = frames().length;
        if (existing === 0) {
            say('secondary', 'There are no frames in this save.');
            return;
        }
        if (!window.confirm(`Remove all ${plural(existing, 'frame')} from this save?`)) return;
        apply([], `Removed ${plural(existing, 'frame')}`);
    });
    container.append(
        el('h3', 'mb-3 mt-4', 'Export and Import Frames'),
        row('Export', btnExport),
        row('Import', file, el('div', 'form-text',
            'A file exported here, edited or not. You then choose whether it replaces the frames in this save ' +
            'or is added to them.')),
        row('Remove', btnRemove),
        result,
    );
}
