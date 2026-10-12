/* ═════════ settings, theming (Material You / iPhone glass) and language ═════════ */
const SETTINGS_KEY = 'dockit-settings';
const CFG_DEFAULT = {
  mode: 'system', amoled: false, style: 'standard', accent: '#e4461e', radius: 'default', density: 'comfortable', fontScale: 100, font: 'inter', motion: true,
  lang: 'en', bnDigits: false,
  catLayout: 'list', catDesc: true, catIcons: true, catNew: true, catCounts: true, catPopular: true, catRecent: true, defaultTab: 'all', hiddenCats: []
};
let CFG = { ...CFG_DEFAULT };
function loadCfg() {
  try {
    const j = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (j && typeof j === 'object') CFG = { ...CFG_DEFAULT, ...j, hiddenCats: Array.isArray(j.hiddenCats) ? j.hiddenCats : [] };
    else { const old = localStorage.getItem('dockit-theme'); if (old === 'dark' || old === 'light') CFG.mode = old; }
  } catch {}
}
function saveCfg() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(CFG)); } catch {} }

/* ── colour maths ── */
const hexToRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function hexToHsl(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, s, l];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2; let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
const lumOf = hex => { const [r, g, b] = hexToRgb(hex).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const onColor = hex => { const L = lumOf(hex); return 1.05 / (L + .05) >= (L + .05) / .057 ? '#ffffff' : '#1a1210'; };
/* Material 3-style tonal palette generated from one seed colour */
function materialPalette(seed, dark, amoled) {
  let [h, s] = hexToHsl(seed); s = clamp(s, .36, .88); const t = (ss, l) => hslToHex(h, ss, l);
  const P = dark ? {
    bg: amoled ? '#000000' : t(.14, .075), surface: amoled ? t(.12, .05) : t(.14, .11), surface2: amoled ? t(.12, .09) : t(.15, .15),
    line: t(.12, .2), line2: t(.12, .3), ink: t(.2, .93), ink2: t(.14, .8), muted: t(.1, .64),
    acc: hslToHex(h, s, .76), accH: hslToHex(h, s, .84), soft: hslToHex(h, Math.min(s, .5), amoled ? .2 : .27)
  } : {
    bg: t(.5, .975), surface: t(.42, .945), surface2: t(.4, .915), line: t(.3, .87), line2: t(.26, .78),
    ink: t(.25, .1), ink2: t(.18, .24), muted: t(.1, .42), acc: hslToHex(h, s, .38), accH: hslToHex(h, s, .31), soft: hslToHex(h, Math.min(s, .7), .89)
  };
  P.on = onColor(P.acc); P.secondary = hslToHex(h + 25, s * .55, dark ? .75 : .42); P.tertiary = hslToHex(h + 65, s * .6, dark ? .76 : .42); P.container = P.soft; return P;
}

const PAL_VARS = ['--bg', '--surface', '--surface2', '--line', '--line2', '--ink', '--ink2', '--muted', '--acc', '--acc-h', '--acc-soft', '--ring', '--on-acc'];
const effectiveDark = () => CFG.mode === 'dark' || (CFG.mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
function applySettings() {
  const r = document.documentElement, st = r.style, dark = effectiveDark(), d = r.dataset;
  d.theme = dark ? 'dark' : 'light'; d.style = CFG.style; d.radius = CFG.radius; d.density = CFG.density; d.font = CFG.font; d.motion = CFG.motion ? 'on' : 'off';
  d.amoled = dark && CFG.amoled ? '1' : '0'; d.catLayout = CFG.catLayout; d.catDesc = CFG.catDesc ? '1' : '0'; d.catIcons = CFG.catIcons ? '1' : '0';
  d.catNew = CFG.catNew ? '1' : '0'; d.catCounts = CFG.catCounts ? '1' : '0'; r.lang = CFG.lang === 'bn' ? 'bn' : 'en';
  st.setProperty('--fs', String(CFG.fontScale / 100)); PAL_VARS.forEach(v => st.removeProperty(v));
  let bar = dark ? '#181613' : '#ffffff';
  if (CFG.style === 'material') {
    const P = materialPalette(CFG.accent, dark, CFG.amoled);
    Object.entries({ '--bg': P.bg, '--surface': P.surface, '--surface2': P.surface2, '--line': P.line, '--line2': P.line2, '--ink': P.ink, '--ink2': P.ink2, '--muted': P.muted, '--acc': P.acc, '--acc-h': P.accH, '--acc-soft': P.soft, '--on-acc': P.on }).forEach(([k, v]) => st.setProperty(k, v));
    st.setProperty('--ring', `color-mix(in srgb, ${P.acc} 32%, transparent)`); bar = P.bg;
  } else {
    let [h, s, l] = hexToHsl(CFG.accent), a = CFG.accent; if (dark) { a = hslToHex(h, s, clamp(l, .52, .74)); l = clamp(l, .52, .74); }
    st.setProperty('--acc', a); st.setProperty('--acc-h', hslToHex(h, s, dark ? l + .07 : l - .07)); st.setProperty('--on-acc', onColor(a));
    st.setProperty('--acc-soft', `color-mix(in srgb, ${a} ${dark ? 20 : 12}%, ${dark ? '#171512' : '#ffffff'})`); st.setProperty('--ring', `color-mix(in srgb, ${a} 30%, transparent)`);
    if (CFG.style === 'glass') { st.setProperty('--acc-soft', `color-mix(in srgb, ${a} ${dark ? 26 : 16}%, transparent)`); bar = dark ? '#0a0c13' : '#eceff7'; }
    else if (dark && CFG.amoled) { Object.entries({ '--bg': '#000000', '--surface': '#0b0b0b', '--surface2': '#151515', '--line': '#1e1e1e', '--line2': '#2c2c2c' }).forEach(([k, v]) => st.setProperty(k, v)); bar = '#000000'; }
  }
  const m = $('#themeColor'); if (m) m.content = bar;
  const tb = $('#themeBtn'); if (tb) tb.innerHTML = icon(dark ? 'sun' : 'moon');
}
function setCfg(k, v, { repaint = true } = {}) {
  CFG[k] = v; saveCfg(); applySettings();
  if (k === 'lang' || k === 'bnDigits') { I18N.on = CFG.lang === 'bn'; if (S.tool === null && location.hash === '#/settings' && repaint) paintSettings(); i18nRefresh(); try { setChrome(S.tool || (location.hash === '#/settings' ? { settings: true } : null)); } catch {} return; }
  if (['catLayout', 'catDesc', 'catIcons', 'catNew', 'catCounts', 'catPopular', 'catRecent', 'hiddenCats'].includes(k)) { /* applied when the catalogue is next drawn */ }
  if (repaint && location.hash === '#/settings') paintSettings();
}
function applyTheme(t) { setCfg('mode', t, { repaint: false }); } /* kept for the top-bar toggle */
function toggleTheme() { setCfg('mode', effectiveDark() ? 'light' : 'dark', { repaint: location.hash === '#/settings' }); }
function resetCfg() { const lang = CFG.lang; CFG = { ...CFG_DEFAULT }; saveCfg(); applySettings(); I18N.on = false; paintSettings(); i18nRefresh(); toast('Settings reset to defaults', 'ok'); if (lang === 'bn') setChrome(location.hash === '#/settings' ? { settings: true } : null); }

/* ── recently used tools ── */
const RECENT_KEY = 'dockit-recent';
const getRecents = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
function pushRecent(key) { try { const a = [key, ...getRecents().filter(x => x !== key)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(a)); } catch {} }

/* ── settings page ── */
const ACCENTS = [['#e4461e', 'Vermilion'], ['#d81b60', 'Rose'], ['#8e24aa', 'Purple'], ['#4f46e5', 'Indigo'], ['#1a73e8', 'Blue'], ['#007aff', 'iOS blue'], ['#00897b', 'Teal'], ['#1e8e3e', 'Green'], ['#f59e0b', 'Amber'], ['#475569', 'Slate']];
const segCtl = (k, opts, val) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-k="${k}" data-v="${v}" class="${String(val) === String(v) ? 'on' : ''}" aria-pressed="${String(val) === String(v)}">${l}</button>`).join('')}</div>`;
const switchCtl = (k, on, label) => `<button type="button" role="switch" class="switch" data-k="${k}" data-sw="1" aria-checked="${!!on}" aria-label="${label}"></button>`;
const row = (title, desc, ctl, cls = '') => `<div class="set-row ${cls}"><div class="lab"><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div>${ctl}</div>`;
const sec = (ic, t) => `<div class="set-sec">${icon(ic)}${t}</div>`;
function openSettings() {
  cleanup(); S.tool = null; S.onOpt = null; setChrome({ settings: true });
  app.innerHTML = `<div class="wrap ws set"><nav class="crumbs"><a href="#/">${icon('back')}All tools</a><span>/</span><span style="color:var(--ink2)">Settings</span></nav>
    <header class="ws-head" style="--c:#64748b"><span class="ic">${icon('gear')}</span><div><h1>Settings</h1><p>Make the app look and work the way you like. Changes apply instantly and are saved on this device.</p></div></header>
    <div id="setBody" style="max-width:860px"></div></div>`;
  const body = $('#setBody');
  body.onclick = e => {
    const b = e.target.closest('[data-k],[data-reset]'); if (!b) return;
    if (b.dataset.reset !== undefined) { if (b.dataset.armed) { clearTimeout(b._t); resetCfg(); } else { b.dataset.armed = '1'; b.textContent = 'Tap again to confirm'; b._t = setTimeout(() => { b.dataset.armed = ''; b.textContent = 'Reset all settings'; }, 3000); } return; }
    const k = b.dataset.k, v = b.dataset.v;
    if (b.dataset.sw) return setCfg(k, !CFG[k]);
    if (k === 'hide') { const a = new Set(CFG.hiddenCats); a.has(v) ? a.delete(v) : a.add(v); return setCfg('hiddenCats', [...a]); }
    if (k === 'randomSeed') return setCfg('accent', hslToHex(Math.random() * 360, .55 + Math.random() * .3, .5));
    if (k === 'showAll') return setCfg('hiddenCats', []);
    if (k === 'fontScale') return setCfg('fontScale', 100);
    setCfg(k, v);
  };
  body.addEventListener('input', e => {
    if (e.target.id === 'fsRange') { CFG.fontScale = +e.target.value; saveCfg(); applySettings(); const o = e.target.closest('.set-row').querySelector('output'); if (o) o.textContent = CFG.fontScale + '%'; i18nRefresh(); }
    if (e.target.id === 'customColor') { CFG.accent = e.target.value; saveCfg(); applySettings(); }
  });
  body.addEventListener('change', e => { if (e.target.id === 'customColor') paintSettings(); });
  paintSettings();
}
function paintSettings() {
  const body = $('#setBody'); if (!body) return; const y = window.scrollY, dark = effectiveDark(), mat = CFG.style === 'material';
  const palette = mat ? materialPalette(CFG.accent, dark, CFG.amoled) : null;
  const hiddenChips = (dom, cats) => Object.entries(cats).map(([k, v]) => `<button type="button" class="cat ${CFG.hiddenCats.includes(dom + ':' + k) ? 'off' : ''}" data-k="hide" data-v="${dom}:${k}">${v.n}</button>`).join('');
  body.innerHTML =
    sec('palette', 'Appearance') + `<div class="set-card">
      ${row('Theme mode', 'Follow your device, or force light or dark.', segCtl('mode', [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']], CFG.mode))}
      ${row('Pure black (AMOLED)', 'Uses true black in dark mode — saves battery on OLED screens.', switchCtl('amoled', CFG.amoled, 'Pure black'))}
      <div class="set-row col"><div class="lab"><b>Design style</b><span>Pick the overall look of the app.</span></div><div class="style-grid">
        <button type="button" class="style-card ${CFG.style === 'standard' ? 'on' : ''}" data-k="style" data-v="standard"><div class="mock mock-std"><i class="c"></i><i class="t"></i><i class="b"></i></div><div><b>Standard</b><span class="d">Clean, crisp and neutral.</span></div></button>
        <button type="button" class="style-card ${mat ? 'on' : ''}" data-k="style" data-v="material"><div class="mock mock-mat"><i class="c"></i><i class="t"></i><i class="b"></i><i class="f"></i></div><div><b>Material You</b><span class="d">Android-style colours built from your seed colour.</span></div></button>
        <button type="button" class="style-card ${CFG.style === 'glass' ? 'on' : ''}" data-k="style" data-v="glass"><div class="mock mock-gls"><i class="c"></i><i class="t"></i><i class="b"></i></div><div><b>iPhone glass</b><span class="d">Frosted, translucent layers with soft gradients.</span></div></button>
      </div></div></div>` +
    sec('palette', mat ? 'Seed colour' : 'Accent colour') + `<div class="set-card"><div class="set-row col"><div class="lab"><b>${mat ? 'Material You seed colour' : 'Accent colour'}</b><span>${mat ? 'Browsers cannot read your wallpaper, so pick a seed colour — the full Material palette is generated from it.' : 'Used for buttons, highlights and focus rings.'}</span></div>
      <div class="swatches">${ACCENTS.map(([c, n]) => `<button type="button" style="background:${c}" data-k="accent" data-v="${c}" class="${CFG.accent.toLowerCase() === c ? 'on' : ''}" aria-label="${n}" title="${n}">${CFG.accent.toLowerCase() === c ? icon('check') : ''}</button>`).join('')}
        <label title="Custom colour" aria-label="Custom colour"><input type="color" id="customColor" value="${CFG.accent}"></label>${mat ? `<button type="button" class="btn sm" data-k="randomSeed">${icon('dice')}Surprise me</button>` : ''}</div>
      ${mat ? `<div class="pal"><div style="background:${palette.acc};color:${palette.on}">Primary</div><div style="background:${palette.container};color:${palette.ink}">Container</div><div style="background:${palette.secondary};color:${onColor(palette.secondary)}">Secondary</div><div style="background:${palette.tertiary};color:${onColor(palette.tertiary)}">Tertiary</div><div style="background:${palette.surface2};color:${palette.ink}">Surface</div></div>` : ''}</div></div>` +
    sec('sliders', 'Shape & text') + `<div class="set-card">
      ${row('Corner roundness', '', segCtl('radius', [['sharp', 'Sharp'], ['default', 'Default'], ['round', 'Round']], CFG.radius))}
      ${row('Density', 'Space between elements.', segCtl('density', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']], CFG.density))}
      <div class="set-row col"><div class="lab" style="display:flex;justify-content:space-between;gap:12px"><div><b>Text size</b><span>Makes all text larger or smaller.</span></div><div style="text-align:right"><output>${CFG.fontScale}%</output><br><button type="button" class="btn sm ghost" data-k="fontScale" style="margin-top:4px">Reset</button></div></div><input type="range" id="fsRange" min="85" max="130" step="5" value="${CFG.fontScale}" aria-label="Text size"></div>
      ${row('Font', '', segCtl('font', [['inter', 'Inter'], ['system', 'System'], ['serif', 'Serif']], CFG.font))}
      ${row('Animations', 'Turn off for a calmer, faster feel.', switchCtl('motion', CFG.motion, 'Animations'))}
    </div>` +
    sec('grid', 'Catalogue') + `<div class="set-card">
      ${row('Tool layout', 'How tools are listed on the home screen.', segCtl('catLayout', [['list', 'List'], ['grid', 'Grid'], ['dense', 'Compact']], CFG.catLayout))}
      ${row('Start on', 'Which tab opens first.', segCtl('defaultTab', [['all', 'All'], ['pdf', 'PDF'], ['text', 'Text']], CFG.defaultTab))}
      ${row('Show descriptions', 'A short line under each tool name.', switchCtl('catDesc', CFG.catDesc, 'Show descriptions'))}
      ${row('Show icons', '', switchCtl('catIcons', CFG.catIcons, 'Show icons'))}
      ${row('Show “NEW” badges', '', switchCtl('catNew', CFG.catNew, 'Show new badges'))}
      ${row('Show tool counts', 'Numbers next to tabs and categories.', switchCtl('catCounts', CFG.catCounts, 'Show counts'))}
      ${row('Popular tools row', '', switchCtl('catPopular', CFG.catPopular, 'Popular row'))}
      ${row('Recently used row', 'Quick access to the tools you opened last.', switchCtl('catRecent', CFG.catRecent, 'Recently used row'))}
      <div class="set-row col"><div class="lab"><b>Hide categories</b><span>Tap a category to hide it from the catalogue. Search still finds every tool.</span></div>
        <div><div class="lbl" style="margin-bottom:8px">PDF tools</div><div class="chips">${hiddenChips('pdf', CATS)}</div></div>
        <div><div class="lbl" style="margin-bottom:8px">Text tools</div><div class="chips">${hiddenChips('text', TCATS)}</div></div>
        ${CFG.hiddenCats.length ? `<div><button type="button" class="btn sm" data-k="showAll">Show all categories</button></div>` : ''}</div>
    </div>` +
    sec('globe', 'Language') + `<div class="set-card"><div class="set-row col"><div class="lab"><b>App language</b><span>Switches menus, tool names and descriptions.</span></div>
      <div class="lang-grid">
        <button type="button" class="lang-card ${CFG.lang === 'en' ? 'on' : ''}" data-k="lang" data-v="en"><div><b>English</b><span>English</span></div><i class="ck">${icon('check')}</i></button>
        <button type="button" class="lang-card ${CFG.lang === 'bn' ? 'on' : ''}" data-k="lang" data-v="bn"><div><b>বাংলা</b><span>Bangla</span></div><i class="ck">${icon('check')}</i></button>
      </div></div>
      ${row('Bangla numerals', 'Show ০১২৩৪৫৬৭৮৯ instead of 0123456789 in the app.', switchCtl('bnDigits', CFG.bnDigits, 'Bangla numerals'))}
    </div>` +
    sec('info', 'About') + `<div class="set-card">
      ${row(APP_NAME, `${TOOLS.length + TTOOLS.length} tools · everything runs privately in your browser.`, '')}
      ${row('Reset settings', 'Restore theme, layout and language to the defaults.', `<button type="button" class="btn" data-reset="1">Reset all settings</button>`)}
    </div>`;
  window.scrollTo(0, y);
}

/* ═════════ language engine (DOM translation with originals kept) ═════════ */
const I18N = { on: false, busy: false };
const BN_D = '০১২৩৪৫৬৭৮৯';
const toBnDigits = s => s.replace(/[0-9]/g, d => BN_D[d]);
const I18N_SKIP = 'textarea,input,script,style,pre,code,.tx,.txt-out,.nm,.kv dd,[data-notr],.ov,.pv-page,.pad,.rd';
const I18N_NUM = '.cnt,.doms b,.cat b,.dom-h span,.hero .lead,.pg,.sub,.rfile .sub,.fcard .sub,.imgs figcaption,output';
function trStr(s) {
  const k = s.trim(); if (!k) return null;
  let v = BN[k]; if (v !== undefined) return s.replace(k, () => v);
  for (const [rx, fn] of BN_RULES) { const m = k.match(rx); if (m) { const out = fn(...m); if (out !== null) return s.replace(k, () => out); } }
  return null;
}
function i18nText(n) {
  const p = n.parentElement; if (!p || p.closest(I18N_SKIP)) return;
  if (n.__out !== undefined && n.nodeValue === n.__out) return;
  n.__en = n.nodeValue; let out = n.nodeValue;
  if (I18N.on) { const t = trStr(out); if (t !== null) { out = CFG.bnDigits ? toBnDigits(t) : t; } else if (CFG.bnDigits && p.closest(I18N_NUM)) out = toBnDigits(out); }
  n.__out = out; if (out !== n.nodeValue) n.nodeValue = out;
}
const I18N_ATTRS = ['placeholder', 'title', 'aria-label'];
function i18nAttrs(el) {
  if (el.closest && el.closest('[data-notr]')) return; el.__enA ??= {}; el.__outA ??= {};
  for (const a of I18N_ATTRS) {
    if (!el.hasAttribute(a)) continue; const cur = el.getAttribute(a);
    if (el.__outA[a] !== undefined && cur === el.__outA[a]) continue;
    el.__enA[a] = cur; let out = cur; if (I18N.on) { const t = trStr(cur); if (t !== null) out = t; }
    el.__outA[a] = out; if (out !== cur) el.setAttribute(a, out);
  }
}
function i18nWalk(root, fn) { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const list = []; while ((n = w.nextNode())) list.push(n); list.forEach(fn); }
function i18nRefresh() {
  I18N.busy = true;
  try {
    i18nWalk(document.body, n => { if (n.__en !== undefined) { n.nodeValue = n.__en; n.__out = undefined; } i18nText(n); });
    document.body.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => { if (el.__enA) for (const a in el.__enA) { if (el.hasAttribute(a) && el.__enA[a] !== undefined) el.setAttribute(a, el.__enA[a]); } el.__outA = {}; i18nAttrs(el); });
  } finally { I18N.busy = false; }
}
function initI18n() {
  I18N.on = CFG.lang === 'bn';
  new MutationObserver(muts => {
    if (I18N.busy || (!I18N.on && !CFG.bnDigits)) return; I18N.busy = true;
    try {
      for (const m of muts) {
        if (m.type === 'characterData') i18nText(m.target);
        else if (m.type === 'attributes') i18nAttrs(m.target);
        else m.addedNodes.forEach(n => { if (n.nodeType === 3) i18nText(n); else if (n.nodeType === 1) { i18nWalk(n, i18nText); i18nAttrs(n); n.querySelectorAll && n.querySelectorAll('[placeholder],[title],[aria-label]').forEach(i18nAttrs); } });
      }
    } finally { I18N.busy = false; }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
}
