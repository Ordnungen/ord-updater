import { Plugin, PluginSettingTab, SettingDefinitionControl, SettingDefinitionItem, TFile, TFolder, Notice, TAbstractFile, getLanguage, moment, normalizePath } from 'obsidian';
import { confirmAction } from './confirm';

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

type LangKey = keyof typeof LANG.en;

/**
 * Language of the interface, taken from Obsidian itself: a user may run the app
 * in Russian on an English system, and the plugin must follow the app.
 * `getLanguage()` exists since Obsidian 1.8.7; the plugin's `minAppVersion` is
 * 1.13.0, so the API is always there.
 */
function currentLanguage(): string {
    return getLanguage();
}

function t(key: LangKey, replacements?: Record<string, string>): string {
    const lang: 'ru' | 'en' = currentLanguage().startsWith('ru') ? 'ru' : 'en';
    let text = LANG[lang][key] ?? LANG.en[key];
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`__${k}__`, v);
        }
    }
    return text;
}

function isRu(): boolean {
    return currentLanguage().startsWith('ru');
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface ORDupdaterSettings {
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

const DEFAULT_SETTINGS: ORDupdaterSettings = {
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
function sanitizeSettings(data: unknown): ORDupdaterSettings {
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
function parseSkipNames(value: string): string[] {
    return value
        .split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name !== '');
}

/** A property value as a list of strings, whatever shape it has in the file. */
function toStringList(value: unknown): string[] {
    if (Array.isArray(value)) return value.map(item => String(item));
    if (typeof value === 'string') {
        return value.split(',').map(item => item.trim()).filter(item => item !== '');
    }
    return [];
}

/** Adds the values that are not there yet, keeping the existing ones in place. */
function mergeList(value: unknown, additions: string[]): string[] {
    const result = toStringList(value);
    for (const item of additions) {
        if (!result.includes(item)) result.push(item);
    }
    return result;
}

/** Compares property values by content, not by reference. */
function sameValue(left: unknown, right: unknown): boolean {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

/** A property value as text — only simple values have one. */
function asText(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class OrdUpdater extends Plugin {
    private processing: Map<string, number> = new Map();
    private readonly DEBOUNCE_MS = 3000;
    settings: ORDupdaterSettings = DEFAULT_SETTINGS;
    private readonly BATCH_SIZE = 20;
    private contentCache: Map<string, string> = new Map();
    private batchCount = 0;
    private get inBatch(): boolean { return this.batchCount > 0; }

    async onload(): Promise<void> {
        await this.loadSettings();
        this.applyLockStyle();

        this.addRibbonIcon('refresh-cw', t('ribbonTooltip'), async () => {
            await this.updateWholeVault();
        });

        // Commands
        this.addCommand({
            id: 'update-current-file',
            name: t('cmdUpdateFile'),
            callback: async () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    await this.safeUpdate(file, true);
                    new Notice(t('noticeFileUpdated', { name: file.basename }));
                } else {
                    new Notice(t('noticeNoFile'));
                }
            },
        });

        this.addCommand({
            id: 'update-all-files',
            name: t('cmdUpdateVault'),
            callback: async () => {
                await this.updateWholeVault();
            },
        });

        if (this.settings.autoUpdate) {
            this.registerEvent(this.app.vault.on('modify', (file: TAbstractFile) => this.handleAutoUpdate(file)));
            this.registerEvent(this.app.vault.on('create', (file: TAbstractFile) => this.handleAutoUpdate(file)));
            // Переименование и перенос обрабатывает отдельный обработчик ниже:
            // он и обновляет свойства, и убирает следы прежней папки — по
            // порядку, а не двумя параллельными записями в один файл.
        }

        this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
            void this.handleVaultRename(file, oldPath);
        }));

        this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                window.setTimeout(() => { void this.updateActiveFile(); }, 200);
            }
        });

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file: TAbstractFile) => {
                if (file instanceof TFolder) {
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menuUpdateFolder'))
                            .setIcon('refresh-cw')
                            .onClick(async () => {
                                // Rename the folder itself if it has spaces
                                if (file.name.includes(' ')) {
                                    const newName = file.name.replace(/\s+/g, '_');
                                    try {
                                        await this.app.fileManager.renameFile(file, normalizePath(`${file.parent?.path || ''}/${newName}`));
                                    } catch {
                                        console.error(`ORDupdater: could not rename folder "${file.path}"`);
                                    }
                                }
                                const files = await this.getMarkdownFilesRecursive(file);
                                const count = await this.batchUpdate(files, true);
                                if (this.settings.autoIndex) {
                                    await this.updateIndexesDeep([file, ...this.collectFoldersDeep(file)]);
                                }
                                this.contentCache.clear();
                                new Notice(t('noticeFolderUpdated', { n: String(count), name: file.name }));
                            });
                    });
                } else if (file instanceof TFile && file.extension === 'md') {
                    menu.addItem((item) => {
                        item
                            .setTitle(t('menuUpdateFile'))
                            .setIcon('refresh-cw')
                            .onClick(async () => {
                                await this.safeUpdate(file, true);
                                new Notice(t('noticeFileUpdated', { name: file.basename }));
                            });
                    });
                }
            })
        );

        this.addSettingTab(new ORDupdaterSettingTab(this.app, this));
    }

    onunload(): void {
        this.processing.clear();
        this.contentCache.clear();
        document.body.classList.remove('ord-updater-lock');
    }

    async loadSettings(): Promise<void> {
        this.settings = sanitizeSettings(await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        this.applyLockStyle();
    }

    getSettings(): ORDupdaterSettings {
        return this.settings;
    }

    private applyLockStyle(): void {
        document.body.classList.toggle('ord-updater-lock', this.settings.lockProperties);
    }

    /**
     * Everything at once: rename folders with spaces when that is switched on,
     * refresh the properties of every note, then rebuild the folder indexes.
     * It touches the whole vault, so it asks first and reports when it is done.
     */
    private async updateWholeVault(): Promise<void> {
        const files = this.app.vault.getMarkdownFiles();
        const confirmed = await confirmAction(this.app, {
            title: t('confirmUpdateTitle'),
            message: t('confirmUpdateMessage', { n: String(files.length) }),
            confirm: t('confirmUpdateButton'),
            cancel: t('confirmCancelButton'),
        });
        if (!confirmed) {
            new Notice(t('noticeCancelled'));
            return;
        }

        if (this.settings.sanitizeSpaces) {
            const folders: TFolder[] = [this.app.vault.getRoot(), ...this.collectFoldersDeep(this.app.vault.getRoot())];
            folders.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
            for (const folder of folders) {
                if (this.shouldSkip(folder.path)) continue;
                if (!folder.name.includes(' ')) continue;
                const newName = folder.name.replace(/\s+/g, '_');
                try {
                    await this.app.fileManager.renameFile(folder, normalizePath(`${folder.parent?.path || ''}/${newName}`));
                } catch (error) {
                    console.error(`ORDupdater: could not rename folder "${folder.path}"`, error);
                }
            }
        }

        const count = await this.batchUpdate(files, true);
        if (this.settings.autoIndex) {
            await this.updateIndexesDeep(this.collectFoldersDeep(this.app.vault.getRoot()));
        }
        this.contentCache.clear();
        new Notice(t('noticeUpdated', { n: String(count) }));
    }

    /** Update on Ctrl/Cmd+S: Obsidian saves right after the key event. */
    private async updateActiveFile(): Promise<void> {
        const file = this.app.workspace.getActiveFile();
        if (file) await this.safeUpdate(file, true);
    }

    /** Debounced index refresh after an automatic edit. */
    private async updateIndexAfterEdit(folder: TFolder, key: string): Promise<void> {
        try {
            await this.updateFolderIndex(folder);
        } catch (error) {
            console.error(`ORDupdater: could not refresh the index of "${folder.path}"`, error);
        } finally {
            this.processing.delete(key);
        }
    }

    /**
     * Names the plugin leaves alone: hidden entries always (Obsidian's own
     * folders among them), plus whatever the `skipNames` setting lists. The
     * setting repeats the names that used to be hardcoded, so the default
     * behaviour is the one users already know.
     */
    private shouldSkip(path: string): boolean {
        const skip = parseSkipNames(this.settings.skipNames);
        return path.split('/').some(part => part.startsWith('.') || skip.includes(part.toLowerCase()));
    }

    /** Vault events expect a void callback; the work itself is awaited inside. */
    private handleAutoUpdate(file: TAbstractFile): void {
        void this.safeUpdate(file, false);
    }

    /**
     * A note moved to another folder: the chain to its old sections and the tag
     * of the old folder are no longer true, so exactly those go. Anything else
     * in `links` and `tags` is the user's. The rename event gives the old path,
     * which is the only way to tell our traces apart from the user's own.
     */
    private async dropStaleTraces(file: TFile, oldPath: string): Promise<void> {
        const oldFolders = oldPath.split('/').slice(0, -1);
        if (oldFolders.length === 0) return;

        const currentChain = this.folderChain(file);
        const staleLinks = oldFolders.map(part => `[[${part}]]`).filter(link => !currentChain.includes(link));
        const oldTag = oldFolders[oldFolders.length - 1] ?? '';
        const staleTag = oldTag !== '' && oldTag !== this.folderTag(file);

        const frontmatter: Record<string, unknown> = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const links = toStringList(frontmatter['links']);
        const keptLinks = links.filter(link => !staleLinks.includes(link));
        const tags = toStringList(frontmatter['tags']);
        const keptTags = tags.filter(tag => tag !== oldTag);

        const linksChanged = this.settings.autoLinks && keptLinks.length !== links.length;
        const tagsChanged = this.settings.autoTags && staleTag && keptTags.length !== tags.length;
        if (!linksChanged && !tagsChanged) return;

        this.processing.set(file.path, Date.now() + this.DEBOUNCE_MS);
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            if (linksChanged) {
                if (keptLinks.length > 0) fm['links'] = keptLinks;
                else delete fm['links'];
            }
            if (tagsChanged) {
                if (keptTags.length > 0) fm['tags'] = keptTags;
                else delete fm['tags'];
            }
        });
    }

    /** A renamed folder can leave its old index note behind. */
    private async handleVaultRename(file: TAbstractFile, oldPath: string): Promise<void> {
        if (file instanceof TFile && file.extension === 'md') {
            // Сначала свойства по новому месту, потом уборка следов старого:
            // обе записи идут одна за другой в один файл.
            if (this.settings.autoUpdate) await this.safeUpdate(file, true);
            await this.dropStaleTraces(file, oldPath);
            return;
        }
        if (!(file instanceof TFolder)) return;
        const oldName = oldPath.split('/').pop();
        if (oldName && oldName !== file.name) {
            const stray = this.app.vault.getAbstractFileByPath(`${file.path}/${oldName}.md`);
            const target = this.app.vault.getAbstractFileByPath(`${file.path}/${file.name}.md`);
            if (stray instanceof TFile) {
                if (target instanceof TFile) {
                    // The old index is replaced by the new one, but only when it
                    // really is an index note: anything else is the user's note.
                    if (this.isIndexNote(stray)) {
                        await this.app.fileManager.trashFile(stray);
                    } else {
                        console.warn(`ORDupdater: left "${stray.path}" in place — it is not a folder index`);
                    }
                } else {
                    await this.app.fileManager.renameFile(stray, normalizePath(`${file.path}/${file.name}.md`));
                }
            } else if (!(target instanceof TFile)) {
                await this.updateFolderIndex(file);
            }
        }
        if (file.parent) await this.updateFolderIndex(file.parent);
    }

    private async safeUpdate(file: TAbstractFile, isManual: boolean): Promise<boolean> {
        if (!(file instanceof TFile) || file.extension !== 'md') return false;
        if (this.shouldSkip(file.path)) return false;
        // Debounce: skip auto events within DEBOUNCE_MS, but NOT manual
        if (!isManual) {
            const expiry = this.processing.get(file.path);
            if (expiry) {
                if (Date.now() < expiry) return false;
                this.processing.delete(file.path);
            }
        }

        // Step 1: rename parent folder if it has spaces (only manual)
        if (isManual && this.settings.sanitizeSpaces && file.parent && file.parent.name.includes(' ')) {
            const newName = file.parent.name.replace(/\s+/g, '_');
            try {
                await this.app.fileManager.renameFile(file.parent, normalizePath(`${file.parent.parent?.path || ''}/${newName}`));
                // Continue to process frontmatter — file reference is updated in-place
            } catch {
                console.error(`ORDupdater: could not rename folder "${file.parent.path}"`);
            }
        }

        // Step 2: rename file itself if it has spaces (before index check, so index files also get sanitized)
        if (isManual && this.settings.sanitizeSpaces && file.name.includes(' ')) {
            const baseName = file.basename.replace(/\s+/g, '_');
            const ext = file.extension;
            let candidateName = `${baseName}.${ext}`;
            let candidatePath = normalizePath(`${file.parent?.path || ''}/${candidateName}`);
            let counter = 0;
            // If target exists, find next available number
            while (this.app.vault.getAbstractFileByPath(candidatePath)) {
                counter++;
                candidateName = `${baseName}_${counter}.${ext}`;
                candidatePath = normalizePath(`${file.parent?.path || ''}/${candidateName}`);
            }
            if (candidatePath !== file.path) {
                try {
                    await this.app.fileManager.renameFile(file, candidatePath);
                    // file reference updated in-place by Obsidian
                } catch {
                    console.error(`ORDupdater: could not rename "${file.path}" to "${candidatePath}"`);
                }
            }
        }

        // Step 3: skip index files
        if (file.parent && file.basename === file.parent.name) return false;

        // Step 4: update frontmatter
        try {
            const changed = await this.updateFrontmatter(file, !isManual);
            if (changed && isManual && this.settings.updateIndexOnSave && file.parent) {
                await this.updateFolderIndex(file.parent);
            }
            if (changed && !isManual && this.settings.autoIndex && file.parent) {
                // Auto-events: debounce index update to avoid excessive writes
                const parent = file.parent;
                const key = `idx:${parent.path}`;
                if (!this.processing.has(key)) {
                    this.processing.set(key, Date.now() + 5000);
                    window.setTimeout(() => { void this.updateIndexAfterEdit(parent, key); }, 1000);
                }
            }
            return changed;
        } catch (error) {
            console.error(`ORDupdater: could not update the properties of "${file.path}"`, error);
            return false;
        }
    }

    private async batchUpdate(files: TFile[], isManual: boolean): Promise<number> {
        this.batchCount++;
        try {
            const results = new Array(files.length).fill(false);
            for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
                const batch = files.slice(i, i + this.BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(f => this.safeUpdate(f, isManual))
                );
                for (let j = 0; j < batchResults.length; j++) {
                    results[i + j] = batchResults[j];
                }
            }
            return results.filter(Boolean).length;
        } finally {
            this.batchCount--;
        }
    }

    /**
     * Properties are written through FileManager.processFrontMatter: Obsidian
     * parses and serialises YAML itself, so property types, nested values and
     * block scalars survive, and every plugin sees the same data.
     *
     * The file is only written when there is something to change: a repeated run
     * over an untouched note leaves it alone, and `update` moves only when the
     * note or its properties really changed.
     */
    private async updateFrontmatter(file: TFile, noteChanged: boolean): Promise<boolean> {
        const now = this.getTimestamp();
        const current: Record<string, unknown> = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
        const plan = this.plannedProperties(file, current, now, noteChanged);
        if (!plan) return false;

        this.processing.set(file.path, Date.now() + this.DEBOUNCE_MS);
        await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(plan.changes)) frontmatter[key] = value;
            for (const key of plan.removals) delete frontmatter[key];
        });
        return true;
    }

    /**
     * What the properties should say, as a patch on the current state.
     * Returns null when there is nothing to do — that is what keeps a second run
     * from touching the file at all.
     */
    private plannedProperties(
        file: TFile,
        current: Record<string, unknown>,
        now: string,
        noteChanged: boolean,
    ): { changes: Record<string, unknown>; removals: string[] } | null {
        const settings = this.settings;
        const changes: Record<string, unknown> = {};
        const removals: string[] = [];
        const folderTag = this.folderTag(file);
        const chain = this.folderChain(file);

        if (settings.overwriteMode) {
            // Overwrite mode: only the properties this plugin manages survive.
            for (const key of Object.keys(current)) {
                if (!['date', 'update', 'tags', 'links'].includes(key)) removals.push(key);
            }
        }

        const date = current['date'];
        if (asText(date).trim() === '') changes['date'] = now;

        if (settings.autoTags) {
            if (settings.overwriteMode) {
                // The index tag marks a note this plugin created: keep it.
                const index = toStringList(current['tags']).filter(tag => tag === 'index');
                changes['tags'] = [...new Set([folderTag, ...index])];
            } else {
                // Merge: the folder tag is added, the user's own tags stay.
                const tags = mergeList(current['tags'], [folderTag]);
                if (!sameValue(tags, current['tags'])) changes['tags'] = tags;
            }
        } else if (settings.overwriteMode && current['tags'] !== undefined) {
            removals.push('tags');
        }

        if (settings.autoLinks && chain.length > 0) {
            const links = settings.overwriteMode ? chain : mergeList(current['links'], chain);
            if (!sameValue(links, current['links'])) changes['links'] = links;
        } else if (settings.overwriteMode && current['links'] !== undefined) {
            removals.push('links');
        }

        const touched = Object.keys(changes).length > 0 || removals.length > 0;
        if (!touched && !noteChanged) return null;
        if (asText(current['update']) !== now) changes['update'] = now;
        return { changes, removals };
    }

    /** Tag of the folder the note lives in; the note's own name at the root. */
    private folderTag(file: TFile): string {
        return file.parent && file.parent.name ? file.parent.name : file.basename;
    }

    /** Links to the folders the note lives in, from the top down. */
    private folderChain(file: TFile): string[] {
        const parts = file.parent ? file.parent.path.split('/').filter(Boolean) : [];
        return [...new Set(parts.map(part => `[[${part}]]`))];
    }

    private async getMarkdownFilesRecursive(folder: TFolder): Promise<TFile[]> {
        const files: TFile[] = [];
        for (const entry of folder.children) {
            if (entry instanceof TFolder) {
                files.push(...await this.getMarkdownFilesRecursive(entry));
            } else if (entry instanceof TFile && entry.extension === 'md') {
                files.push(entry);
            }
        }
        return files;
    }

    /** Every folder below `folder`, in no particular order. */
    private collectFoldersDeep(folder: TFolder): TFolder[] {
        const result: TFolder[] = [];
        const walk = (current: TFolder): void => {
            for (const entry of current.children) {
                if (entry instanceof TFolder) {
                    result.push(entry);
                    walk(entry);
                }
            }
        };
        walk(folder);
        return result;
    }

    /**
     * Index notes of the deepest folders first, so a parent index lists folders
     * that already have their own index written.
     */
    private async updateIndexesDeep(folders: TFolder[]): Promise<void> {
        const ordered = [...folders].sort((a, b) => b.path.split('/').length - a.path.split('/').length);
        for (const folder of ordered) {
            await this.updateFolderIndex(folder);
        }
    }

    /** An index note is one this plugin created: it carries the `index` tag. */
    private isIndexNote(file: TFile): boolean {
        const frontmatter: Record<string, unknown> | undefined = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const tags = frontmatter?.['tags'];
        if (Array.isArray(tags)) return (tags as unknown[]).some(tag => tag === 'index');
        if (typeof tags === 'string') return tags === 'index';
        return false;
    }

    private async updateFolderIndex(folder: TFolder): Promise<void> {
        // Skip root folder and hidden/system folders
        if (!folder.path || folder.path === '') return;
        try { if (folder.isRoot()) return; } catch { /* fallback: path already checked */ }
        if (this.shouldSkip(folder.path)) return;
        // Skip plugin directories (containing manifest.json or package.json)
        if (folder.children.some(c => c instanceof TFile && (c.name === 'manifest.json' || c.name === 'package.json'))) return;
        try {
            const vault = this.app.vault;
            const indexPath = `${folder.path}/${folder.name}.md`;
            const children = folder.children || [];
            const subfolders: string[] = [];
            const notes: string[] = [];

            for (const c of children) {
                if (!c.name || c.name.startsWith('.')) continue;

                if (c instanceof TFolder) {
                    subfolders.push(`- [[${c.name}]]`);
                } else if (c instanceof TFile && c.extension === 'md' && c.name !== `${folder.name}.md`) {
                    try {
                        const content = this.contentCache.get(c.path) ?? await vault.read(c);
                        let date = '', tags = '', update = '';

                        if (content.startsWith('---')) {
                            const endIdx = content.indexOf('---', 3);
                            if (endIdx > 3) {
                                const fm = content.slice(3, endIdx);
                                const dateMatch = fm.match(/date:\s*(.+?)(?:\n|$)/);
                                const updateMatch = fm.match(/update:\s*(.+?)(?:\n|$)/);
                                const tagsMatch = fm.match(/tags:\s*\n([\s\S]*?)(?:\n\S|\n\n|$)/);

                                if (dateMatch) date = dateMatch[1].trim();
                                if (updateMatch) update = updateMatch[1].trim();
                                if (tagsMatch) {
                                    const tagLines = tagsMatch[1]
                                        .split('\n')
                                        .map(l => l.trim().replace(/^-\s*"?|"?$/g, ''))
                                        .filter(Boolean);
                                    tags = tagLines.join(', ');
                                }
                            }
                        }

                        let entry = `- [[${c.basename}]]`;
                        const props: string[] = [];
                        if (date) props.push(`date: ${date}`);
                        if (tags) props.push(`tags: ${tags}`);
                        if (update) props.push(`update: ${update}`);
                        if (props.length) entry += ` _(${props.join(' | ')})_`;
                        notes.push(entry);
                    } catch {
                        notes.push(`- [[${c.basename}]]`);
                    }
                }
            }

            subfolders.sort((a, b) => a.localeCompare(b, isRu() ? 'ru' : 'en'));
            notes.sort((a, b) => a.localeCompare(b, isRu() ? 'ru' : 'en'));

            const now = this.getTimestamp();
            const tagName = folder.name;
            const parentParts = folder.parent ? folder.parent.path.split('/').filter(Boolean) : [];
            const folderLinks: string[] = [];
            if (parentParts.length > 0) {
                for (const p of parentParts) {
                    const link = `[[${p}]]`;
                    if (link !== `[[${tagName}]]`) {
                        folderLinks.push(link);
                    }
                }
            }

            // Содержимое собирается без отметок времени: они добавляются в конце,
            // и заметка переписывается только если что-то другое изменилось.
            const build = (date: string, update: string): string => {
                let content = '---\n';
                content += `date: ${date}\n`;
                content += `update: ${update}\n`;
                content += 'tags:\n';
                content += `  - "${tagName}"\n`;
                content += '  - "index"\n';
                if (folderLinks.length > 0) {
                    content += 'links:\n';
                    for (const link of folderLinks) {
                        content += `  - "${link}"\n`;
                    }
                }
                content += '---\n\n';
                if (subfolders.length) {
                    content += `## ${t('indexSubfolders')}\n\n${subfolders.join('\n')}\n\n`;
                }
                if (notes.length) {
                    content += `## ${t('indexNotes')}\n\n${notes.join('\n')}\n`;
                } else if (subfolders.length === 0) {
                    content += `${t('indexEmpty')}\n`;
                }
                return content;
            };

            const existing = vault.getAbstractFileByPath(indexPath);
            if (existing instanceof TFile) {
                const current = await vault.cachedRead(existing);
                const frontmatter: Record<string, unknown> = this.app.metadataCache.getFileCache(existing)?.frontmatter ?? {};
                // Дата создания индексной заметки — не наша: сохраняем её как есть.
                const created = asText(frontmatter['date']) || now;
                const updated = asText(frontmatter['update']) || now;
                if (current === build(created, updated)) return;
                this.processing.set(indexPath, Date.now() + this.DEBOUNCE_MS);
                await vault.process(existing, () => build(created, now));
            } else if (!existing) {
                this.processing.set(indexPath, Date.now() + this.DEBOUNCE_MS);
                await vault.create(indexPath, build(now, now));
            }
        } catch (error) {
            console.error(`ORDupdater: could not write the index of "${folder.path}"`, error);
        }
    }

    private getTimestamp(): string {
        return moment().format('YYYY-MM-DD HH:mm');
    }
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class ORDupdaterSettingTab extends PluginSettingTab {
    /**
     * Settings are declared, not drawn. Obsidian renders the controls, binds
     * them to `plugin.settings` and shows them in its own settings search; the
     * imperative `display()` would be skipped on 1.13+ anyway (docs/PLAN.md §7).
     */
    getSettingDefinitions(): SettingDefinitionItem[] {
        const toggle = (
            key: keyof ORDupdaterSettings,
            name: LangKey,
            desc: LangKey,
        ): SettingDefinitionControl => ({
            name: t(name),
            desc: t(desc),
            control: { type: 'toggle', key },
        });

        return [
            {
                type: 'group',
                heading: t('settingsGeneral'),
                items: [
                    toggle('autoUpdate', 'settingAutoUpdate', 'settingAutoUpdateDesc'),
                    toggle('autoTags', 'settingTags', 'settingTagsDesc'),
                    toggle('autoLinks', 'settingLinks', 'settingLinksDesc'),
                    toggle('autoIndex', 'settingIndex', 'settingIndexDesc'),
                    toggle('updateIndexOnSave', 'settingIndexOnSave', 'settingIndexOnSaveDesc'),
                    toggle('lockProperties', 'settingLock', 'settingLockDesc'),
                    {
                        name: t('settingSkipNames'),
                        desc: t('settingSkipNamesDesc'),
                        control: { type: 'text', key: 'skipNames' },
                    },
                ],
            },
            {
                type: 'group',
                heading: t('settingDangerous'),
                items: [
                    toggle('overwriteMode', 'settingOverwrite', 'settingOverwriteDesc'),
                    toggle('sanitizeSpaces', 'settingSanitize', 'settingSanitizeDesc'),
                ],
            },
        ];
    }
}
