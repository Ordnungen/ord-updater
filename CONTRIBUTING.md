# Contributing

Thanks for looking at this plugin. The most useful things you can send are a clear bug report, a failing case
and a small pull request — in that order.

## Reporting a problem

Open an issue with:

- what you expected and what happened instead;
- your Obsidian version and the plugin version (Settings → Community plugins);
- the vault shape that matters for the problem: folder depth, whether the note has properties already, and
  whether any other plugin writes properties;
- the console output if there is an error (Ctrl/Cmd+Shift+I → Console).

Please do not paste your real notes: a two-line example that reproduces the problem is enough.

## Working on the code

```bash
git clone https://github.com/Ordnungen/<plugin-id>
cd <plugin-id>
npm install
npm run dev      # watch build
npm run check    # typecheck + lint
npm run cases    # checks on an Obsidian stub
npm run build    # production build
```

Touching notes of a real vault is the one thing that needs care: run `npm run dry-run -- "<vault>"` first — it
prints what the plugin would change and writes nothing.

## What a pull request should contain

- **one change**, described in a sentence in the title;
- **a case** for any behaviour change: checks live in `tools/`, and a fix without a case tends to come back;
- `npm run check` and `npm run cases` green, and `main.js` rebuilt (`npm run build`) — it is committed on
  purpose.

## Style

Everything visible in the interface goes through the dictionary (`src/i18n.ts`): English is the base, Russian
is the translation, and both are checked by the compiler. Code, comments, commits and the README are in
English; the notes in a vault stay in whatever language the vault uses.

The rules the two plugins follow are written down in the `docs/` folder next to the code:
`IDENTITY.md` (the idea and the style), `STANDARD.md` (structure), `CODE-STYLE.md`, `UI-TEXT.md`,
`STYLES.md`, `PLUGINS.md` (state and debts) and `SKELETON.md` (the conveyor for a new plugin).

## License

By contributing you agree that your work is released under the MIT license of this repository.
