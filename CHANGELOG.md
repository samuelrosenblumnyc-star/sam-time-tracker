# Change log

Every edit requested for the time tracker, newest first.
**Not yet published** means it's on the working branch but not merged into `main` (so not on the live site yet).

## Not yet published

(nothing right now)

## Published

### 2026-10-30: pushed straight to `main` (no pull request)
- **2026-10-30: Summary charts: hover tooltips and highlighting** (edited directly by Sam, not through a pull request). Hovering a donut slice or a bar segment shows an instant tooltip with the client name and hours (e.g. "Axon, 12.5 h this week (38%)", and a bar's total for that day or week). The hovered slice or segment also pops out and the rest dim. This replaces the slow built-in browser tooltip.
- **2026-10-30: Automated tests and a "how it works" guide saved into the repo.** New `tests/` folder (9 test files plus a one-command runner: `npm test`) covering undo, gaps, timer, recurring blocks, Summary, pacing, sync badge, recurring to-dos, reminders, dark mode, backups switch, to-do add row, quotes, damaged data and phone layout. New `HOW-IT-WORKS.md` explains the files, where data lives, how the pieces connect, how to publish, and how to run the tests, so any future session or tool can pick up the project. These files are not part of the app; they just sit in the repo.
- **2026-10-30: 25 new lines for the yellow quote bar.** 12 funny ones about logging time ("Your calendar says 'busy.' Your timesheet says 'show your work.'") and 10 motivational ones in the same dry tone, plus 3 day-of-week lines that only appear on the right days (Wednesday: "Halfway through the week...", Thursday and Friday: "The weekend is a deliverable...", Friday: "Friday: the last 0.25 of the week."). Long lines now wrap onto a second line instead of being cut off with "..." (many of the old ones were being cut off, more so since the sync badge took some room). On mid-size screens (tablets, small laptops) the weekday name and the "Prev/Next" words, and below 900px the app title, are hidden to give the quote room.

### 2026-10-28: PR #10
- **2026-10-28: On/off switch for automatic backups, per device** (Settings > Automatic Backups > "Keep automatic backups on this device"). It's stored only on that device, so you can have backups on for your laptop and off for your phone. While off, no daily backups and none before synced data replaces yours; "Back up now", the safety copy before a restore, and restoring older backups all still work. A new "Delete backups on this device" button clears them (your real data is not touched). Turning it back on takes a backup straight away. Bug-tested with sync pulls while off, odd stored values, phone and dark mode. Also tidied the "remind me if I've logged under N hours" sentence in Settings so it reads properly on phones.

### 2026-10-28: PR #9
- **2026-10-28: The "add a to-do" row is now at the top of the list** (just under the client name), so you never scroll to the bottom to add one. It keeps focus after you add so you can type the next one. Also made the to-do table's column headings (Task, Priority, Due Date...) readable; they were gray on dark blue.

### 2026-10-28: PR #8
- **2026-10-28: Bug check of the new features and the rest of the app.** Fixed:
  - *Undo merged separate actions.* An edit made right after pressing Undo joined the older step, and quick actions on different things (e.g. adding a recurring block, then applying it) became one step. Steps now only combine for the same kind of edit in quick succession (typing).
  - *Gaps list missed a gap at the very end* (e.g. 10:30 to 11:30 before your last entry).
  - *Phone: the Sums row fell below the screen* because the controls grew a second row. The grid now measures the controls (and the gaps strip) so it always fits.
  - *Phone: Home tab was wider than the screen* (a pre-existing problem with long task names). It is now one column.
  - *Phone: reminders covered the buttons.* They are now a banner under the tabs; on wider screens they stay in the top-right corner.
  - *Recurring blocks:* a new rule no longer fills today's grid while you are still setting it up (it applies when you go back to the tracker); "Reset to Defaults" no longer deletes your recurring blocks; damaged rule data can no longer crash the app.
  - *Recurring to-dos:* un-checking and re-checking after the next copy was already completed no longer adds a duplicate; monthly tasks keep their day of the month ("the 31st") after a short month; damaged data can't crash.
  - *Storage full:* the automatic backups give up space first (oldest first) so your edits still save; backups are capped lower (about 1.8 MB) so they can't crowd out your data.
  - *Timer:* a clock that jumps backwards logs nothing instead of a stray slot; no crash with an empty day; Summary opens on the current week/month again after you move days on the tracker.
  - *Burn-rate:* finished months no longer show a month-end projection.
  - *Dark mode:* fixed a few inline-styled labels and buttons that stayed light.
  - *Notifications:* the "Allow notifications" button works in older Safari.

- **2026-10-28: Twelve new features** (new files `features.js`, `features.css`, `dark.css`; if `features.js` ever fails to load, the app works as before).
  - *Recurring time blocks* (Settings): e.g. "Standup, 9:00 to 9:15, Mon to Fri". The first time you open a matching day, its empty slots fill in. Change or delete them and they stay changed. Only affects days from the day you create the rule. There is an "Apply to the day shown now" button too. Opening a day this way is not counted as an edit, so a stale device can't overwrite your synced copy.
  - *Fill gaps*: a "gaps" button in the controls bar counts unlogged slots between your first and last entry. It highlights them with stripes and lists each gap ("9:45 to 10:30 AM, 0.75 h") with a + to fill it, or "Fill all gaps" with a client you choose.
  - *Timer*: "Start timer" picks a client (and task); Stop logs it in 15-minute slots rounded to the nearest slot (10:07 to 10:54 logs 10:00 to 11:00). It keeps running if you close the page, shows in the browser tab title, and a red pill follows you to the other tabs. Stop is undoable.
  - *Undo and redo for everything*: Undo/Redo buttons plus Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z cover time entries, to-dos, saved tasks and settings (the last 40 changes; quick bursts of edits count as one step).
  - *Summary tab*: week or month grid of hours per client per day with totals (click a day to open it), a donut chart of the client split, bars per day (week) or per week (month), and burn-group totals.
  - *Burn-rate pacing*: each box now says "on pace / ahead / behind" by working days (Mon to Fri, not calendar days) and projects the month end ("On track for ~72h by month end (3h short)").
  - *Automatic backups* (Settings): one backup a day on this device plus one before synced data replaces yours; the last 10 are kept, with a Restore button (your current data is backed up first). "Back up now" too.
  - *Sync badge*: always visible in the top right of the header: Synced / Saving / Syncing / Offline (with "unsynced" if edits are waiting) / Sync failed / Local only. Click it to sync now (or open Settings if sync isn't set up). Phones show just the colored dot.
  - *Recurring to-dos*: a Repeat setting (daily, weekdays, weekly, every 2 weeks, monthly) on every to-do. Completing one creates the next with the following due date; un-checking removes that copy again.
  - *Reminders* (Settings): an in-app card when a to-do's time arrives, a morning summary for to-dos due today without a time, and a weekday reminder at 4:30 PM if you've logged under 6 hours (times and amount adjustable). Turn on notifications to also get them from other tabs and windows. Only works while the app is open (iPhone is limited to Home Screen apps).
  - *Dark mode* (Settings > Appearance): Auto (follows your device), Light or Dark.

### 2026-10-26: PR #7
- **2026-10-26: The red line now starts at the arrow.** The time tag's arrow ended inside the time column while the line only began at the column's edge, leaving a gap. A short red stem now runs from the arrow tip across the time column, so the line looks continuous from the arrow onward (desktop and phone).

### 2026-10-26: PR #6
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
