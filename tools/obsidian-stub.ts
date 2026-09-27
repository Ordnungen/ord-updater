/*
 * Minimal Obsidian API for the checks in this folder.
 *
 * The checks run in Node and import the plugin from `src/` unchanged: esbuild
 * replaces the `obsidian` module with this file. Only what the plugin actually
 * uses is implemented, and the parts that matter for correctness (renaming,
 * frontmatter reading, vault events) behave like the real app, so a test that
 * passes here means something.
 */

// ---------------------------------------------------------------- paths

export function normalizePath(path: string): string {
    return path
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\//, '')
        .replace(/(.)\/$/, '$1');
}

// ---------------------------------------------------------------- files

export class TAbstractFile {
    name: string;
    path: string;
    parent: TFolder | null = null;

    constructor(path: string) {
        this.path = normalizePath(path);
        this.name = this.path.split('/').pop() ?? this.path;
    }
}

export class TFile extends TAbstractFile {
    extension: string;
    get basename(): string {
        return this.extension ? this.name.slice(0, -(this.extension.length + 1)) : this.name;
    }

    constructor(path: string) {
        super(path);
        this.extension = this.name.includes('.') ? this.name.split('.').pop() ?? '' : '';
    }
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[] = [];

    isRoot(): boolean {
        return this.path === '/' || this.path === '';
    }
}

// ---------------------------------------------------------------- DOM

export class FakeElement {
    tagName: string;
    children: FakeElement[] = [];
    parent: FakeElement | null = null;
    textContent = '';
    attributes: Record<string, string> = {};
    listeners: Record<string, ((event: unknown) => void)[]> = {};
    private classes = new Set<string>();

    constructor(tagName = 'div') {
        this.tagName = tagName;
    }

    createDiv(options?: { cls?: string } | string): FakeElement {
        const child = new FakeElement('div');
        if (typeof options === 'string') child.addClass(options);
        else if (options?.cls) child.addClass(options.cls);
        return this.appendChild(child);
    }

    createEl(tagName: string, options?: { cls?: string; text?: string }): FakeElement {
        const child = new FakeElement(tagName);
        if (options?.cls) child.addClass(options.cls);
        if (options?.text) child.textContent = options.text;
        return this.appendChild(child);
    }

    appendChild(child: FakeElement): FakeElement {
        child.parent = this;
        this.children.push(child);
        return child;
    }

    addClass(cls: string): this {
        this.classes.add(cls);
        return this;
    }

    removeClass(cls: string): this {
        this.classes.delete(cls);
        return this;
    }

    hasClass(cls: string): boolean {
        return this.classes.has(cls);
    }

    toggleClass(cls: string, on: boolean): void {
        if (on) this.addClass(cls);
        else this.removeClass(cls);
    }

    get classList(): {
        contains: (cls: string) => boolean;
        add: (cls: string) => void;
        remove: (cls: string) => void;
        toggle: (cls: string, on?: boolean) => void;
    } {
        return {
            contains: (cls: string) => this.classes.has(cls),
            add: (cls: string) => this.addClass(cls),
            remove: (cls: string) => this.removeClass(cls),
            toggle: (cls: string, on?: boolean) => this.toggleClass(cls, on ?? !this.classes.has(cls)),
        };
    }

    setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    /** The DOM helper Obsidian adds: set the text of this element. */
    setText(text: string): this {
        this.textContent = text;
        return this;
    }

    getAttribute(name: string): string | null {
        return this.attributes[name] ?? null;
    }

    empty(): void {
        for (const child of this.children) child.parent = null;
        this.children = [];
    }

    addEventListener(type: string, handler: (event: unknown) => void): void {
        (this.listeners[type] ??= []).push(handler);
    }

    /** Fire a listener and let the event loop settle afterwards. */
    async dispatch(type: string, event: unknown = {}): Promise<void> {
        for (const handler of this.listeners[type] ?? []) handler(event);
        await drain();
    }

    /** Every text in this subtree, for assertions about visible strings. */
    texts(): string[] {
        const own = this.textContent ? [this.textContent] : [];
        return [...own, ...this.children.flatMap(child => child.texts())];
    }
}

class FakeDocument extends FakeElement {
    body = new FakeElement('body');

    createElement(tagName: string): FakeElement {
        return new FakeElement(tagName);
    }
}

export const document = new FakeDocument('document');

// ---------------------------------------------------------------- clock

interface Timer {
    id: number;
    at: number;
    fn: () => void;
}

const timers: Timer[] = [];
let timerId = 1;
let now = 1_700_000_000_000;

/** Let queued microtasks run: the plugin awaits inside its own handlers. */
export async function drain(steps = 8): Promise<void> {
    for (let i = 0; i < steps; i++) await Promise.resolve();
}

/** Move the fake clock forward, running everything that becomes due. */
export async function advance(ms: number): Promise<void> {
    const target = now + ms;
    await drain();
    for (;;) {
        const due = timers.filter(timer => timer.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        timers.splice(timers.indexOf(due), 1);
        now = due.at;
        due.fn();
        await drain();
    }
    now = target;
    await drain();
}

export function installTimers(target: Record<string, unknown>): void {
    target['setTimeout'] = (fn: () => void, ms = 0): number => {
        const id = timerId++;
        timers.push({ id, at: now + ms, fn });
        return id;
    };
    target['clearTimeout'] = (id: number): void => {
        const index = timers.findIndex(timer => timer.id === id);
        if (index >= 0) timers.splice(index, 1);
    };
    target['window'] = target;
    target['setInterval'] = target['setTimeout'];
    target['clearInterval'] = target['clearTimeout'];
    // The plugin debounces with Date.now(), so the clock has to be one clock:
    // otherwise "expired" never arrives and the checks test nothing.
    (Date as unknown as { now: () => number }).now = () => now;
}

export function resetClock(): void {
    timers.length = 0;
    timerId = 1;
}

let language = 'en';

/** Language of the fake app: the plugin reads it through `getLanguage()`. */
export function setLanguage(value: string): void {
    language = value;
}

export function getLanguage(): string {
    return language;
}

/**
 * Minimal `moment` on top of the fake clock: the plugin formats timestamps with
 * it, so the checks can move time forward and see what changes.
 */
export function moment(): { format: (pattern: string) => string } {
    return {
        format: (pattern: string): string => {
            if (pattern !== 'YYYY-MM-DD HH:mm') {
                throw new Error(`заглушка moment знает только "YYYY-MM-DD HH:mm", спросили "${pattern}"`);
            }
            const date = new Date(now);
            const pad = (value: number): string => String(value).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        },
    };
}

// ---------------------------------------------------------------- metadata

export interface CachedMetadata {
    frontmatter?: Record<string, unknown>;
}

/**
 * Reads a frontmatter block into plain values the way Obsidian does: strings,
 * numbers, booleans, arrays, nested objects and block scalars. This is a subset
 * of YAML — enough for the properties a vault really contains, and honest about
 * the rest: anything unknown comes back as a string.
 */
export function readFrontmatter(content: string): Record<string, unknown> {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    return parseFrontmatterBlock(match[1]);
}

export function parseFrontmatterBlock(text: string): Record<string, unknown> {
    const lines = text.split(/\r?\n/);
    const result: Record<string, unknown> = {};
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        if (line.trim() === '' || /^\s*#/.test(line)) {
            index++;
            continue;
        }
        const keyMatch = line.match(/^([^\s#][^:]*?):\s*(.*)$/);
        if (!keyMatch) {
            index++;
            continue;
        }
        const key = keyMatch[1].trim();
        const value = keyMatch[2];
        if (value === '') {
            const items: string[] = [];
            const nested: Record<string, unknown> = {};
            let isList = false;
            let isMap = false;
            let next = index + 1;
            while (next < lines.length && /^\s+/.test(lines[next]) && lines[next].trim() !== '') {
                if (/^\s+-/.test(lines[next])) {
                    isList = true;
                    items.push(unquote(lines[next].trim().replace(/^-\s*/, '')));
                } else {
                    const inner = lines[next].match(/^\s+([^\s#][^:]*?):\s*(.*)$/);
                    if (inner) {
                        isMap = true;
                        nested[inner[1].trim()] = scalar(inner[2]);
                    }
                }
                next++;
            }
            result[key] = isList ? items : isMap ? nested : null;
            index = next;
            continue;
        }
        if (/^[|>]/.test(value)) {
            const block: string[] = [];
            let next = index + 1;
            while (next < lines.length && (/^\s+/.test(lines[next]) || lines[next].trim() === '')) {
                block.push(lines[next].replace(/^\s{2}/, ''));
                next++;
            }
            result[key] = value.startsWith('>') ? block.join(' ').trim() : block.join('\n').replace(/\s+$/, '');
            index = next;
            continue;
        }
        result[key] = scalar(value);
        index++;
    }
    return result;
}

function scalar(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed.slice(1, -1).split(',').map(item => unquote(item.trim())).filter(item => item !== '');
    }
    if (trimmed === '' || trimmed === 'null' || trimmed === '~') return null;
    if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
    if (/^-?\d+$/.test(trimmed) || /^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);
    return unquote(trimmed);
}

function unquote(value: string): string {
    return value.replace(/^["']|["']$/g, '');
}

/** Writes values back in the shape Obsidian writes them. */
export function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
    const lines: string[] = [];
    const write = (key: string, value: unknown, indent: string): void => {
        if (Array.isArray(value)) {
            if (value.length === 0) {
                lines.push(`${indent}${key}:`);
                return;
            }
            lines.push(`${indent}${key}:`);
            for (const item of value) lines.push(`${indent}  - ${formatScalar(item)}`);
            return;
        }
        if (value !== null && typeof value === 'object') {
            lines.push(`${indent}${key}:`);
            for (const [inner, innerValue] of Object.entries(value as Record<string, unknown>)) {
                write(inner, innerValue, `${indent}  `);
            }
            return;
        }
        lines.push(`${indent}${key}: ${formatScalar(value)}`);
    };
    for (const [key, value] of Object.entries(frontmatter)) write(key, value, '');
    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function formatScalar(value: unknown): string {
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value === null || value === undefined) return '';
    const text = String(value);
    // Quotes only where YAML really needs them, like Obsidian's own writer:
    // "2026-09-27 10:58" stays plain, "5" would otherwise become a number.
    const needsQuotes = text === ''
        || /(^:)|(:\s)|^\s|\s$|[#"]/.test(text)
        || /^(true|false|null|~|-?\d+(\.\d+)?)$/.test(text);
    return needsQuotes ? `"${text.replace(/"/g, '\\"')}"` : text;
}

// ---------------------------------------------------------------- vault

type VaultEvent = 'create' | 'modify' | 'delete' | 'rename';
type Listener = (...args: never[]) => void;

export class Vault {
    root = new TFolder('');
    private contents = new Map<string, string>();
    private listeners: Record<string, Listener[]> = {};

    // ----- registry helpers used by the checks

    addFile(path: string, content = ''): TFile {
        const file = new TFile(path);
        this.contents.set(file.path, content);
        this.attach(file);
        return file;
    }

    addFolder(path: string): TFolder {
        const folder = new TFolder(path);
        this.attach(folder);
        return folder;
    }

    getContent(path: string): string {
        return this.contents.get(normalizePath(path)) ?? '';
    }

    /** How many times a file was written, for the checks about extra writes. */
    writeCount(path: string): number {
        return this.writes.get(normalizePath(path)) ?? 0;
    }

    private writes = new Map<string, number>();

    private attach(file: TAbstractFile): void {
        const parts = file.path.split('/');
        parts.pop();
        let folder = this.root;
        let prefix = '';
        for (const part of parts) {
            prefix = prefix ? `${prefix}/${part}` : part;
            const existing = this.getAbstractFileByPath(prefix);
            folder = existing instanceof TFolder ? existing : this.addFolder(prefix);
        }
        file.parent = folder.isRoot() ? null : folder;
        folder.children.push(file);
    }

    // ----- events

    on(event: VaultEvent, callback: Listener): { event: VaultEvent; callback: Listener } {
        (this.listeners[event] ??= []).push(callback);
        return { event, callback };
    }

    offref(ref: { event: VaultEvent; callback: Listener }): void {
        const list = this.listeners[ref.event] ?? [];
        const index = list.indexOf(ref.callback);
        if (index >= 0) list.splice(index, 1);
    }

    async trigger(event: VaultEvent, ...args: unknown[]): Promise<void> {
        for (const callback of [...(this.listeners[event] ?? [])]) {
            (callback as unknown as (...a: unknown[]) => void)(...args);
        }
        await drain();
    }

    // ----- API used by the plugin

    getRoot(): TFolder {
        return this.root;
    }

    getAbstractFileByPath(path: string): TAbstractFile | null {
        const clean = normalizePath(path);
        if (clean === '') return this.root;
        const walk = (folder: TFolder): TAbstractFile | null => {
            for (const child of folder.children) {
                if (child.path === clean) return child;
                if (child instanceof TFolder) {
                    const found = walk(child);
                    if (found) return found;
                }
            }
            return null;
        };
        return walk(this.root);
    }

    getMarkdownFiles(): TFile[] {
        const result: TFile[] = [];
        const walk = (folder: TFolder): void => {
            for (const child of folder.children) {
                if (child instanceof TFile && child.extension === 'md') result.push(child);
                else if (child instanceof TFolder) walk(child);
            }
        };
        walk(this.root);
        return result;
    }

    async read(file: TFile): Promise<string> {
        return this.getContent(file.path);
    }

    async cachedRead(file: TFile): Promise<string> {
        return this.getContent(file.path);
    }

    async create(path: string, content: string): Promise<TFile> {
        const file = this.addFile(path, content);
        this.writes.set(file.path, (this.writes.get(file.path) ?? 0) + 1);
        await this.trigger('create', file);
        return file;
    }

    async createFolder(path: string): Promise<TFolder> {
        const folder = this.addFolder(path);
        await this.trigger('create', folder);
        return folder;
    }

    async modify(file: TFile, content: string): Promise<void> {
        this.contents.set(file.path, content);
        this.writes.set(file.path, (this.writes.get(file.path) ?? 0) + 1);
        await this.trigger('modify', file);
    }

    async process(file: TFile, fn: (data: string) => string): Promise<string> {
        const next = fn(this.getContent(file.path));
        this.contents.set(file.path, next);
        this.writes.set(file.path, (this.writes.get(file.path) ?? 0) + 1);
        await this.trigger('modify', file);
        return next;
    }

    /** Raw rename: moves the file but leaves links in other notes alone. */
    async rename(file: TAbstractFile, newPath: string): Promise<void> {
        const oldPath = file.path;
        this.detach(file);
        file.path = normalizePath(newPath);
        file.name = file.path.split('/').pop() ?? file.path;
        if (file instanceof TFile) {
            const content = this.contents.get(oldPath) ?? '';
            this.contents.delete(oldPath);
            this.contents.set(file.path, content);
        } else if (file instanceof TFolder) {
            // A folder rename moves everything inside it, contents included.
            const moved = [...this.contents.entries()].filter(([path]) => path.startsWith(`${oldPath}/`));
            for (const [path, content] of moved) {
                this.contents.delete(path);
                this.contents.set(`${file.path}/${path.slice(oldPath.length + 1)}`, content);
            }
            for (const child of this.descendants(file)) {
                const tail = child.path.slice(oldPath.length + 1);
                child.path = `${file.path}/${tail}`;
                child.name = child.path.split('/').pop() ?? child.path;
            }
        }
        this.attach(file);
        await this.trigger('rename', file, oldPath);
    }

    private descendants(folder: TFolder): TAbstractFile[] {
        const result: TAbstractFile[] = [];
        const walk = (current: TFolder): void => {
            for (const child of current.children) {
                result.push(child);
                if (child instanceof TFolder) walk(child);
            }
        };
        walk(folder);
        return result;
    }

    async delete(file: TAbstractFile): Promise<void> {
        this.detach(file);
        if (file instanceof TFile) this.contents.delete(file.path);
        await this.trigger('delete', file);
    }

    private detach(file: TAbstractFile): void {
        const parent = this.getAbstractFileByPath(file.parent?.path ?? '') as TFolder | null;
        const folder = parent instanceof TFolder ? parent : this.root;
        const index = folder.children.indexOf(file);
        if (index >= 0) folder.children.splice(index, 1);
    }

    /** Everything that lives inside a folder, for the checks that walk a tree. */
    describeTree(): string[] {
        const lines: string[] = [];
        const walk = (folder: TFolder, depth: number): void => {
            for (const child of folder.children) {
                lines.push(`${'  '.repeat(depth)}${child.path}`);
                if (child instanceof TFolder) walk(child, depth + 1);
            }
        };
        walk(this.root, 0);
        return lines.sort();
    }
}

// ---------------------------------------------------------------- file manager

export class FileManager {
    constructor(private vault: Vault) {}

    /** Rename or move, updating links in other notes, like the real app does. */
    async renameFile(file: TAbstractFile, newPath: string): Promise<void> {
        const oldName = file instanceof TFile ? file.basename : file.name;
        const oldPath = file.path;
        await this.vault.rename(file, newPath);
        if (!(file instanceof TFile)) return;
        const newName = file.basename;
        if (oldName === newName) return;
        for (const other of this.vault.getMarkdownFiles()) {
            const content = this.vault.getContent(other.path);
            const updated = content
                .replaceAll(`[[${oldName}]]`, `[[${newName}]]`)
                .replaceAll(`[[${oldName}|`, `[[${newName}|`)
                .replaceAll(`[[${oldPath}]]`, `[[${file.path}]]`)
                .replaceAll(`[[${oldPath}|`, `[[${file.path}|`);
            if (updated !== content) {
                this.vault['contents'].set(other.path, updated);
            }
        }
    }

    async trashFile(file: TAbstractFile): Promise<void> {
        await this.vault.delete(file);
    }

    /**
     * Parse the frontmatter, hand it over for changes and write it back — the
     * shape Obsidian offers. Values keep their types, unknown properties and
     * their nesting survive, and the body is left untouched.
     */
    async processFrontMatter(
        file: TFile,
        fn: (frontmatter: Record<string, unknown>) => void | Promise<void>,
    ): Promise<void> {
        const content = this.vault.getContent(file.path);
        const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        const frontmatter = match ? parseFrontmatterBlock(match[1]) : {};
        const body = match ? content.slice(match[0].length) : content;
        await fn(frontmatter);
        await this.vault.modify(file, `---\n${serializeFrontmatter(frontmatter)}---${body}`);
    }
}

// ---------------------------------------------------------------- caches, app

export class MetadataCache {
    constructor(private vault: Vault) {}

    getFileCache(file: TFile): CachedMetadata | null {
        return { frontmatter: readFrontmatter(this.vault.getContent(file.path)) };
    }
}

export class Workspace {
    private active: TFile | null = null;
    private listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    getActiveFile(): TFile | null {
        return this.active;
    }

    setActiveFile(file: TFile | null): void {
        this.active = file;
    }

    on(event: string, callback: (...args: unknown[]) => void): { event: string; callback: (...args: unknown[]) => void } {
        (this.listeners[event] ??= []).push(callback);
        return { event, callback };
    }

    trigger(event: string, ...args: unknown[]): void {
        for (const callback of this.listeners[event] ?? []) callback(...args);
    }
}

export class App {
    vault = new Vault();
    fileManager: FileManager;
    metadataCache: MetadataCache;
    workspace = new Workspace();

    constructor() {
        this.fileManager = new FileManager(this.vault);
        this.metadataCache = new MetadataCache(this.vault);
    }
}

// ---------------------------------------------------------------- plugin API

export class Notice {
    static all: Notice[] = [];
    message: string;

    constructor(message: string) {
        this.message = message;
        Notice.all.push(this);
    }
}

export class Setting {
    settingEl: FakeElement;
    nameEl: FakeElement;
    descEl: FakeElement;
    private toggleValue = false;

    constructor(public containerEl: FakeElement) {
        this.settingEl = new FakeElement('div');
        this.nameEl = this.settingEl.createDiv({ cls: 'setting-item-name' });
        this.descEl = this.settingEl.createDiv({ cls: 'setting-item-description' });
        containerEl.appendChild(this.settingEl);
    }

    setName(name: string): this {
        this.nameEl.textContent = name;
        return this;
    }

    setDesc(desc: string): this {
        this.descEl.textContent = desc;
        return this;
    }

    setHeading(): this {
        this.settingEl.addClass('setting-item-heading');
        return this;
    }

    addToggle(callback: (toggle: {
        setValue: (value: boolean) => unknown;
        setDisabled: (disabled: boolean) => unknown;
        onChange: (handler: (value: boolean) => unknown) => unknown;
        getValue: () => boolean;
    }) => unknown): this {
        let onChange: ((value: boolean) => unknown) | null = null;
        const control = new FakeElement('div');
        this.settingEl.appendChild(control);
        // Components chain, so every setter returns the toggle itself.
        const toggle = {
            setValue: (value: boolean) => {
                this.toggleValue = value;
                control.setAttribute('data-value', String(value));
                return toggle;
            },
            setDisabled: (disabled: boolean) => {
                control.setAttribute('data-disabled', String(disabled));
                return toggle;
            },
            onChange: (handler: (value: boolean) => unknown) => {
                onChange = handler;
                return toggle;
            },
            getValue: () => this.toggleValue,
        };
        callback(toggle);
        control.addEventListener('change', (event: unknown) => {
            this.toggleValue = Boolean((event as { value?: boolean }).value);
            void onChange?.(this.toggleValue);
        });
        return this;
    }

    addButton(callback: (button: {
        setButtonText: (text: string) => unknown;
        setCta: () => unknown;
        onClick: (handler: () => unknown) => unknown;
    }) => unknown): this {
        const element = this.settingEl.createEl('button');
        const button = {
            setButtonText: (text: string) => {
                element.textContent = text;
                return button;
            },
            setCta: () => {
                element.addClass('mod-cta');
                return button;
            },
            onClick: (handler: () => unknown) => {
                element.addEventListener('click', () => { void handler(); });
                return button;
            },
        };
        callback(button);
        return this;
    }

    /** The toggle control of this setting, for the checks. */
    get control(): FakeElement | null {
        return this.settingEl.children.find(child => child.getAttribute('data-value') !== null) ?? null;
    }
}

export abstract class PluginSettingTab {
    containerEl = new FakeElement('div');

    constructor(public app: App, public plugin: Plugin) {}

    /** Declarative tab: Obsidian renders the controls from these definitions. */
    getSettingDefinitions?(): unknown[];

    /** Imperative tab: only for builds without the declarative API. */
    display(): void {
        // Nothing to do: the checks work with definitions, not with markup.
    }

    /**
     * What the core does with a declarative control: it reads and writes the
     * value on `plugin.settings` and persists it. The checks go through these
     * two methods, so a setting that does not react fails a test.
     */
    getControlValue(key: string): unknown {
        return (this.plugin.settings as Record<string, unknown>)[key];
    }

    async setControlValue(key: string, value: unknown): Promise<void> {
        (this.plugin.settings as Record<string, unknown>)[key] = value;
        const savable = this.plugin as unknown as { saveSettings?: () => Promise<void> };
        if (typeof savable.saveSettings === 'function') await savable.saveSettings();
        else await this.plugin.saveData(this.plugin.settings);
    }
}

export interface Command {
    id: string;
    name: string;
    callback: () => unknown;
}

/**
 * A modal window, as far as the plugin uses it: a title, a content element and
 * buttons. Open windows are recorded, so a check can answer them the way a user
 * would — by pressing a button with the text it sees.
 */
export class Modal {
    static open: Modal[] = [];
    titleEl = new FakeElement('div');
    contentEl = new FakeElement('div');
    containerEl = new FakeElement('div');

    constructor(public app: App) {}

    open(): void {
        Modal.open.push(this);
        this.onOpen();
    }

    close(): void {
        const index = Modal.open.indexOf(this);
        if (index >= 0) Modal.open.splice(index, 1);
        this.onClose();
    }

    /** Press the button with this text, like the user does. */
    async click(text: string): Promise<void> {
        const found = this.buttons().find(button => button.textContent === text);
        if (!found) {
            throw new Error(`в окне нет кнопки «${text}»: есть ${this.buttons().map(b => b.textContent).join(', ')}`);
        }
        await found.dispatch('click');
    }

    buttons(): FakeElement[] {
        const found: FakeElement[] = [];
        const walk = (node: FakeElement): void => {
            for (const child of node.children) {
                if (child.tagName === 'button') found.push(child);
                walk(child);
            }
        };
        walk(this.contentEl);
        return found;
    }

    /** All texts of the window, for checks about wording. */
    allTexts(): string[] {
        return [...this.titleEl.texts(), ...this.contentEl.texts()];
    }

    onOpen(): void {
        // nothing: the checks look at what the plugin filled in
    }

    onClose(): void {
        this.contentEl.empty();
    }
}

export abstract class Plugin {
    app: App;
    manifest = { id: 'ord-updater', version: '1.0.4' };
    /** Settings the declarative controls read and write. */
    settings: unknown = null;
    commands: Command[] = [];
    ribbons: FakeElement[] = [];
    settingTabs: PluginSettingTab[] = [];
    domEvents: { target: FakeElement; type: string; handler: (event: unknown) => void }[] = [];
    private registered: { event: string; callback: (...args: never[]) => void }[] = [];
    private data: unknown = null;

    constructor(app: App) {
        this.app = app;
    }

    async loadData(): Promise<unknown> {
        return this.data;
    }

    async saveData(data: unknown): Promise<void> {
        this.data = data;
    }

    addRibbonIcon(icon: string, title: string, callback: () => unknown): FakeElement {
        const element = document.createElement('div');
        element.setAttribute('data-icon', icon);
        element.setAttribute('aria-label', title);
        element.addEventListener('click', () => { void callback(); });
        this.ribbons.push(element);
        return element;
    }

    addCommand(command: Command): Command {
        this.commands.push(command);
        return command;
    }

    addSettingTab(tab: PluginSettingTab): void {
        this.settingTabs.push(tab);
    }

    registerEvent(ref: { event: string; callback: (...args: never[]) => void }): void {
        this.registered.push(ref);
    }

    registerDomEvent(target: FakeElement, type: string, handler: (event: unknown) => void): void {
        this.domEvents.push({ target, type, handler });
        target.addEventListener(type, handler);
    }

    registerInterval(id: number): number {
        return id;
    }

    /** Unsubscribe everything, like the real app does on unload. */
    async unregister(): Promise<void> {
        for (const ref of this.registered) this.app.vault.offref(ref as never);
        this.registered = [];
    }

    abstract onload(): Promise<void>;
    abstract onunload(): void;
}

export const Platform = { isDesktopApp: true, isMobile: false, isIosApp: false, isAndroidApp: false };
