// Recurring time blocks, the Summary tab, burn-rate pacing
const { ok, boot, launch, done, seed, day, getDb } = require('./lib.js');
const T = '2026-10-28'; // a Wednesday
const cfg = { defaultClients: ['Axon', 'Admin', 'Flex'], burnRates: [{ id: 'g1', label: 'Axon', target: 75, clients: ['Axon'] }] };
(async () => {
  const b = await launch(); let p, bl;
  console.log('Recurring blocks');
  p = await boot(b, { store: { stt_v1: { [T]: day({}) }, stt_config: cfg }, time: T + 'T08:00:00' });
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('#recPanel >> text=+ Add recurring block'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => config.recurring.length) === 1, 'rule added and saved in settings');
  ok(!(await getDb(p))[T].blocks['09:00'], 'a new rule does not fill the grid while you are still setting it up');
  await p.click('.app-tab-btn[data-tab="tracker"]'); await p.waitForTimeout(150);
  bl = (await getDb(p))[T].blocks;
  ok(bl['09:00']?.client === 'Axon' && bl['09:00'].taskId === '__meeting_int__' && !bl['09:15'], 'going back to the tracker fills 9:00-9:15 today');
  await p.click('#nextBtn'); await p.waitForTimeout(150);
  ok(!!(await getDb(p))['2026-10-29']?.blocks['09:00'], 'Thursday is filled when opened');
  await p.click('#nextBtn'); await p.click('#nextBtn'); await p.waitForTimeout(150);
  ok(!Object.keys((await getDb(p))['2026-10-31']?.blocks || {}).length, 'Saturday is not filled');
  for (let i = 0; i < 4; i++) await p.click('#prevBtn'); await p.waitForTimeout(150);
  ok(!Object.keys((await getDb(p))['2026-10-27']?.blocks || {}).length, 'a day before the rule existed is not filled');
  await p.click('#nextBtn'); await p.click('#nextBtn'); await p.waitForTimeout(100);
  await p.evaluate(() => { delete getDay(currentDate).blocks['09:00']; dbSave(); renderAll(); });
  await p.reload(); await p.waitForTimeout(700); await p.evaluate(() => navTo('2026-10-29')); await p.waitForTimeout(150);
  ok(!(await getDb(p))['2026-10-29'].blocks['09:00'], 'a block you deleted stays deleted after a reload');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  p = await boot(b, { store: { stt_v1: { [T]: day({}) }, stt_config: { ...cfg, recurring: [{ id: 'r1', label: 'S', client: 'Axon', taskId: null, otherText: '', start: '09:00', end: '09:30', days: [1, 2, 3, 4, 5], from: '2026-10-01', on: true }] } }, time: T + 'T08:00:00' });
  ok((await getDb(p))[T].blocks['09:15']?.client === 'Axon', 'a 30-minute rule fills two slots');
  ok(await p.evaluate(() => localStorage.getItem('stt_lastChange')) === null, 'filling a day does not count as a local edit (so a stale device cannot overwrite the synced copy)');
  await p.evaluate(() => { config.recurring[0].on = false; configSave(); navTo('2026-10-30'); });
  ok(!Object.keys((await getDb(p))['2026-10-30']?.blocks || {}).length, 'a switched-off rule does nothing');
  await p.ctx.close();

  console.log('Burn-rate pacing');
  p = await boot(b, { store: { stt_v1: seed(T), stt_config: { ...cfg, burnRates: [{ id: 'g1', label: 'Axon', target: 75, clients: ['Axon'] }, { id: 'g2', label: 'Tiny', target: 1, clients: ['Admin'] }] } }, time: T + 'T10:00:00' });
  const cards = await p.$$eval('.burn-card', e => e.map(x => x.innerText.replace(/\s+/g, ' ')));
  ok(cards.length === 2 && cards.every(c => /pace|over target|just started/.test(c)), 'each card shows a status');
  ok(/On track for ~\d+h by month end/.test(cards[0]), 'projection shown');
  ok(/over target/.test(cards[1]) && !/On track/.test(cards[1]), 'an over-target group has no projection');
  ok(/working days done/.test(await p.textContent('.burn-hdr')), 'header explains the basis');
  await p.ctx.close();

  console.log('Summary tab');
  p = await boot(b, { store: { stt_v1: { [T]: day({ '09:00': 'Axon', '09:15': 'Axon', '10:00': 'Admin' }), '2026-10-27': day({ '09:00': 'Flex' }) }, stt_config: cfg }, time: T + 'T10:00:00' });
  await p.click('.app-tab-btn[data-tab="summary"]'); await p.waitForTimeout(200);
  ok(/Oct 26 – Nov 1/.test(await p.textContent('.sum-period')), 'week label');
  const rows = await p.$$eval('.sum-grid tbody tr', r => r.map(x => [...x.children].map(c => c.textContent.trim()).join('|')));
  ok(rows.length === 3 && rows.some(r => /^Axon\|·\|·\|0\.5\|/.test(r)) && rows.some(r => /^Flex\|·\|0\.25\|/.test(r)), 'grid rows are right');
  ok(await p.locator('.donut-wrap svg circle').count() >= 3 && await p.locator('.bars .bar-col').count() === 7, 'donut and 7 daily bars drawn');
  await p.click('.sum-seg button:has-text("Month")'); await p.waitForTimeout(150);
  ok(/October 2026/.test(await p.textContent('.sum-period')) && await p.locator('.sum-grid thead th').count() === 33, 'month view: 31 days + client + total');
  await p.click('.sum-bar button:has-text("→")'); await p.waitForTimeout(100);
  ok(/November 2026/.test(await p.textContent('.sum-period')) && await p.locator('.sum-empty').count() >= 1, 'next month is empty');
  await p.click('.sum-bar button:has-text("This month")'); await p.click('.sum-seg button:has-text("Week")');
  await p.click('.sum-grid thead th >> nth=2 >> button'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => currentDate) === '2026-10-27' && await p.evaluate(() => activeTab()) === 'tracker', 'clicking a day opens it');
  ok(p.errs.length === 0, 'no errors');
  await done(b);
})();
