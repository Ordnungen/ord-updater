/*
 * Свойства заметки: что плагин ведёт, как он это решает и какие помощники для
 * списков ему нужны.
 *
 * Модуль чистый: ни состояния Obsidian, ни чтения хранилища — только правила.
 * Поэтому его проверяют напрямую, без запуска приложения.
 */

import type { ORDupdaterSettings } from './settings';

/** Что должно измениться в свойствах: новые значения и то, что нужно убрать. */
export interface PropertyPlan {
    changes: Record<string, unknown>;
    removals: string[];
}

/** Наши следы в свойствах: тег папки и цепочка ссылок на разделы. */
export interface NoteTraces {
    folderTag: string;
    /** Имя папки как есть: недопустимый тегом прежний след плагин за собой убирает. */
    legacyTag?: string;
    chain: string[];
}

/**
 * Имя папки в виде тега, который Obsidian принимает.
 *
 * По документации Obsidian в теге можно только буквы, цифры, `_`, `-` и `/`,
 * поэтому точки, пробелы, скобки и прочее становятся `_`. Имя без единой буквы
 * тегом быть не может (Obsidian не принимает теги из одних цифр) — тогда пусто.
 */
export function tagFor(name: string): string {
    const cleaned = name
        .replace(/[^\p{L}\p{N}_/-]+/gu, '_')
        .replace(/_+/g, '_')
        .replace(/^[-_/]+|[-_/]+$/g, '');
    if (cleaned === '' || !/\p{L}/u.test(cleaned)) return '';
    return cleaned;
}

/** Имена из настройки: пустые куски отбрасываем, сравнение — без регистра. */
export function parseSkipNames(value: string): string[] {
    return value
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name !== '');
}

/** A property value as a list of strings, whatever shape it has in the file. */
export function toStringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(item => String(item));
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(item => item !== '');
    }
    return [];
}

/** Adds the values that are not there yet, keeping the existing ones in place. */
export function mergeList(value: unknown, additions: string[]): string[] {
    const result = toStringList(value);
    for (const item of additions) {
        if (!result.includes(item)) result.push(item);
    }
    return result;
}

/** Compares property values by content, not by reference. */
export function sameValue(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/** A property value as text — only simple values have one. */
export function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

/**
 * Что записать в свойства заметки.
 *
 * Возвращает null, когда менять нечего: именно это не даёт повторному прогону
 * трогать файл, а `update` двигаться без причины.
 */
export function planProperties(options: {
    settings: ORDupdaterSettings;
    current: Record<string, unknown>;
    traces: NoteTraces;
    now: string;
    noteChanged: boolean;
}): PropertyPlan | null {
    const { settings, current, traces, now, noteChanged } = options;
    const changes: Record<string, unknown> = {};
    const removals: string[] = [];

    if (settings.overwriteMode) {
        // Overwrite mode: only the properties this plugin manages survive.
        for (const key of Object.keys(current)) {
            if (!['date', 'update', 'tags', 'links'].includes(key)) removals.push(key);
        }
    }

    if (asText(current['date']).trim() === '') changes['date'] = now;

    if (settings.autoTags) {
        const legacy = traces.legacyTag && traces.legacyTag !== traces.folderTag ? traces.legacyTag : '';
        if (settings.overwriteMode) {
            // The index tag marks a note this plugin created: keep it.
            const index = toStringList(current['tags']).filter(tag => tag === 'index');
            const own = traces.folderTag === '' ? index : [traces.folderTag, ...index];
            changes['tags'] = [...new Set(own)];
        } else {
            // Merge: the folder tag is added, the user's own tags stay. The only
            // thing that goes is the invalid form this plugin wrote before.
            const existing = toStringList(current['tags']).filter(tag => tag !== legacy);
            const tags = traces.folderTag === '' ? existing : mergeList(existing, [traces.folderTag]);
            if (!sameValue(tags, current['tags'])) changes['tags'] = tags;
        }
    } else if (settings.overwriteMode && current['tags'] !== undefined) {
        removals.push('tags');
    }

    if (settings.autoLinks && traces.chain.length > 0) {
        const links = settings.overwriteMode ? traces.chain : mergeList(current['links'], traces.chain);
        if (!sameValue(links, current['links'])) changes['links'] = links;
    } else if (settings.overwriteMode && current['links'] !== undefined) {
        removals.push('links');
    }

    const touched = Object.keys(changes).length > 0 || removals.length > 0;
    if (!touched && !noteChanged) return null;
    if (asText(current['update']) !== now) changes['update'] = now;
    return { changes, removals };
}

/**
 * Что убрать из свойств после переноса заметки: следы прежней папки и только
 * они. Всё, что написал пользователь, остаётся.
 *
 * Старый путь — единственный способ отличить нашу цепочку от его ссылок.
 */
export function planStaleTraces(options: {
    settings: ORDupdaterSettings;
    oldPath: string;
    traces: NoteTraces;
    current: Record<string, unknown>;
}): { links: string[]; tags: string[] } | null {
    const { settings, oldPath, traces, current } = options;
    const oldFolders = oldPath.split('/').slice(0, -1);
    if (oldFolders.length === 0) return null;

    const staleLinks = oldFolders
        .map(part => `[[${part}]]`)
        .filter(link => !traces.chain.includes(link));
    const oldTag = oldFolders[oldFolders.length - 1] ?? '';
    const staleTag = oldTag !== '' && oldTag !== traces.folderTag;

    const links = toStringList(current['links']);
    const keptLinks = links.filter(link => !staleLinks.includes(link));
    const tags = toStringList(current['tags']);
    const keptTags = tags.filter(tag => tag !== oldTag);

    const linksChanged = settings.autoLinks && keptLinks.length !== links.length;
    const tagsChanged = settings.autoTags && staleTag && keptTags.length !== tags.length;
    if (!linksChanged && !tagsChanged) return null;

    return { links: keptLinks, tags: keptTags };
}
