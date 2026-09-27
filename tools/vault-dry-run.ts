/*
 * Сухой прогон по настоящему хранилищу.
 *
 * Настоящий код плагина получает копию хранилища в памяти (заглушка Obsidian) и
 * прогоняется по всем заметкам и папкам. На диск **ничего не пишется**: отчёт
 * показывает, что изменилось бы и почему. Это проверка перед тем, как браться
 * за рабочее хранилище.
 *
 * Запуск: npm run dry-run -- "C:\путь\к\хранилищу" [--lang=ru|en] [--limit=N] [--show=N]
 */

import { say, sayErr } from './output';
import { fs } from './node-io';
import { path } from './node-io';
import type { PluginManifest } from 'obsidian';
import OrdUpdater from '../src/main';
import {
    App, TFolder, drain, installTimers, readFrontmatter, setLanguage, document as fakeDocument,
} from './obsidian-stub';

const globals = global as unknown as Record<string, unknown>;
installTimers(globals);
globals['document'] = fakeDocument;

const args = process.argv.slice(2);
const vaultPath = args.find(argument => !argument.startsWith('--'));
const language = args.find(argument => argument.startsWith('--lang='))?.split('=')[1] ?? 'ru';
const limit = Number(args.find(argument => argument.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const show = Number(args.find(argument => argument.startsWith('--show='))?.split('=')[1] ?? 8);

setLanguage(language);

if (!vaultPath || !fs.existsSync(vaultPath)) {
    sayErr('укажите путь к хранилищу: npm run dry-run -- "<хранилище>"');
    process.exitCode = 2;
    throw new Error('нет хранилища');
}

const MANIFEST = {
    id: 'ord-updater',
    name: 'ORDupdater',
    version: '1.1.0',
    minAppVersion: '1.13.0',
    description: 'dry run',
    author: 'Ordnung',
    authorUrl: 'https://github.com/Ordnungen',
    isDesktopOnly: false,
} as unknown as PluginManifest;

// ---------------------------------------------------------------- хранилище в памяти

const app = new App();
let read = 0;
const skippedByRules: string[] = [];

const walk = (folder: string): void => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(folder, entry.name);
        if (entry.isDirectory()) {
            walk(full);
            continue;
        }
        if (!entry.name.endsWith('.md')) continue;
        const relative = path.relative(vaultPath, full).replace(/\\/g, '/');
        const parts = relative.split('/');
        if (parts.includes('node_modules') || parts.includes('src') || parts.includes('dist') || parts.includes('build')
            || parts[parts.length - 1].toLowerCase() === 'readme.md') {
            skippedByRules.push(relative);
        }
        if (read >= limit) continue;
        read++;
        app.vault.addFile(relative, fs.readFileSync(full, 'utf8'));
    }
};
walk(vaultPath);

// ---------------------------------------------------------------- прогон

const plugin = new (OrdUpdater as unknown as new (app: App, manifest: PluginManifest) => OrdUpdater)(app, MANIFEST);
await plugin.onload();
await drain();

const api = plugin as unknown as {
    safeUpdate(file: unknown, isManual: boolean): Promise<boolean>;
    updateFolderIndex(folder: unknown): Promise<void>;
};

const notes = app.vault.getMarkdownFiles();
const before = new Map(notes.map(file => [file.path, app.vault.getContent(file.path)]));

for (const file of notes) await api.safeUpdate(file, true);

const folders: TFolder[] = [];
const collect = (folder: TFolder): void => {
    for (const child of folder.children) {
        if (child instanceof TFolder) {
            folders.push(child);
            collect(child);
        }
    }
};
collect(app.vault.getRoot());
for (const folder of folders.sort((a, b) => b.path.split('/').length - a.path.split('/').length)) {
    await api.updateFolderIndex(folder);
}
await drain();

// ---------------------------------------------------------------- отчёт

function changedProperties(beforeText: string, afterText: string): string[] {
    const left = readFrontmatter(beforeText);
    const right = readFrontmatter(afterText);
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const changed: string[] = [];
    for (const key of keys) {
        if (JSON.stringify(left[key] ?? null) !== JSON.stringify(right[key] ?? null)) changed.push(key);
    }
    return changed;
}

function changedBody(beforeText: string, afterText: string): boolean {
    const strip = (text: string): string => text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
    return strip(beforeText) !== strip(afterText);
}

const changed: { path: string; reason: string }[] = [];
for (const [notePath, text] of before) {
    const now = app.vault.getContent(notePath);
    if (now === text) continue;
    const properties = changedProperties(text, now);
    const reasons = properties.map(key => `свойство ${key}`);
    if (changedBody(text, now)) reasons.push('текст');
    changed.push({ path: notePath, reason: reasons.join(', ') || 'формат' });
}

const created = app.vault.getMarkdownFiles()
    .map(file => file.path)
    .filter(notePath => !before.has(notePath));

const byReason = new Map<string, number>();
for (const item of changed) {
    byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
}

say(`хранилище:         ${vaultPath}`);
say(`заметок прочитано: ${before.size}${limit === Infinity ? '' : ` (ограничение ${limit})`}`);
say(`язык интерфейса:   ${language}`);
say('');
say(`изменилось бы:     ${changed.length} заметок (${((changed.length / Math.max(before.size, 1)) * 100).toFixed(1)} %)`);
say(`создано бы:        ${created.length} индексных заметок`);
say(`пропущено правилами (src, dist, build, node_modules, README.md): ${skippedByRules.length}`);
say('');
if (byReason.size > 0) {
    say('почему:');
    for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
        say(`  ${String(count).padStart(5)}  ${reason}`);
    }
    say('');
}
if (changed.length > 0) {
    say(`примеры изменений (первые ${Math.min(show, changed.length)}):`);
    for (const item of changed.slice(0, show)) {
        say(`  ${item.path} — ${item.reason}`);
    }
    say('');
}
if (created.length > 0) {
    say(`примеры новых индексов (первые ${Math.min(show, created.length)}):`);
    for (const notePath of created.slice(0, show)) say(`  ${notePath}`);
    say('');
}
if (skippedByRules.length > 0) {
    say(`примеры пропусков (первые ${Math.min(show, skippedByRules.length)}):`);
    for (const notePath of skippedByRules.slice(0, show)) say(`  ${notePath}`);
}
