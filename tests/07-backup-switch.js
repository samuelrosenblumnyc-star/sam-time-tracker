// The per-device switch for automatic backups
const { ok, boot, launch, done, seed, day } = require('./lib.js');
const T = '2026-10-28';
const cfg = { defaultClients: ['Axon', 'Admin'], burnRates: [] };
(async () => {
  const b = await launch(); let p;
  const snaps = p => p.evaluate(() => JSON.parse(localStorage.getItem('stt_snapshots') || '[]'));
  p = await boot(b, { store: { stt_v1: seed(T) } });
  ok((await snaps(p)).length === 1, 'on by default: a daily backup was taken');
  await p.click('.app-tab-btn[data-tab="settings"]');
  ok(await p.locator('#backupPanel .ft-switch input').isChecked(), 'the switch shows On');
  await p.click('#backupPanel .ft-switch input'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => localStorage.getItem('stt_backups_auto')) === 'off', 'switched off, stored on this device only');
  await p.evaluate(() => { const d = getDay(currentDate); setBlock(d, '09:00', 'Axon'); dbSave(); FEAT.snapshot('before loading synced data'); });
  ok((await snaps(p)).length === 1, 'while off: no new automatic or pre-sync backups');
  await p.click('#backupPanel >> text=Back up now'); await p.waitForTimeout(100);
  ok((await snaps(p)).length === 2, '"Back up now" still works while off');
  await p.reload(); await p.waitForTimeout(600);
  ok(await p.evaluate(() => localStorage.getItem('stt_backups_auto')) === 'off' && (await snaps(p)).length === 2, 'stays off after a reload');
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.locator('#backupPanel .ft-item').nth(1).locator('button').click(); await p.waitForTimeout(250);
  ok(!!(await p.evaluate(() => localStorage.getItem('stt_snapshots'))), 'restore still works while off');
  await p.click('#backupPanel >> text=Delete backups on this device'); await p.waitForTimeout(150);
  ok((await snaps(p)).length === 0, 'delete all backups');
  await p.click('#backupPanel .ft-switch input'); await p.waitForTimeout(150);
  ok((await snaps(p)).length === 1, 'switching back on takes a backup straight away');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Manual backups and restore');
  p = await boot(b, { store: { stt_v1: seed(T), stt_config: cfg } });
  await p.evaluate(() => { const d = getDay(currentDate); setBlock(d, '09:00', 'Axon'); dbSave(); });
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('#backupPanel >> text=Back up now'); await p.waitForTimeout(100);
  await p.click('#backupPanel >> text=Back up now'); await p.waitForTimeout(100);
  ok((await snaps(p)).length === 2 && await p.locator('#backupPanel .ft-item').count() === 2, 'a second backup is added, but not a duplicate');
  await p.locator('#backupPanel .ft-item').nth(1).locator('button').click(); await p.waitForTimeout(300);
  ok(!(await p.evaluate(() => JSON.parse(localStorage.getItem('stt_v1'))))[T]?.blocks?.['09:00'], 'restoring the older backup reverts the edit');
  await p.ctx.close();

  console.log('Pulling synced data while backups are off');
  const gist = JSON.stringify({ v: 1, stt_v1: { [T]: day({ '09:00': 'Admin' }, ['Axon', 'Admin']) }, stt_todos: {}, stt_custom: {}, exportedAt: '2026-10-28T09:00:00.000Z' });
  p = await boot(b, { store: { stt_v1: { [T]: day({ '14:00': 'Axon', '14:15': 'Axon' }, ['Axon', 'Admin']) }, stt_config: cfg, stt_sync: { token: 'x', gistId: 'g1', lastSync: '2026-10-20T00:00:00.000Z', autoSync: true }, stt_lastChange: '2026-10-20T00:00:00.000Z' }, rawStore: { stt_backups_auto: 'off' },
    setup: async c => c.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'g1', files: { 'sam-time-tracker.json': { content: gist } } }) })) });
  await p.waitForTimeout(300);
  ok(Object.keys(await p.evaluate(() => getDay(currentDate).blocks)).join() === '09:00', 'the synced day replaced the local one');
  ok((await snaps(p)).length === 0, 'no automatic backup was made (the switch is off)');
  ok(!!(await p.evaluate(() => localStorage.getItem('stt_backup'))), 'the older single "before loading synced data" safety copy still exists');
  await p.ctx.close();

  console.log('Odd values');
  p = await boot(b, { store: { stt_v1: seed(T) }, rawStore: { stt_backups_auto: 'banana' } });
  ok((await snaps(p)).length === 1, 'an unrecognised value counts as On');
  await p.ctx.close();
  for (const [name, vp, theme] of [['phone', { width: 390, height: 844 }, 'light'], ['dark', { width: 1280, height: 800 }, 'dark']]) {
    p = await boot(b, { store: { stt_v1: seed(T) }, rawStore: { stt_backups_auto: 'off' }, vp, theme });
    await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('#backupPanel >> text=Back up now');
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(w[0] <= w[1] && p.errs.length === 0, `${name}: no sideways scroll, no errors`);
    await p.ctx.close();
  }
  await done(b);
})();
