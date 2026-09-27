/*
 * Настройки плагина: типы, значения по умолчанию и проверка прочитанного.
 * Работа со свойствами заметок — в `properties.ts`.
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
    /** Whether the ribbon gets the "update properties" icon. */
    showRibbonIcon: boolean;
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
    showRibbonIcon: true,
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
        showRibbonIcon: flag(raw['showRibbonIcon'], DEFAULT_SETTINGS.showRibbonIcon),
        skipNames: typeof raw['skipNames'] === 'string' ? raw['skipNames'] : DEFAULT_SETTINGS.skipNames,
    };
}
