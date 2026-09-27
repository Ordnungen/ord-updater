/*
 * Настройки плагина: значения по умолчанию, проверка прочитанного и
 * небольшие помощники для свойств заметок.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ORDupdaterSettings {
    autoUpdate: boolean;
    autoTags: boolean;
    autoLinks: boolean;
    autoIndex: boolean;
    updateIndexOnSave: boolean;
    overwriteMode: boolean;
    sanitizeSpaces: boolean;
    lockProperties: boolean;
    /** Folders and notes the plugin never touches, comma separated. */
    skipNames: string;
}

export const DEFAULT_SETTINGS: ORDupdaterSettings = {
    autoUpdate: true,
    autoTags: true,
    autoLinks: true,
    autoIndex: true,
    updateIndexOnSave: true,
    overwriteMode: false,
    sanitizeSpaces: false,
    lockProperties: false,
    // Значения по умолчанию повторяют прежнее поведение: имена, которые плагин
    // пропускал жёстко зашитыми, теперь можно менять в настройках.
    skipNames: 'node_modules, src, dist, build, README.md',
};

/**
 * Saved settings are user data: an old version, a hand edit or a damaged file
 * can hold anything. Every value is checked and anything unexpected falls back
 * to its default instead of reaching the code as-is.
 */
export function sanitizeSettings(data: unknown): ORDupdaterSettings {
    const raw: Record<string, unknown> = typeof data === 'object' && data !== null
        ? data as Record<string, unknown>
        : {};
    const flag = (value: unknown, fallback: boolean): boolean =>
        typeof value === 'boolean' ? value : fallback;
    return {
        autoUpdate: flag(raw['autoUpdate'], DEFAULT_SETTINGS.autoUpdate),
        autoTags: flag(raw['autoTags'], DEFAULT_SETTINGS.autoTags),
        autoLinks: flag(raw['autoLinks'], DEFAULT_SETTINGS.autoLinks),
        autoIndex: flag(raw['autoIndex'], DEFAULT_SETTINGS.autoIndex),
        updateIndexOnSave: flag(raw['updateIndexOnSave'], DEFAULT_SETTINGS.updateIndexOnSave),
        overwriteMode: flag(raw['overwriteMode'], DEFAULT_SETTINGS.overwriteMode),
        sanitizeSpaces: flag(raw['sanitizeSpaces'], DEFAULT_SETTINGS.sanitizeSpaces),
        lockProperties: flag(raw['lockProperties'], DEFAULT_SETTINGS.lockProperties),
        skipNames: typeof raw['skipNames'] === 'string' ? raw['skipNames'] : DEFAULT_SETTINGS.skipNames,
    };
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
