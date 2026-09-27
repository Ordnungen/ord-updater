/*
 * Отчёт по настоящему хранилищу: только чтение, ничего не пишется.
 *
 * Показывает, что плагин видит в хранилище и какие заметки для него «сложные»:
 * вложенные свойства, блочные значения, пометка BOM, заметки, которые он
 * пропускает по зашитым именам. Служит проверкой перед правками свойств.
 *
 * Запуск: `npm run analyze -- "C:\путь\к\хранилищу" [--limit=N]`
 */

import { say, sayErr } from './output';
import { fs } from './node-io';
import { path } from './node-io';
import { readFrontmatter } from './obsidian-stub';
interface Note {
    relative: string;
    content: string;
    frontmatter: Record<string, unknown> | null;
}

const args = process.argv.slice(2);
const vaultPath = args.find(argument => !argument.startsWith('--'));
const limitArg = args.find(argument => argument.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity;

if (!vaultPath) {
    sayErr('укажите путь к хранилищу: npm run analyze -- "<хранилище>"');
    process.exitCode = 2;
} else if (!fs.existsSync(vaultPath)) {
    sayErr(`хранилище не найдено: ${vaultPath}`);
    process.exitCode = 2;
} else {
    report(vaultPath);
}

function collectNotes(root: string): Note[] {
    const notes: Note[] = [];
    const walk = (folder: string): void => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.md')) {
                notes.push({
                    relative: path.relative(root, full).replace(/\\/g, '/'),
                    content: fs.readFileSync(full, 'utf8'),
                    frontmatter: null,
                });
            }
        }
    };
    walk(root);
    return notes;
}

function frontmatterBlock(content: string): string | null {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? (match[1] ?? null) : null;
}

function report(root: string): void {
    const notes = collectNotes(root);
    const seen = notes.slice(0, limit === Infinity ? notes.length : limit);

    let withoutFrontmatter = 0;
    let withBom = 0;
    let nested = 0;
    let blockScalars = 0;
    let typedScalars = 0;
    let comments = 0;
    let inlineTags = 0;
    let indexNotes = 0;
    let nameEqualsFolder = 0;
    let skippedByHardcodedName = 0;
    let withDate = 0;
    let withUpdate = 0;
    let withLinks = 0;
    const nestedExamples: string[] = [];
    const bomExamples: string[] = [];
    const skippedExamples: string[] = [];

    for (const note of seen) {
        const isBom = note.content.charCodeAt(0) === 0xfeff;
        if (isBom) {
            withBom++;
            if (bomExamples.length < 3) bomExamples.push(note.relative);
        }
        const block = frontmatterBlock(note.content);
        if (!block) {
            withoutFrontmatter++;
            continue;
        }
        const lines = block.split(/\r?\n/);
        let previousIndent = 0;
        for (const line of lines) {
            if (/^\s*#/.test(line)) comments++;
            if (/^\s*(>|\|)/.test(line)) blockScalars++;
            const keyMatch = line.match(/^([^\s#][^:]*):\s*(.+)$/);
            if (!keyMatch) continue;
            const indent = line.match(/^\s*/)?.[0].length ?? 0;
            if (indent > 0 && indent > previousIndent) {
                // Значение внутри вложенного объекта: ручной разбор теряет связь.
                nested++;
                if (nestedExamples.length < 5) nestedExamples.push(`${note.relative} (${line.trim()})`);
            }
            previousIndent = indent;
            const value = (keyMatch[2] ?? '').trim();
            if (/^-?\d+(\.\d+)?$/.test(value) || /^(true|false)$/.test(value)) typedScalars++;
            if (/^\[.*\]$/.test(value) && (keyMatch[1] ?? '').trim() === 'tags') inlineTags++;
        }
        const frontmatter = readFrontmatter(note.content);
        if ('date' in frontmatter) withDate++;
        if ('update' in frontmatter) withUpdate++;
        if ('links' in frontmatter) withLinks++;
        const tags = frontmatter['tags'];
        const tagList = Array.isArray(tags) ? tags.map(String) : typeof tags === 'string' ? [tags] : [];
        if (tagList.includes('index')) indexNotes++;
        const folder = note.relative.split('/').slice(0, -1).pop() ?? '';
        if (folder && note.relative.split('/').pop() === `${folder}.md`) nameEqualsFolder++;
        const parts = note.relative.split('/');
        if (parts.includes('node_modules') || parts.includes('src') || parts.includes('dist') || parts.includes('build')
            || (parts[parts.length - 1] ?? '').toLowerCase() === 'readme.md') {
            skippedByHardcodedName++;
            if (skippedExamples.length < 5) skippedExamples.push(note.relative);
        }
    }

    const percent = (value: number): string => `${((value / seen.length) * 100).toFixed(1)}%`;

    say(`хранилище:      ${root}`);
    say(`заметок:        ${seen.length}${limit === Infinity ? '' : ` (ограничение ${limit})`}`);
    say('');
    say('что видит плагин:');
    say(`  без свойств:            ${withoutFrontmatter} (${percent(withoutFrontmatter)})`);
    say(`  с date:                 ${withDate} (${percent(withDate)})`);
    say(`  с update:               ${withUpdate} (${percent(withUpdate)})`);
    say(`  с links:                ${withLinks} (${percent(withLinks)})`);
    say(`  индексные (тег index):  ${indexNotes} (${percent(indexNotes)})`);
    say('');
    say('что может сломать ручной разбор свойств:');
    say(`  BOM в начале файла:     ${withBom} (${percent(withBom)})`);
    say(`  вложенные значения:     ${nested} (${percent(nested)})`);
    say(`  блочные значения >, |:  ${blockScalars}`);
    say(`  числа и флажки:         ${typedScalars}`);
    say(`  комментарии в свойствах: ${comments}`);
    say(`  tags в одну строку:     ${inlineTags}`);
    say('');
    say('пропуски по зашитым именам (src, dist, build, node_modules, README.md):');
    say(`  заметок:                ${skippedByHardcodedName} (${percent(skippedByHardcodedName)})`);
    say(`  заметок, где имя = имя папки (плагин считает их индексами): ${nameEqualsFolder}`);
    if (bomExamples.length) say(`\nпримеры с BOM: ${bomExamples.join(', ')}`);
    if (nestedExamples.length) say(`примеры вложенных значений:\n  ${nestedExamples.join('\n  ')}`);
    if (skippedExamples.length) say(`примеры пропусков:\n  ${skippedExamples.join('\n  ')}`);
}
