// Easter eggs and seasonal decorations for the time tracker.
//
// Loaded after the main script. Everything here is optional: the main script only calls window.EGGS.* inside
// try/catch (eggHook), so if this file is missing or breaks, the app works exactly the same.
//
// Ground rules: each surprise is small, dismissible and shown at most once per day (or month); none of them ever
// blocks a tap or a scroll; people with "reduce motion" turned on get still pictures; and nothing here is part of
// the synced data (the "already seen" notes live only on this device).
(function () {
  'use strict';

  // ── Preferences, once-per-day bookkeeping ────────────────────
  const PREF_KEY = 'stt_fun';
  function prefs() {
    try { return Object.assign({ eggs: true, season: true }, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); }
    catch { return { eggs: true, season: true }; }
  }
  function setPref(k, v) { const p = prefs(); p[k] = v; try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* ignore */ } }
  const eggsOn = () => prefs().eggs;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // claim('name', stamp): true the first time this name is seen with this stamp (a date or a month), false after
  function claim(name, stamp) {
    const k = 'stt_egg_' + name;
    try { if (localStorage.getItem(k) === stamp) return false; localStorage.setItem(k, stamp); } catch { /* private mode: allow */ }
    return true;
  }
  const todayStamp = () => todayStr();

  // ── Styles ───────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
  .egg-pop { display: flex; align-items: center; gap: 12px; width: max-content; max-width: 100%; color: #f3f0ff;
    background: linear-gradient(180deg, var(--egg-a, #1e1b3a), var(--egg-b, #14122b)); padding: 8px 10px 8px 8px; border-radius: 14px;
    border: 1px solid var(--egg-edge, #3b3566); box-shadow: 0 12px 32px rgba(10, 8, 30, .45);
    transform: translateY(-24px); opacity: 0; pointer-events: none; transition: opacity .25s, transform .3s cubic-bezier(.2,.9,.3,1.2); }
  .egg-pop.show { opacity: 1; transform: none; pointer-events: auto; }
  .egg-art { width: 120px; height: 90px; flex-shrink: 0; border-radius: 9px; overflow: hidden; background: #2a2650; }
  .egg-art svg { display: block; width: 100%; height: 100%; }
  .egg-text { font-size: 14px; font-weight: bold; line-height: 1.3; }
  .egg-sub { font-size: 12px; font-weight: normal; color: #c9c4f2; margin-top: 3px; line-height: 1.3; }
  .egg-x { background: none; border: none; color: #a8a2d6; font-size: 14px; cursor: pointer; padding: 4px 6px; border-radius: 6px; align-self: flex-start; }
  .egg-x:hover { color: #fff; background: rgba(255,255,255,.1); }
  @media (max-width: 640px) { .egg-art { width: 96px; height: 72px; } }

  #eggConfetti { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 940; }

  /* flame next to a burn rate box that has reached its target */
  .burn-flame { display: inline-block; width: 13px; height: 15px; margin-left: 5px; vertical-align: -2px; }
  .burn-flame.over { width: 15px; height: 17px; }

  /* the title easter egg */
  #topbar h1.egg-silly { animation: eggSpin .7s ease; }
  @keyframes eggSpin { from { transform: rotateX(0); } to { transform: rotateX(360deg); } }
  #topbar h1 .egg-clock { display: inline-block; width: 15px; height: 15px; margin-left: 6px; vertical-align: -3px; }
  @media (max-width: 640px) { #topbar h1.egg-silly { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }

  /* chasing the red line */
  #nowTag { pointer-events: auto; }
  .egg-sprite { position: absolute; pointer-events: none; z-index: 2; }
  .egg-sprite svg { display: block; width: 100%; height: 100%; }
  #nowLine.egg-chase { filter: drop-shadow(0 0 4px rgba(220,38,38,.9)); }

  /* Konami: retro mode */
  html.egg-retro body, html.egg-retro button, html.egg-retro input, html.egg-retro select, html.egg-retro textarea { font-family: "Courier New", Courier, monospace !important; }
  html.egg-retro body { background: #05060a; filter: contrast(1.18) saturate(1.9) hue-rotate(-12deg); image-rendering: pixelated; }
  html.egg-retro #topbar, html.egg-retro thead th, html.egg-retro tfoot td { background: #000 !important; color: #39ff14 !important; border-color: #14532d !important; text-shadow: 0 0 6px #39ff14; }
  html.egg-retro td { border-color: #12331f !important; }
  html.egg-retro td.client-cell.sel { background: #ff2bd6 !important; border-color: #ff2bd6 !important; box-shadow: 0 0 8px #ff2bd6; }
  html.egg-retro .seg-lbl, html.egg-retro .cell-lbl { color: #000 !important; }
  html.egg-retro #tableWrap, html.egg-retro #descSection, html.egg-retro #burnSection { background: #0a0f0a !important; color: #39ff14; }
  html.egg-retro .burn-fill { background: #ff2bd6 !important; }
  html.egg-retro .burn-track { background: #12331f !important; }
  #eggScan { position: fixed; inset: 0; pointer-events: none; z-index: 960; opacity: .35;
    background: repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) 2px, rgba(0,0,0,.55) 3px); }

  /* seasonal decorations */
  #seasonLayer { position: fixed; inset: 0; pointer-events: none; z-index: 210; }
  #seasonLayer .pumpkin { position: absolute; bottom: calc(3px + env(safe-area-inset-bottom, 0px)); width: 38px; opacity: .95; }
  #seasonLayer .pumpkin.l { left: 6px; }
  #seasonLayer .pumpkin.r { right: 6px; transform: scaleX(-1); }
  #seasonLayer .web { position: absolute; top: 0; width: 84px; height: 84px; opacity: .5; }
  @media (max-width: 640px) { #seasonLayer .pumpkin { width: 28px; left: 4px; } #seasonLayer .pumpkin.r { left: auto; right: 4px; } #seasonLayer .web { width: 60px; height: 60px; opacity: .4; } }
  #seasonLayer .web.l { left: 0; }
  #seasonLayer .web.r { right: 0; transform: scaleX(-1); }
  #seasonLayer canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  #seasonLayer .heart { position: absolute; bottom: -24px; width: 18px; height: 16px; opacity: 0; animation: eggHeart 7s ease-in forwards; }
  @keyframes eggHeart { 0% { transform: translateY(0) scale(.7); opacity: 0; } 12% { opacity: .75; } 100% { transform: translateY(-105vh) translateX(var(--dx, 20px)) scale(1.1); opacity: 0; } }
  `;
  document.head.appendChild(css);

  // ── Pop-ups ──────────────────────────────────────────────────
  // They stack under the header (shared with the graveyard pop-up). At most two show at once; if more
  // surprises coincide, the rest wait their turn.
  const MAX_SHOWING = 2, waiting = [];
  function drain() {
    const stack = document.getElementById('eggStack');
    while (waiting.length && stack && stack.querySelectorAll('.egg-pop').length < MAX_SHOWING) pop(waiting.shift());
  }
  function pop(opts) {
    const { art, text, sub = '', colors = ['#1e1b3a', '#14122b'], edge = '#3b3566', ms = 6500 } = opts;
    const stack = document.getElementById('eggStack');
    if (!stack) return null;
    if (stack.querySelectorAll('.egg-pop').length >= MAX_SHOWING) { waiting.push(opts); return null; }
    const el = document.createElement('div');
    el.className = 'egg-pop'; el.setAttribute('role', 'status');
    el.style.setProperty('--egg-a', colors[0]); el.style.setProperty('--egg-b', colors[1]); el.style.setProperty('--egg-edge', edge);
    el.innerHTML = '<div class="egg-art"></div><div><div class="egg-text"></div><div class="egg-sub"></div></div><button class="egg-x" aria-label="Dismiss" title="Dismiss">✕</button>';
    el.querySelector('.egg-art').innerHTML = art;
    el.querySelector('.egg-text').textContent = text;
    el.querySelector('.egg-sub').textContent = sub;
    stack.append(el);
    const svg = el.querySelector('svg');
    if (reduced() && svg && svg.pauseAnimations) { svg.setCurrentTime(3); svg.pauseAnimations(); }   // still picture
    let t = null;
    const hide = () => { clearTimeout(t); el.classList.remove('show'); setTimeout(() => { el.remove(); drain(); }, 350); };
    el.addEventListener('click', hide);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    t = setTimeout(hide, ms);
    return el;
  }

  // ── Artwork (inline SVG with built-in animation) ─────────────
  let gradId = 0;
  const gid = () => 'eg' + (++gradId);
  const wrap = (bg, inner, defs = '') => `<svg viewBox="0 0 96 72" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}<rect width="96" height="72" fill="${bg}"/>${inner}</svg>`;
  const star = (x, y, r, d) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".8"><animate attributeName="opacity" values=".25;1;.25" dur="${d}s" repeatCount="indefinite"/></circle>`;
  const sparkle = (x, y, s, begin) => `<g transform="translate(${x} ${y})"><g><animateTransform attributeName="transform" type="scale" values="0;${s};0" dur="1.3s" begin="${begin}s" repeatCount="indefinite"/><path d="M0 -4 L1 -1 L4 0 L1 1 L0 4 L-1 1 L-4 0 L-1 -1Z" fill="#fde68a"/></g></g>`;

  const ART = {
    // 8 hours logged: a clock that gets a green tick
    clock() {
      return wrap('#1d2b53', `
        ${star(12, 9, 1, 2.1)}${star(84, 12, 1.2, 1.7)}${star(8, 40, .9, 2.6)}
        <g transform="translate(46 37)"><g>
          <animateTransform attributeName="transform" type="scale" values=".4;1.1;1" keyTimes="0;.6;1" dur=".55s" fill="freeze"/>
          <circle r="22" fill="#fff8e1" stroke="#fbbf24" stroke-width="4"/>
          <path d="M0 -18v3M18 0h-3M0 18v-3M-18 0h3" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
          <path d="M0 0V-14M0 0L-8 4.6" stroke="#92400e" stroke-width="3" stroke-linecap="round"/><circle r="2" fill="#92400e"/>
        </g></g>
        <g transform="translate(69 55)"><circle r="11" fill="#16a34a" stroke="#fff" stroke-width="2"/>
          <path d="M-5 0l4 4 7-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="20" stroke-dashoffset="20">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur=".4s" begin=".45s" fill="freeze"/></path></g>
        ${sparkle(20, 18, 1, 0.2)}${sparkle(76, 22, .8, 0.7)}${sparkle(24, 58, .9, 1.0)}`);
    },
    // a burn rate group reached (or went over) its monthly target
    flame(over) {
      const k = over ? 1.28 : 1;
      return wrap(over ? '#2d1220' : '#2b1630', `
        ${star(12, 10, 1, 2.3)}${star(82, 14, 1.1, 1.8)}${star(86, 44, .8, 2.9)}
        <g transform="translate(48 62)">
          <g><animateTransform attributeName="transform" type="scale" values="${k} ${k};${k * 1.06} ${k * .94};${k * .96} ${k * 1.07};${k} ${k}" dur=".7s" repeatCount="indefinite"/>
            <path d="M0 -44 C6 -32 18 -26 16 -12 C15 -4 8 0 0 0 C-8 0 -15 -4 -16 -12 C-18 -24 -6 -30 0 -44Z" fill="${over ? '#dc2626' : '#f97316'}"/>
            <path d="M0 -30 C4 -22 11 -18 10 -9 C9 -3 5 0 0 0 C-5 0 -9 -3 -10 -9 C-11 -17 -3 -21 0 -30Z" fill="${over ? '#f97316' : '#fbbf24'}"/>
            <path d="M0 -16 C2 -11 6 -9 5 -4 C4 -1 2 0 0 0 C-2 0 -4 -1 -5 -4 C-6 -9 -2 -11 0 -16Z" fill="#fef3c7"/>
          </g>
          <rect x="-19" y="-1" width="38" height="6" rx="3" fill="#7c4a1e" transform="rotate(7)"/><rect x="-19" y="-1" width="38" height="6" rx="3" fill="#92400e" transform="rotate(-7)"/>
          ${[[-6, 1.6, 1.0, 0], [5, 1.3, 1.2, .4], [0, 1.1, 1.4, .8], [9, 1.2, 1.1, 1.1]].map(([x, r, d, b]) =>
            `<circle cx="${x}" cy="-24" r="${r}" fill="#fcd34d" opacity="0"><animateMotion path="M0 0 Q${x > 0 ? 6 : -6} -16 ${x > 0 ? 3 : -3} -30" dur="${d}s" begin="${b}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="${d}s" begin="${b}s" repeatCount="indefinite"/></circle>`).join('')}
        </g>`);
    },
    // overdue list cleared
    trophy() {
      return wrap('#2e1f5e', `
        ${star(12, 10, 1, 2.2)}${star(84, 10, 1.2, 1.9)}${star(10, 52, .9, 2.7)}
        <g transform="translate(48 34)"><g>
          <animateTransform attributeName="transform" type="translate" values="0 -26;0 3;0 -2;0 0" keyTimes="0;.55;.8;1" dur=".6s" fill="freeze"/>
          <path d="M-14 -17 C-25 -17 -24 -2 -12 0" stroke="#d97706" stroke-width="3.2" fill="none" stroke-linecap="round"/>
          <path d="M14 -17 C25 -17 24 -2 12 0" stroke="#d97706" stroke-width="3.2" fill="none" stroke-linecap="round"/>
          <path d="M-14 -20 H14 V-6 C14 6 7 12 0 12 C-7 12 -14 6 -14 -6Z" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
          <path d="M0 -13l2.2 4.6 5 .7-3.6 3.5.9 5L0 -2l-4.5 2.4.9-5-3.6-3.5 5-.7Z" fill="#fff8e1"/>
          <rect x="-3" y="12" width="6" height="9" fill="#d97706"/><rect x="-11" y="21" width="22" height="6" rx="2" fill="#92400e"/>
        </g></g>
        ${sparkle(22, 22, 1.1, 0.5)}${sparkle(74, 18, 1, 0.9)}${sparkle(70, 52, .9, 0.2)}${sparkle(26, 54, .8, 1.1)}`);
    },
    // first time logged in a new month
    calendar(mon) {
      return wrap('#12363f', `
        ${star(10, 10, 1, 2.0)}${star(86, 12, 1, 2.4)}${star(84, 58, 1.1, 1.6)}
        <g transform="translate(48 38)"><g>
          <animateTransform attributeName="transform" type="scale" values=".3;1.08;1" keyTimes="0;.6;1" dur=".5s" fill="freeze"/>
          <rect x="-24" y="-24" width="48" height="48" rx="5" fill="#f8fafc"/>
          <path d="M-24 -19a5 5 0 0 1 5-5h38a5 5 0 0 1 5 5v8h-48z" fill="#ef4444"/>
          <rect x="-14" y="-29" width="4" height="9" rx="2" fill="#94a3b8"/><rect x="10" y="-29" width="4" height="9" rx="2" fill="#94a3b8"/>
          <text x="0" y="-14.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="8.5" fill="#fff">${mon}</text>
          <g transform="translate(0 12)"><g><animateTransform attributeName="transform" type="scale" values="0;1.25;1" keyTimes="0;.6;1" dur=".5s" begin=".3s" fill="freeze"/>
            <text x="0" y="0" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="26" fill="#0f172a">1</text></g></g>
        </g></g>
        ${sparkle(16, 20, 1, 0.5)}${sparkle(80, 30, .9, 1.0)}${sparkle(20, 56, .8, 0.2)}`);
    },
    // logging time before 8 AM: a rooster crowing at sunrise
    rooster() {
      const sky = gid();
      return wrap('#2b2468', `
        <rect width="96" height="72" fill="url(#${sky})"/>
        <g transform="translate(24 50)"><g>
          <animateTransform attributeName="transform" type="translate" from="0 28" to="0 0" dur="1.5s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".2 .7 .3 1"/>
          <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="16s" repeatCount="indefinite"/>
            ${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -16V-21" stroke="#fde68a" stroke-width="2" stroke-linecap="round" transform="rotate(${a})"/>`).join('')}</g>
          <circle r="12.5" fill="#fde68a"/>
        </g></g>
        <path d="M0 57 Q22 47 44 56 T96 55 V72 H0Z" fill="#2f5d34"/>
        <path d="M0 63 Q30 55 60 62 T96 61 V72 H0Z" fill="#244a2a"/>
        <rect x="44" y="57" width="52" height="3.6" rx="1" fill="#a3703a"/>
        <rect x="64" y="46" width="9" height="24" rx="1.5" fill="#8b5a2b"/>
        <path d="M75 36 C84 36 91 28 89 15 C85 24 80 28 74 31Z" fill="#0f766e"/>
        <path d="M75 38 C86 40 94 33 94 22 C89 29 83 33 74 35Z" fill="#1d4ed8"/>
        <path d="M75 34 C82 30 85 22 82 13 C80 21 77 26 73 29Z" fill="#c2410c"/>
        <path d="M65 44V46.6M71 44V46.6" stroke="#f59e0b" stroke-width="1.7" stroke-linecap="round"/>
        <ellipse cx="68" cy="37" rx="9.5" ry="8" fill="#c2410c"/>
        <ellipse cx="62.5" cy="39" rx="5" ry="6" fill="#f59e0b"/>
        <path d="M64 36 C70 32 77 36 75 42 C70 44 65 42 64 36Z" fill="#92400e"/>
        <g>
          <animateTransform attributeName="transform" type="rotate" values="0 63 32;-17 63 32;-17 63 32;0 63 32" keyTimes="0;.22;.82;1" dur="1.5s" begin="1.3s" repeatCount="2" fill="freeze"/>
          <path d="M60 38 C58 33 58 29 60 26 L66 28 C66 32 66 35 66 38Z" fill="#c2410c"/>
          <circle cx="60" cy="24" r="5.2" fill="#c2410c"/>
          <circle cx="58.2" cy="19.4" r="1.9" fill="#dc2626"/><circle cx="60.4" cy="18.4" r="1.9" fill="#dc2626"/><circle cx="62.6" cy="19.6" r="1.9" fill="#dc2626"/>
          <path d="M55.4 23.2 L50 24.6 L55.4 25.8Z" fill="#facc15"/>
          <g><animateTransform attributeName="transform" type="rotate" values="0 55.4 26.2;26 55.4 26.2;4 55.4 26.2;26 55.4 26.2;4 55.4 26.2;26 55.4 26.2;0 55.4 26.2" dur="1.5s" begin="1.3s" repeatCount="2" fill="freeze"/>
            <path d="M55.4 26.2 L50.8 27.8 L55.6 28.6Z" fill="#eab308"/></g>
          <ellipse cx="57.6" cy="29.2" rx="1.5" ry="2.4" fill="#dc2626"/>
          <circle cx="58.6" cy="23" r="1.1" fill="#111"/>
        </g>
        ${[['M46 21 Q42.5 25 46 29', 1.45, 1.4], ['M41 17.5 Q35 25 41 32.5', 1.6, 1.4], ['M36 14 Q28 25 36 36', 1.75, 1.4]].map(([d, b, w]) =>
          `<path d="${d}" stroke="#fff" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;.95;0" dur="1.5s" begin="${b}s" repeatCount="2"/></path>`).join('')}`,
        `<linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2468"/><stop offset=".55" stop-color="#e4694f"/><stop offset="1" stop-color="#fbbf24"/></linearGradient>`);
    },
    // Friday, nearly clock-out time: someone tiptoeing out the door
    door() {
      return wrap('#2d2a5a', `
        ${star(70, 9, 1, 2.2)}${star(88, 20, 1, 1.8)}${star(56, 16, .9, 2.8)}
        <rect x="0" y="62" width="96" height="10" fill="#1b1940"/>
        <rect x="8" y="8" width="29" height="54" fill="#fde68a" stroke="#a8a2d6" stroke-width="2"/>
        <path d="M37 10 L74 3 L74 69 L37 60Z" fill="#fde68a" opacity="0"><animate attributeName="opacity" values="0;.28" dur=".6s" begin=".35s" fill="freeze"/></path>
        <g transform="translate(9 9)"><g>
          <animateTransform attributeName="transform" type="scale" values="1 1;.16 1" dur=".7s" begin=".3s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 0 .3 1"/>
          <rect width="27" height="52" fill="#a16207"/><rect x="3" y="4" width="21" height="19" rx="1.5" fill="#b9791a"/><rect x="3" y="27" width="21" height="21" rx="1.5" fill="#b9791a"/>
          <circle cx="22" cy="28" r="1.8" fill="#fde68a"/>
        </g></g>
        <g transform="translate(22 62)" opacity="0"><animate attributeName="opacity" from="0" to="1" dur=".01s" begin=".85s" fill="freeze"/><g>
          <animateTransform attributeName="transform" type="translate" values="0 0;56 0" dur="2.8s" begin=".95s" fill="freeze"/>
          <g><animateTransform attributeName="transform" type="rotate" values="-24 0 -16;24 0 -16;-24 0 -16" dur=".55s" begin=".95s" repeatCount="5"/><path d="M0 -16L0 0" stroke="#e5e7eb" stroke-width="2.6" stroke-linecap="round"/></g>
          <g><animateTransform attributeName="transform" type="rotate" values="24 0 -16;-24 0 -16;24 0 -16" dur=".55s" begin=".95s" repeatCount="5"/><path d="M0 -16L0 0" stroke="#9ca3af" stroke-width="2.6" stroke-linecap="round"/></g>
          <rect x="-7" y="-30" width="5.5" height="12" rx="2" fill="#ef4444"/>
          <path d="M0 -16 L0 -29" stroke="#e5e7eb" stroke-width="3" stroke-linecap="round"/>
          <path d="M0 -26 L5 -21 L7 -25" stroke="#e5e7eb" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="0" cy="-34" r="4.6" fill="#fcd34d"/><circle cx="1.6" cy="-34.6" r=".8" fill="#111"/>
        </g></g>
        <g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.8;1" dur="2.4s" begin="1.5s" fill="freeze"/>
          <rect x="46" y="6" width="24" height="12" rx="6" fill="#fff"/><path d="M50 18l-3 5 7-4z" fill="#fff"/>
          <text x="58" y="15" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="8" fill="#334155">shh…</text></g>`);
    },
    // working on a weekend: reclining under an umbrella, drifting off
    lounge() {
      return wrap('#38bdf8', `
        <g transform="translate(14 13)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="18s" repeatCount="indefinite"/>
          ${[0, 60, 120, 180, 240, 300].map(a => `<path d="M0 -9V-13" stroke="#fef08a" stroke-width="2" stroke-linecap="round" transform="rotate(${a})"/>`).join('')}</g>
          <circle r="7" fill="#fde047"/></g>
        <rect x="0" y="59" width="96" height="13" fill="#fcd34d"/>
        <rect x="63" y="22" width="2" height="38" fill="#78350f"/>
        <path d="M45 27 C45 11 83 11 83 27Z" fill="#ef4444"/>
        <path d="M58 13.2 C56 18 55.5 23 55 27 H73 C72.5 23 72 18 70 13.2 C67 12.6 61 12.6 58 13.2Z" fill="#fff"/>
        <path d="M23 38 L35 56 H62" stroke="#0ea5e9" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M62 56 L65 60" stroke="#0369a1" stroke-width="3" stroke-linecap="round"/><path d="M35 56 L33 60" stroke="#0369a1" stroke-width="3" stroke-linecap="round"/>
        <path d="M31 40 L40 53" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>
        <path d="M41 53 H58 L61 59" stroke="#fbbf24" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <g><animateTransform attributeName="transform" type="rotate" values="0 28 38;7 28 38;0 28 38" dur="2.2s" repeatCount="indefinite"/>
          <circle cx="28" cy="35" r="4.4" fill="#fcd34d"/><path d="M26 35h4" stroke="#78350f" stroke-width="1.3" stroke-linecap="round"/><path d="M24.2 33.4h7.6" stroke="#1e293b" stroke-width="1.4" stroke-linecap="round"/></g>
        <g transform="rotate(-14 48 49)"><rect x="42" y="46" width="13" height="7" rx="1" fill="#475569"/><rect x="43.2" y="46.8" width="10.6" height="4.6" fill="#93c5fd"/></g>
        ${[['z', 36, 28, 0, 9], ['Z', 42, 20, .8, 11], ['Z', 49, 12, 1.6, 13]].map(([ch, x, y, b, fs]) =>
          `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-weight="bold" font-size="${fs}" fill="#fff" opacity="0">${ch}<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${b}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 4;0 -4" dur="2.4s" begin="${b}s" repeatCount="indefinite"/></text>`).join('')}`);
    },
    // noon: a sandwich slides along a little timeline
    sandwich() {
      return wrap('#1f2a44', `
        ${[10, 20, 30, 40, 50, 60].map(y => `<path d="M0 ${y}H96" stroke="#2e3b5c" stroke-width="1"/>`).join('')}
        <text x="4" y="9" font-family="Arial, sans-serif" font-size="6" fill="#7f8db3">12 PM</text><text x="4" y="29" font-family="Arial, sans-serif" font-size="6" fill="#4d5b82">:15</text>
        <g><animateTransform attributeName="transform" type="translate" values="-24 38;120 38" dur="3.4s" repeatCount="indefinite"/>
          <g><animateTransform attributeName="transform" type="rotate" values="-5;5;-5" dur=".5s" repeatCount="indefinite"/>
            <rect x="-15" y="2" width="30" height="6.5" rx="3.2" fill="#e0a64f"/>
            <path d="M-14 1H14L11 4H-11Z" fill="#facc15"/>
            <ellipse cx="-6" cy="-1" rx="5.5" ry="2.2" fill="#ef4444"/><ellipse cx="6" cy="-1" rx="5.5" ry="2.2" fill="#ef4444"/>
            <path d="M-16 -2q3 -4.5 6.4 0t6.4 0 6.4 0 6.4 0 6.4 0" stroke="#22c55e" stroke-width="3.2" fill="none" stroke-linecap="round"/>
            <path d="M-15 -5C-15 -19 15 -19 15 -5Z" fill="#f2c27b"/>
            <circle cx="-5" cy="-9" r="1.2" fill="#111"/><circle cx="5" cy="-9" r="1.2" fill="#111"/><path d="M-3 -6q3 3 6 0" stroke="#111" stroke-width="1.1" fill="none" stroke-linecap="round"/>
          </g></g>`);
    },
    // typing "coffee": a steaming mug
    mug() {
      return wrap('#3d2b1f', `
        <ellipse cx="46" cy="62" rx="26" ry="5" fill="#2a1d14"/>
        ${[[38, 0], [46, .5], [54, .9]].map(([x, b]) =>
          `<path d="M${x} 36 q-4 -6 0 -12 t0 -12" stroke="#f1e9e2" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;.85;0" dur="2s" begin="${b}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -8" dur="2s" begin="${b}s" repeatCount="indefinite"/></path>`).join('')}
        <path d="M60 42 q11 0 11 9 t-11 9" stroke="#f8fafc" stroke-width="4.2" fill="none" stroke-linecap="round"/>
        <path d="M30 38 H62 V54 C62 62 56 64 46 64 C36 64 30 62 30 54Z" fill="#f8fafc"/>
        <ellipse cx="46" cy="38.5" rx="16" ry="3.6" fill="#7a4a24"/><ellipse cx="46" cy="38.2" rx="13" ry="2.4" fill="#9a6130"/>
        <path d="M37 50l4 4-4 4M55 50l-4 4 4 4" stroke="#cbd5e1" stroke-width="0" fill="none"/>
        <path d="M40 48q6 5 12 0" stroke="#94a3b8" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="41.5" cy="46.5" r="1.2" fill="#475569"/><circle cx="50.5" cy="46.5" r="1.2" fill="#475569"/>`);
    },
    // Konami code: a pixel invader
    invader() {
      const f1 = ['..x.....x..', '...x...x...', '..xxxxxxx..', '.xx.xxx.xx.', 'xxxxxxxxxxx', 'x.xxxxxxx.x', 'x.x.....x.x', '...xx.xx...'];
      const f2 = ['..x.....x..', 'x..x...x..x', 'x.xxxxxxx.x', 'xxx.xxx.xxx', 'xxxxxxxxxxx', '.xxxxxxxxx.', '..x.....x..', '.x.......x.'];
      const draw = f => f.flatMap((row, y) => [...row].map((c, x) => c === 'x' ? `<rect x="${x * 5}" y="${y * 5}" width="5.2" height="5.2"/>` : '')).join('');
      return wrap('#000', `
        <g fill="#39ff14" transform="translate(20.5 16)">
          <g><animate attributeName="visibility" values="visible;hidden" dur=".7s" calcMode="discrete" repeatCount="indefinite"/>${draw(f1)}</g>
          <g visibility="hidden"><animate attributeName="visibility" values="hidden;visible" dur=".7s" calcMode="discrete" repeatCount="indefinite"/>${draw(f2)}</g>
        </g>
        <text x="48" y="64" text-anchor="middle" font-family="Courier New, monospace" font-weight="bold" font-size="7" fill="#ff2bd6">1UP  x30</text>`);
    },
    // little sprites for chasing the red line
    runner() {
      return `<svg viewBox="0 0 26 32" aria-hidden="true">
        <g transform="translate(13 30)">
          <g><animateTransform attributeName="transform" type="rotate" values="-35 0 -13;35 0 -13;-35 0 -13" dur=".42s" repeatCount="indefinite"/><path d="M0 -13L0 0" stroke="#1b3a5c" stroke-width="2.6" stroke-linecap="round"/></g>
          <g><animateTransform attributeName="transform" type="rotate" values="35 0 -13;-35 0 -13;35 0 -13" dur=".42s" repeatCount="indefinite"/><path d="M0 -13L0 0" stroke="#3b6ea5" stroke-width="2.6" stroke-linecap="round"/></g>
          <path d="M0 -13V-24" stroke="#1b3a5c" stroke-width="3.2" stroke-linecap="round"/>
          <g><animateTransform attributeName="transform" type="rotate" values="50 0 -22;-50 0 -22;50 0 -22" dur=".42s" repeatCount="indefinite"/><path d="M0 -22L0 -13" stroke="#3b6ea5" stroke-width="2.4" stroke-linecap="round"/></g>
          <circle cx="1.5" cy="-27.5" r="4" fill="#fcd34d"/>
        </g></svg>`;
    },
    fleeingClock() {
      return `<svg viewBox="0 0 26 32" aria-hidden="true">
        <g transform="translate(13 30)">
          <g><animateTransform attributeName="transform" type="rotate" values="-35 0 -9;35 0 -9;-35 0 -9" dur=".34s" repeatCount="indefinite"/><path d="M0 -9L0 0" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/></g>
          <g><animateTransform attributeName="transform" type="rotate" values="35 0 -9;-35 0 -9;35 0 -9" dur=".34s" repeatCount="indefinite"/><path d="M0 -9L0 0" stroke="#dc2626" stroke-width="2.2" stroke-linecap="round"/></g>
          <circle cy="-18" r="9" fill="#fff8e1" stroke="#dc2626" stroke-width="2.4"/><path d="M0 -18V-23M0 -18L4 -16" stroke="#7f1d1d" stroke-width="1.8" stroke-linecap="round"/>
        </g></svg>`;
    },
    smallClock() {
      return `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="#fff" stroke-width="1.8"/>
        <path d="M8 4.2V8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="1s" repeatCount="indefinite"/></path>
        <path d="M8 8L10.6 9.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="6s" repeatCount="indefinite"/></path></svg>`;
    },
    flameIcon(over) {
      return `<svg class="burn-flame${over ? ' over' : ''}" viewBox="-17 -46 34 48" aria-hidden="true"><title>${over ? 'Over target' : 'Target reached'}</title>
        <path d="M0 -44 C6 -32 18 -26 16 -12 C15 -4 8 0 0 0 C-8 0 -15 -4 -16 -12 C-18 -24 -6 -30 0 -44Z" fill="${over ? '#dc2626' : '#f97316'}"/>
        <path d="M0 -30 C4 -22 11 -18 10 -9 C9 -3 5 0 0 0 C-5 0 -9 -3 -10 -9 C-11 -17 -3 -21 0 -30Z" fill="${over ? '#f97316' : '#fbbf24'}"/></svg>`;
    },
    // seasonal
    pumpkin() {
      return `<svg viewBox="0 0 60 52" aria-hidden="true">
        <path d="M30 10c-1-5 2-8 6-9" stroke="#3f7a2a" stroke-width="4" fill="none" stroke-linecap="round"/>
        <ellipse cx="17" cy="31" rx="14" ry="19" fill="#ea7a12"/><ellipse cx="43" cy="31" rx="14" ry="19" fill="#ea7a12"/>
        <ellipse cx="30" cy="31" rx="15" ry="20" fill="#f58a1f"/>
        <path d="M30 12c-5 8-5 30 0 38M20 15c-6 9-6 27 0 35M40 15c6 9 6 27 0 35" stroke="#c4620b" stroke-width="1.4" fill="none"/>
        <g fill="#2b1a08"><path d="M19 27l7 3-7 4z"/><path d="M41 27l-7 3 7 4z"/><path d="M20 40l4 -3 3 3 3-3 3 3 3-3 4 3-4 5-3-3-3 3-3-3-3 3z"/></g>
        <g fill="#fde047" opacity=".9"><path d="M20.5 29l3.5 1.5-3.5 2z"/><path d="M39.5 29l-3.5 1.5 3.5 2z"/><animate attributeName="opacity" values=".5;1;.6;1" dur="1.6s" repeatCount="indefinite"/></g>
      </svg>`;
    },
    web() {
      return `<svg viewBox="0 0 96 96" aria-hidden="true" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round">
        <path d="M0 0L88 0M0 0L84 36M0 0L66 66M0 0L36 84M0 0L0 88"/>
        <path d="M22 0Q20 18 0 22M44 0Q40 36 0 44M66 0Q60 54 0 66M86 0Q80 72 0 86" />
        <path d="M60 0V30" stroke-width=".9"><animate attributeName="d" values="M60 0V30;M60 0V36;M60 0V30" dur="3s" repeatCount="indefinite"/></path>
        <g><animateTransform attributeName="transform" type="translate" values="0 0;0 6;0 0" dur="3s" repeatCount="indefinite"/>
          <circle cx="60" cy="33" r="3.2" fill="#111" stroke="none"/>
          <path d="M57 31L53 28M57 33L52 33M57 35L53 38M63 31L67 28M63 33L68 33M63 35L67 38" stroke="#111" stroke-width="1"/></g>
      </svg>`;
    },
    heart() {
      return `<svg viewBox="0 0 20 18" aria-hidden="true"><path d="M10 17C-6 7 2 -3 10 4C18 -3 26 7 10 17Z" fill="#f472b6"/></svg>`;
    },
  };

  // ── Confetti ─────────────────────────────────────────────────
  function confetti() {
    if (reduced()) return;
    const cv = document.createElement('canvas'); cv.id = 'eggConfetti';
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#a855f7', '#fde047', '#ec4899'];
    const bits = Array.from({ length: 130 }, (_, i) => ({
      x: Math.random() * W, y: -20 - Math.random() * H * 0.45, vx: (Math.random() - 0.5) * 2.2, vy: 2 + Math.random() * 3.2,
      w: 6 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      c: colors[i % colors.length], sway: Math.random() * 6.28,
    }));
    const t0 = performance.now();
    (function frame(t) {
      const dt = t - t0;
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const b of bits) {
        b.x += b.vx + Math.sin(b.sway + dt / 400) * 0.7; b.y += b.vy; b.r += b.vr;
        if (b.y < H + 20) alive++;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c;
        ctx.globalAlpha = Math.max(0, Math.min(1, (4200 - dt) / 900));
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore();
      }
      if (dt < 4200 && alive) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  // ── The surprises ────────────────────────────────────────────
  const monthShort = d => new Date(d + '-01T12:00:00').toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const monthLong = d => new Date(d + '-01T12:00:00').toLocaleString('en-US', { month: 'long' });

  function eightHours() {
    confetti();
    pop({ art: ART.clock(), text: 'Done. Go home.', sub: '8.0 hours logged.', colors: ['#1d2b53', '#111a3a'], edge: '#34457d' });
  }
  function burnFull(g, over) {
    pop({
      art: ART.flame(over),
      text: over ? `${g.label} is over target.` : `${g.label}: ${fmtHrs(g.target)}/${fmtHrs(g.target)}. Fully burned.`,
      sub: over ? "Slow down, that's a bonfire." : 'Monthly target reached.',
      colors: over ? ['#3a1526', '#240d19'] : ['#35193a', '#1f0f24'], edge: over ? '#7a2b49' : '#5b2b66',
    });
  }
  const inboxZero = () => pop({ art: ART.trophy(), text: 'Inbox zero energy.', sub: 'Nothing overdue.', colors: ['#2e1f5e', '#1c1240'], edge: '#4b3a8f' });
  const freshMonth = month => pop({ art: ART.calendar(monthShort(month)), text: 'Fresh month, fresh burn.', sub: `${monthLong(month)} starts with empty bars.`, colors: ['#12363f', '#0b2128'], edge: '#245866' });
  const earlyBird = () => pop({ art: ART.rooster(), text: 'Early bird, huh?', sub: 'Logging time before 8 AM.', colors: ['#3a2a63', '#241a45'], edge: '#5c4a93' });
  const weekendWarrior = dow => pop({ art: ART.lounge(), text: 'Weekend warrior.', sub: `Working on a ${dow === 6 ? 'Saturday' : 'Sunday'}.`, colors: ['#0e4a6b', '#0a3550'], edge: '#1b6a94' });
  const lunchTime = () => pop({ art: ART.sandwich(), text: 'Lunch?', sub: "It's noon. The timeline can wait.", colors: ['#1f2a44', '#141c30'], edge: '#34456d' });
  function fridayExit(now) {
    const left = 17 * 60 - (now.getHours() * 60 + now.getMinutes());
    pop({
      art: ART.door(), colors: ['#2d2a5a', '#1d1b40'], edge: '#4a4690',
      text: left > 0 ? `Weekend in ${left} min.` : "Clock out. It's the weekend.",
      sub: left > 0 ? 'Shh… tiptoe toward the door.' : 'You made it.',
    });
  }
  const coffeeBreak = () => pop({ art: ART.mug(), text: 'Coffee break?', sub: 'The header jokes are caffeinated today.', colors: ['#3d2b1f', '#271b13'], edge: '#5e4430' });

  const COFFEE_QUOTES = [
    'Coffee first. Then hours.',
    'I tracked my time: 40% working, 60% getting coffee to work.',
    'Espresso yourself. Then log it.',
    'Decaf is just a rumor.',
    'Behind every logged quarter-hour is a cup of coffee.',
    "It's not procrastination, it's brewing time.",
    'Every great timesheet starts with a strong cup.',
    'Latte be honest, those hours are not going to log themselves.',
    "Coffee: because 'billable' needs fuel.",
    'May your coffee be strong and your Mondays short.',
    'Running on caffeine and 0.25-hour increments.',
    'A day without coffee is like... just kidding, I have no idea.',
  ];
  const coffeeDay = () => { try { return localStorage.getItem('stt_egg_coffeeday') === todayStamp(); } catch { return false; } };

  // ── Watching what you do (called from the main script) ───────
  const S = { date: null, total: 0, early: 0, slots: 0, burn: {}, monthHad: false };
  const earlyCount = day => Object.keys(day.blocks).filter(t => t < '08:00').length;
  const monthHasTime = month => Object.keys(db).some(d => d.startsWith(month) && Object.keys(db[d].blocks || {}).length);
  const burnHours = () => {
    const m = {};
    calcMonthlyHours().forEach(g => { m[g.id || g.label] = g.hours; });
    return m;
  };
  function snapshot() {
    const day = getDay(currentDate);
    S.date = currentDate; S.total = calcTotals(day).grand; S.early = earlyCount(day); S.slots = Object.keys(day.blocks).length;
    S.burn = burnHours(); S.monthHad = monthHasTime(currentDate.slice(0, 7));
  }

  function decorateBurn() {
    const data = calcMonthlyHours();
    document.querySelectorAll('#burnSection .burn-card').forEach(card => {
      const g = data[+card.dataset.i]; if (!g || !(g.hours >= g.target)) return;
      const name = card.querySelector('.burn-card-label strong');
      if (name && !name.querySelector('.burn-flame')) name.insertAdjacentHTML('beforeend', ART.flameIcon(g.hours > g.target));
    });
  }

  function logged() {
    if (!eggsOn()) { snapshot(); return; }
    if (S.date !== currentDate) { snapshot(); return; }
    const date = currentDate, day = getDay(date), month = date.slice(0, 7), now = new Date();

    // 8 hours
    const total = calcTotals(day).grand;
    if (S.total < 8 && total >= 8 && claim('eight', date)) eightHours();

    // a burn rate group reaches / passes its target (once per group per month)
    const hours = burnHours();
    config.burnRates.forEach(g => {
      const id = g.id || g.label, prev = S.burn[id] || 0, cur = hours[id] || 0;
      if (cur > g.target && prev <= g.target) { claim('burnFull_' + id, month); if (claim('burnOver_' + id, month)) burnFull(g, true); }
      else if (cur >= g.target && prev < g.target && claim('burnFull_' + id, month)) burnFull(g, false);
    });

    // first time logged this month
    if (!S.monthHad && monthHasTime(month) && claim('month', month)) freshMonth(month);

    // time logged before 8 AM
    if (earlyCount(day) > S.early && claim('early', todayStamp())) earlyBird();

    // logging on a weekend
    const dow = now.getDay();
    if ((dow === 0 || dow === 6) && Object.keys(day.blocks).length > S.slots && claim('weekend', todayStamp())) weekendWarrior(dow);

    snapshot();
  }

  function todoToggle({ was, now }) {
    if (eggsOn() && was > 0 && now === 0 && claim('inbox', todayStamp())) inboxZero();
  }

  function clockEggs() {
    if (!eggsOn()) return;
    const d = new Date(), h = d.getHours(), m = d.getMinutes();
    if (h === 12 && claim('lunch', todayStamp())) lunchTime();
    if (d.getDay() === 5 && ((h === 16 && m >= 45) || h === 17) && claim('friday', todayStamp())) fridayExit(d);
  }

  // ── Hidden interactions ──────────────────────────────────────
  const typingInField = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

  // Konami code → retro mode for a few seconds
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let konamiAt = 0, retroTimer = null;
  function retro() {
    pop({ art: ART.invader(), text: 'CHEAT ACTIVATED', sub: '+30 lives. Retro mode for 8 seconds.', colors: ['#06130a', '#000'], edge: '#14532d', ms: 5000 });
    if (reduced()) return;
    document.documentElement.classList.add('egg-retro');
    let scan = document.getElementById('eggScan');
    if (!scan) { scan = document.createElement('div'); scan.id = 'eggScan'; document.body.appendChild(scan); }
    clearTimeout(retroTimer);
    retroTimer = setTimeout(() => { document.documentElement.classList.remove('egg-retro'); scan.remove(); }, 8000);
  }

  // type "coffee" on the timesheet
  let typed = '', typedAt = 0;
  function coffee() {
    try { localStorage.setItem('stt_egg_coffeeday', todayStamp()); } catch { /* ignore */ }
    coffeeBreak();
    if (typeof showNextQuote === 'function') showNextQuote(false);
  }

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || !eggsOn() || typingInField(e)) return;
    const k = e.key.toLowerCase();
    // Konami
    konamiAt = k === KONAMI[konamiAt] ? konamiAt + 1 : (k === KONAMI[0] ? 1 : 0);
    if (konamiAt === KONAMI.length) { konamiAt = 0; retro(); return; }
    // coffee (only on the Time Tracker tab)
    if (/^[a-z]$/.test(k) && document.getElementById('tab-tracker')?.classList.contains('active')) {
      const now = Date.now();
      typed = (now - typedAt > 2000 ? '' : typed) + k; typedAt = now;
      typed = typed.slice(-6);
      if (typed === 'coffee') { typed = ''; coffee(); }
    }
  });

  // click the title 7 times
  const SILLY = ['SAM TIME WASTER', 'TIMEY MCTIMEFACE', 'SAM O\'CLOCK', 'BILLABLE BOOGIE', 'TICK TOCK SAM', 'THE 0.25 SHOW', 'QUARTER-HOUR PARTY', 'SAM\'S HOUR HOUSE', 'CHRONO SAM', 'TIME LORD SAM'];
  (function title() {
    const h1 = document.querySelector('#topbar h1'); if (!h1) return;
    const original = h1.textContent;
    let clicks = 0, last = 0, revert = null, current = '';
    h1.addEventListener('click', () => {
      if (!eggsOn()) return;
      const now = Date.now();
      clicks = now - last > 1500 ? 1 : clicks + 1; last = now;
      if (clicks < 7) return;
      let next; do { next = SILLY[Math.floor(Math.random() * SILLY.length)]; } while (next === current);
      current = next;
      h1.textContent = next;
      h1.insertAdjacentHTML('beforeend', `<span class="egg-clock">${ART.smallClock()}</span>`);
      h1.classList.remove('egg-silly'); void h1.offsetWidth; h1.classList.add('egg-silly');
      clearTimeout(revert);
      revert = setTimeout(() => { h1.textContent = original; h1.classList.remove('egg-silly'); current = ''; clicks = 0; }, 6000);
    });
  })();

  // double-click the time tag on the red line: a little runner chases a clock along it
  (function chase() {
    const tag = document.getElementById('nowTag'), line = document.getElementById('nowLine');
    if (!tag || !line) return;
    tag.title = '';
    tag.addEventListener('dblclick', () => {
      if (!eggsOn() || reduced() || line.querySelector('.egg-sprite')) return;
      const table = document.querySelector('#tableWrap table'), start = document.querySelector('#thead .time-hdr').offsetWidth + 6;
      const end = Math.max(start + 120, table.offsetWidth - 30), dur = Math.max(2.6, (end - start) / 260);
      line.classList.add('egg-chase');
      [['fleeingClock', 0, 26, 32], ['runner', -46, 26, 32]].forEach(([art, lag, w, h]) => {
        const s = document.createElement('div'); s.className = 'egg-sprite';
        s.style.cssText = `width:${w}px;height:${h}px;top:${-h + 1}px;left:${start + 40 + lag}px;`;
        s.innerHTML = ART[art]();
        line.appendChild(s);
        const a = s.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${end - start - 40}px)` }], { duration: dur * 1000, easing: 'ease-in', fill: 'forwards' });
        a.onfinish = () => { s.remove(); if (!line.querySelector('.egg-sprite')) line.classList.remove('egg-chase'); };
      });
    });
  })();

  // ── Seasonal decorations ─────────────────────────────────────
  const layer = document.createElement('div'); layer.id = 'seasonLayer'; layer.setAttribute('aria-hidden', 'true');
  let seasonName = null, seasonStop = null;
  function seasonFor(d) {
    const m = d.getMonth(), day = d.getDate();
    if ((m === 9 && day >= 24) || (m === 10 && day === 1)) return 'halloween';
    if (m === 11) return 'snow';
    if (m === 1 && day <= 14) return 'hearts';
    return null;
  }
  function stopSeason() { if (seasonStop) { seasonStop(); seasonStop = null; } layer.innerHTML = ''; layer.remove(); seasonName = null; }
  function startSeason(name) {
    layer.innerHTML = '';
    document.body.appendChild(layer);
    seasonName = name;
    if (name === 'halloween') {
      layer.innerHTML = `<div class="web l">${ART.web()}</div><div class="web r">${ART.web()}</div><div class="pumpkin l">${ART.pumpkin()}</div><div class="pumpkin r">${ART.pumpkin()}</div>`;
      if (reduced()) layer.querySelectorAll('svg').forEach(s => { s.pauseAnimations?.(); });
    } else if (name === 'snow' && !reduced()) {
      const cv = document.createElement('canvas'); layer.appendChild(cv);
      const ctx = cv.getContext('2d'); let W = 0, H = 0, raf = 0, last = 0;
      const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
      size(); addEventListener('resize', size);
      const flakes = Array.from({ length: 42 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: 1 + Math.random() * 2.2, v: 0.4 + Math.random() * 0.9, p: Math.random() * 6.28 }));
      (function frame(t) {
        raf = requestAnimationFrame(frame);
        if (t - last < 33 || document.hidden) return; last = t;
        ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (const f of flakes) {
          f.y += f.v; f.x += Math.sin(f.p + t / 1500) * 0.4;
          if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
          ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
        }
      })(0);
      seasonStop = () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
    } else if (name === 'hearts' && !reduced()) {
      const id = setInterval(() => {
        if (document.hidden || layer.querySelectorAll('.heart').length > 7) return;
        const h = document.createElement('div'); h.className = 'heart';
        h.style.left = `${5 + Math.random() * 90}%`; h.style.setProperty('--dx', `${(Math.random() - 0.5) * 60}px`);
        h.style.animationDuration = `${6 + Math.random() * 3}s`;
        h.innerHTML = ART.heart(); layer.appendChild(h);
        h.addEventListener('animationend', () => h.remove());
      }, 1200);
      seasonStop = () => clearInterval(id);
    }
  }
  function refreshSeason() {
    const want = prefs().season ? seasonFor(new Date()) : null;
    if (want === seasonName) return;
    stopSeason();
    if (want) startSeason(want);
  }

  // ── Settings: "Fun stuff" ────────────────────────────────────
  function buildSettings() {
    const el = document.getElementById('funPanel'); if (!el) return;
    el.hidden = false;
    el.innerHTML = '<h2>Fun stuff</h2><p class="settings-desc">Little surprises, plus seasonal decorations around Halloween, in December, and mid-February. These settings stay on this device.</p>';
    [['eggs', 'Easter eggs'], ['season', 'Seasonal decorations']].forEach(([key, label]) => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex; align-items:center; gap:8px; margin-top:10px; font-size:13px; color:#444; cursor:pointer;';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = prefs()[key];
      cb.style.cssText = 'accent-color:#1b3a5c; width:15px; height:15px;';
      cb.onchange = () => { setPref(key, cb.checked); refreshSeason(); };
      row.append(cb, document.createTextNode(label));
      el.appendChild(row);
    });
  }

  // ── Public hooks ─────────────────────────────────────────────
  window.EGGS = {
    enabled: eggsOn,
    quotes: () => (eggsOn() && coffeeDay() ? COFFEE_QUOTES : null),
    render: snapshot,
    logged,
    todoToggle,
    burn: () => { if (eggsOn()) decorateBurn(); },
    tick() { clockEggs(); refreshSeason(); },
    _art: ART, _pop: pop, _confetti: confetti,
  };

  buildSettings();
  try { snapshot(); decorateBurn(); } catch (e) { console.warn('easter eggs: initial snapshot', e); }
  refreshSeason();
  clockEggs();
})();
