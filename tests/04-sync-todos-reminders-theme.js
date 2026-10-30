// Sync badge, recurring to-dos, reminders, dark mode
const { ok, boot, launch, done, day } = require('./lib.js');
const T = '2026-10-28';
const cfg = { defaultClients: ['Axon', 'Admin', 'Flex'], burnRates: [{ id: 'g1', label: 'Axon', target: 75, clients: ['Axon'] }] };
(async () => {
  const b = await launch(); let p;
  console.log('Sync badge');
  p = await boot(b, { store: { stt_v1: { [T]: day({}) }, stt_config: cfg } });
  const badge = async () => (await p.textContent('#syncIndicator')).trim();
  ok(await badge() === 'Local only' && await p.locator('#syncIndicator').isVisible(), 'no sync set up: "Local only", always visible');
  const bb = await p.locator('#syncIndicator').boundingBox();
  ok(bb.x > 900 && bb.y < 52, 'in the top right');
  await p.click('#syncIndicator'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => activeTab()) === 'settings', 'clicking it with no sync opens Settings');
  await p.ctx.close();

  let gist = JSON.stringify({ v: 1, stt_v1: { [T]: day({}) }, stt_todos: {}, stt_custom: {}, exportedAt: '2026-10-27T00:00:00.000Z' }), writes = 0;
  p = await boot(b, {
    store: { stt_v1: { [T]: day({}) }, stt_config: cfg, stt_sync: { token: 'x', gistId: 'g1', lastSync: '2026-10-28T09:00:00.000Z', autoSync: true }, stt_lastChange: '2026-10-28T08:00:00.000Z' },
    setup: async c => c.route('https://api.github.com/**', async r => {   // a pretend GitHub Gist
      if (r.request().method() !== 'GET') { writes++; gist = JSON.parse(r.request().postData()).files['sam-time-tracker.json'].content; }
      await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'g1', files: { 'sam-time-tracker.json': { content: gist } } }) });
    }) });
  ok(await badge() === 'Synced', 'configured and up to date: "Synced"');
  await p.click('#tbody td[data-time="09:00"][data-ci="0"]'); await p.evaluate(() => hidePopover()); await p.waitForTimeout(100);
  ok(await badge() === 'Saving…', 'after an edit: "Saving…"');
  await p.clock.fastForward(5000); await p.waitForTimeout(500);
  ok(await badge() === 'Synced' && writes >= 1, 'after the upload: "Synced" again');
  await p.ctx.setOffline(true); await p.waitForTimeout(100);
  ok(await badge() === 'Offline', 'offline: "Offline"');
  await p.click('#tbody td[data-time="09:15"][data-ci="0"]'); await p.evaluate(() => hidePopover()); await p.waitForTimeout(100);
  ok(/Offline · unsynced/.test(await badge()), 'offline with edits: "Offline · unsynced"');
  await p.ctx.setOffline(false); await p.waitForTimeout(300);
  ok(/Saving|Syncing|Synced/.test(await badge()), 'back online recovers');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Recurring to-dos');
  p = await boot(b, { store: { stt_v1: { [T]: day({}) }, stt_config: cfg, stt_todos: { Axon: [{ id: 'w1', task: 'Weekly report', dueDate: T, dueTime: '', notes: 'n', priority: 2, done: false, repeat: 'weekly' }, { id: 'm1', task: 'Month end', dueDate: '2026-01-31', dueTime: '', notes: '', priority: 0, done: false, repeat: 'monthly' }, { id: 'p1', task: 'Plain', dueDate: '', dueTime: '', notes: '', priority: 0, done: false }] } } });
  await p.click('.app-tab-btn[data-tab="todos"]'); await p.waitForTimeout(200);
  ok(await p.locator('.todo-repeat-sel').count() >= 1, 'Repeat column present');
  await p.evaluate(() => toggleDone('Axon', 'w1'));
  const copy = (await p.evaluate(() => todos.Axon)).find(x => x.task === 'Weekly report' && !x.done);
  ok(copy?.dueDate === '2026-11-04' && copy.repeat === 'weekly' && copy.notes === 'n' && copy.priority === 2, 'completing it creates next week\'s copy');
  await p.evaluate(() => toggleDone('Axon', 'w1'));
  ok((await p.evaluate(() => todos.Axon)).length === 3, 'un-completing removes the copy again');
  await p.evaluate(() => { toggleDone('Axon', 'w1'); toggleDone('Axon', 'w1'); toggleDone('Axon', 'w1'); });
  ok((await p.evaluate(() => todos.Axon)).length === 4, 'repeated toggling never piles up copies');
  await p.evaluate(() => toggleDone('Axon', 'm1'));
  ok((await p.evaluate(() => todos.Axon)).find(x => x.task === 'Month end' && !x.done)?.dueDate > T, 'an old overdue monthly task jumps to a future date');
  await p.evaluate(() => toggleDone('Axon', 'p1'));
  ok((await p.evaluate(() => todos.Axon)).filter(x => x.task === 'Plain').length === 1, 'plain tasks do not repeat');
  const nd = await p.evaluate(() => [nextDue('2026-01-31', 'monthly'), nextDue('2026-10-30', 'weekdays'), nextDue('2026-10-28', 'daily'), nextDue('2026-10-28', 'biweekly')]);
  ok(JSON.stringify(nd) === '["2026-02-28","2026-11-02","2026-10-29","2026-11-11"]', 'date maths');
  await p.evaluate(() => { toggleDone('Axon', 'w1'); toggleDone('Axon', todos.Axon.find(x => x.task === 'Weekly report' && !x.done).id); toggleDone('Axon', 'w1'); toggleDone('Axon', 'w1'); });
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Reminders');
  p = await boot(b, { store: { stt_v1: { [T]: day({ '09:00': 'Axon' }) }, stt_config: cfg, stt_todos: { Axon: [{ id: 'd1', task: 'Send deck', dueDate: T, dueTime: '10:30', notes: '', priority: 0, done: false }, { id: 'd2', task: 'No-time task', dueDate: T, dueTime: '', notes: '', priority: 0, done: false }] } }, time: T + 'T09:50:00' });
  ok(/1 due today/.test(await p.textContent('#remindStack')), 'morning summary for tasks without a time');
  await p.click('#remindStack >> text=Dismiss'); await p.clock.fastForward(45 * 60000); await p.waitForTimeout(200);
  ok(/Send deck/.test(await p.textContent('#remindStack')), 'a timed to-do pings at its time');
  const n = await p.locator('#remindStack .remind-card').count(); await p.clock.fastForward(60000); await p.waitForTimeout(100);
  ok(await p.locator('#remindStack .remind-card').count() === n, 'and only once');
  await p.click('#remindStack >> text=Dismiss >> nth=0');
  await p.clock.fastForward(5 * 3600000 + 55 * 60000); await p.waitForTimeout(200);
  ok(/Time check/.test(await p.textContent('#remindStack')) && /0\.25 of 8/.test(await p.textContent('#remindStack')), 'under-hours reminder at 4:30 PM');
  await p.click('#remindStack >> text=Show gaps'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => activeTab()) === 'tracker', 'its button goes to the tracker');
  await p.ctx.close();
  p = await boot(b, { store: { stt_config: cfg }, time: '2026-10-31T16:29:00' });
  await p.clock.fastForward(120000); await p.waitForTimeout(200);
  ok(!/Time check/.test(await p.textContent('#remindStack')), 'no under-hours reminder on a Saturday');
  await p.ctx.close();

  console.log('Theme');
  p = await boot(b, { store: { stt_config: cfg }, colorScheme: 'light' });
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', 'auto follows a light device');
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('.seg-theme >> text=Dark'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark' && await p.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(15, 20, 27)', 'Dark switches immediately');
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'the choice persists');
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('.seg-theme >> text=Auto');
  await p.emulateMedia({ colorScheme: 'dark' }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'Auto follows a dark device');
  await p.emulateMedia({ colorScheme: 'light' }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'light', '...and changes live');
  ok(p.errs.length === 0, 'no errors');
  await done(b);
})();
