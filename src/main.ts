import { App, Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice, TAbstractFile } from 'obsidian';

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
        settingsTab: 'ORDupdater',
        settingsGeneral: 'Основные настройки',
        settingAutoUpdate: 'Автоматическое обновление',
        settingAutoUpdateDesc: 'Обновлять свойства при создании, изменении и переименовании файлов.',
        settingTags: 'Авто-теги',
        settingTagsDesc: 'Добавлять тег из имени папки в свойства.',
        settingLinks: 'Авто-ссылки',
        settingLinksDesc: 'Добавлять обратные ссылки на родительские папки.',
        settingIndex: 'Индексные файлы',
        settingIndexDesc: 'Автоматически создавать и обновлять индексные файлы папок.',
        settingIndexOnSave: 'Обновлять индекс при сохранении',
        settingIndexOnSaveDesc: 'Обновлять индексный файл родительской папки при сохранении.',
        settingDangerous: 'Опасные функции',
        settingOverwrite: 'Перезаписывать все свойства',
        settingOverwriteDesc: 'Удаляет нестандартные поля из frontmatter (aliases, description и т.д.). Включайте только если понимаете что делаете.',
        settingSanitize: 'Убирать пробелы в именах',
        settingSanitizeDesc: 'Переименовывает файлы и папки с пробелами в имени (Мой файл.md → Мой_файл.md).',
        settingRestartNotice: 'Изменения вступят после перезагрузки Obsidian',
        labelSubfolders: 'Подпапки',
        labelNotes: 'Заметки',
        labelEmpty: 'Пусто',
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
        settingsTab: 'ORDupdater',
        settingsGeneral: 'General settings',
        settingAutoUpdate: 'Auto-update',
        settingAutoUpdateDesc: 'Update properties on file create, modify and rename.',
        settingTags: 'Auto-tags',
        settingTagsDesc: 'Add a tag from the folder name to properties.',
        settingLinks: 'Auto-links',
        settingLinksDesc: 'Add backlinks to parent folders.',
        settingIndex: 'Folder index',
        settingIndexDesc: 'Automatically create and update folder index files.',
        settingIndexOnSave: 'Update index on save',
        settingIndexOnSaveDesc: 'Update the parent folder index file on save.',
        settingDangerous: 'Dangerous features',
        settingOverwrite: 'Overwrite all frontmatter',
        settingOverwriteDesc: 'Removes non-standard fields from frontmatter (aliases, description, etc.). Enable only if you understand the consequences.',
        settingSanitize: 'Remove spaces in names',
        settingSanitizeDesc: 'Renames files and folders with spaces (My File.md → My_File.md).',
        settingRestartNotice: 'Changes will apply after restarting Obsidian',
        labelSubfolders: 'Subfolders',
        labelNotes: 'Notes',
        labelEmpty: 'Empty',
    },
};

type LangKey = keyof typeof LANG.en;

function getObsidianLang(): string {
    try { return (window as any).localStorage.getItem('language') || navigator.language || 'en'; }
    catch { return navigator.language || 'en'; }
}

function t(key: LangKey, replacements?: Record<string, string>): string {
    const lang = getObsidianLang().startsWith('ru') ? 'ru' : 'en';
    let text = (LANG[lang]?.[key] ?? LANG.en[key]);
    if (replacements) {
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`__${k}__`, v);
        }
    }
    return text;
}

function isRu(): boolean {
    return getObsidianLang().startsWith('ru');
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
}

const DEFAULT_SETTINGS: ORDupdaterSettings = {
    autoUpdate: true,
    autoTags: true,
    autoLinks: true,
    autoIndex: true,
    updateIndexOnSave: true,
    overwriteMode: false,
    sanitizeSpaces: false,
};

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default class OrdUpdater extends Plugin {
    private processing: Map<string, number> = new Map();
    private readonly DEBOUNCE_MS = 3000;
    private pluginSettings: ORDupdaterSettings = DEFAULT_SETTINGS;
    private readonly BATCH_SIZE = 20;
    private contentCache: Map<string, string> = new Map();
    private inBatch = false;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.addRibbonIcon('refresh-cw', t('ribbonTooltip'), async () => {
            const vault = this.app.vault;
            // Rename folders with spaces (only if setting enabled)
            if (this.pluginSettings.sanitizeSpaces) {
                const allFolders: TFolder[] = [];
                const collect = (f: TFolder) => { allFolders.push(f); for (const c of f.children) if (c instanceof TFolder) collect(c); };
                collect(vault.getRoot());
                allFolders.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
                for (const folder of allFolders) {
                    if (folder.path.split('/').some(p => p.startsWith('.'))) continue;
                    if (folder.name.includes(' ')) {
                        const newName = folder.name.replace(/\s+/g, '_');
                        try { await vault.rename(folder, `${folder.parent?.path || ''}/${newName}`); } catch { /* folder may already be renamed */ }
                    }
                }
            }
            // Second pass: update all files
            const files = vault.getMarkdownFiles();
            const count = await this.batchUpdate(files, true);
            if (this.pluginSettings.autoIndex) {
                const root = vault.getRoot();
                const allFolders2: TFolder[] = [];
                const collect2 = (f: TFolder) => { allFolders2.push(f); for (const c of f.children) if (c instanceof TFolder) collect2(c); };
                collect2(root);
                allFolders2.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
                for (const folder of allFolders2) {
                    await this.updateFolderIndex(folder);
                }
            }
            this.contentCache.clear();
            new Notice(t('noticeUpdated', { n: String(count) }));
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
                const files = this.app.vault.getMarkdownFiles();
                const count = await this.batchUpdate(files, false);
                new Notice(t('noticeUpdated', { n: String(count) }));
            },
        });

        if (this.pluginSettings.autoUpdate) {
            this.registerEvent(this.app.vault.on('modify', (file: TAbstractFile) =>
                this.safeUpdate(file, false)));
            this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile) =>
                this.safeUpdate(file, false)));
            this.registerEvent(this.app.vault.on('create', (file: TAbstractFile) =>
                this.safeUpdate(file, false)));
        }

        this.registerEvent(this.app.vault.on('rename', async (file: TAbstractFile, oldPath: string) => {
            if (file instanceof TFolder) {
                const oldName = oldPath.split('/').pop();
                if (oldName && oldName !== file.name) {
                    await new Promise(r => setTimeout(r, 50));
                    const stray = this.app.vault.getAbstractFileByPath(`${file.path}/${oldName}.md`);
                    if (stray instanceof TFile) {
                        await this.app.vault.rename(stray, `${file.path}/${file.name}.md`);
                    }
                }
                if (file.parent) await this.updateFolderIndex(file.parent);
                return;
            }
            if (file instanceof TFile && file.extension === 'md' && file.parent) {
                const oldBase = oldPath.split('/').pop()?.replace('.md', '');
                if (oldBase && oldBase !== file.basename && file.basename !== file.parent.name) {
                    const target = `${file.parent.path}/${file.parent.name}.md`;
                    if (this.app.vault.getAbstractFileByPath(target)) {
                        await this.app.fileManager.trashFile(file);
                    } else {
                        await this.app.vault.rename(file, target);
                    }
                }
            }
        }));

        this.registerDomEvent(document, 'keydown', async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                window.setTimeout(async () => {
                    const file = this.app.workspace.getActiveFile();
                    if (file) await this.safeUpdate(file, true);
                }, 200);
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
                                        await this.app.vault.rename(file, `${file.parent?.path || ''}/${newName}`);
                                    } catch (e) {
                                        console.error("ORDupdater: rename failed", file.path, String(e));
                                    }
                                }
                                const files = await this.getMarkdownFilesRecursive(file);
                                const count = await this.batchUpdate(files, false);
                                if (this.pluginSettings.autoIndex) {
                                    const allFolders = this.getAllSubfolders(file);
                                    allFolders.push(file);
                                    allFolders.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
                                    for (const folder of allFolders) {
                                        await this.updateFolderIndex(folder);
                                    }
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
    }

    async loadSettings(): Promise<void> {
        this.pluginSettings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.pluginSettings);
    }

    getSettings(): ORDupdaterSettings {
        return this.pluginSettings;
    }

    private async safeUpdate(file: TAbstractFile, isManual: boolean): Promise<boolean> {
        if (!(file instanceof TFile) || file.extension !== 'md') return false;
        // Skip hidden files and any file inside hidden folders
        const pathParts = file.path.split('/');
        if (pathParts.some(p => p.startsWith('.'))) return false;
        const expiry = this.processing.get(file.path);
        if (expiry && Date.now() < expiry) return false;

        // Step 1: rename parent folder if it has spaces (before index check)
        if (this.pluginSettings.sanitizeSpaces && file.parent && file.parent.name.includes(' ')) {
            const newName = file.parent.name.replace(/\s+/g, '_');
            try {
                await this.app.vault.rename(file.parent, `${file.parent.parent?.path || ''}/${newName}`);
                return true;
            } catch (e) {
                console.error("ORDupdater: rename folder failed", file.parent.path, String(e));
            }
        }

        // Step 2: skip index files
        if (file.parent && file.basename === file.parent.name) return false;

        // Step 2: rename file itself if it has spaces
        if (this.pluginSettings.sanitizeSpaces && file.name.includes(' ')) {
            const newName = file.name.replace(/\s+/g, '_');
            try {
                await this.app.vault.rename(file, `${file.parent?.path || ''}/${newName}`);
                return true;
            } catch (e) {
                console.error("ORDupdater: rename failed", file.path, String(e));
            }
        }

        // Step 3: update frontmatter
        try {
            const changed = await this.updateFrontmatter(file);
            if (changed && isManual && this.pluginSettings.updateIndexOnSave && file.parent) {
                await this.updateFolderIndex(file.parent);
            }
            return changed;
        } catch (e) {
            console.error("ORDupdater:", String(e));
            return false;
        }
    }

    private async batchUpdate(files: TFile[], isManual: boolean): Promise<number> {
        this.inBatch = true;
        try {
            const results = new Array(files.length).fill(false);
            for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
                const batch = files.slice(i, i + this.BATCH_SIZE);
                const batchResults = await Promise.all(
                    batch.map(f => this.safeUpdate(f, false))
                );
                for (let j = 0; j < batchResults.length; j++) {
                    results[i + j] = batchResults[j];
                }
            }
            return results.filter(Boolean).length;
        } finally {
            this.inBatch = false;
        }
    }

    private async updateFrontmatter(file: TFile): Promise<boolean> {
        const vault = this.app.vault;
        const raw = await vault.read(file);

        if (raw.includes('⚠ Switch to EXCALIDRAW VIEW')) return false;

        const match = raw.match(/^---\s*([\s\S]*?)\s*---/);
        const existingFM = match ? match[1].trim() : '';
        const body = match ? raw.slice(match[0].length) : raw;

        const fm = this.parseFrontmatter(existingFM);
        const now = this.getTimestamp();

        if (this.pluginSettings.overwriteMode) {
            // Overwrite mode: keep only plugin-managed fields, remove the rest
            const managed = new Set(['date', 'update', 'tags', 'links']);
            const original = this.parseFrontmatter(existingFM);
            fm.clear();
            for (const k of ['date', 'update']) {
                const v = original.get(k);
                if (v !== undefined) fm.set(k, v);
            }
        }

        const tagName = file.parent ? file.parent.name : file.basename;

        const folderParts = file.parent ? file.parent.path.split('/').filter(Boolean) : [];
        let folderLinks: string[];
        if (folderParts.length > 0) {
            folderLinks = [...new Set(folderParts.map(p => `[[${p}]]`))];
        } else if (file.parent) {
            folderLinks = [`[[${file.parent.name}]]`];
        } else {
            folderLinks = [];
        }

        if (!fm.has('date')) {
            fm.set('date', now);
        }
        fm.set('update', now);

        if (this.pluginSettings.autoTags) {
            fm.set('tags', [tagName]);
        } else {
            fm.delete('tags');
        }

        if (this.pluginSettings.autoLinks) {
            if (folderLinks.length > 0) {
                fm.set('links', folderLinks);
            }
        } else {
            fm.delete('links');
        }

        const newFM = this.serializeFrontmatter(fm);
        const cleanBody = body.replace(/^\s*\n/, '');
        const newContent = `---\n${newFM}---\n\n${cleanBody}`;

        if (raw !== newContent) {
            this.processing.set(file.path, Date.now() + this.DEBOUNCE_MS);
            await vault.modify(file, newContent);
            if (this.inBatch) {
                this.contentCache.set(file.path, newContent);
            }
            return true;
        } else {
            if (this.inBatch) {
                this.contentCache.set(file.path, raw);
            }
        }
        return false;
    }

    private parseFrontmatter(fm: string): Map<string, string | string[]> {
        const map = new Map<string, string | string[]>();
        const lines = fm.split('\n');
        let currentKey: string | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const keyMatch = trimmed.match(/^(\S+?):\s*(.*)$/);
            if (keyMatch) {
                currentKey = keyMatch[1];
                const val = keyMatch[2].trim();
                if (val === '') {
                    map.set(currentKey, []);
                } else if (val.startsWith('[') && val.endsWith(']')) {
                    try {
                        const items = JSON.parse(val);
                        if (Array.isArray(items)) {
                            map.set(currentKey, items);
                        } else {
                            map.set(currentKey, val);
                        }
                    } catch {
                        const rawItems = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                        map.set(currentKey, rawItems.filter(Boolean));
                    }
                } else {
                    map.set(currentKey, val);
                }
            } else if (currentKey && /^\s+-/.test(line)) {
                const item = trimmed.replace(/^-\s*/, '').replace(/^["']|["']$/g, '');
                const existing = map.get(currentKey);
                if (Array.isArray(existing)) {
                    existing.push(item);
                }
            }
        }
        return map;
    }

    private serializeFrontmatter(map: Map<string, string | string[]>): string {
        const lines: string[] = [];
        for (const [key, val] of map.entries()) {
            if (Array.isArray(val)) {
                if (val.length === 0) {
                    lines.push(`${key}:`);
                } else {
                    lines.push(`${key}:`);
                    for (const item of val) {
                        lines.push(`  - "${item}"`);
                    }
                }
            } else {
                lines.push(`${key}: ${val}`);
            }
        }
        return lines.join('\n') + '\n';
    }

    private isUserTag(fm: Map<string, string | string[]>, pathParts: string[]): boolean {
        const tags = fm.get('tags');
        if (!tags) return false;
        const tagValues = Array.isArray(tags) ? tags : [tags];
        const folderNames = new Set(pathParts.filter(p => !/^\d+_/.test(p)));
        return tagValues.every(t => folderNames.has(t));
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

    private getAllSubfolders(folder: TFolder): TFolder[] {
        const result: TFolder[] = [];
        for (const entry of folder.children) {
            if (entry instanceof TFolder) {
                result.push(entry);
                result.push(...this.getAllSubfolders(entry));
            }
        }
        return result;
    }

    private async updateFolderIndex(folder: TFolder): Promise<void> {
        if (folder.path.split('/').some(p => p.startsWith('.'))) return;
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

            let content = '---\n';
            content += `date: ${now}\n`;
            content += `update: ${now}\n`;
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
                content += `## ${isRu() ? 'Подпапки' : 'Subfolders'}\n\n${subfolders.join('\n')}\n\n`;
            }
            if (notes.length) {
                content += `## ${isRu() ? 'Заметки' : 'Notes'}\n\n${notes.join('\n')}\n`;
            } else if (subfolders.length === 0) {
                content += `_${isRu() ? 'Пусто' : 'Empty'}_\n`;
            }

            const existing = vault.getAbstractFileByPath(indexPath);
            if (existing instanceof TFile) {
                this.processing.set(indexPath, Date.now() + this.DEBOUNCE_MS);
                await vault.modify(existing, content);
            } else if (!existing) {
                this.processing.set(indexPath, Date.now() + this.DEBOUNCE_MS);
                await vault.create(indexPath, content);
            }
        } catch (e) {
            console.error("ORDupdater:", String(e));
        }
    }

    private getTimestamp(): string {
        const d = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

class ORDupdaterSettingTab extends PluginSettingTab {
    private plugin: OrdUpdater;

    constructor(app: App, plugin: OrdUpdater) {
        super(app, plugin);
        this.plugin = plugin;
    }

    getSettingDefinitions(): any[] {
        return [
            { id: 'autoUpdate', name: t('settingAutoUpdate'), desc: t('settingAutoUpdateDesc'), type: 'toggle' },
            { id: 'autoTags', name: t('settingTags'), desc: t('settingTagsDesc'), type: 'toggle' },
            { id: 'autoLinks', name: t('settingLinks'), desc: t('settingLinksDesc'), type: 'toggle' },
            { id: 'autoIndex', name: t('settingIndex'), desc: t('settingIndexDesc'), type: 'toggle' },
            { id: 'updateIndexOnSave', name: t('settingIndexOnSave'), desc: t('settingIndexOnSaveDesc'), type: 'toggle' },
            { id: 'overwriteMode', name: t('settingOverwrite'), desc: t('settingOverwriteDesc'), type: 'toggle' },
            { id: 'sanitizeSpaces', name: t('settingSanitize'), desc: t('settingSanitizeDesc'), type: 'toggle' },
        ];
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName(t('settingsTab'))
            .setHeading();

        new Setting(containerEl)
            .setName(t('settingsGeneral'))
            .setHeading();

        new Setting(containerEl)
            .setName(t('settingAutoUpdate'))
            .setDesc(t('settingAutoUpdateDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().autoUpdate)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.autoUpdate = val;
                    await this.plugin.saveSettings();
                    new Notice(isRu() ? 'Изменения вступят после перезагрузки Obsidian' : 'Changes will apply after restarting Obsidian');
                }));

        new Setting(containerEl)
            .setName(t('settingTags'))
            .setDesc(t('settingTagsDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().autoTags)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.autoTags = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settingLinks'))
            .setDesc(t('settingLinksDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().autoLinks)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.autoLinks = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settingIndex'))
            .setDesc(t('settingIndexDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().autoIndex)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.autoIndex = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settingIndexOnSave'))
            .setDesc(t('settingIndexOnSaveDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().updateIndexOnSave)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.updateIndexOnSave = val;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('hr');
        containerEl.createEl('h3', { text: t('settingDangerous') });

        new Setting(containerEl)
            .setName(t('settingOverwrite'))
            .setDesc(t('settingOverwriteDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().overwriteMode)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.overwriteMode = val;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName(t('settingSanitize'))
            .setDesc(t('settingSanitizeDesc'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.getSettings().sanitizeSpaces)
                .onChange(async (val) => {
                    const s = this.plugin.getSettings();
                    s.sanitizeSpaces = val;
                    await this.plugin.saveSettings();
                }));
    }
}
