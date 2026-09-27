/*
 * Тексты интерфейса: EN и RU, язык берётся у Obsidian.
 */
import { getLanguage } from 'obsidian';

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const LANG = {
    ru: {
        ribbonTooltip: 'ORDupdater: обновить свойства',
        cmdUpdateFile: 'Обновить свойства текущего файла',
        cmdUpdateVault: 'Обновить свойства всех файлов хранилища',
        menuUpdateFolder: 'ORDupdater: обновить папку',
        menuUpdateFile: 'ORDupdater: обновить файл',
        noticeUpdated: 'ORDupdater: обновлено __n__ файлов',
        noticeNoFile: 'ORDupdater: нет активного файла',
        noticeFileUpdated: 'ORDupdater: обновлён "__name__"',
        noticeFolderUpdated: 'ORDupdater: обновлено __n__ файлов в "__name__"',
        confirmUpdateTitle: 'Обновить свойства во всём хранилище',
        confirmUpdateMessage: 'Плагин пройдёт по всем заметкам хранилища (__n__) и обновит служебные свойства. Продолжить?',
        confirmUpdateButton: 'Обновить',
        confirmCancelButton: 'Отмена',
        noticeCancelled: 'ORDupdater: отменено',
        settingsTab: 'ORDupdater',
        settingsGeneral: 'Основные настройки',
        settingAutoUpdate: 'Автоматическое обновление',
        settingAutoUpdateDesc: 'Обновлять свойства при создании, изменении и переименовании файлов. Изменения вступают после перезагрузки Obsidian.',
        settingTags: 'Авто-теги',
        settingTagsDesc: 'Добавлять тег из имени папки в свойства.',
        settingLinks: 'Авто-ссылки',
        settingLinksDesc: 'Добавлять обратные ссылки на родительские папки.',
        settingIndex: 'Индексные файлы',
        settingIndexDesc: 'Автоматически создавать и обновлять индексные файлы папок.',
        settingIndexOnSave: 'Обновлять индекс при сохранении',
        settingIndexOnSaveDesc: 'Обновлять индексный файл родительской папки при сохранении.',
        settingSkipNames: 'Не трогать имена',
        settingSkipNamesDesc: 'Папки и заметки с этими именами плагин пропускает. Список через запятую, регистр не важен. Скрытые папки пропускаются всегда.',
        settingDangerous: 'Опасные функции',
        settingLock: 'Блокировать свойства',
        settingLockDesc: 'Скрывает кнопку «Добавить свойство» и крестики удаления тегов в режиме чтения. Полезно если плагин управляет свойствами.',
        settingOverwrite: 'Перезаписывать все свойства',
        settingOverwriteDesc: 'Оставляет только date, update, tags и links, удаляя остальные свойства. При включении авто-теги, авто-ссылки и блокировка свойств действуют принудительно.',
        settingSanitize: 'Убирать пробелы в именах',
        settingSanitizeDesc: 'Переименовывает файлы и папки с пробелами в имени (Мой файл.md → Мой_файл.md).',
        settingRestartNotice: 'Изменения вступят после перезагрузки Obsidian',
        indexSubfolders: 'Подразделы',
        indexNotes: 'Заметки',
        indexEmpty: '_Пусто_',
    },
    en: {
        ribbonTooltip: 'ORDupdater: update properties',
        cmdUpdateFile: 'Update current file properties',
        cmdUpdateVault: 'Update all files in vault',
        menuUpdateFolder: 'ORDupdater: update folder',
        menuUpdateFile: 'ORDupdater: update file',
        noticeUpdated: 'ORDupdater: updated __n__ files',
        noticeNoFile: 'ORDupdater: no active file',
        noticeFileUpdated: 'ORDupdater: updated "__name__"',
        noticeFolderUpdated: 'ORDupdater: updated __n__ files in "__name__"',
        confirmUpdateTitle: 'Update properties in the whole vault',
        confirmUpdateMessage: 'The plugin will go through all __n__ notes in the vault and update the managed properties. Continue?',
        confirmUpdateButton: 'Update',
        confirmCancelButton: 'Cancel',
        noticeCancelled: 'ORDupdater: cancelled',
        settingsTab: 'ORDupdater',
        settingsGeneral: 'General settings',
        settingAutoUpdate: 'Auto-update',
        settingAutoUpdateDesc: 'Update properties on file create, modify and rename. Changes apply after restarting Obsidian.',
        settingTags: 'Auto-tags',
        settingTagsDesc: 'Add a tag from the folder name to properties.',
        settingLinks: 'Auto-links',
        settingLinksDesc: 'Add backlinks to parent folders.',
        settingIndex: 'Folder index',
        settingIndexDesc: 'Automatically create and update folder index files.',
        settingIndexOnSave: 'Update index on save',
        settingIndexOnSaveDesc: 'Update the parent folder index file on save.',
        settingSkipNames: 'Skip names',
        settingSkipNamesDesc: 'Folders and notes with these names are left alone. Comma separated, case does not matter. Hidden folders are always skipped.',
        settingDangerous: 'Dangerous features',
        settingLock: 'Lock properties',
        settingLockDesc: 'Hides the "Add property" button and tag remove buttons in read mode. Useful when the plugin manages properties.',
        settingOverwrite: 'Overwrite all frontmatter',
        settingOverwriteDesc: 'Keeps only date, update, tags and links and removes the other properties. While it is on, auto-tags, auto-links and property locking are forced.',
        settingSanitize: 'Remove spaces in names',
        settingSanitizeDesc: 'Renames files and folders with spaces (My File.md → My_File.md).',
        settingRestartNotice: 'Changes will apply after restarting Obsidian',
        indexSubfolders: 'Subfolders',
        indexNotes: 'Notes',
        indexEmpty: '_Empty_',
    },
};

export type LangKey = keyof typeof LANG.en;

/**
 * Language of the interface, taken from Obsidian itself: a user may run the app
 * in Russian on an English system, and the plugin must follow the app.
 * `getLanguage()` exists since Obsidian 1.8.7; the plugin's `minAppVersion` is
 * 1.13.0, so the API is always there.
 */
function currentLanguage(): string {
    return getLanguage();
}

export function t(key: LangKey, replacements?: Record<string, string>): string {
    const lang: 'ru' | 'en' = currentLanguage().startsWith('ru') ? 'ru' : 'en';
    let text = LANG[lang][key] ?? LANG.en[key];
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`__${k}__`, v);
        }
    }
    return text;
}

export function isRu(): boolean {
    return currentLanguage().startsWith('ru');
}
