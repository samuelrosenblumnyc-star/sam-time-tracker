// Extra features for the time tracker: undo/redo buttons, "what's unlogged?" gaps, a start/stop timer, recurring time
// blocks, the Summary tab (week/month grid + charts), automatic backups, reminders and the dark/light theme.
//
// Loaded after the main script. Everything here is optional: the main script only calls window.FEAT.* inside
// try/catch (featHook), so if this file is missing or breaks, the app works as before.
//
// Device-only settings (not synced): stt_theme, stt_timer, stt_remind_cfg, stt_reminded, stt_snapshots.
// Synced with the rest of the settings: config.recurring (the recurring blocks).
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const FEAT = window.FEAT = {};
  const el = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    if (props) Object.entries(props).forEach(([k, v]) => { if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e[k] = v; else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v); });
    kids.flat().forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  };
  const tStr = mins => fmtRange(mins);                               // 9:15 AM
  const hrsStr = h => `${fmtHrs(h)} h`;
  const MEETINGS = [['__meeting_int__', 'Standing Meeting (Internal)'], ['__meeting_cli__', 'Standing Meeting (Client)']];

  // Options for a "task" dropdown for a client: none, standing meetings, its open to-dos, saved "Other" tasks
  function taskOptions(client) {
    const opts = [['', '(no task)'], ...MEETINGS];
    clientTodos(client).filter(t => !t.done).forEach(t => opts.push([t.id, t.task]));
    getCustomTasks(client).forEach(t => opts.push(['__other__:' + t, t]));
    return opts;
  }
  const splitTask = v => v.startsWith('__other__:') ? { taskId: '__other__', otherText: v.slice(10) } : { taskId: v || null, otherText: '' };
  const joinTask = (taskId, otherText) => taskId === '__other__' ? '__other__:' + (otherText || '') : (taskId || '');
  function fillSelect(sel, opts, value) {
    sel.replaceChildren(...opts.map(([v, l]) => el('option', { value: v, text: l })));
    if (value !== undefined && [...sel.options].some(o => o.value === value)) sel.value = value;
  }
  const dayClients = () => getDay(currentDate).clients;

  // ══ Controls: undo / redo, gaps, timer ═══════════════════════════════════════════════════════
  const undoBtn = el('button', { class: 'ctrl-btn', id: 'undoBtn', title: 'Undo the last change (Ctrl/Cmd+Z)', onclick: () => undoStep('undo') }, '↶', el('span', { class: 'ctrl-lbl', text: ' Undo' }));
  const redoBtn = el('button', { class: 'ctrl-btn', id: 'redoBtn', title: 'Redo (Ctrl/Cmd+Shift+Z)', onclick: () => undoStep('redo') }, '↷', el('span', { class: 'ctrl-lbl', text: ' Redo' }));
  const gapBtn = el('button', { class: 'ctrl-btn', id: 'gapBtn', title: 'Show unlogged time between your first and last entries', onclick: () => toggleGaps() });
  const timerBtn = el('button', { class: 'ctrl-btn', id: 'timerBtn', onclick: () => timerClick() });
  const timerPanel = el('div', { class: 'ft-pop', id: 'timerPanel', hidden: true });
  const tools = el('span', { class: 'ft-tools', id: 'featTools' }, undoBtn, redoBtn, gapBtn, el('span', { class: 'ft-wrap' }, timerBtn, timerPanel));
  $('addClientForm').after(tools);
  const gapStrip = el('div', { id: 'gapStrip', hidden: true });
  $('controls').after(gapStrip);

  // The grid is as tall as the screen allows; tell the CSS how tall the controls (plus the gaps strip) are, so the Sums row never falls below the fold
  const syncCtlH = () => document.documentElement.style.setProperty('--ctl-h', ($('controls').offsetHeight + (gapStrip.hidden ? 0 : gapStrip.offsetHeight)) + 'px');
  if (window.ResizeObserver) { const ro = new ResizeObserver(syncCtlH); ro.observe($('controls')); ro.observe(gapStrip); }
  syncCtlH();

  FEAT.undoChanged = () => {
    undoBtn.disabled = !undoState.undo.length; redoBtn.disabled = !undoState.redo.length;
  };

  // ── Gaps ──
  let gapsOpen = false;
  function gapsOf(day) {
    const idx = Object.keys(day.blocks).map(slotIdx).sort((a, b) => a - b);
    if (idx.length < 2) return [];
    const have = new Set(idx), out = []; let cur = null;
    for (let i = idx[0] + 1; i < idx[idx.length - 1]; i++) {
      if (!have.has(i)) { if (cur) cur.to = i; else cur = { from: i, to: i }; }
      else if (cur) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out;
  }
  const gapLabel = g => `${tStr(SLOTS[g.from].mins)} – ${tStr(SLOTS[g.to].mins + 15)}`;
  function renderGaps(day) {
    const gaps = gapsOf(day), n = gaps.reduce((a, g) => a + g.to - g.from + 1, 0);
    gapBtn.className = 'ctrl-btn' + (gapsOpen && n ? ' ft-on' : '');
    gapBtn.replaceChildren(n ? `◌ ${gaps.length} gap${gaps.length > 1 ? 's' : ''}` : '◌ No gaps', el('span', { class: 'ctrl-lbl', text: n ? ` · ${hrsStr(n / 4)}` : ' ✓' }));
    document.querySelectorAll('#tbody td.gapcell').forEach(c => c.classList.remove('gapcell'));
    if (!gapsOpen || !n) { gapStrip.hidden = true; return; }
    const set = new Set(); gaps.forEach(g => { for (let i = g.from; i <= g.to; i++) set.add(SLOTS[i].time); });
    document.querySelectorAll('#tbody td.client-cell').forEach(c => { if (set.has(c.dataset.time)) c.classList.add('gapcell'); });
    const keep = gapStrip.querySelector('select')?.value;
    const sel = el('select', { id: 'gapClient', title: 'Client to fill the gaps with' }, day.clients.map(c => el('option', { value: c, text: c })));
    if (keep && day.clients.includes(keep)) sel.value = keep;
    gapStrip.replaceChildren(
      el('div', null, el('b', { text: `${n} unlogged slot${n > 1 ? 's' : ''} (${hrsStr(n / 4)}) ` }), `between ${tStr(SLOTS[slotIdx(Object.keys(day.blocks).sort()[0])].mins)} and ${tStr(SLOTS[slotIdx(Object.keys(day.blocks).sort().pop())].mins + 15)}`),
      el('div', { class: 'gap-chips' }, gaps.map(g => el('span', { class: 'gap-chip' },
        el('button', { title: 'Scroll to this gap', text: `${gapLabel(g)} · ${hrsStr((g.to - g.from + 1) / 4)}`, onclick: () => jumpToGap(g) }),
        el('button', { class: 'gap-add', title: 'Fill this gap with the client chosen below', text: '+', onclick: () => fillGaps(day, [g], sel.value) })))),
      el('div', { class: 'gap-fill' }, 'Fill with', sel, el('button', { class: 'ctrl-btn primary', text: 'Fill all gaps', onclick: () => fillGaps(day, gapsOf(day), sel.value) }), el('button', { class: 'ctrl-btn', text: 'Hide', onclick: () => toggleGaps(false) })));
    gapStrip.hidden = false;
  }
  function toggleGaps(force) {
    gapsOpen = force === undefined ? !gapsOpen : force;
    const day = getDay(currentDate);
    if (gapsOpen && !gapsOf(day).length) { toast('No gaps: everything between your first and last entry is logged.'); gapsOpen = false; }
    renderGaps(day);
  }
  function jumpToGap(g) {
    const row = document.querySelector(`#tbody tr[data-time="${SLOTS[g.from].time}"]`); if (!row) return;
    const wrap = $('tableWrap'); wrap.scrollTop = Math.max(0, row.offsetTop - wrap.clientHeight / 2);
    for (let i = g.from; i <= g.to; i++) { const r = document.querySelector(`#tbody tr[data-time="${SLOTS[i].time}"]`); if (r) { r.classList.add('gap-flash'); setTimeout(() => r.classList.remove('gap-flash'), 1500); } }
  }
  function fillGaps(day, gaps, client) {
    if (!client || !gaps.length) return;
    let n = 0; gaps.forEach(g => { for (let i = g.from; i <= g.to; i++) { if (!day.blocks[SLOTS[i].time]) { setBlock(day, SLOTS[i].time, client); n++; } } });
    afterBlockChange(day);
    toast(`Filled ${n} slot${n > 1 ? 's' : ''} (${hrsStr(n / 4)}) with ${client}.`, () => undoStep('undo'));
  }

  // ── Timer ──
  const TKEY = 'stt_timer';
  const timer = () => LS.get(TKEY, null);
  const pill = el('div', { id: 'timerPill' }, el('span', { id: 'timerPillTxt' }), el('button', { text: 'Stop', onclick: () => stopTimer() }));
  document.body.append(pill);
  const fmtElapsed = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
  function timerUI() {
    const t = timer();
    document.title = t ? `⏱ ${fmtElapsed(Date.now() - t.start)} ${t.client} · SAM TIME TRACKER` : 'SAM TIME TRACKER';
    if (!t) {
      timerBtn.className = 'ctrl-btn'; timerBtn.replaceChildren('⏱', el('span', { class: 'ctrl-lbl', text: ' Start timer' }));
      timerBtn.title = 'Start a timer for what you are working on now; Stop logs it in 15-minute slots';
      pill.classList.remove('show'); return;
    }
    timerBtn.className = 'ctrl-btn ft-run';
    timerBtn.replaceChildren(el('i', { class: 'ft-pulse' }), `${fmtElapsed(Date.now() - t.start)} `, el('span', { class: 'ctrl-lbl', text: `${t.client} · ■ Stop` }));
    timerBtn.title = `Stop the timer and log it (rounded to the nearest 15 minutes)`;
    $('timerPillTxt').textContent = `⏱ ${t.client} · ${fmtElapsed(Date.now() - t.start)}`;
    pill.classList.toggle('show', FEAT.tab !== 'tracker');
    timerPanel.hidden = true;
  }
  function timerClick() {
    if (timer()) { stopTimer(); return; }
    if (!timerPanel.hidden) { timerPanel.hidden = true; return; }
    const last = LS.get('stt_timer_last', null), clients = dayClients();
    const cSel = el('select'), tSel = el('select');
    fillSelect(cSel, clients.map(c => [c, c]), last?.client);
    const refresh = keep => fillSelect(tSel, taskOptions(cSel.value), keep);
    refresh(last && last.client === cSel.value ? joinTask(last.taskId, last.otherText) : '');
    cSel.onchange = () => refresh();
    if (!clients.length) { toast('Add a client to this day first.'); return; }
    timerPanel.replaceChildren(
      el('label', null, 'Client', cSel), el('label', null, 'Task (optional)', tSel),
      el('button', { class: 'ctrl-btn primary', text: '▶ Start', onclick: () => { const { taskId, otherText } = splitTask(tSel.value); startTimer(cSel.value, taskId, otherText); } }),
      el('small', { text: 'When you stop, the time is logged in 15-minute slots, rounded to the nearest slot. The timer keeps running if you close the page.' }));
    timerPanel.hidden = false;
  }
  function startTimer(client, taskId, otherText) {
    if (!client) return;
    LS.set(TKEY, { start: Date.now(), client, taskId: taskId || null, otherText: otherText || '' });
    LS.set('stt_timer_last', { client, taskId: taskId || null, otherText: otherText || '' });
    timerPanel.hidden = true; timerUI();
    toast(`Timer started for ${client}.`);
  }
  function stopTimer(discard) {
    const t = timer(); if (!t) return;
    try { localStorage.removeItem(TKEY); } catch { /* ignore */ }
    timerUI();
    if (discard) { toast('Timer discarded.'); return; }
    const end = Date.now(), s = new Date(t.start), e = new Date(end);
    if (end - t.start > 36 * 3600000) { toast('That timer ran over 36 hours, so it was not logged.'); return; }
    if (end < t.start) { toast('The clock went backwards, so that timer was not logged.'); return; }
    const plan = [];   // [date, startMin, endMin]
    let d = dateStr(s);
    const sm = s.getHours() * 60 + s.getMinutes(), em = e.getHours() * 60 + e.getMinutes();
    if (dateStr(e) === d) plan.push([d, sm, em]);
    else { plan.push([d, sm, 1440]); plan.push([dateStr(e), 0, em]); }
    let overwritten = 0, logged = 0, first = null;
    plan.forEach(([date, a, b]) => {
      let lo = Math.round(a / 15) * 15, hi = Math.round(b / 15) * 15;
      if (plan.length === 1 && hi <= lo) hi = lo + 15;         // anything shorter than half a slot still logs one slot
      lo = Math.min(lo, 1425); hi = Math.min(hi, 1440);
      if (hi <= lo) return;
      const day = getDay(date); if (!day.clients.includes(t.client)) day.clients.push(t.client);
      for (let m = lo; m < hi; m += 15) {
        const key = SLOTS[m / 15].time, old = day.blocks[key];
        if (old && (bClient(old) !== t.client || bTaskId(old) !== t.taskId)) overwritten++;
        setBlock(day, key, t.client, t.taskId, t.otherText); logged++;
      }
      autoFillDescs(day); first = first || { date, lo, hi };
    });
    if (!logged) { toast('Nothing to log.'); return; }
    dbSave();
    if (first.date !== currentDate) navTo(first.date); else refreshVisible();
    eggHook('logged');
    toast(`Logged ${hrsStr(logged / 4)} on ${t.client}${overwritten ? ` (replaced ${overwritten} slot${overwritten > 1 ? 's' : ''})` : ''}.`, () => undoStep('undo'));
  }
  pill.querySelector('button').after(el('button', { text: '✕', title: 'Discard this timer without logging', onclick: () => { if (confirm('Discard the running timer without logging it?')) stopTimer(true); } }));
  timerBtn.oncontextmenu = e => { if (timer()) { e.preventDefault(); if (confirm('Discard the running timer without logging it?')) stopTimer(true); } };
  setInterval(timerUI, 15000);
  document.addEventListener('click', e => { if (!timerPanel.hidden && !e.target.closest('.ft-wrap')) timerPanel.hidden = true; });

  // ══ Recurring time blocks ════════════════════════════════════════════════════════════════════
  // config.recurring: [{ id, label, client, taskId, otherText, start:'09:00', end:'09:15', days:[1..5], from:'YYYY-MM-DD', on }]
  // The first time a matching day is opened, empty slots get filled; the rule's id is then noted on that day (day.rec) so
  // anything you change or delete that day stays that way.
  const rules = () => (config.recurring = Array.isArray(config.recurring) ? config.recurring.filter(r => r && typeof r === 'object') : []);
  const slotTime = m => m >= 1440 ? '24:00' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const toMin = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
  function ruleApplies(r, date, day) {
    if (r.on === false || !day.clients.includes(r.client)) return false;
    if (date < (r.from || '0000-00-00')) return false;
    return (r.days || []).includes(new Date(date + 'T12:00:00').getDay());
  }
  function applyRulesTo(day, date) {
    if (!rules().length) return false;
    let changed = false;
    rules().forEach(r => {
      if (!ruleApplies(r, date, day) || (day.rec || []).includes(r.id)) return;
      const a = toMin(r.start), b = Math.min(1440, toMin(r.end));
      if (!(b > a)) return;
      for (let m = Math.floor(a / 15) * 15; m < b; m += 15) { const k = SLOTS[m / 15].time; if (!day.blocks[k]) setBlock(day, k, r.client, r.taskId || null, r.otherText || ''); }
      (day.rec = day.rec || []).push(r.id); changed = true;
    });
    return changed;
  }
  // Called by renderAll before drawing. Saved without a sync stamp: opening a day is not an "edit", and a stale phone
  // must never look newer than the Gist just because it filled a day in.
  FEAT.applyRecurring = day => { const changed = applyRulesTo(day, currentDate); if (changed) dbSave(false); return changed; };
  function reapplyToday() {
    const day = getDay(currentDate); day.rec = []; const changed = applyRulesTo(day, currentDate);
    if (changed) { autoFillDescs(day); dbSave(); refreshVisible(); toast('Recurring blocks applied to empty slots.'); } else toast('Nothing to add: those slots are already filled (or no rule matches this day).');
  }

  // Rule edits take effect when you go back to the tracker (so a half-set-up rule never fills today's grid while you're still typing it)
  let rulesDirty = false;
  const saveRules = () => { rulesDirty = true; configSave(); };
  function renderRecurringPanel() {
    const panel = $('recPanel'); if (!panel) return;
    const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const list = el('div');
    rules().forEach(r => {
      const bad = toMin(r.end) <= toMin(r.start);
      const name = el('input', { type: 'text', class: 'rec-name', value: r.label || '', placeholder: 'Name (e.g. Standup)', onchange: e => { r.label = e.target.value.trim(); saveRules(); } });
      const cSel = el('select', { onchange: e => { r.client = e.target.value; r.taskId = null; r.otherText = ''; saveRules(); renderRecurringPanel(); } });
      fillSelect(cSel, [...new Set([...config.defaultClients, ...(r.client ? [r.client] : [])])].map(c => [c, c]), r.client);
      const tSel = el('select', { onchange: e => { const t = splitTask(e.target.value); r.taskId = t.taskId; r.otherText = t.otherText; saveRules(); } });
      fillSelect(tSel, (r.client ? taskOptions(r.client) : [['', '(no task)']]).filter(o => !o[0] || o[0].startsWith('__')), joinTask(r.taskId, r.otherText));
      const st = el('input', { type: 'time', step: 900, value: r.start, onchange: e => { r.start = e.target.value || r.start; if (toMin(r.end) <= toMin(r.start)) r.end = slotTime(toMin(r.start) + 15); saveRules(); renderRecurringPanel(); } });
      const en = el('input', { type: 'time', step: 900, value: r.end === '24:00' ? '23:59' : r.end, class: bad ? 'rec-bad' : '', onchange: e => { r.end = e.target.value || r.end; saveRules(); renderRecurringPanel(); } });
      const days = el('span', { class: 'rec-days' }, DAYS.map((d, i) => el('button', { type: 'button', class: (r.days || []).includes(i) ? 'on' : '', title: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i], text: d, onclick: () => {
        const set = new Set(r.days || []); set.has(i) ? set.delete(i) : set.add(i); r.days = [...set].sort(); saveRules(); renderRecurringPanel(); } })));
      const on = el('label', { class: 'rec-note' }, el('input', { type: 'checkbox', checked: r.on !== false, onchange: e => { r.on = e.target.checked; saveRules(); renderRecurringPanel(); } }), ' On');
      const del = el('button', { class: 'ctrl-btn danger', text: 'Delete', onclick: () => { config.recurring = rules().filter(x => x !== r); saveRules(); renderRecurringPanel(); toast(`Deleted “${r.label || 'recurring block'}”. Blocks it already filled stay.`, () => undoStep('undo')); } });
      list.append(el('div', { class: 'rec-rule' + (r.on === false ? ' off' : '') },
        el('div', { class: 'rec-row' }, name, on, del),
        el('div', { class: 'rec-row' }, cSel, tSel),
        el('div', { class: 'rec-row' }, st, '–', en, days),
        bad ? el('div', { class: 'rec-note', text: 'End time must be after the start time.' }) : null));
    });
    if (!rules().length) list.append(el('p', { class: 'settings-desc', text: 'No recurring blocks yet. Add one and it fills in automatically on the days you choose.' }));
    panel.replaceChildren(
      el('h2', { text: 'Recurring Time Blocks' }),
      el('p', { class: 'settings-desc', text: 'e.g. “Standup, 9:00–9:15, Mon–Fri”. The first time you open a matching day, its empty slots are filled in. Change or delete them that day and they stay changed. Only affects days from today on.' }),
      list,
      el('div', { class: 'settings-actions' },
        el('button', { class: 'ctrl-btn primary', text: '+ Add recurring block', onclick: () => {
          const client = config.defaultClients[0]; if (!client) { toast('Add a client first.'); return; }
          rules().push({ id: uid(), label: 'Standup', client, taskId: '__meeting_int__', otherText: '', start: '09:00', end: '09:15', days: [1, 2, 3, 4, 5], from: todayStr(), on: true });
          saveRules(); renderRecurringPanel();
        } }),
        el('button', { class: 'ctrl-btn', text: 'Apply to the day shown now', title: 'Fill this day’s empty slots from the rules', onclick: reapplyToday })));
  }

  // ══ Summary tab ══════════════════════════════════════════════════════════════════════════════
  const PALETTE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#ca8a04', '#9333ea', '#64748b'];
  const colorMemo = {};
  function colorOf(name) {
    if (colorMemo[name]) return colorMemo[name];
    const i = config.defaultClients.indexOf(name);
    return colorMemo[name] = PALETTE[(i >= 0 ? i : [...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALETTE.length];
  }
  const sum = { mode: 'week', anchor: null };
  const mondayOf = date => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dateStr(d); };
  function periodDays() {
    const a = sum.anchor || currentDate;
    if (sum.mode === 'week') { const m = mondayOf(a); return Array.from({ length: 7 }, (_, i) => offsetDate(m, i)); }
    const d = new Date(a + 'T12:00:00'), n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), p = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-`;
    return Array.from({ length: n }, (_, i) => p + pad(i + 1));
  }
  function hoursFor(date) {      // { client: hours } for one day
    const out = {}, day = db[date]; if (!day) return out;
    Object.values(day.blocks).forEach(b => { const c = bClient(b); if (c) out[c] = (out[c] || 0) + 0.25; });
    return out;
  }
  function donutSvg(items, total) {
    const R = 70, C = 2 * Math.PI * R; let off = 0;
    const segs = items.map(it => { const len = total ? it.hrs / total * C : 0, s = `<circle r="${R}" cx="95" cy="95" fill="none" stroke="${it.color}" stroke-width="26" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 95 95)"><title>${esc(it.name)}: ${fmtHrs(it.hrs)} h</title></circle>`; off += len; return s; }).join('');
    return `<svg viewBox="0 0 190 190" role="img" aria-label="Hours by client"><circle r="${R}" cx="95" cy="95" fill="none" stroke="var(--f-surface2)" stroke-width="26"/>${segs}<text x="95" y="96" text-anchor="middle" class="donut-total">${fmtHrs(total)}</text><text x="95" y="113" text-anchor="middle" class="donut-sub">hours</text></svg>`;
  }
  function renderSummary() {
    const host = $('summarySection'); if (!host) return;
    const days = periodDays(), today = todayStr(), perDay = days.map(hoursFor);
    const byClient = {}; perDay.forEach(m => Object.entries(m).forEach(([c, h]) => { byClient[c] = (byClient[c] || 0) + h; }));
    const order = [...config.defaultClients, ...Object.keys(byClient).filter(c => !config.defaultClients.includes(c))];
    const clients = order.filter(c => byClient[c] > 0), total = clients.reduce((a, c) => a + byClient[c], 0);
    const fmtD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const label = sum.mode === 'week' ? `${fmtD(days[0])} – ${fmtD(days[6])}, ${days[6].slice(0, 4)}` : new Date(days[0] + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const step = dir => { const a = sum.anchor || currentDate; sum.anchor = sum.mode === 'week' ? offsetDate(a, 7 * dir) : (() => { const d = new Date(a + 'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth() + dir); return dateStr(d); })(); renderSummary(); };
    const bar = el('div', { class: 'sum-bar' },
      el('button', { class: 'ctrl-btn', text: '←', title: 'Previous', onclick: () => step(-1) }),
      el('span', { class: 'sum-period', text: label }),
      el('button', { class: 'ctrl-btn', text: '→', title: 'Next', onclick: () => step(1) }),
      el('button', { class: 'ctrl-btn', text: sum.mode === 'week' ? 'This week' : 'This month', onclick: () => { sum.anchor = today; renderSummary(); } }),
      el('span', { class: 'sum-seg' }, ['week', 'month'].map(m => el('button', { class: sum.mode === m ? 'on' : '', text: m === 'week' ? 'Week' : 'Month', onclick: () => { sum.mode = m; renderSummary(); } }))),
      el('span', { class: 'rec-note', text: total ? `${fmtHrs(total)} h logged` : '' }));

    // Grid: clients down, days across
    const head = el('tr', null, el('th', { class: 'sum-name', text: 'Client' }), days.map((d, i) => {
      const dt = new Date(d + 'T12:00:00'), wk = dt.getDay() === 0 || dt.getDay() === 6;
      return el('th', { class: (d === today ? 'is-today ' : '') + (wk ? 'wk' : '') }, el('button', { title: `Open ${fmtDay(d)}`, onclick: () => { navTo(d); showTab('tracker'); } },
        sum.mode === 'week' ? dt.toLocaleDateString('en-US', { weekday: 'short' }) : String(dt.getDate()), sum.mode === 'week' ? el('br') : null, sum.mode === 'week' ? String(dt.getDate()) : null));
    }), el('th', { class: 'tot', text: 'Total' }));
    const rows = clients.map(c => el('tr', null,
      el('td', { class: 'sum-name', title: c }, el('i', { class: 'sw', style: `background:${colorOf(c)}` }), c),
      days.map((d, i) => { const h = perDay[i][c] || 0, wk = [0, 6].includes(new Date(d + 'T12:00:00').getDay()); return el('td', { class: (h ? 'clk ' : 'zero ') + (wk ? 'wk ' : '') + (d === today ? 'is-today' : ''), text: h ? fmtHrs(h) : '·', onclick: h ? () => { navTo(d); showTab('tracker'); } : null }); }),
      el('td', { class: 'tot', text: fmtHrs(byClient[c]) })));
    const foot = el('tr', null, el('td', { class: 'sum-name', text: 'Total' }), perDay.map(m => { const t = Object.values(m).reduce((a, b) => a + b, 0); return el('td', { class: t ? '' : 'zero', text: t ? fmtHrs(t) : '·' }); }), el('td', { class: 'tot', text: fmtHrs(total) }));
    const grid = clients.length ? el('div', { class: 'sum-scroll' }, el('table', { class: 'sum-grid' }, el('thead', null, head), el('tbody', null, rows), el('tfoot', null, foot))) : el('p', { class: 'sum-empty', text: 'Nothing logged in this period.' });

    // Charts
    const items = clients.map(c => ({ name: c, hrs: byClient[c], color: colorOf(c) })).sort((a, b) => b.hrs - a.hrs);
    const legend = el('div', { class: 'legend' }, items.map(it => el('div', null, el('i', { class: 'sw', style: `background:${it.color}` }), el('span', { class: 'nm', title: it.name, text: it.name }), el('span', { class: 'v', text: `${fmtHrs(it.hrs)} h · ${Math.round(it.hrs / total * 100)}%` }))));
    const donut = el('div', { class: 'donut-wrap' }); donut.innerHTML = donutSvg(items, total); donut.append(legend);
    // Bars: per day (week) or per week (month)
    let cols;
    if (sum.mode === 'week') cols = days.map((d, i) => ({ label: new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d.slice(8).replace(/^0/, ''), today: d === today, parts: perDay[i] }));
    else {
      const wks = {}; days.forEach((d, i) => { const k = mondayOf(d); const w = wks[k] ||= { label: `${fmtD(k < days[0] ? days[0] : k)}`, today: false, parts: {} }; if (days.includes(today) && mondayOf(today) === k) w.today = true; Object.entries(perDay[i]).forEach(([c, h]) => { w.parts[c] = (w.parts[c] || 0) + h; }); });
      cols = Object.values(wks).map(w => ({ ...w, label: 'Week of ' + w.label }));
    }
    const colTot = cols.map(c => Object.values(c.parts).reduce((a, b) => a + b, 0)), maxH = Math.max(8, ...colTot);
    const bars = el('div', { class: 'bars' }, cols.map((c, i) => el('div', { class: 'bar-col' + (c.today ? ' is-today' : ''), title: `${c.label}: ${fmtHrs(colTot[i])} h` },
      el('div', { class: 'bar-val', text: colTot[i] ? fmtHrs(colTot[i]) : '' }),
      el('div', { class: 'bar-stack', style: `height:${colTot[i] / maxH * 100 * 0.78}%` }, order.filter(n => c.parts[n]).map(n => el('i', { style: `height:${c.parts[n] / colTot[i] * 100}%;background:${colorOf(n)}`, title: `${n}: ${fmtHrs(c.parts[n])} h` }))),
      el('div', { class: 'bar-lbl', text: c.label }))));
    const charts = total ? el('div', { class: 'sum-charts' }, donut, bars) : el('p', { class: 'sum-empty', text: 'Charts appear once you log some time.' });

    // Burn-rate groups for the period's month
    const kids = [bar, el('div', { class: 'sum-card' }, el('h2', {}, 'Hours by client and day', el('small', { text: 'tap a day or number to open it' })), grid),
      el('div', { class: 'sum-card' }, el('h2', {}, sum.mode === 'week' ? 'Where the week went' : 'Where the month went', el('small', { text: sum.mode === 'week' ? 'bars: hours per day' : 'bars: hours per week' })), charts)];
    const groups = config.burnRates.map(g => ({ g, h: g.clients.reduce((a, c) => a + (byClient[c] || 0), 0) })).filter(x => x.h > 0);
    if (groups.length) kids.push(el('div', { class: 'sum-card' }, el('h2', {}, 'By burn rate group', el('small', { text: 'this ' + sum.mode })),
      el('div', { class: 'sum-pace' }, groups.map(({ g, h }) => el('div', { class: 'pc' }, el('b', {}, el('span', { text: g.label }), el('span', { text: `${fmtHrs(h)} h` })), sum.mode === 'month' ? el('span', { class: 'rec-note', text: `${Math.round(h / g.target * 100)}% of ${g.target} h target` }) : null)))));
    host.replaceChildren(...kids);
  }
  FEAT.summary = renderSummary;

  // ══ Automatic backups ════════════════════════════════════════════════════════════════════════
  // Snapshots of everything (time, to-dos, saved tasks, settings), kept on this device: one each day you open the app,
  // plus one before a synced copy replaces your data or you restore a backup. The newest 10 are kept.
  const SNAP_KEY = 'stt_snapshots', SNAP_MAX = 10, SNAP_BYTES = 1.8e6;   // browsers allow ~5 MB in all; the live data must always fit
  const snaps = () => { const s = LS.get(SNAP_KEY, []); return Array.isArray(s) ? s.filter(x => x && typeof x.data === 'string') : []; };
  const sigOf = () => JSON.stringify([db, todos, customTasks, config]);
  // Per-device switch (stored as plain text on this device only). Off = no automatic backups here; "Back up now" and the safety copy before a restore still work.
  const autoBackupOn = () => { try { return localStorage.getItem('stt_backups_auto') !== 'off'; } catch { return true; } };
  const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return str.length + ':' + h; };
  function snapshot(reason, manual) {
    try {
      if (!manual && !autoBackupOn()) return false;
      const list = snaps(), sig = hash(sigOf()), last = list[list.length - 1];
      if (!Object.keys(db).length && !Object.keys(todos).length) return false;           // nothing worth keeping
      if (last && last.sig === sig) return false;                                          // identical to the newest copy
      list.push({ at: new Date().toISOString(), reason, sig, data: packAllData(), days: Object.keys(db).filter(d => Object.keys(db[d].blocks).length).length, entries: dataSize({ stt_v1: db, stt_todos: todos }) });
      while (list.length > SNAP_MAX) list.shift();
      while (list.length > 1 && JSON.stringify(list).length > SNAP_BYTES) list.shift();
      for (let i = 0; i < 4 && !LS.set(SNAP_KEY, list); i++) { if (list.length < 2) return false; list.shift(); }
      return true;
    } catch (e) { console.warn('snapshot', e); return false; }
  }
  // Called when a save fails because storage is full: drop the oldest backup (keeping at least the newest). True if space was freed.
  FEAT.freeSpace = () => { const l = snaps(); if (l.length < 2) return false; l.shift(); return LS.set(SNAP_KEY, l) || true; };
  FEAT.snapshot = reason => snapshot(reason || 'automatic');   // used by the sync code before it replaces your data
  function dailySnapshot() {
    if (!autoBackupOn()) return;
    const last = snaps().pop(), today = todayStr();
    if (!last || !(last.at && dateStr(new Date(last.at)) === today)) snapshot('automatic (daily)');
  }
  function restoreSnapshot(s) {
    const when = new Date(s.at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    if (!confirm(`Restore everything from the backup of ${when}?\n\nYour current data is backed up first, and the restored data is then uploaded to your Gist.`)) return;
    let d; try { d = JSON.parse(s.data); } catch { toast('That backup is damaged.'); return; }
    snapshot('before restoring a backup', true);
    if (isObj(d.stt_v1)) db = cleanDb(d.stt_v1);
    if (isObj(d.stt_todos)) todos = cleanTodos(d.stt_todos);
    if (isObj(d.stt_custom)) customTasks = cleanCustom(d.stt_custom);
    if (cleanConfig(d.stt_config)) config = d.stt_config;
    dbSave(false); todosSave(false); customSave(false); configSave(false);
    markLocalChange(); undoReset(); refreshVisible();
    toast(`Restored the backup from ${when}.`);
  }
  function renderBackupPanel() {
    const panel = $('backupPanel'); if (!panel) return;
    const list = snaps().reverse();
    panel.replaceChildren(
      el('h2', { text: 'Automatic Backups' }),
      el('p', { class: 'settings-desc', text: `When on, a copy of all your data is saved on this device once a day, and before synced data replaces it. The last ${SNAP_MAX} are kept, so a bad edit or sync can always be rolled back. This switch is for this device only.` }),
      el('label', { class: 'ft-switch' }, el('input', { type: 'checkbox', checked: autoBackupOn(), onchange: e => {
        try { localStorage.setItem('stt_backups_auto', e.target.checked ? 'on' : 'off'); } catch { /* ignore */ }
        if (e.target.checked) dailySnapshot();
        toast(e.target.checked ? 'Automatic backups are on for this device.' : 'Automatic backups are off for this device. "Back up now" still works.'); renderBackupPanel(); } }), 'Keep automatic backups on this device'),
      el('div', { class: 'ft-list' }, list.length ? list.map(s => el('div', { class: 'ft-item' },
        el('div', { class: 'grow' }, new Date(s.at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), el('small', { text: `${s.reason} · ${s.days} day${s.days === 1 ? '' : 's'} logged, ${s.entries} entries` })),
        el('button', { class: 'ctrl-btn', text: 'Restore…', onclick: () => restoreSnapshot(s) }))) : el('p', { class: 'settings-desc', text: 'No backups yet.' })),
      el('div', { class: 'settings-actions' }, snaps().length ? el('button', { class: 'ctrl-btn danger', text: 'Delete backups on this device', onclick: () => { if (confirm('Delete all automatic backups saved on this device? Your actual time and to-dos are not affected.')) { try { localStorage.removeItem(SNAP_KEY); } catch { /* ignore */ } toast('Backups deleted.'); renderBackupPanel(); } } }) : null, el('button', { class: 'ctrl-btn primary', text: 'Back up now', onclick: () => { toast(snapshot('manual', true) ? 'Backed up.' : 'Nothing has changed since the last backup.'); renderBackupPanel(); } })));
  }

  // ══ Reminders ════════════════════════════════════════════════════════════════════════════════
  const RCFG = 'stt_remind_cfg', RSEEN = 'stt_reminded';
  const rcfg = () => Object.assign({ todos: true, hours: true, hoursAt: '16:30', hoursUnder: 6, digestAt: '09:00' }, LS.get(RCFG, {}));
  const stack = el('div', { id: 'remindStack' }); $('appTabBar').after(stack);   // fixed top-right on wide screens; an in-page banner under the tabs on phones
  function notify(title, body, tag, actions) {
    const card = el('div', { class: 'remind-card' }, el('b', { text: title }), body, el('div', { class: 'remind-actions' },
      ...(actions || []).map(([l, f]) => el('button', { class: 'primary', text: l, onclick: () => { f(); card.remove(); } })), el('button', { text: 'Dismiss', onclick: () => card.remove() })));
    stack.append(card);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const opts = { body, tag, icon: 'icons/icon.svg' };
        if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => new Notification(title, opts));
        else new Notification(title, opts);
      }
    } catch { /* notifications are optional */ }
  }
  function remindCheck() {
    const c = rcfg(), now = new Date(), today = dateStr(now), mins = now.getHours() * 60 + now.getMinutes();
    let seen = LS.get(RSEEN, {}); if (!isObj(seen)) seen = {};
    Object.keys(seen).forEach(k => { if (seen[k] < offsetDate(today, -3)) delete seen[k]; });
    const once = key => { if (seen[key]) return false; seen[key] = today; return true; };
    if (c.todos) {
      const open = [];
      allTodoGroups().forEach(g => clientTodos(g).forEach(t => { if (!t.done) open.push({ ...t, g }); }));
      // a to-do with a time: ping when that time comes (for up to 6 hours after)
      open.filter(t => t.dueDate === today && t.dueTime).forEach(t => {
        const at = toMin(t.dueTime);
        if (mins >= at && mins - at < 360 && once('t:' + t.id)) notify('To-do due now', `${t.task} (${t.g}) · ${tStr(at)}`, 't' + t.id, [['Open to-dos', () => showTab('todos')]]);
      });
      // the rest: one digest each morning
      if (mins >= toMin(c.digestAt) && mins < toMin(c.digestAt) + 360 && once('digest')) {
        const due = open.filter(t => t.dueDate === today && !t.dueTime), late = open.filter(t => t.dueDate && t.dueDate < today);
        if (due.length || late.length) notify('To-dos today', [due.length ? `${due.length} due today` : '', late.length ? `${late.length} overdue` : ''].filter(Boolean).join(', ') + '.', 'digest', [['Open to-dos', () => showTab('todos')]]);
      }
    }
    if (c.hours && now.getDay() % 6 !== 0 && mins >= toMin(c.hoursAt) && mins < toMin(c.hoursAt) + 120 && once('hours')) {
      const logged = calcTotals(getDay(today)).grand;
      if (logged < c.hoursUnder) notify('Time check', `You've logged ${fmtHrs(logged)} of 8 hours today. Anything missing?`, 'hours', [['Show gaps', () => { navTo(today); showTab('tracker'); toggleGaps(true); }]]);
    }
    LS.set(RSEEN, seen);
  }
  FEAT.remindCheck = remindCheck;
  function renderRemindPanel() {
    const panel = $('remindPanel'); if (!panel) return;
    const c = rcfg(), save = patch => { LS.set(RCFG, { ...rcfg(), ...patch }); };
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    panel.replaceChildren(
      el('h2', { text: 'Reminders' }),
      el('p', { class: 'settings-desc', text: 'Gentle nudges while the app is open. Turn on notifications to also get them when the app is in another tab or window. (iPhone only allows notifications for apps added to the Home Screen, and they can’t arrive when the app is fully closed.)' }),
      el('label', { class: 'ft-switch' }, el('input', { type: 'checkbox', checked: c.todos, onchange: e => save({ todos: e.target.checked }) }), 'Remind me when a to-do is due (at its time, or a morning summary for ones without a time)'),
      el('label', { class: 'ft-switch' }, el('input', { type: 'checkbox', checked: c.hours, onchange: e => save({ hours: e.target.checked }) }),
        'On weekdays at ', el('input', { type: 'time', value: c.hoursAt, onchange: e => save({ hoursAt: e.target.value || '16:30' }), style: 'font-size:13px;padding:3px 5px' }),
        ', remind me if I’ve logged under ', el('input', { type: 'number', min: 1, max: 8, step: 0.5, value: c.hoursUnder, style: 'width:56px;font-size:13px;padding:3px 5px', onchange: e => save({ hoursUnder: +e.target.value || 6 }) }), ' hours'),
      el('div', { class: 'settings-actions' },
        perm === 'granted' ? el('span', { class: 'rec-note', text: '✓ Notifications are allowed on this device.' })
          : perm === 'denied' ? el('span', { class: 'rec-note', text: 'Notifications are blocked for this site. Allow them in your browser’s site settings.' })
          : perm === 'unsupported' ? el('span', { class: 'rec-note', text: 'This browser doesn’t support notifications. In-app reminders still work.' })
          : el('button', { class: 'ctrl-btn primary', text: 'Allow notifications', onclick: () => { try { const r = Notification.requestPermission(renderRemindPanel); if (r && r.then) r.then(renderRemindPanel); } catch { renderRemindPanel(); } } }),
        el('button', { class: 'ctrl-btn', text: 'Send a test', onclick: () => notify('Test reminder', 'This is what a reminder looks like.', 'test') })));
  }

  // ══ Theme (light / dark / automatic) ═════════════════════════════════════════════════════════
  const themePref = () => { try { return localStorage.getItem('stt_theme') || 'auto'; } catch { return 'auto'; } };   // stored as plain text; index.html reads it before the page paints
  const mql = matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const pref = themePref(), dark = pref === 'dark' || (pref === 'auto' && mql.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0f1b2b' : '#1b3a5c');
  }
  mql.addEventListener?.('change', applyTheme);
  function renderThemePanel() {
    const panel = $('themePanel'); if (!panel) return;
    const pref = themePref();
    panel.replaceChildren(el('h2', { text: 'Appearance' }), el('p', { class: 'settings-desc', text: 'Light, dark, or follow your device. Stored on this device only.' }),
      el('span', { class: 'seg-theme' }, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => el('button', { class: pref === v ? 'on' : '', text: l, onclick: () => { try { localStorage.setItem('stt_theme', v); } catch { /* ignore */ } applyTheme(); renderThemePanel(); } }))));
  }

  // ══ Settings panels, tab tracking, hooks ═════════════════════════════════════════════════════
  const container = document.querySelector('.settings-panels');
  [['recPanel', () => $('syncPanel')], ['remindPanel', null], ['backupPanel', null], ['themePanel', null]].forEach(([id, before]) => {
    const p = el('div', { class: 'settings-panel', id });
    if (before) before().before(p); else container.append(p);
  });
  FEAT.settings = () => { renderRecurringPanel(); renderRemindPanel(); renderBackupPanel(); renderThemePanel(); };
  FEAT.tab = activeTab();
  FEAT.tabChanged = tab => { if (tab === 'tracker' && rulesDirty) { rulesDirty = false; renderAll(); }
    if (tab === 'summary' && FEAT.tab !== 'summary') sum.anchor = null; FEAT.tab = tab; timerUI(); };
  FEAT.render = day => { renderGaps(day || getDay(currentDate)); };

  // Start-up (the main script already drew once, before this file loaded)
  applyTheme();
  dailySnapshot();
  FEAT.undoChanged(); timerUI();
  refreshVisible();
  remindCheck(); setInterval(remindCheck, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { timerUI(); remindCheck(); } });
  setInterval(dailySnapshot, 3600000);
})();
