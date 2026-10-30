# How this app is put together

A personal work time tracker. It is a plain website: no build step, no server, no framework. Everything the browser needs is a handful of files in this folder, and GitHub Pages publishes whatever is on the `main` branch (about a minute after a change).

## The files

| File | What it is |
| --- | --- |
| `index.html` | The main app: all the layout, styling and core code (time grid, to-dos, settings, sync, undo, burn rates). About 3,500 lines. |
| `features.js`, `features.css` | Newer features that sit on top: undo/redo buttons, the gaps strip, the timer, recurring time blocks, the Summary tab and charts, automatic backups, reminders, the theme switch. Optional: if this file is missing or breaks, the app still works. |
| `dark.css` | The dark theme (switched on by `<html data-theme="dark">`). |
| `easter-eggs.js` | The easter eggs and seasonal decorations. Also optional. |
| `sw.js` | The service worker: lets the app load offline. **If you add a new file the app needs, add it to the `ASSETS` list at the top and change the `CACHE` name (e.g. `stt-v4`).** |
| `manifest.json`, `icons/` | "Add to Home Screen" support. |
| `graveyard.gif`, `graveyard-final-frame.png` | Pictures for the "Later" button easter egg. |
| `CHANGELOG.md` | Every change, newest first. "Not yet published" lists work that is on a branch but not yet live. |
| `tests/` | Automated browser tests (see below). |

## Where the data lives

Nothing is stored on a server. Data lives in the browser's `localStorage`, under these keys:

| Key | Contents | Synced to the Gist? |
| --- | --- | --- |
| `stt_v1` | Every day: `{ clients, blocks, descriptions, descManual, rec }`. Blocks are keyed by `"HH:MM"` (15-minute slots) as `{ client, taskId, otherText }`. | yes |
| `stt_todos` | To-dos per client list. | yes |
| `stt_custom` | Saved "Other" task names. | yes |
| `stt_config` | Default clients, burn-rate groups and targets, recurring time blocks (`recurring`). | yes |
| `stt_sync` | GitHub token, Gist ID, last-sync time. | **no, never** |
| `stt_lastChange` | When this device last changed data (compared with the Gist's `exportedAt`). | no |
| `stt_theme`, `stt_backups_auto`, `stt_timer`, `stt_remind_cfg`, `stt_reminded`, `stt_snapshots`, `stt_fun`, `stt_egg_*`, `stt_tab`, `stt_range`, `stt_graveyard` | Per-device settings and bookkeeping. | no |

Sync uses one private GitHub Gist (`sam-time-tracker.json`). The newest save wins as a whole, with prompts when one side looks much smaller than the other. Loading data always passes through `cleanDb`, `cleanTodos`, `cleanConfig` in `index.html`, which repair odd or damaged shapes.

## How the pieces talk to each other

- `index.html` runs first. After each render it calls optional hooks: `featHook('render', day)` (features.js) and `eggHook('render')` (easter-eggs.js), both wrapped in try/catch.
- Every real edit goes through `dbSave()`, `todosSave()`, `customSave()` or `configSave()`. These record an undo step (`undoNote`), save to `localStorage`, and mark the device as changed so the next sync uploads it. Passing `false` saves without marking a change (used for automatic fills like recurring blocks, which must not make a stale device look newer than the Gist).
- Tabs: `showTab(name)`, then `refreshVisible()` redraws whatever is on screen.

## Publishing a change

1. Edit the files on a branch (or straight on `main` if you are working alone and are careful).
2. Update `CHANGELOG.md`.
3. Merge to `main`. GitHub Pages deploys. Hard-refresh (Ctrl/Cmd+Shift+R), or close and reopen the app on a phone.

## Running the tests

The tests open the real app in a real (headless) browser, with the clock faked, and click through it. They never touch your real data (each test starts with a fresh empty browser).

```
npm install            # once; installs Playwright
npx playwright install chromium   # once; downloads the test browser
npm test               # runs everything
node tests/run.js undo # runs only files with "undo" in the name
```

| Test file | Covers |
| --- | --- |
| `01-undo.js` | Undo/redo: keyboard, buttons, step grouping, history cap. |
| `02-gaps-timer.js` | Gaps strip and filling; the timer (rounding, reload, midnight, bad clocks). |
| `03-recurring-summary-pacing.js` | Recurring blocks, Summary tab and charts, burn-rate pacing. |
| `04-sync-todos-reminders-theme.js` | Sync badge states (with a pretend Gist), recurring to-dos, reminders, dark mode. |
| `05-edge-cases.js` | Damaged data, full storage, hostile names, phone layout. |
| `06-recurring-panel-sync-offline.js` | The recurring-block settings, pulling newer synced data, offline reload. |
| `07-backup-switch.js` | The per-device backup switch, restore, delete. |
| `08-todo-add-row.js` | The add-a-to-do row stays above the list. |
| `09-quotes.js` | The quote bar: day-specific lines, nothing cut off. |

Not covered here: older tests for the time-grid dragging, burn-box dragging, touch painting, the "now" line and the easter eggs were lost in a session reset. Those areas still work; they just have no saved automatic checks. Adding tests for them would be a good next job.

## Good habits

- One change at a time; check the live site on a laptop and a phone afterwards.
- Test with the clock faked (see `tests/lib.js`) rather than waiting for real times.
- Never put your GitHub token anywhere but the app's Settings screen.
