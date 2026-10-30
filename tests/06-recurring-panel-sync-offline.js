// Recurring panel through the screen, pulling newer synced data, offline reload with the service worker
const { ok, boot, launch, done, day, getDb } = require('./lib.js');
const T = '2026-10-28';
const cfg = { defaultClients: ['Axon', 'Admin', 'Flex'], burnRates: [{ id: 'g1', label: 'Axon', target: 75, clients: ['Axon'] }] };
(async () => {
  const b = await launch(); let p;
  console.log('Recurring panel');
  p = await boot(b, { store: { stt_v1: { [T]: day({}) }, stt_config: cfg }, time: T + 'T08:00:00' });
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('#recPanel >> text=+ Add recurring block'); await p.waitForTimeout(100);
  const rule = '#recPanel .rec-rule';
  await p.selectOption(`${rule} select >> nth=0`, 'Admin'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => config.recurring[0].client) === 'Admin' && await p.evaluate(() => config.recurring[0].taskId) === null, 'changing the client resets the task');
  await p.selectOption(`${rule} select >> nth=1`, '__meeting_cli__');
  ok(await p.evaluate(() => config.recurring[0].taskId) === '__meeting_cli__', 'task saved');
  await p.fill(`${rule} input[type=time] >> nth=0`, '13:00'); await p.dispatchEvent(`${rule} input[type=time] >> nth=0`, 'change'); await p.waitForTimeout(100);
  const r1 = await p.evaluate(() => config.recurring[0]);
  ok(r1.start === '13:00' && r1.end === '13:15', 'moving the start pushes a too-early end to start + 15 minutes');
  await p.click(`${rule} .rec-days button >> nth=3`); await p.waitForTimeout(80);
  ok(!(await p.evaluate(() => config.recurring[0].days)).includes(3), 'toggling a weekday');
  await p.click(`${rule} .rec-days button >> nth=3`);
  await p.fill(`${rule} input[type=time] >> nth=1`, '12:00'); await p.dispatchEvent(`${rule} input[type=time] >> nth=1`, 'change'); await p.waitForTimeout(100);
  ok(await p.locator(`${rule} .rec-bad`).count() === 1, 'an end time before the start is flagged');
  await p.click('.app-tab-btn[data-tab="tracker"]'); await p.waitForTimeout(100);
  ok(!(await getDb(p))[T].blocks['13:00'], 'and a bad rule fills nothing');
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.fill(`${rule} input[type=time] >> nth=1`, '14:00'); await p.dispatchEvent(`${rule} input[type=time] >> nth=1`, 'change');
  await p.click('#recPanel >> text=Apply to the day shown now'); await p.waitForTimeout(150);
  const bl = (await getDb(p))[T].blocks;
  ok(Object.keys(bl).join() === '13:00,13:15,13:30,13:45' && bl['13:00'].client === 'Admin' && bl['13:00'].taskId === '__meeting_cli__', 'Apply fills 1-2 PM with the chosen client and task');
  await p.click(`${rule} input[type=checkbox]`); await p.waitForTimeout(80);
  ok(await p.locator(`${rule}.off`).count() === 1, 'switching a rule off dims it');
  await p.click(`${rule} >> text=Delete`); await p.waitForTimeout(100);
  ok(await p.locator('#recPanel .rec-rule').count() === 0 && Object.keys((await getDb(p))[T].blocks).length === 4, 'deleting a rule keeps what it already filled');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  ok(await p.locator('#recPanel .rec-rule').count() === 1, 'and Undo brings the rule back');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Pulling newer synced data');
  const gist = JSON.stringify({ v: 1, stt_v1: { [T]: { ...day({ '09:00': 'Axon', '09:15': 'Axon' }), rec: ['r1'] } }, stt_todos: {}, stt_custom: {}, stt_config: { ...cfg, recurring: [{ id: 'r1', label: 'Standup', client: 'Axon', start: '09:00', end: '09:15', days: [1, 2, 3, 4, 5], from: '2026-10-01', on: true }] }, exportedAt: '2026-10-28T09:00:00.000Z' });
  p = await boot(b, { store: { stt_v1: { [T]: day({ '14:00': 'Flex' }) }, stt_config: cfg, stt_sync: { token: 'x', gistId: 'g1', lastSync: '2026-10-20T00:00:00.000Z', autoSync: true }, stt_lastChange: '2026-10-20T00:00:00.000Z' },
    setup: async c => c.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'g1', files: { 'sam-time-tracker.json': { content: gist } } }) })) });
  await p.waitForTimeout(300);
  const got = (await getDb(p))[T];
  ok(Object.keys(got.blocks).join() === '09:00,09:15' && got.rec?.join() === 'r1', 'the newer synced day replaced this one, with its recurring flag');
  ok(await p.evaluate(() => config.recurring?.length) === 1, 'recurring rules arrive with the synced settings');
  ok(await p.locator('#undoBtn').isDisabled(), 'the undo history was cleared by the pull');
  ok((await p.evaluate(() => JSON.parse(localStorage.getItem('stt_snapshots') || '[]').map(s => s.reason))).some(r => /before loading synced|automatic/.test(r)), 'this device\'s copy was backed up before being replaced');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Offline reload with the service worker');
  p = await boot(b, { sw: true });
  await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(800);
  await p.ctx.setOffline(true); await p.reload(); await p.waitForTimeout(900);
  ok(await p.evaluate(() => !!window.FEAT && !!document.getElementById('gapBtn')), 'offline: the app and features.js load from the cache');
  const cached = await p.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map(r => r.url.split('/').pop()));
  ok(['features.js', 'features.css', 'dark.css', 'index.html', 'easter-eggs.js'].every(f => cached.includes(f)), 'the cache holds every file');
  ok(p.errs.length === 0, 'no errors');
  await done(b);
})();
