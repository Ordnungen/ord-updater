---
date: 2026-07-26 08:46
update: 2026-07-26 09:42
tags:
  - "ord-updater"
links:
  - "[[1_Репозиторий]]"
  - "[[Проекты]]"
  - "[[ORDcod]]"
  - "[[obsidian_plugins]]"
  - "[[ord-updater]]"
---

# ORDupdater

Automatically updates frontmatter (Properties) in Obsidian notes based on folder structure.

**Keywords:** frontmatter, properties, tags, links, folder structure, metadata

## English

ORDupdater automatically manages frontmatter properties for your Obsidian notes. It reads the folder structure and updates `date`, `update`, `tags`, and `links` properties accordingly.

### Features

- **Auto-tags** — tag is determined by the parent folder name
- **Auto-links** — backlinks to all parent folders in the hierarchy
- **Date tracking** — `date` on first creation, `update` on every change
- **Folder index** — automatically creates `FolderName.md` with a list of subfolders and notes
- **i18n** — interface adapts to Obsidian language (RU/EN)
- **Batch processing** — parallel updates for large vaults (20 files at once)
- **Hidden folders** — skips `.git`, `.obsidian`, and other hidden paths
- **Space sanitization** — automatically renames files and folders with spaces (`My File.md` → `My_File.md`) on update
- **Overwrite mode** — strips non-standard frontmatter fields (aliases, description, etc.) when enabled
- **Index rename** — renames folder index files when the folder is renamed, instead of creating duplicates

### Installation

1. Open **Settings → Community plugins**
2. Disable **Restricted mode**
3. Browse → search **ORDupdater**
4. Install & Enable

Or manual: copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/ord-updater/`.

### Usage

- **Auto:** properties update automatically on file create/modify/rename
- **Ribbon icon** (refresh icon in sidebar) — update all files and folder indices
- **Right-click** a folder → "ORDupdater: update folder"
- **Right-click** a file → "ORDupdater: update file"
- **Command palette** — "Update all files in vault"

### Settings

| Option | Description |
|--------|-------------|
| Auto-update | Update on file create/modify/rename |
| Auto-tags | Tag from folder name |
| Auto-links | Backlinks to parent folders |
| Folder index | Create/update FolderName.md |
| Index on save | Update folder index on Ctrl+S |
| Overwrite mode | Strip non-standard frontmatter fields |
| Sanitize spaces | Rename files/folders with spaces |

---

## Русский

ORDupdater автоматически обновляет Properties (date, update, tags, links) на основе структуры папок.

### Возможности

- **Авто-теги** — тег из имени родительской папки
- **Авто-ссылки** — обратные `[[links]]` на все папки в пути
- **Даты** — `date` при создании, `update` при изменении
- **Индексные файлы** — `Папка.md` со списком содержимого
- **Пакетная обработка** — 20 файлов параллельно
- **Скрытые папки** — `.git`, `.obsidian` игнорируются
- **Очистка пробелов** — автоматически переименовывает файлы и папки с пробелами (`Мой файл.md` → `Мой_файл.md`)
- **Режим перезаписи** — удаляет нестандартные поля frontmatter при включении
- **Переименование индексов** — индексы переименовываются вместе с папкой

### Установка

1. `Настройки → Сторонние плагины → Обзор → ORDupdater`
2. Установить и включить

Или вручную: скопировать `main.js`, `manifest.json`, `styles.css` в `.obsidian/plugins/ord-updater/`.

### Использование

- **Автоматически** — при создании/изменении/переименовании
- **Иконка в ленте** (боковая панель) — обновить всё хранилище
- **Правый клик** на папке/файле — обновить
- **Палитра команд** (Ctrl+P) — "Обновить все файлы"

---

## License

MIT
