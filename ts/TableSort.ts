import {el, icon} from './dom';

export type SortState = {
    column: string;
    descending: boolean;
};

export type SortValue = string | number | null | undefined;

/** Text is compared the way a person would: ignoring case, and with "9" before "10". */
const collator = new Intl.Collator('en', {numeric: true, sensitivity: 'base'});

const isBlank = (value: SortValue) => value === null || typeof value === 'undefined' || value === '';

/**
 * Return a sorted copy of some rows. Rows with nothing in the sorted column go
 * last whichever way the rest are sorted, and equal rows keep their order.
 * @param {T[]} rows
 * @param {SortState | undefined} sort - Leave undefined to keep the original order.
 * @param {Record<string, function>} columns - How to read each sortable column from a row.
 * @return {T[]}
 */
export function sortRows<T>(
    rows: readonly T[],
    sort: SortState | undefined,
    columns: Record<string, (row: T) => SortValue>,
): T[] {
    const getValue = sort ? columns[sort.column] : undefined;
    if (!sort || !getValue) return rows.slice();
    const sign = sort.descending ? -1 : 1;
    return rows
        .map((row, index) => ({index, row, value: getValue(row)}))
        .sort((a, b) => {
            const aBlank = isBlank(a.value);
            const bBlank = isBlank(b.value);
            if (aBlank || bBlank) return (Number(aBlank) - Number(bBlank)) || (a.index - b.index);
            const order = (typeof a.value === 'number' && typeof b.value === 'number') ?
                a.value - b.value :
                collator.compare(String(a.value), String(b.value));
            return (sign * order) || (a.index - b.index);
        })
        .map((entry) => entry.row);
}

/**
 * What clicking a column heading does: ascending, then descending, then back
 * to the original order.
 * @param {SortState | undefined} sort
 * @param {string} column
 * @return {SortState | undefined}
 */
export function nextSort(sort: SortState | undefined, column: string): SortState | undefined {
    if (!sort || sort.column !== column) return {column, descending: false};
    if (!sort.descending) return {column, descending: true};
    return undefined;
}

/**
 * Turn a column heading into a button that sorts by that column.
 * @param {HTMLTableCellElement} th
 * @param {string} label
 * @param {string} column
 * @param {SortState | undefined} sort - The current sort, to show which way this column is sorted.
 * @param {function} onSort
 */
export function sortableHeader(
    th: HTMLTableCellElement,
    label: string,
    column: string,
    sort: SortState | undefined,
    onSort: (next: SortState | undefined) => void,
): void {
    const active = sort?.column === column ? sort : undefined;
    const button = el('button', 'sort-button');
    button.type = 'button';
    button.classList.toggle('active', Boolean(active));
    if (!active) {
        button.append(label, icon('bi-chevron-expand'));
        button.title = `Sort by ${label}`;
        th.setAttribute('aria-sort', 'none');
    } else if (active.descending) {
        button.append(label, icon('bi-caret-down-fill'));
        button.title = `Sorted by ${label}, descending. Click to go back to the original order.`;
        th.setAttribute('aria-sort', 'descending');
    } else {
        button.append(label, icon('bi-caret-up-fill'));
        button.title = `Sorted by ${label}, ascending. Click to sort descending.`;
        th.setAttribute('aria-sort', 'ascending');
    }
    button.addEventListener('click', () => onSort(nextSort(sort, column)));
    th.replaceChildren(button);
}
