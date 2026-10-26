# Change log

Every edit requested for the time tracker, newest first.
**Not yet published** means it's on the working branch but not merged into `main` (so not on the live site yet).

## Not yet published

- **2026-10-26: Fixed two bugs from the easter eggs update.**
  - *The red "now" line could end up in the wrong place after retro mode.* Retro mode changes the grid's fonts and row heights, and the line was only re-placed once a minute, so it stayed at an out-of-date position (about 8 minutes off on one screen) until the next tick. The line now re-places itself whenever the grid changes size (retro mode on or off, fonts loading, rows resizing), so it can't go stale.
  - *The Halloween pumpkin covered the Total number.* There is now just one small pumpkin, tucked into the very bottom-left corner (the empty part of the time column), and the cobwebs are smaller and fainter. Checked on several screen sizes (including 1919x910 and two phone sizes), at the normal position and with the page scrolled to the bottom: it never touches any text.

- **2026-10-26: Bug sweep.** Went through the whole app looking for problems and fixed these:
  - *Damaged or odd saved data could crash the app* (e.g. from an old version, a hand-edited Gist, or a sync mix-up). Saved and synced data is now checked and repaired when loaded, so the app always starts.
  - *A new day copied the client list from the latest day on record* (even one in the future) instead of the nearest earlier day. It now copies the nearest earlier day.
  - *Client names that differ only by capital letters* (e.g. "Zeta" and "zeta") could be added twice. They are now treated as the same.
  - *Dragging the column header when only one client is on the day* caused an error. It now does nothing.
  - *Reordering columns* now also reorders later empty days that have the same clients, so tomorrow matches.
  - *Phone To-Do tab* was wider than the screen (the Task column was squashed). The list now scrolls sideways inside its box.
  - *Failed saves* (storage full or blocked) now show a message instead of silently losing the edit.
  - *Easter eggs* can no longer repeat on the same day when two triggers share an egg; retro mode no longer shifts pop-ups when the page is scrolled.
  - Added a favicon (the browser was requesting one and getting an error).

## Published

### 2026-10-26: PR #5
- **Easter eggs and seasonal decorations** (new `easter-eggs.js`; if it ever fails to load, the app works as before). Each shows at most once per day or month, is dismissible, never blocks a tap or scroll, shows a still picture when reduced motion is on, and is not part of the synced data. At most two pop-ups show at once; the rest wait their turn.
  - *Milestones:* reaching 8.0 hours (confetti, "Done. Go home."); a burn rate group reaching its target (flame on its box, "Fully burned.") or going over it ("Slow down, that's a bonfire."); ticking off the last overdue to-do ("Inbox zero energy."); the first time logged in a new month ("Fresh month, fresh burn.").
  - *Time and calendar:* logging a slot before 8 AM (rooster at sunrise, "Early bird, huh?"); logging on a Saturday or Sunday ("Weekend warrior."); noon, when a sandwich slides along a timeline ("Lunch?"); Friday 4:45 to 6 PM, someone tiptoeing out a door ("Weekend in N min.").
  - *Seasonal decorations:* pumpkins and cobwebs Oct 24 to Nov 1, falling snow in December, floating hearts Feb 1 to 14.
  - *Hidden:* the Konami code (8 seconds of retro mode); clicking the app title 7 times (silly names and a spinning clock); double-clicking the time tag on the red line (a runner chases a clock along it); typing "coffee" on the Time Tracker tab (steaming mug, and the header jokes are caffeinated for the day).
  - *Settings:* a new "Fun stuff" panel with switches for easter eggs and for seasonal decorations (stored on this device only).
- **2026-10-26: Time labels stay visible under the red "now" line.** When the line reached a row, that row's gray time (e.g. `:30`, `12 PM`) disappeared. The line now runs *behind* the time column, so every label stays readable, and the current row's label keeps its normal gray (a thin red marker on the row's left edge still shows the current row). The time tag (e.g. `9:35 AM ▸`) stays on top. The time column is a little wider (104px desktop, 72px phone) so the tag never covers a label; checked for every minute from 8 AM to 7 PM.
- **2026-10-26: Phone fix: swiping on the time grid no longer logs time.** Any touch that started on a grid cell was treated as "start filling time" and scrolling was blocked, so trying to scroll added codes instead (this came from the original app's touch code). Now a **swipe** scrolls the grid (up/down and sideways) as normal, a **tap** logs the slot and opens the task menu, and **pressing and holding** for a moment (the slot highlights) then dragging fills a range. Holding near the top or bottom of the grid while filling scrolls it so you can fill past the visible rows. Desktop mouse behavior is unchanged.
- **2026-10-26: Started this change log.**

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
