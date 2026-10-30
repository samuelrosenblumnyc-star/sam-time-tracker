// The yellow quote bar
const { ok, boot, launch, done } = require('./lib.js');
(async () => {
  const b = await launch();
  for (const [label, time, want, notWant] of [['Wednesday', '2026-10-28T10:00:00', 'Halfway through the week', 'Friday: the last'], ['Friday', '2026-10-30T10:00:00', 'Friday: the last', 'Halfway through'], ['Monday', '2026-10-26T10:00:00', null, 'Friday: the last']]) {
    const p = await boot(b, { time });
    const list = await p.evaluate(() => activeQuotes());
    ok(list.length >= 43, `${label}: ${list.length} lines in rotation`);
    if (want) ok(list.some(q => q.includes(want)), `${label}: includes "${want}"`);
    ok(!list.some(q => q.includes(notWant)), `${label}: leaves out "${notWant}"`);
    ok(new Set(list).size === list.length, `${label}: no duplicates`);
    await p.click('#quoteDisplay'); await p.waitForTimeout(900);
    ok((await p.textContent('#quoteDisplay')).length > 5 && p.errs.length === 0, `${label}: clicking shows the next line`);
    await p.ctx.close();
  }
  for (const w of [1280, 1100, 1024, 900]) {
    const p = await boot(b, { time: '2026-10-30T10:00:00', vp: { width: w, height: 800 } });
    const cut = await p.evaluate(() => { const el = document.getElementById('quoteDisplay'), bad = []; for (const q of activeQuotes()) { el.textContent = q; if (el.scrollHeight > el.clientHeight + 1) bad.push(q); } return bad; });
    ok(cut.length === 0, `every line fits in two lines at ${w}px wide${cut.length ? ' (cut: ' + cut.length + ')' : ''}`);
    await p.ctx.close();
  }
  await done(b);
})();
