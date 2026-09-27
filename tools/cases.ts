/*
 * Каталог кейсов ord-updater.
 *
 * Работает на заглушке Obsidian (`tools/obsidian-stub.ts`), поэтому проверки
 * идут без запуска приложения и без риска для настоящего хранилища. Плагин
 * берётся из `src/` как есть: esbuild подменяет модуль `obsidian`.
 *
 * Запуск: `npm run cases`.
 */

import fs from 'node:fs';
import type { PluginManifest } from 'obsidian';
import OrdUpdater from '../src/main';
import {
    App, Notice, Plugin as StubPlugin, TFile, TFolder, advance, drain, installTimers, resetClock,
    setLanguage,
    document as fakeDocument,
} from './obsidian-stub';
import path from 'node:path';

/** Плагин так, как его создаёт Obsidian: приложение подменяется заглушкой. */
function createPlugin(app: App): OrdUpdater {
    const PluginClass = OrdUpdater as unknown as new (app: App, manifest: PluginManifest) => OrdUpdater;
    return new PluginClass(app, MANIFEST);
}

/** Манифест для конструктора: настоящий тип `Plugin` требует его вторым аргументом. */
const MANIFEST = {
    id: 'ord-updater',
    name: 'ORDupdater',
    version: '1.0.4',
    minAppVersion: '1.7.2',
    description: 'properties updater',
    author: 'Ordnung',
    authorUrl: 'https://github.com/Ordnungen',
    isDesktopOnly: false,
} as unknown as PluginManifest;

// --------------------------------------------------------------------------
// Окружение: у плагина должны быть окно, таймеры, документ и язык.
// --------------------------------------------------------------------------

const globals = globalThis as unknown as Record<string, unknown>;
installTimers(globals);
globals['document'] = fakeDocument;

resetClock();
setLanguage('ru');

// --------------------------------------------------------------------------
// Отчёт
// --------------------------------------------------------------------------

let passed = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, detail = ''): void {
    if (condition) {
        passed++;
        console.log(`OK   ${name}${detail ? ` — ${detail}` : ''}`);
    } else {
        failures.push(name);
        console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    }
}

function section(title: string): void {
    console.log(`\n=== ${title} ===`);
}

// --------------------------------------------------------------------------
// Помощники
// --------------------------------------------------------------------------

const privateApi = (plugin: OrdUpdater) => plugin as unknown as {
    safeUpdate(file: unknown, isManual: boolean): Promise<boolean>;
    updateFolderIndex(folder: unknown): Promise<void>;
    processing: Map<string, number>;
    settings: Record<string, boolean>;
};

/**
 * Плагин глазами заглушки: команды, лента и табы настроек есть у заглушки, но
 * настоящий тип `Plugin` их не показывает.
 */
const stub = (plugin: OrdUpdater): StubPlugin => plugin as unknown as StubPlugin;

/** Плагин, загруженный так, как его запускает Obsidian. */
async function startPlugin(
    files: Record<string, string> = {},
    settings: Record<string, unknown> | null = null,
): Promise<{ app: App; plugin: OrdUpdater }> {
    const app = new App();
    for (const [filePath, content] of Object.entries(files)) app.vault.addFile(filePath, content);
    const plugin = createPlugin(app);
    if (settings) await plugin.saveData(settings);
    await plugin.onload();
    await drain();
    return { app, plugin };
}

/** Меню файла: как его строит Obsidian, с записью пунктов. */
function fakeMenu(): { menu: unknown; items: { title: string; run: () => Promise<void> }[] } {
    const items: { title: string; run: () => Promise<void> }[] = [];
    const menu = {
        addItem: (build: (item: unknown) => void): void => {
            const item = {
                title: '',
                setTitle(title: string) { this.title = title; items.push({ title, run: async () => undefined }); return this; },
                setIcon() { return this; },
                onClick(run: () => Promise<void>) { items[items.length - 1].run = run; return this; },
            };
            build(item);
        },
    };
    return { menu, items };
}

/** Определение одной настройки в декларативном табе. */
interface SettingDef {
    name?: string;
    desc?: string;
    control?: { type: string; key: string };
}

/** Группа определений с заголовком. */
interface SettingGroup {
    heading?: string;
    items?: SettingDef[];
}

/** Как их отдаёт настоящий Obsidian: вкладка описана, а не нарисована. */
function rawDefinitions(plugin: OrdUpdater): (SettingDef | SettingGroup)[] {
    return stub(plugin).settingTabs.flatMap(tab =>
        (tab.getSettingDefinitions?.() ?? []) as (SettingDef | SettingGroup)[]);
}

/** Все настройки вкладки, разложенные из групп. */
function settingDefinitions(plugin: OrdUpdater): SettingDef[] {
    return rawDefinitions(plugin).flatMap(item => {
        const group = item as SettingGroup;
        return group.items ?? [item as SettingDef];
    });
}

/** Все видимые тексты вкладки: заголовки групп, названия и описания. */
function definitionTexts(plugin: OrdUpdater): string[] {
    const texts: string[] = [];
    for (const item of rawDefinitions(plugin)) {
        const group = item as SettingGroup;
        const single = item as SettingDef;
        if (group.heading) texts.push(group.heading);
        if (single.name) texts.push(single.name);
        if (single.desc) texts.push(single.desc);
        for (const child of group.items ?? []) {
            if (child.name) texts.push(child.name);
            if (child.desc) texts.push(child.desc);
        }
    }
    return texts;
}

// --------------------------------------------------------------------------
// 1. Настройки: чтение пользовательских данных
// --------------------------------------------------------------------------

section('1. Настройки');
{
    // Мусор в data.json: строки и числа вместо флажков.
    const { plugin } = await startPlugin({}, { autoUpdate: 'yes', autoTags: 1, sanitizeSpaces: null });
    const current = plugin.getSettings();
    assert('1.1 мусор в data.json не проходит в код', current.autoUpdate === true && current.autoTags === true,
        `autoUpdate=${String(current.autoUpdate)}, autoTags=${String(current.autoTags)}`);
    assert('1.2 ненастроенные значения остаются по умолчанию', current.sanitizeSpaces === false);
    plugin.onunload();
}
{
    const { plugin } = await startPlugin({}, { autoUpdate: false, unknownField: true });
    const current = plugin.getSettings();
    assert('1.3 годное значение сохраняется', current.autoUpdate === false);
    assert('1.4 неизвестное поле не появляется', !('unknownField' in current),
        Object.keys(current).join(', '));
    plugin.onunload();
}
{
    const { plugin } = await startPlugin({}, {});
    const defaults = plugin.getSettings();
    assert('1.5 пустые данные дают значения по умолчанию',
        defaults.autoUpdate === true && defaults.autoIndex === true && defaults.overwriteMode === false);
    plugin.onunload();
}
{
    // Не объект вовсе (повреждённый файл).
    const app = new App();
    const plugin = createPlugin(app);
    await plugin.saveData('это не настройки');
    await plugin.onload();
    assert('1.6 повреждённый data.json не ломает загрузку', plugin.getSettings().autoUpdate === true);
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 2. Тексты
// --------------------------------------------------------------------------

section('2. Тексты');
for (const [language, foreign] of [['ru', 'Auto-update'], ['en', 'Автоматическое обновление']] as const) {
    setLanguage(language);
    const { plugin } = await startPlugin({ 'Папка/Заметка.md': '' });
    const texts = definitionTexts(plugin);
    assert(`2.${language === 'ru' ? '1' : '2'} вкладка настроек целиком на ${language === 'ru' ? 'русском' : 'английском'}`,
        !texts.some(text => text.includes(foreign)),
        texts.find(text => text.includes(foreign)) ?? 'чужого текста нет');
    assert(`2.${language === 'ru' ? '3' : '4'} подписи настроек непустые`,
        texts.length > 8 && texts.every(text => text.trim() !== ''));
    plugin.onunload();
}
setLanguage('ru');
{
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': '' });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    app.workspace.setActiveFile(file);
    Notice.all.length = 0;
    await stub(plugin).commands.find(command => command.id === 'update-current-file')?.callback();
    await drain();
    const message = Notice.all[0]?.message ?? '';
    assert('2.5 уведомление начинается с имени продукта', message.startsWith('ORDupdater: '), message);
    assert('2.6 подстановки в уведомлении раскрыты', !message.includes('__'), message);
    assert('2.7 подсказка иконки начинается с имени продукта',
        (stub(plugin).ribbons[0]?.getAttribute('aria-label') ?? '').startsWith('ORDupdater: '),
        stub(plugin).ribbons[0]?.getAttribute('aria-label') ?? '');
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 3. Таб настроек
// --------------------------------------------------------------------------

section('3. Декларативная вкладка настроек');
{
    const { plugin } = await startPlugin({ 'Папка/Заметка.md': '' });
    const definitions = settingDefinitions(plugin);
    const keys = definitions.map(item => item.control?.key ?? '');
    assert('3.1 объявлены все восемь настроек', definitions.length === 8, keys.join(', '));
    assert('3.2 каждая настройка — переключатель, привязанный к своему полю',
        definitions.every(item => item.control?.type === 'toggle')
        && !keys.includes('')
        && new Set(keys).size === keys.length,
        keys.join(', '));
    assert('3.3 поля настроек совпадают с набором плагина',
        keys.sort().join(',') === Object.keys(privateApi(plugin).settings).sort().join(','),
        keys.join(', '));
    assert('3.4 в описании авто-обновления сказано про перезагрузку',
        definitions.some(item => item.control?.key === 'autoUpdate'
            && (item.desc ?? '').includes('перезагрузки')),
        definitions.find(item => item.control?.key === 'autoUpdate')?.desc ?? '');
    assert('3.5 опасные настройки собраны в группу с заголовком',
        rawDefinitions(plugin).some(item => 'heading' in item
            && (item as SettingGroup).heading?.includes('Опасные')
            && ((item as SettingGroup).items ?? []).some(child => child.control?.key === 'overwriteMode')));

    // Декларативный таб читает и пишет ровно тот объект, которым пользуется
    // плагин: одно хранилище настроек, а не две копии.
    assert('3.6 вкладка и плагин работают с одним объектом настроек',
        plugin.settings === plugin.getSettings());
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 4. Свойства заметки
// --------------------------------------------------------------------------

section('4. Свойства заметки');
{
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': '# Заметка\n\nтекст\n' });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    await privateApi(plugin).safeUpdate(file, true);

    const content = app.vault.getContent('Папка/Заметка.md');
    assert('4.1 свойства добавлены в начало заметки', content.startsWith('---\n'), content.split('\n')[0]);
    assert('4.2 date и update заполнены',
        /date: "?\d{4}-\d{2}-\d{2}/.test(content) && /update: "?\d{4}-\d{2}-\d{2}/.test(content), content);
    assert('4.3 тег папки записан', content.includes('tags:') && content.includes('Папка'), content);
    assert('4.4 цепочка ссылок собрана', content.includes('links:') && content.includes('[[Папка]]'));
    assert('4.5 тело заметки не потеряно', content.includes('# Заметка') && content.includes('текст'));

    const first = app.vault.getContent('Папка/Заметка.md');
    await privateApi(plugin).safeUpdate(file, true);
    assert('4.6 повторный ручной прогон в ту же минуту не пишет файл',
        app.vault.getContent('Папка/Заметка.md') === first);

    // Ручной прогон позже тоже ничего не пишет: свойства уже такие, как надо.
    await advance(61_000);
    const writesBefore = app.vault.writeCount('Папка/Заметка.md');
    await privateApi(plugin).safeUpdate(file, true);
    assert('4.7 повторный ручной прогон в следующую минуту не трогает заметку',
        app.vault.writeCount('Папка/Заметка.md') === writesBefore,
        `записей: ${writesBefore} → ${app.vault.writeCount('Папка/Заметка.md')}`);

    // А вот правка самой заметки отметку update двигает.
    const beforeEdit = app.vault.getContent('Папка/Заметка.md');
    const updateBefore = /update: "?([^"\n]+)/.exec(beforeEdit)?.[1] ?? '';
    await advance(61_000);
    await app.vault.modify(file, `${beforeEdit}\nдописано\n`);
    await advance(10);
    const afterEdit = app.vault.getContent('Папка/Заметка.md');
    const updateAfter = /update: "?([^"\n]+)/.exec(afterEdit)?.[1] ?? '';
    assert('4.8 правка заметки обновляет отметку update',
        afterEdit.includes('дописано') && updateAfter !== updateBefore,
        `${updateBefore} → ${updateAfter}`);
    plugin.onunload();
}
{
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': '' });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    privateApi(plugin).settings.autoTags = false;
    privateApi(plugin).settings.autoLinks = false;
    await privateApi(plugin).safeUpdate(file, true);
    const content = app.vault.getContent('Папка/Заметка.md');
    assert('4.9 выключенные авто-теги и авто-ссылки не пишутся',
        !content.includes('tags:') && !content.includes('links:'), content.split('\n').slice(0, 6).join(' | '));
    plugin.onunload();
}

{
    // Слияние: чужие теги и ссылки остаются, наши добавляются.
    const { app, plugin } = await startPlugin({
        'Папка/Заметка.md': '---\ntags:\n  - "проект"\nlinks:\n  - "[[Своё]]"\ndescription: "руками"\n---\n\nтекст\n',
    });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    await privateApi(plugin).safeUpdate(file, true);
    const content = app.vault.getContent('Папка/Заметка.md');
    assert('4.10 чужие теги сохранены, тег папки добавлен',
        content.includes('проект') && content.includes('Папка'), content);
    assert('4.11 чужие ссылки сохранены, цепочка добавлена',
        content.includes('[[Своё]]') && content.includes('[[Папка]]'), content);
    assert('4.12 незнакомые свойства не тронуты', content.includes('description: руками'));
    plugin.onunload();
}
{
    // Вложенные и блочные значения, а также типы переживают прогон.
    const nested = '---\ncover:\n  image: a.png\n  alt: подпись\npinned: true\nrating: 5\nnote: >\n  строка один\n  строка два\ntags: "проект, идея"\n---\n\nтекст\n';
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': nested });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    await privateApi(plugin).safeUpdate(file, true);
    const content = app.vault.getContent('Папка/Заметка.md');
    assert('4.13 вложенные свойства сохранены',
        content.includes('cover:') && content.includes('image: a.png') && content.includes('alt: подпись'), content);
    assert('4.14 типы свойств сохранены',
        content.includes('pinned: true') && content.includes('rating: 5'), content);
    assert('4.15 блочное значение сохранено',
        content.includes('строка один') && content.includes('строка два'));
    assert('4.16 теги, записанные строкой, разобраны и дополнены',
        content.includes('проект') && content.includes('идея') && content.includes('Папка'), content);
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 5. Переименования: ссылки должны оставаться целыми
// --------------------------------------------------------------------------

section('5. Переименования');
{
    const { app, plugin } = await startPlugin({
        'Мой файл.md': '# Мой файл\n',
        'Другая.md': 'смотри [[Мой файл]] и [[Мой файл|алиас]]\n',
        'Папка/Третья.md': 'ссылка [[Мой файл]]\n',
    });
    privateApi(plugin).settings.sanitizeSpaces = true;
    const file = app.vault.getAbstractFileByPath('Мой файл.md') as unknown as TFile;
    app.workspace.setActiveFile(file);
    await stub(plugin).commands.find(command => command.id === 'update-current-file')?.callback();
    await drain();

    assert('5.1 файл с пробелами переименован',        app.vault.getAbstractFileByPath('Мой_файл.md') !== null
        && app.vault.getAbstractFileByPath('Мой файл.md') === null);
    const other = app.vault.getContent('Другая.md');
    assert('5.2 ссылка в другой заметке обновлена', other.includes('[[Мой_файл]]'),
        other.split('\n')[0]);
    assert('5.3 алиас ссылки тоже обновлён', other.includes('[[Мой_файл|алиас]]'));
    assert('5.4 ссылка из вложенной заметки обновлена',
        app.vault.getContent('Папка/Третья.md').includes('[[Мой_файл]]'));
    assert('5.5 содержимое переименованной заметки сохранено',
        app.vault.getContent('Мой_файл.md').includes('# Мой файл'));
    plugin.onunload();
}
{
    // Папка верхнего уровня: путь не должен начинаться с двойного слэша.
    const { app, plugin } = await startPlugin({ 'Папка с пробелом/Заметка.md': 'текст\n' });
    privateApi(plugin).settings.sanitizeSpaces = true;
    const file = app.vault.getAbstractFileByPath('Папка с пробелом/Заметка.md') as unknown as TFile;
    await privateApi(plugin).safeUpdate(file, true);
    const moved = app.vault.getAbstractFileByPath('Папка_с_пробелом/Заметка.md');
    assert('5.6 папка верхнего уровня переименована, путь корректен',
        moved !== null && moved.path === 'Папка_с_пробелом/Заметка.md',
        app.vault.describeTree().join(' | '));
    assert('5.7 содержимое заметки в переименованной папке сохранено',
        app.vault.getContent('Папка_с_пробелом/Заметка.md').includes('текст'));
    plugin.onunload();
}
{
    // Столкновение имён: у цели уже есть файл.
    const { app, plugin } = await startPlugin({ 'Мой файл.md': 'a\n', 'Мой_файл.md': 'b\n' });
    privateApi(plugin).settings.sanitizeSpaces = true;
    const file = app.vault.getAbstractFileByPath('Мой файл.md') as unknown as TFile;
    await privateApi(plugin).safeUpdate(file, true);
    assert('5.8 занятое имя не перезаписывается, добавляется номер',
        app.vault.getAbstractFileByPath('Мой_файл_1.md') !== null
        && app.vault.getContent('Мой_файл.md') === 'b\n',
        app.vault.describeTree().join(' | '));
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 6. Индексные заметки папок
// --------------------------------------------------------------------------

section('6. Индексные заметки');
{
    const { app, plugin } = await startPlugin({
        'Раздел/Заметка.md': '',
        'Раздел/Вложенная/Внутри.md': '',
        '.hidden/Скрытая.md': '',
    });
    await privateApi(plugin).updateFolderIndex(app.vault.getAbstractFileByPath('Раздел') as unknown as TFolder);
    const index = app.vault.getContent('Раздел/Раздел.md');
    assert('6.1 индекс назван по папке и создан', index !== '', index.split('\n').slice(0, 8).join(' | '));
    assert('6.2 в индексе стоит тег index', index.includes('"index"'));
    assert('6.3 в индексе перечислены заметки и подпапки',
        index.includes('[[Вложенная]]') && index.includes('[[Заметка]]'));
    assert('6.4 сам индекс в списке не участвует', !index.includes('[[Раздел]]'));
    assert('6.5 у индексной заметки папки верхнего уровня нет чужих ссылок',
        !index.includes('links:'), index.split('\n').slice(0, 9).join(' | '));

    await privateApi(plugin).updateFolderIndex(app.vault.getAbstractFileByPath('Раздел/Вложенная') as unknown as TFolder);
    const nestedIndex = app.vault.getContent('Раздел/Вложенная/Вложенная.md');
    assert('6.5 у индексной заметки вложенной папки собрана цепочка ссылок',
        nestedIndex.includes('links:') && nestedIndex.includes('[[Раздел]]'),
        nestedIndex.split('\n').slice(0, 9).join(' | '));

    // Действительно пустая папка: файлов в ней нет вовсе.
    const emptyFolder = app.vault.addFolder('Пусто');
    await privateApi(plugin).updateFolderIndex(emptyFolder);
    const emptyIndex = app.vault.getContent('Пусто/Пусто.md');
    assert('6.6 индекс пустой папки создан и без списка заметок',
        emptyIndex !== '' && !emptyIndex.includes('[['), emptyIndex.replace(/\n/g, ' | '));

    await privateApi(plugin).updateFolderIndex(app.vault.getAbstractFileByPath('.hidden') as unknown as TFolder);
    assert('6.7 скрытая папка индекс не получает',
        app.vault.getAbstractFileByPath('.hidden/.hidden.md') === null);

    await privateApi(plugin).updateFolderIndex(app.vault.getRoot());
    assert('6.8 корень индекс не получает', app.vault.getAbstractFileByPath('.md') === null);
    plugin.onunload();
}
{
    // Папка плагина (есть manifest.json) индекс не получает.
    const { app, plugin } = await startPlugin({ 'плагин/manifest.json': '{}', 'плагин/main.js': 'x' });
    await privateApi(plugin).updateFolderIndex(app.vault.getAbstractFileByPath('плагин') as unknown as TFolder);
    assert('6.9 папка плагина индекс не получает',
        app.vault.getAbstractFileByPath('плагин/плагин.md') === null);
    plugin.onunload();
}

{
    // Индексная заметка не переписывается, если ничего не изменилось, и её дата
    // создания сохраняется.
    const { app, plugin } = await startPlugin({ 'Раздел/Заметка.md': '' });
    const folder = app.vault.getAbstractFileByPath('Раздел') as unknown as TFolder;
    await privateApi(plugin).updateFolderIndex(folder);
    const created = app.vault.getContent('Раздел/Раздел.md');
    const dateLine = /date: ([^\n]+)/.exec(created)?.[1] ?? '';
    await advance(61_000);
    const writes = app.vault.writeCount('Раздел/Раздел.md');
    await privateApi(plugin).updateFolderIndex(folder);
    assert('6.10 индекс не переписывается без изменений',
        app.vault.writeCount('Раздел/Раздел.md') === writes,
        `записей: ${writes} → ${app.vault.writeCount('Раздел/Раздел.md')}`);
    assert('6.11 дата создания индексной заметки сохранена',
        (/date: ([^\n]+)/.exec(app.vault.getContent('Раздел/Раздел.md'))?.[1] ?? '') === dateLine, dateLine);

    // А при изменении состава папки индекс обновляется.
    await app.vault.create('Раздел/Новая.md', '');
    await privateApi(plugin).updateFolderIndex(folder);
    assert('6.12 новая заметка попадает в индекс',
        app.vault.getContent('Раздел/Раздел.md').includes('[[Новая]]'));
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 7. Переименование папки и осиротевший индекс
// --------------------------------------------------------------------------

section('7. Переименование папки');
{
    // Индексная заметка (тег index) уходит в корзину: её заменил новый индекс.
    const { app, plugin } = await startPlugin({
        'Старое/Старое.md': '---\ntags:\n  - "Старое"\n  - "index"\n---\n\nиндекс\n',
        'Старое/Новое.md': '---\ntags:\n  - "Старое"\n  - "index"\n---\n\nиндекс\n',
        'Старое/Заметка.md': 'текст\n',
    });
    const folder = app.vault.getAbstractFileByPath('Старое') as unknown as TFolder;
    await app.fileManager.renameFile(folder, 'Новое');
    await drain();
    assert('7.1 старый индекс заменён новым',
        app.vault.getAbstractFileByPath('Новое/Новое.md') !== null
        && app.vault.getAbstractFileByPath('Новое/Старое.md') === null,
        app.vault.describeTree().join(' | '));
    plugin.onunload();
}
{
    // Пользовательская заметка с именем старой папки остаётся на месте.
    const { app, plugin } = await startPlugin({
        'Старое/Старое.md': '---\ntags:\n  - "моё"\n---\n\nмоя заметка\n',
        'Старое/Новое.md': '---\ntags:\n  - "Старое"\n  - "index"\n---\n\nиндекс\n',
    });
    const folder = app.vault.getAbstractFileByPath('Старое') as unknown as TFolder;
    await app.fileManager.renameFile(folder, 'Новое');
    await drain();
    assert('7.2 пользовательская заметка не удаляется',
        app.vault.getAbstractFileByPath('Новое/Старое.md') !== null
        && app.vault.getContent('Новое/Старое.md').includes('моя заметка'),
        app.vault.describeTree().join(' | '));
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 8. События и дебаунс
// --------------------------------------------------------------------------

section('8. События и дебаунс');
{
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': '' });
    const file = app.vault.getAbstractFileByPath('Папка/Заметка.md') as unknown as TFile;
    await app.vault.trigger('modify', file);
    await advance(0);
    assert('8.1 автоматическое событие обновляет свойства',
        app.vault.getContent('Папка/Заметка.md').startsWith('---'));
    const writes = app.vault.writeCount('Папка/Заметка.md');
    await app.vault.trigger('modify', file);
    await app.vault.trigger('modify', file);
    await advance(0);
    assert('8.2 повторные события в окне дебаунса ничего не пишут',
        app.vault.writeCount('Папка/Заметка.md') === writes,
        `записей: ${writes} → ${app.vault.writeCount('Папка/Заметка.md')}`);
    await advance(4000);
    await app.vault.trigger('modify', file);
    await advance(0);
    assert('8.3 после окна дебаунса событие снова обрабатывается',
        app.vault.getContent('Папка/Заметка.md').startsWith('---'));
    plugin.onunload();
}
{
    const { app, plugin } = await startPlugin({
        'картинка.png': 'binary',
        '.hidden/Заметка.md': '',
        'README.md': '# README\n',
        'Папка/Заметка.md': '',
    });
    await privateApi(plugin).safeUpdate(app.vault.getAbstractFileByPath('картинка.png'), true);
    assert('8.4 не-markdown файл не обрабатывается',
        app.vault.getContent('картинка.png') === 'binary');
    await privateApi(plugin).safeUpdate(app.vault.getAbstractFileByPath('.hidden/Заметка.md'), true);
    assert('8.5 заметка в скрытой папке не обрабатывается',
        app.vault.getContent('.hidden/Заметка.md') === '');
    await privateApi(plugin).safeUpdate(app.vault.getAbstractFileByPath('README.md'), true);
    assert('8.6 README.md не обрабатывается', app.vault.getContent('README.md') === '# README\n');
    plugin.onunload();
}
{
    // Индекс родительской папки обновляется один раз на несколько правок.
    const { app, plugin } = await startPlugin({ 'Раздел/Заметка.md': '', 'Раздел/Вторая.md': '' });
    const file = app.vault.getAbstractFileByPath('Раздел/Заметка.md') as unknown as TFile;
    await app.vault.trigger('modify', file);
    await advance(1500);
    const writes = app.vault.writeCount('Раздел/Раздел.md');
    await app.vault.trigger('modify', file);
    await advance(1500);
    assert('8.7 индекс обновляется по дебаунсу, а не на каждую правку',
        app.vault.writeCount('Раздел/Раздел.md') === writes,
        `записей индекса: ${writes} → ${app.vault.writeCount('Раздел/Раздел.md')}`);
    plugin.onunload();
}

{
    // Меню файла и папки: пункты и их действие.
    const { app, plugin } = await startPlugin({ 'Папка/Заметка.md': '', 'Папка/Внутри.md': '' });
    const folderMenu = fakeMenu();
    app.workspace.trigger('file-menu', folderMenu.menu, app.vault.getAbstractFileByPath('Папка'));
    assert('8.8 в меню папки есть пункт обновления с именем продукта',
        folderMenu.items.length === 1 && folderMenu.items[0].title.startsWith('ORDupdater: '),
        folderMenu.items.map(item => item.title).join(', ') || 'пунктов нет');

    Notice.all.length = 0;
    await folderMenu.items[0].run();
    await drain();
    assert('8.9 пункт меню обрабатывает папку и сообщает об этом',
        Notice.all.some(notice => notice.message.startsWith('ORDupdater: ')),
        Notice.all.map(notice => notice.message).join(' | ') || 'уведомлений нет');

    const fileMenu = fakeMenu();
    app.workspace.trigger('file-menu', fileMenu.menu, app.vault.getAbstractFileByPath('Папка/Заметка.md'));
    assert('8.10 в меню заметки есть пункт обновления файла',
        fileMenu.items.length === 1 && fileMenu.items[0].title.startsWith('ORDupdater: '));
    plugin.onunload();
}

// --------------------------------------------------------------------------
// 9. Каркас: проверки самого репозитория
// --------------------------------------------------------------------------

section('9. Каркас');
{
    const source = fs.readFileSync(path.join('src', 'main.ts'), 'utf8');
    assert('9.1 переименование идёт через FileManager.renameFile',
        !source.includes('vault.rename(') && source.includes('fileManager.renameFile('));
    assert('9.2 запись индексной заметки идёт через Vault.process',
        source.includes('vault.process(') && !source.includes('vault.modify(existing, content)'));
    assert('9.3 свойства пишутся через processFrontMatter, ручного YAML больше нет',
        source.includes('processFrontMatter(')
        && !source.includes('parseFrontmatter(')
        && !source.includes('serializeFrontmatter(')
        && !source.includes('vault.modify('));
    assert('9.4 путь собирается через normalizePath', source.includes('normalizePath('));

    const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8')) as { name: string; version: string };
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };
    assert('9.5 имя продукта в форме ORD…', /^ORD[a-z]/.test(manifest.name), manifest.name);
    assert('9.6 версии манифеста и package.json совпадают',
        manifest.version === pkg.version, `${manifest.version} / ${pkg.version}`);
}

// --------------------------------------------------------------------------
// Итог
// --------------------------------------------------------------------------

console.log(`\nпроверок: ${passed + failures.length}, провалено: ${failures.length}`);
if (failures.length > 0) {
    console.log(failures.map(name => `  провалено: ${name}`).join('\n'));
    process.exitCode = 1;
}
