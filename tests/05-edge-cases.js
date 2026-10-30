// Damaged data, full storage, hostile names, phone layout, reset, recurring to-do edge cases
const { ok, boot, launch, done, seed, day, getDb } = require('./lib.js');
const T = '2026-10-28';
const cfg = { defaultClients: ['Axon', 'Admin', 'Flex'], burnRates: [{ id: 'g1', label: 'Axon', target: 75, clients: ['Axon'] }] };
(async () => {
  const b = await launch(); let p;

  console.log('Damaged or odd saved data');
  for (const [name, store, rawStore] of [
    ['garbage in the time data', {}, { stt_v1: 'this is not json {{{' }],
    ['wrong-shaped to-dos / quick picks / settings', { stt_todos: '[]', stt_custom: '"oops"', stt_config: { defaultClients: ['A'], burnRates: 'nope' } }, {}],
    ['a day with no client list and old-style blocks', { stt_v1: { [T]: { blocks: { '09:00': 'Axon', '09:15': { client: 'Axon' } } } } }, {}],
    ['blocks for a client that is not on the day + impossible times', { stt_v1: { [T]: { clients: ['Axon'], blocks: { '09:00': { client: 'Gone' }, '25:99': { client: 'Axon' } }, descriptions: null } } }, {}],
    ['an odd date key and a day with zero clients', { stt_v1: { 'not-a-date': { clients: ['Axon'], blocks: {} }, [T]: { clients: [], blocks: {}, descriptions: {}, descManual: {} } } }, {}],
    ['damaged recurring rules, backups, timer, reminders', { stt_v1: { [T]: { ...day({ '09:00': 'Axon' }), rec: 'oops' } }, stt_config: { ...cfg, recurring: [{ id: 'x', client: 'Axon', start: '09:00', end: '09:15', days: 'mon' }, 'junk', { id: 'y', client: 'Axon', start: 'bad', end: '10:00', days: [1] }, { id: 'z', client: 'Axon', start: '09:00', end: '09:15', days: [1, 2, 99, 'x'], from: '2026-10-01' }] } }, { stt_snapshots: 'not json', stt_timer: '{"start":"zzz"}', stt_remind_cfg: '[]', stt_reminded: '"x"' }],
  ]) {
    p = await boot(b, { store, rawStore });
    for (const t of ['settings', 'summary', 'todos', 'home', 'tracker']) { await p.evaluate(x => showTab(x), t); await p.waitForTimeout(80); }
    ok(p.errs.length === 0 && (await p.$$('#tbody tr')).length > 20, `${name}: starts and every tab opens ${p.errs.join('|').slice(0, 100)}`);
    await p.ctx.close();
  }
  p = await boot(b, { store: { stt_v1: { [T]: day({}) } } });
  const h = await (await p.$('#thead th.client-hdr')).boundingBox();
  await p.mouse.move(h.x + 20, h.y + 10); await p.mouse.down(); await p.mouse.move(h.x + 200, h.y + 10, { steps: 6 }); await p.mouse.up();
  ok(p.errs.length === 0, 'dragging a column header does nothing harmful'); await p.ctx.close();

  console.log('Recurring to-do edge case');
  p = await boot(b, { store: { stt_config: cfg, stt_todos: { Axon: [{ id: 'w1', task: 'Weekly', dueDate: T, dueTime: '', notes: '', priority: 0, done: false, repeat: 'weekly' }] } } });
  await p.evaluate(() => { toggleDone('Axon', 'w1'); toggleDone('Axon', todos.Axon.find(x => x.id !== 'w1').id); toggleDone('Axon', 'w1'); toggleDone('Axon', 'w1'); });
  ok(await p.evaluate(() => todos.Axon.length) === 3, 'no duplicate when the copy was already completed'); await p.ctx.close();

  console.log('Reset to defaults keeps recurring blocks');
  p = await boot(b, { store: { stt_config: { ...cfg, recurring: [{ id: 'z', client: 'Axon', start: '09:00', end: '09:15', days: [1, 2], from: '2026-10-01' }] } } });
  await p.click('.app-tab-btn[data-tab="settings"]'); await p.click('#resetConfigBtn'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => (config.recurring || []).length) === 1, 'the rule survived'); await p.ctx.close();

  console.log('Storage full');
  p = await boot(b, { store: { stt_v1: seed(T), stt_config: cfg } });
  await p.evaluate(() => { FEAT.snapshot('a'); const d = getDay(currentDate); setBlock(d, '08:00', 'Axon'); afterBlockChange(d); FEAT.snapshot('b'); });
  const n0 = await p.evaluate(() => JSON.parse(localStorage.getItem('stt_snapshots')).length);
  await p.evaluate(() => { const real = Storage.prototype.setItem; let fails = 1; Storage.prototype.setItem = function (k, v) { if (k === 'stt_v1' && fails-- > 0) throw new DOMException('full', 'QuotaExceededError'); return real.call(this, k, v); }; });
  await p.evaluate(() => { const d = getDay(currentDate); setBlock(d, '08:15', 'Axon'); afterBlockChange(d); });
  const n1 = await p.evaluate(() => JSON.parse(localStorage.getItem('stt_snapshots')).length);
  ok(!!(await getDb(p))[T].blocks['08:15'] && n1 === n0 - 1, `a full disk drops the oldest backup and still saves the edit (${n0} -> ${n1})`);
  ok(!(await p.textContent('#toast')).includes("Couldn't save"), 'no error message when that worked'); await p.ctx.close();

  console.log('Hostile client names (no HTML injection)');
  const evil = '<img src=x onerror="window.__pwn=1">';
  p = await boot(b, { store: { stt_v1: { [T]: day({ '09:00': evil, '09:30': evil, '10:00': 'Axon' }, [evil, 'Axon']) }, stt_config: { ...cfg, defaultClients: [evil, 'Axon'], burnRates: [{ id: 'g', label: evil, target: 5, clients: [evil] }], recurring: [{ id: 'r', label: evil, client: evil, taskId: '__other__', otherText: evil, start: '11:00', end: '11:15', days: [3], from: '2026-10-01' }] }, stt_todos: { [evil]: [{ id: 't', task: evil, dueDate: T, dueTime: '10:30', notes: evil, priority: 0, done: false }] } } });
  await p.click('#gapBtn'); await p.click('#timerBtn'); await p.click('#timerBtn');
  for (const t of ['summary', 'settings', 'todos', 'home', 'tracker']) { await p.evaluate(x => showTab(x), t); await p.waitForTimeout(100); }
  await p.clock.fastForward(40 * 60000); await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__pwn) === undefined && await p.locator('img').count() === 0, 'no injected <img> or script anywhere');
  ok(p.errs.length === 0, 'no errors'); await p.ctx.close();

  console.log('Phone layout (390x800)');
  p = await boot(b, { store: { stt_v1: { [T]: day({ '09:00': 'Axon', '10:00': 'Admin' }) }, stt_config: { ...cfg, recurring: [{ id: 'r', label: 'Standup', client: 'Axon', taskId: null, otherText: '', start: '09:00', end: '09:15', days: [1, 2, 3, 4, 5], from: '2026-10-01', on: true }] }, stt_todos: { Axon: [{ id: 'a', task: 'A long task name to test wrapping on a small screen', dueDate: T, dueTime: '', notes: 'notes', priority: 1, done: false, repeat: 'weekly' }] } }, time: T + 'T11:00:00', vp: { width: 390, height: 800 } });
  for (const t of ['tracker', 'summary', 'home', 'todos', 'settings']) {
    await p.evaluate(x => showTab(x), t); await p.waitForTimeout(150);
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    ok(w[0] <= w[1], `${t}: no sideways page scroll (${w[0]} vs ${w[1]})`);
  }
  await p.evaluate(() => { showTab('tracker'); document.getElementById('remindStack').innerHTML = ''; });   // a reminder banner is page content and legitimately pushes the grid down until dismissed
  await p.click('#gapBtn'); await p.waitForTimeout(100);
  const sh = await p.evaluate(() => document.getElementById('tableWrap').getBoundingClientRect().bottom - innerHeight);
  ok(sh <= 2, 'the Sums row stays on screen even with the extra control rows');
  const tabs = await p.$$eval('.app-tab-btn', e => e.map(x => { const r = x.getBoundingClientRect(); return [r.left, r.right]; }));
  ok(tabs.every(t => t[0] >= 0 && t[1] <= 390), 'all 5 tabs fit across the screen');
  ok(p.errs.length === 0, 'no errors');
  await done(b);
})();
