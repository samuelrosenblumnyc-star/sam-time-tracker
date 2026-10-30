// Undo / redo for everything
const { ok, boot, launch, done, day, getDb } = require('./lib.js');
const T = '2026-10-28';
(async () => {
  const b = await launch();
  let p = await boot(b, { store: { stt_v1: { [T]: day({}) } } });
  const click = async t => { await p.click(`#tbody td[data-time="${t}"][data-ci="0"]`); await p.evaluate(() => hidePopover()); };
  const n = async () => Object.keys((await getDb(p))[T].blocks).length;
  ok(await p.locator('#undoBtn').isDisabled(), 'Undo starts disabled');
  await click('09:00');
  ok(await n() === 1, 'a click logs a slot');
  ok(await p.locator('#undoBtn').isEnabled(), 'Undo enabled after an edit');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  ok(await n() === 0 && !(await p.$('#tbody td.sel')), 'Ctrl+Z removes it (data and screen)');
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(150);
  ok(await n() === 1, 'Ctrl+Shift+Z brings it back');
  await p.click('#undoBtn'); await p.waitForTimeout(150);
  ok(await n() === 0, 'the Undo button works too');
  await p.click('#redoBtn'); await p.click('#undoBtn');

  // typing-speed edits of one kind are one step; separate edits are separate steps
  await click('10:00'); await click('10:15'); await p.waitForTimeout(1500); await click('11:00');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await n() === 2, 'one Undo removes only the latest separate edit');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await n() === 0, 'quick back-to-back edits of the same kind undo together');

  // different kinds of action are separate steps; an edit right after Undo is its own step
  await click('09:00'); await p.waitForTimeout(900); await click('09:15'); await p.waitForTimeout(900);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(50);
  await click('10:00');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(Object.keys((await getDb(p))[T].blocks).sort().join() === '09:00', 'an edit right after Undo is its own step');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await p.locator('#undoBtn').isDisabled(), 'Undo disabled when the history is used up');

  // to-dos too; multi-slot fill is one step
  await p.evaluate(() => addTask('Axon', 'Test task', '', ''));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => !(todos.Axon || []).some(t => t.task === 'Test task')), 'Undo removes a to-do');
  await p.evaluate(() => { const d = getDay(currentDate); for (let m = 540; m < 660; m += 15) setBlock(d, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, 'Axon'); afterBlockChange(d); });
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await n() === 0, 'a multi-slot fill undoes in one step');
  // history is capped
  await p.evaluate(async () => { for (let i = 0; i < 50; i++) { addTask('Axon', 't' + i, '', ''); await new Promise(r => setTimeout(r, 800)); } });
  ok(await p.evaluate(() => undoState.undo.length) <= 40, 'history capped at 40');
  // native undo inside a text box is left alone
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.fill('#newClientInp', 'abc'); await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(p.errs.length === 0, 'no errors ' + p.errs.join('|').slice(0, 150));
  await done(b);
})();
