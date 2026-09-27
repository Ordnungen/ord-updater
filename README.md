# ORDupdater

*Keeps frontmatter properties and folder index notes in sync with your folder structure.*

![ORDupdater cover](ord-updater-cover.jpg)

## Features

| Capability | What it does |
|------------|--------------|
| Section chain | Every note gets `links:` — wikilinks to the folders it lives in, from the top down. Links you wrote yourself stay |
| Dates | `date` is set once, when the note first gets properties. `update` moves only when the note or its properties really changed |
| Folder tag | `tags` gets the tag of the folder the note is in. Your own tags stay |
| Folder index | Every folder gets `<Folder>.md` listing its subfolders and notes with their dates and tags |
| Renaming | With "Remove spaces in names" on, files and folders with spaces are renamed through Obsidian, so links to them follow |
| Moving a note | The chain and the tag of the old folder are removed; everything you wrote stays |
| I18n | Interface follows the language of Obsidian (English and Russian included) |
| Safe | Hidden folders (`.obsidian`, `.git`, …) are never touched, and nothing is written outside your vault |

## Installation

- Community plugins → Browse → ORDupdater → Install & Enable
- Manual: copy `main.js`, `manifest.json`, `styles.css` to `.obsidian/plugins/ord-updater/`

## Usage

| Action | What happens |
|--------|--------------|
| Create, edit or rename a note | Properties are updated automatically |
| Ribbon icon (sidebar) | Asks first, then updates the whole vault: properties, then folder indexes |
| Right-click a folder | Updates the files of that folder and its indexes |
| Command palette | Update all files in vault / Update current file properties |
| Ctrl/Cmd+S | Updates the active file as soon as Obsidian saved it |

## Settings

| Setting | Default | What it does |
|---------|---------|--------------|
| Auto-update | ON | Update properties on file create, modify and rename |
| Auto-tags | ON | Add the folder tag to `tags` |
| Auto-links | ON | Add the chain of folders to `links` |
| Folder index | ON | Create and update `<Folder>.md` |
| Update index on save | ON | Refresh the folder index after a note changes |
| Lock properties | OFF | Hide "Add property" and the tag remove buttons |
| Skip names | `node_modules, src, dist, build, README.md` | Folders and notes with these names are left alone. Comma separated, case does not matter, hidden folders are always skipped |
| Overwrite mode | OFF | Keep only `date`, `update`, `tags` and `links` and remove the other properties |
| Remove spaces in names | OFF | Rename files and folders with spaces, links included |

## Performance

Notes are processed in batches of 20, and only when something really has to change: a second run over untouched
notes writes nothing at all, and folder indexes are built from Obsidian's own metadata cache. The whole-vault
update asks for confirmation first, so it cannot start by accident.

## Data and privacy

Only the notes in your vault and the plugin's own `data.json` are used. Nothing is sent anywhere, and no note is
rewritten unless its properties need it.

## Development

```bash
git clone https://github.com/Ordnungen/ord-updater
cd ord-updater
npm install
npm run dev      # watch build
npm run check    # typecheck + lint
npm run cases    # checks on an Obsidian stub
npm run dry-run -- "<vault>"   # what the plugin would change, without writing anything
npm run build    # production build
```

## License

MIT
