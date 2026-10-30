// Shared helpers for the browser tests. Run everything with:  node tests/run.js
const { chromium } = require('playwright');

let fails = 0;
const ok = (cond, msg) => { console.log(cond ? '  ✓' : '  ✗ FAIL:', msg); if (!cond) fails++; };
const launch = () => chromium.launch();

// Local data for tests. One weekday-heavy history ending the day before `base` (a YYYY-MM-DD string).
function seed(base) {
  const clients = ['Axon', "L'Oreal", 'VGNT', 'HSY Tier 1', 'HSY Tier 2', 'HSY Tier 3', "HSY Dot's", 'HSY Issues Management', 'HSY Corp Storytelling', "Reese's", 'HSY Program MGMT', 'Admin', 'Flex'];
  const p = n => String(n).padStart(2, '0'), db = {};
  for (let i = 1; i <= 120; i++) {
    const d = new Date(base + 'T12:00:00'); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const blocks = {};
    for (let m = 9 * 60; m < 17 * 60 + 30; m += 15) blocks[`${p(Math.floor(m / 60))}:${p(m % 60)}`] = { client: clients[((m / 15 + i) % 12) | 0], taskId: m % 60 ? null : '__other__', otherText: m % 60 ? undefined : 'Work' };
    db[`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`] = { clients, blocks, descriptions: {}, descManual: {} };
  }
  return db;
}
// A day with the given { 'HH:MM': client } blocks.
const day = (blocks, clients = ['Axon', 'Admin', 'Flex']) => ({ clients, blocks: Object.fromEntries(Object.entries(blocks).map(([k, c]) => [k, { client: c, taskId: null }])), descriptions: {}, descManual: {} });

// Open the app in a fresh browser profile with the clock set to `time`.
//   store: localStorage entries to start with   theme: 'dark' | 'light'   sw: allow the service worker
//   setup(context): runs before the page opens (e.g. to fake the GitHub API)
async function boot(b, { store = {}, time = '2026-10-28T10:00:00', vp = { width: 1280, height: 800 }, theme, sw = false, colorScheme, setup, rawStore = {} } = {}) {
  const c = await b.newContext({ viewport: vp, ...(sw ? {} : { serviceWorkers: 'block' }), ...(colorScheme ? { colorScheme } : {}) });
  if (setup) await setup(c);
  await c.addInitScript(([s, raw, th]) => {
    if (localStorage.getItem('__s')) return;
    localStorage.setItem('__s', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    for (const [k, v] of Object.entries(raw)) localStorage.setItem(k, v);
    if (th) localStorage.setItem('stt_theme', th);
  }, [store, rawStore, theme]);
  const p = await c.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|fonts|ERR_FAILED|404|401/.test(m.text())) p.errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  await p.clock.install({ time: new Date(time) });
  await p.goto(process.argv[2]); await p.waitForTimeout(700);
  p.ctx = c; return p;
}
const getDb = p => p.evaluate(() => JSON.parse(localStorage.getItem('stt_v1')));
const done = async b => { console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0); };
module.exports = { ok, boot, launch, done, seed, day, getDb };
