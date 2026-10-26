# Change log

Every edit requested for the time tracker, newest first.
**Not yet published** means it's on the working branch but not merged into `main` (so not on the live site yet).

## Not yet published

- **2026-10-26: Time labels stay visible under the red "now" line.** When the line reached a row, that row's gray time (e.g. `:30`, `12 PM`) disappeared. The line now runs *behind* the time column, so every label stays readable, and the current row's label keeps its normal gray (a thin red marker on the row's left edge still shows the current row). The time tag (e.g. `9:35 AM ▸`) stays on top. The time column is a little wider (104px desktop, 72px phone) so the tag never covers a label; checked for every minute from 8 AM to 7 PM.
- **2026-10-26: Started this change log.**

## Published

### 2026-10-23: PR #4
- Drag a client's column header sideways to reorder the time-tracker columns (mouse; press-and-hold on touch; Alt+←/→ on keyboard). Logged time, Sums and descriptions move with the column; saved with the day and inherited by new days. "Moved … Undo" toast.
- Drag the monthly burn rate boxes to choose which come first (same gestures). The order is stored with the burn rate groups, so it syncs and the Settings list and To-Do tabs follow it.

### 2026-10-22: PR #3
- The red "now" line moves like a clock hand, down through each 15-minute slot every minute, with a time tag pinned at its left.
- To-Do "All" tab is one flat list in due-date order, with a Group column (burn rate group name); completed items at the bottom.
- Blocks that end at the top of an hour now run all the way to the bold gray hour line.
- Easter egg: the first "Later" click each day shows "Working the graveyard shift, huh?" with an animated skeleton-arm GIF (`graveyard.gif`; source in `graveyard-src/`). Once per calendar day per device.

### 2026-10-22: PR #2
- To-Do tabs are grouped by burn rate group (Axon, Versigent, L'Oreal, Hershey…) instead of client codes.
- To-do due dates can be typed without a year (`10/25`, `Oct 25`, `today`, `tomorrow`, `fri`).
- Bolder gray hour lines in the time grid; first version of the "now" time tag.

### 2026-10-21: PR #1
- Fixed cross-browser sync (data not carrying over to other browsers, and an empty browser overwriting the synced Gist): saves a few seconds after each change, checks the Gist on open / on return to the tab, asks before replacing a much larger copy, keeps a restorable backup, and shows clear error messages.

### Before this log
- Original app plus a UI/UX overhaul (local-date fix, calendar-style grid, undo toasts, mobile header, keyboard shortcuts).
