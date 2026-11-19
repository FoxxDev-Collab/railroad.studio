import {Frame, FrameState} from './Railroad';
import {GvasString, GvasText} from './Gvas';
import {Rotator} from './Rotator';
import {Vector} from './Vector';

/** Written into the file, so that an import can tell what it has been given. */
const FORMAT = 'railroad.studio/frames';
const VERSION = 1;
/** Text can nest (a format string with text arguments). Real saves are a level or two deep. */
const MAX_TEXT_DEPTH = 16;
const MAX_ERRORS = 20;

type FieldKind = 'boolean' | 'number' | 'optionalNumber' | 'string';

/**
 * Every field of a frame's state and what it has to hold. Typing this as a
 * Record over the keys of FrameState makes the compiler insist that a field
 * added to the save format is added here too.
 */
const stateFields: Record<keyof FrameState, FieldKind> = {
    boilerFireTemp: 'number',
    boilerFuelAmount: 'number',
    boilerPressure: 'number',
    boilerWaterLevel: 'number',
    boilerWaterTemp: 'number',
    brakeValue: 'number',
    compressorAirPressure: 'number',
    compressorValveValue: 'number',
    couplerFrontState: 'boolean',
    couplerRearState: 'boolean',
    freightAmount: 'number',
    freightType: 'string',
    generatorValveValue: 'number',
    headlightFrontState: 'boolean',
    headlightRearState: 'boolean',
    headlightType: 'number',
    markerLightsCenterState: 'optionalNumber',
    markerLightsFrontLeftState: 'number',
    markerLightsFrontRightState: 'number',
    markerLightsRearLeftState: 'number',
    markerLightsRearRightState: 'number',
    paintType: 'optionalNumber',
    regulatorValue: 'number',
    reverserValue: 'number',
    sanderAmount: 'optionalNumber',
    smokestackType: 'number',
    tenderFuelAmount: 'number',
    tenderWaterAmount: 'number',
};

/** JSON has no big integers, which text arguments can hold, so they are written as {"$bigint": "123"}. */
const BIGINT_KEY = '$bigint';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Write frames as JSON that a person can read and edit.
 * @param {Frame[]} frames
 * @return {string}
 */
export function framesToJson(frames: Frame[]): string {
    const replacer = (_key: string, value: unknown) =>
        typeof value === 'bigint' ? {[BIGINT_KEY]: value.toString()} : value;
    // The header fields come first in the file, where a person will see them
    // eslint-disable-next-line sort-keys
    return JSON.stringify({format: FORMAT, version: VERSION, frames}, replacer, 2) + '\n';
}

/** Collects what is wrong with a file, each problem with the place it was found. */
class Problems {
    readonly list: string[] = [];
    private dropped = 0;

    add(path: string, expected: string) {
        if (this.list.length < MAX_ERRORS) {
            this.list.push(`${path} should be ${expected}`);
        } else {
            this.dropped++;
        }
    }

    throwIfAny() {
        if (this.list.length === 0) return;
        const more = this.dropped > 0 ? [`...and ${this.dropped} more`] : [];
        throw new FramesJsonError(this.list.concat(more));
    }
}

/** Thrown by framesFromJson. Each problem is a sentence a person can act on. */
export class FramesJsonError extends Error {
    readonly problems: string[];

    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'FramesJsonError';
        this.problems = problems;
    }
}

function readNumber(value: unknown, path: string, problems: Problems): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    problems.add(path, 'a number');
    return 0;
}

function readString(value: unknown, path: string, problems: Problems): GvasString {
    if (typeof value === 'string' || value === null) return value;
    problems.add(path, 'text or null');
    return null;
}

function readVector(value: unknown, path: string, problems: Problems): Vector {
    if (!isRecord(value)) {
        problems.add(path, 'an object with x, y and z');
        return {x: 0, y: 0, z: 0};
    }
    return {
        x: readNumber(value['x'], `${path}.x`, problems),
        y: readNumber(value['y'], `${path}.y`, problems),
        z: readNumber(value['z'], `${path}.z`, problems),
    };
}

function readRotator(value: unknown, path: string, problems: Problems): Rotator {
    if (!isRecord(value)) {
        problems.add(path, 'an object with pitch, roll and yaw');
        return {pitch: 0, roll: 0, yaw: 0};
    }
    return {
        pitch: readNumber(value['pitch'], `${path}.pitch`, problems),
        roll: readNumber(value['roll'], `${path}.roll`, problems),
        yaw: readNumber(value['yaw'], `${path}.yaw`, problems),
    };
}

/**
 * Check an argument of a text format: a pair of a kind and a value.
 * @param {unknown} value
 * @param {string} path
 * @param {Problems} problems
 * @param {number} depth
 */
function checkTextArgument(value: unknown, path: string, problems: Problems, depth: number): void {
    if (!Array.isArray(value) || value.length !== 2) {
        problems.add(path, 'a pair like ["Text", {...}] or ["Int", 5]');
    } else if (value[0] === 'Int') {
        if (typeof value[1] !== 'bigint') {
            problems.add(`${path}[1]`, `a whole number written as {"${BIGINT_KEY}": "5"}`);
        }
    } else if (value[0] === 'Text') {
        checkText(value[1], `${path}[1]`, problems, depth + 1);
    } else {
        problems.add(`${path}[0]`, '"Text" or "Int"');
    }
}

/**
 * Check that a value is one of the kinds of text the save format has. The
 * kinds are told apart the same way the rest of the editor does it, by which
 * fields are present.
 * @param {unknown} value
 * @param {string} path
 * @param {Problems} problems
 * @param {number} depth
 */
function checkText(value: unknown, path: string, problems: Problems, depth = 0): void {
    if (!isRecord(value)) return problems.add(path, 'a text object');
    if (depth > MAX_TEXT_DEPTH) return problems.add(path, 'less deeply nested');
    if (typeof value['flags'] !== 'number') problems.add(`${path}.flags`, 'a number');
    if ('values' in value) {
        const values = value['values'];
        // The save format has room for one value here; the exporter refuses more
        if (!Array.isArray(values) || values.length > 1 || !values.every((v) => typeof v === 'string' || v === null)) {
            problems.add(`${path}.values`, 'a list holding one piece of text, or none');
        }
    } else if ('key' in value) {
        for (const field of ['namespace', 'key', 'value']) readString(value[field], `${path}.${field}`, problems);
    } else if ('args' in value) {
        checkText(value['sourceFormat'], `${path}.sourceFormat`, problems, depth + 1);
        const args = value['args'];
        if (!Array.isArray(args)) return problems.add(`${path}.args`, 'a list');
        args.forEach((arg: unknown, i) => {
            if (!isRecord(arg)) return problems.add(`${path}.args[${i}]`, 'an object with name and value');
            readString(arg['name'], `${path}.args[${i}].name`, problems);
            checkTextArgument(arg['value'], `${path}.args[${i}].value`, problems, depth);
        });
    } else if ('sourceValue' in value) {
        checkTextArgument(value['sourceValue'], `${path}.sourceValue`, problems, depth);
        readString(value['targetCulture'], `${path}.targetCulture`, problems);
        const options = value['formatOptions'];
        if (typeof options !== 'undefined' && !isRecord(options)) problems.add(`${path}.formatOptions`, 'an object');
    } else if ('tableId' in value) {
        readString(value['tableId'], `${path}.tableId`, problems);
        readString(value['tableKey'], `${path}.tableKey`, problems);
    } else {
        problems.add(path, 'a text object (with values, key, args, sourceValue or tableId)');
    }
}

function readText(value: unknown, path: string, problems: Problems): GvasText {
    const before = problems.list.length;
    checkText(value, path, problems);
    // Checked field by field above, which the compiler cannot follow
    if (problems.list.length === before) return value as GvasText;
    return {flags: 0, values: []};
}

function readState(value: unknown, path: string, problems: Problems): FrameState {
    const state: Record<string, unknown> = {};
    if (!isRecord(value)) {
        problems.add(path, 'an object');
        return state as FrameState;
    }
    for (const [field, kind] of Object.entries(stateFields)) {
        const fieldValue = value[field];
        const fieldPath = `${path}.${field}`;
        if (kind === 'number') {
            state[field] = readNumber(fieldValue, fieldPath, problems);
        } else if (kind === 'optionalNumber') {
            // Older saves do not have these
            if (typeof fieldValue !== 'undefined' && fieldValue !== null) {
                state[field] = readNumber(fieldValue, fieldPath, problems);
            }
        } else if (kind === 'boolean') {
            if (typeof fieldValue !== 'boolean') problems.add(fieldPath, 'true or false');
            state[field] = fieldValue;
        } else {
            state[field] = readString(fieldValue, fieldPath, problems);
        }
    }
    // Every field was checked against stateFields above, which the compiler cannot follow
    return state as FrameState;
}

/**
 * Read frames from JSON written by framesToJson, or from a plain JSON list of
 * frames. Only the fields a frame has are kept.
 * @param {string} text
 * @return {Frame[]}
 * @throws {FramesJsonError} if the text is not JSON, or does not describe frames.
 */
export function framesFromJson(text: string): Frame[] {
    const reviver = (_key: string, value: unknown) => {
        if (isRecord(value) && Object.keys(value).length === 1 && typeof value[BIGINT_KEY] === 'string') {
            try {
                return BigInt(value[BIGINT_KEY]);
            } catch (e) {
                console.log(e);
            }
        }
        return value;
    };
    let parsed: unknown;
    try {
        parsed = JSON.parse(text, reviver);
    } catch (e) {
        throw new FramesJsonError([`This is not a JSON file (${e instanceof Error ? e.message : String(e)})`]);
    }
    let list: unknown = parsed;
    if (isRecord(parsed)) {
        if (parsed['format'] !== FORMAT) {
            throw new FramesJsonError(['This JSON file is not a list of frames exported from Railroad Studio']);
        }
        if (typeof parsed['version'] !== 'number' || parsed['version'] > VERSION) {
            throw new FramesJsonError(['This file was exported by a newer version of Railroad Studio']);
        }
        list = parsed['frames'];
    }
    if (!Array.isArray(list)) throw new FramesJsonError(['The file should hold a list of frames']);
    const problems = new Problems();
    const frames = list.map((value: unknown, i): Frame => {
        const path = `frames[${i}]`;
        const frame = isRecord(value) ? value : {};
        if (!isRecord(value)) problems.add(path, 'an object');
        return {
            location: readVector(frame['location'], `${path}.location`, problems),
            name: readText(frame['name'], `${path}.name`, problems),
            number: readText(frame['number'], `${path}.number`, problems),
            rotation: readRotator(frame['rotation'], `${path}.rotation`, problems),
            state: readState(frame['state'], `${path}.state`, problems),
            type: readString(frame['type'], `${path}.type`, problems),
        };
    });
    problems.throwIfAny();
    return frames;
}
