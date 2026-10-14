/* ═════════ application shell ═════════ */
const app = $('#app');
const S = { tool: null, files: [], vals: {}, aux: {}, st: {}, text: '', results: [], busy: false, carry: null, carryText: null, destroyers: [], listeners: {}, onOpt: null, home: { q: '', dom: 'all', cat: 'all' } };
const ACCEPT = { pdf: '.pdf,application/pdf', image: 'image/*', text: '.txt,.md,.markdown,text/plain,text/markdown' };
const matches = (f, a) => a === 'pdf' ? (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) : a === 'image' ? f.type.startsWith('image/') : /\.(txt|md|markdown|text)$/i.test(f.name) || f.type.startsWith('text/');
const NAMES = { pdf: 'PDF', image: 'images', text: 'a text file' };

/* detect the device once, then keep it fresh on resize / rotation so CSS can adapt */
function detectDevice() {
  const r = document.documentElement, ua = navigator.userAgent || '', plat = navigator.platform || '', w = window.innerWidth;
  const touch = matchMedia('(pointer:coarse)').matches, android = /Android/i.test(ua), ios = /iPhone|iPad|iPod/i.test(ua) || (plat === 'MacIntel' && navigator.maxTouchPoints > 1);
  r.dataset.os = android ? 'android' : ios ? 'ios' : /Win/i.test(plat) ? 'windows' : /Mac/i.test(plat) ? 'mac' : /Linux/i.test(plat) ? 'linux' : 'other';
  r.dataset.touch = touch ? '1' : '0';
  r.dataset.layout = w <= 820 ? 'compact' : 'wide';
  r.dataset.device = android || ios ? (Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet') : touch && w > 820 ? 'tablet' : w <= 820 ? 'phone' : 'desktop';
  r.dataset.standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? '1' : '0';
}
function paintNav() {
  const n = $('#bnav'); if (!n) return; const h = location.hash, d = S.tool ? null : inSet() ? 'settings' : /^#\/(favorites|history)/.test(h) ? 'fav' : S.home.dom;
  n.innerHTML = [['all', '#/', 'home', 'Home'], ['pdf', '#/pdf', 'file', 'PDF'], ['text', '#/text', 'type', 'Text'], ['fav', '#/favorites', 'star', 'Favorites'], ['settings', '#/settings', 'gear', 'Settings']].map(([k, href, ic, l]) => `<a href="${href}" class="${d === k ? 'on' : ''}"${d === k ? ' aria-current="page"' : ''}><span class="pill">${icon(ic)}</span>${l}</a>`).join('');
}
function focusSearch() { const q = $('#q'); if (!q) return; q.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(() => q.focus({ preventScroll: true }), 280); }
function openSearch() {
  const onHome = !S.tool && !/^#\/(settings|favorites|history)/.test(location.hash) && $('#q');
  if (onHome && S.home.dom === 'all' && S.home.cat === 'all') return focusSearch();
  S.focusSearch = true; S.home.dom = 'all'; S.home.cat = 'all';
  if (onHome) { history.replaceState(null, '', '#/'); renderHome(); } else if (location.hash === '#/' || location.hash === '') renderHome(); else location.hash = '#/';
}
function setChrome(t) {
  const r = document.documentElement, pg = !!(t && t.settings); r.classList.toggle('in-tool', (!!t && !pg) || !!(pg && t.back)); r.classList.toggle('in-settings', pg);
  if (pg) { const title = t.title || 'Settings'; $('#barTitle').textContent = title; if (t.back) $('#barBack').href = t.back; document.title = `${title} — ${APP_NAME}`; }
  else if (t) { $('#barTitle').textContent = t.name; $('#barBack').href = t.dom === 'pdf' ? '#/pdf' : '#/text'; document.title = `${t.name} — ${APP_NAME}`; }
  else document.title = `${APP_NAME} — ${TOOLS.length + TTOOLS.length} private PDF & text tools`;
  const fb = $('#favBtn'); if (fb) { fb.hidden = !(t && !pg); if (t && !pg) { fb.innerHTML = icon('star'); syncFavUI(); } }
  paintNav();
}
function initChrome() {
  detectDevice(); let rt; const re = () => { clearTimeout(rt); rt = setTimeout(detectDevice, 120); };
  addEventListener('resize', re); addEventListener('orientationchange', re);
  $('#logoMark').innerHTML = icon('file'); $('#logoText').textContent = APP_NAME; $('#barBack').innerHTML = icon('back'); $('#privPill').innerHTML = icon('shield') + 'Files never leave your device';
  loadCfg(); migrateHistory(); applySettings(); initI18n();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (CFG.mode === 'system') applySettings(); });
  $('#themeBtn').onclick = toggleTheme; $('#setBtn').innerHTML = icon('gear'); $('#searchBtn').innerHTML = icon('search'); $('#searchBtn').onclick = openSearch;
  const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.tagName) && !['checkbox', 'range', 'file', 'color', 'button', 'radio'].includes(e.type);
  addEventListener('focusin', e => { if (document.documentElement.dataset.touch === '1' && typing(e.target)) document.documentElement.classList.add('kb'); });
  addEventListener('focusout', () => setTimeout(() => { if (!typing(document.activeElement || {})) document.documentElement.classList.remove('kb'); }, 60));
  document.title = `${APP_NAME} — ${TOOLS.length + TTOOLS.length} private PDF & text tools`;
  if (I18N.on || CFG.bnDigits) i18nRefresh();
}
function acceptHomeFile(files) {
  const f = files.find(x => matches(x, 'pdf'));
  if (f) { S.carry = f; S.carryText = null; paintCarry(); paintCatalog(); toast(`${f.name} loaded — choose a PDF tool`, 'ok'); return; }
  const tf = files.find(x => x.type.startsWith('text/') || /\.(txt|md|csv|json|html?|xml|log|tsv|ya?ml)$/i.test(x.name));
  if (tf) { tf.text().then(t => { S.carry = null; S.carryText = { name: tf.name, text: t }; paintCarry(); paintCatalog(); toast(`${tf.name} loaded — choose a text tool`, 'ok'); }); return; }
  toast('Choose a PDF or text file', 'err');
}

/* ───────── home ───────── */
const POPULAR = ['merge', 'compress', 'sign', 'pdf2img', 'redact', 'reorder', 'x:printstats', 'x:findreplace', 'x:jsonformat', 'x:titlecase', 'x:sortlines', 'x:passgen'];
let ALLT = [];
const catOf = t => (t.dom === 'pdf' ? CATS : TCATS)[t.cat];
const hrefOf = t => (t.dom === 'pdf' ? '#/t/' : '#/x/') + t.id;
function renderHome() {
  cleanup(); S.tool = null; S.onOpt = null; setChrome(null);
  const nP = TOOLS.length, nT = TTOOLS.length;
  app.innerHTML = `<div class="wrap">
    <section class="hero"><span class="eyebrow"><i></i>Processed in your browser — nothing is uploaded</span>
      <h1>Every PDF &amp; text tool you need. <em>Zero uploads.</em></h1>
      <p class="lead">${ALLT.length} professional tools to edit, sign, convert, clean and analyse documents and text — free, unlimited and private.</p>
      <div class="search"><input id="q" type="search" placeholder="Search ${ALLT.length} tools…" autocomplete="off" aria-label="Search tools">${icon('search')}<kbd>/</kbd></div>
      <div id="carry"></div>
      <div class="trust"><div>${icon('shield')}Private by design</div><div>${icon('infinity')}No limits or sign-up</div><div>${icon('cpu')}Lossless PDF editing where possible</div></div>
    </section>
    <div class="doms seg" id="doms" role="tablist"><button data-d="all">All tools <b>${ALLT.length}</b></button><button data-d="pdf">${icon('file')}PDF tools <b>${nP}</b></button><button data-d="text">${icon('type')}Text tools <b>${nT}</b></button></div>
    <div class="cats" id="cats"></div><div id="catalog"></div>
    <section class="feat" id="why"><div>${icon('shield')}<h4>Your files stay yours</h4><p>Every operation runs locally inside your own browser tab. There is no server to upload to, so sensitive documents and text never leave your device.</p></div>
      <div>${icon('layers')}<h4>True PDF editing</h4><p>Merge, split, rotate, watermark and number pages without flattening them into images, so text stays sharp and selectable.</p></div>
      <div>${icon('zap')}<h4>Live text tools</h4><p>${nT} text tools update as you type, and you can send any result straight into another tool to build a pipeline.</p></div></section>
  </div><footer class="foot"><div class="wrap"><span>© ${APP_NAME} — all processing happens on your device.</span><span>Tip: press <b>/</b> to search</span></div></footer>`;
  const q = $('#q'); q.value = S.home.q; q.oninput = () => { S.home.q = q.value; paintCatalog(); };
  q.onkeydown = e => { if (e.key === 'Enter') { const first = $('#catalog .card:not(.dim)'); if (first) first.click(); } };
  $('#doms').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.home.dom = b.dataset.d; S.home.cat = 'all'; history.replaceState(null, '', S.home.dom === 'all' ? '#/' : '#/' + S.home.dom); paintCats(); paintCatalog(); paintNav(); };
  paintCats(); paintCatalog(); paintCarry();
  if (S.focusSearch) { S.focusSearch = false; focusSearch(); }
}
function paintCarry() {
  const c = $('#carry'); if (!c) return;
  const has = S.carry || S.carryText;
  c.innerHTML = has ? `<div class="carry">${icon(S.carry ? 'file' : 'type')}<span><b>${esc(S.carry ? S.carry.name : S.carryText.name)}</b> is ready — pick a ${S.carry ? 'PDF' : 'text'} tool below</span><button class="btn sm" data-clear>${icon('x')}Clear</button></div>` : `<div class="carry" style="background:none;border-style:dashed;border-color:var(--line2);color:var(--muted)">${icon('upload')}<span><span class="only-desktop">Drop a PDF or text file anywhere on this page to start with it</span><span class="only-touch">Open a PDF or text file to start with it</span></span><label class="btn sm pri" style="cursor:pointer">Open file<input type="file" hidden id="homeFile" accept=".pdf,application/pdf,.txt,.md,.csv,.json,.html,.xml,.log,text/*"></label></div>`;
  const hf = $('#homeFile'); if (hf) hf.onchange = e => { acceptHomeFile([...e.target.files]); e.target.value = ''; };
  const b = $('[data-clear]', c); if (b) b.onclick = () => { S.carry = null; S.carryText = null; paintCarry(); paintCatalog(); };
}
function paintCats() {
  const dom = S.home.dom; $$('#doms button').forEach(b => b.classList.toggle('on', b.dataset.d === dom));
  const box = $('#cats'); if (dom === 'all') { box.innerHTML = ''; box.hidden = true; return; } box.hidden = false;
  const cats = dom === 'pdf' ? CATS : TCATS, list = ALLT.filter(t => t.dom === dom), counts = {}; list.forEach(t => counts[t.cat] = (counts[t.cat] || 0) + 1);
  const shown = Object.entries(cats).filter(([k]) => counts[k] && !CFG.hiddenCats.includes(dom + ':' + k));
  if (S.home.cat !== 'all' && !shown.some(([k]) => k === S.home.cat)) S.home.cat = 'all';
  box.innerHTML = [['all', 'All ' + (dom === 'pdf' ? 'PDF' : 'text') + ' tools', list.length], ...shown.map(([k, v]) => [k, v.n, counts[k]])].map(([k, n, c]) => `<button class="cat${S.home.cat === k ? ' on' : ''}" data-c="${k}">${esc(n)}<b>${c}</b></button>`).join('');
  box.onclick = e => { const b = e.target.closest('.cat'); if (!b) return; S.home.cat = b.dataset.c; paintCats(); paintCatalog(); };
}
function toolCard(t) {
  const dim = (S.carry && (t.dom !== 'pdf' || t.accept === 'text')) || (S.carryText && t.dom !== 'text' && t.accept !== 'text');
  const ct = catOf(t);
  return `<div class="card-w"><a class="card${dim ? ' dim' : ''}" href="${hrefOf(t)}" style="--c:${ct.c}"><span class="ic">${icon(t.dom === 'pdf' ? t.icon : ct.i)}</span><div><h3>${esc(t.name)}${t.isNew ? '<span class="new">NEW</span>' : ''}</h3><p>${esc(t.desc)}</p></div></a>${favBtnHTML(t)}</div>`;
}
function paintCatalog() {
  const q = S.home.q.trim().toLowerCase(), { dom, cat } = S.home, hid = k => CFG.hiddenCats.includes(k);
  const match = t => !q || (t.name + ' ' + t.desc + ' ' + t.id + ' ' + catOf(t).n + ' ' + (t.dom === 'pdf' ? 'pdf' : 'text')).toLowerCase().includes(q);
  const list = ALLT.filter(t => (dom === 'all' || t.dom === dom) && (cat === 'all' || t.cat === cat) && match(t) && (q || !hid(t.dom + ':' + t.cat)));
  const box = $('#catalog'); if (!list.length) { box.innerHTML = `<div class="empty">No tools match “${esc(S.home.q)}”.</div>`; return; }
  const sections = (d, cats) => Object.entries(cats).map(([k, v]) => { const ts = list.filter(t => t.dom === d && t.cat === k); return ts.length ? `<div class="sec-h"><h2>${esc(v.n)}</h2><span class="cnt">${ts.length}</span><hr></div><div class="grid">${ts.map(toolCard).join('')}</div>` : ''; }).join('');
  const find = id => ALLT.find(t => (id.startsWith('x:') ? t.dom === 'text' && t.id === id.slice(2) : t.dom === 'pdf' && t.id === id));
  if (!q && cat === 'all') {
    let h = '';
    if (dom === 'all') {
      const fav = CFG.catFavs ? getFavs().map(toolByKey).filter(Boolean) : [], favShown = fav.slice(0, 6);
      const rec = CFG.catRecent && histOn() ? getHistTools().map(x => toolByKey(x.key)).filter(t => t && !favShown.includes(t)).slice(0, 6) : [];
      let first = true; const gap = () => { const m = first ? 8 : 28; first = false; return m; };
      if (favShown.length) h += `<div class="sec-h" style="margin-top:${gap()}px"><h2>Favorites</h2><span class="cnt">${fav.length}</span><hr><a class="see-all" href="#/favorites">View all</a></div><div class="grid">${favShown.map(toolCard).join('')}</div>`;
      if (rec.length) h += `<div class="sec-h" style="margin-top:${gap()}px"><h2>Recently used</h2><hr><a class="see-all" href="#/history">View all</a></div><div class="grid">${rec.map(toolCard).join('')}</div>`;
      const pop = CFG.catPopular ? POPULAR.map(find).filter(Boolean) : [];
      if (pop.length) h += `<div class="sec-h" style="margin-top:${gap()}px"><h2>Popular</h2><hr></div><div class="grid">${pop.map(toolCard).join('')}</div>`;
    }
    if (dom !== 'text') h += (dom === 'all' ? `<div class="dom-h"><h2>PDF tools</h2><span>${list.filter(t => t.dom === 'pdf').length} tools</span></div>` : '') + sections('pdf', CATS);
    if (dom !== 'pdf') h += (dom === 'all' ? `<div class="dom-h"><h2>Text tools</h2><span>${list.filter(t => t.dom === 'text').length} tools</span></div>` : '') + sections('text', TCATS);
    box.innerHTML = h;
  } else box.innerHTML = `<div class="grid" style="margin-top:8px">${list.map(toolCard).join('')}</div>`;
}

/* ───────── workspace ───────── */
function defaults(t) { const v = {}; (t.opts || []).forEach(f => { if (f.type !== 'note') v[f.k] = f.def; }); return v; }
function cleanup() {
  $$('.modal').forEach(m => m.remove());
  S.destroyers.forEach(f => { try { f(); } catch {} }); S.destroyers = []; S.listeners = {};
  S.files.forEach(r => { try { r.pdfjs && r.pdfjs.destroy(); } catch {} r.url && URL.revokeObjectURL(r.url); });
  S.results.forEach(r => r.url && URL.revokeObjectURL(r.url)); S.files = []; S.results = [];
}
function go(id) { const h = '#/t/' + id; if (location.hash === h) openTool(id); else location.hash = h; }
function goText(id) { const h = '#/x/' + id; if (location.hash === h) openText(id); else location.hash = h; }

function openTool(id) {
  const t = TOOL[id]; if (!t) { location.hash = '#/'; return; }
  cleanup(); Object.assign(S, { tool: t, vals: defaults(t), aux: {}, st: {}, text: '', busy: false }); S.onOpt = null; setChrome(t); recordTool(t);
  const cat = CATS[t.cat], solo = t.noRun && !t.opts.length;
  app.innerHTML = `<div class="wrap ws"><nav class="crumbs"><a href="#/">${icon('back')}All tools</a><span>/</span><span style="color:var(--ink2)">${esc(cat.n)}</span></nav>
    <header class="ws-head" style="--c:${cat.c}"><span class="ic">${icon(t.icon)}</span><div><h1>${esc(t.name)}</h1><p>${esc(t.desc)}</p></div></header>
    <div class="ws-grid ${solo ? 'solo' : ''}" id="wsg"><section id="main"></section><aside class="ws-side" id="side" hidden><div id="sideExtra"></div><div id="optsP"></div><div class="panel" id="runP"><button class="btn pri lg block" id="run"></button><div id="prog"></div><div id="err"></div></div><div id="results"></div></aside></div></div>`;
  $('#run').textContent = t.cta || 'Run'; $('#run').onclick = runTool; window.scrollTo(0, 0);
  const ct = S.carryText; if (S.carry && t.accept !== 'text' && matches(S.carry, t.accept)) { const f = S.carry; S.carry = null; addFiles([f]); } else { renderMain(); if (ct && t.textInput) { S.carryText = null; S.text = ct.text; const ta = $('#txt'); if (ta) ta.value = ct.text; if (ct.name) recordFile(new File([ct.text], ct.name, { type: 'text/plain' }), { dom: 'pdf', tool: t.id, kind: 'text' }); } }
}

function dropHTML(t, compact) {
  const what = NAMES[t.accept], multi = t.multi;
  return `<label class="drop${compact ? ' compact' : ''}" data-drop><input type="file" accept="${ACCEPT[t.accept]}" ${multi ? 'multiple' : ''} aria-label="Choose files">
    <div class="bubble">${icon('upload')}</div><h3>${compact ? `Add more ${what}` : `<span class="only-desktop">Drop </span><span class="only-touch">Choose </span>${multi ? what + ' <span class="only-desktop">(several allowed)</span>' : 'your ' + what}<span class="only-desktop"> here</span>`}</h3><p>${compact ? '<span class="only-desktop">or click</span><span class="only-touch">or tap</span> to browse' : '<span class="only-desktop">or click</span><span class="only-touch">Tap</span> to browse your device — nothing is uploaded'}</p><span class="btn pri lg">Choose ${multi ? 'files' : 'file'}</span></label>`;
}
function bindDrop(root) {
  $$('[data-drop]', root).forEach(d => {
    const inp = $('input', d); inp.onchange = () => { addFiles(inp.files); inp.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => d.addEventListener(ev, () => d.classList.add('over'))); ['dragleave', 'drop'].forEach(ev => d.addEventListener(ev, () => d.classList.remove('over')));
  });
}

async function addFiles(list) {
  const t = S.tool; if (!t) return; list = [...list];
  for (const f of list) {
    if (!matches(f, t.accept)) { toast(`“${f.name}” isn't a ${NAMES[t.accept]} file`, 'err'); continue; }
    if (t.accept === 'text') { S.text = await f.text(); const ta = $('#txt'); if (ta) ta.value = S.text; recordFile(f, { dom: 'pdf', tool: t.id, kind: 'text' }); continue; }
    if (!t.multi) { S.files.forEach(r => { try { r.pdfjs && r.pdfjs.destroy(); } catch {} r.url && URL.revokeObjectURL(r.url); }); S.files = []; S.results = []; }
    const rec = { id: ++uid, file: f, name: f.name, size: f.size, type: f.type, range: '' }; S.files.push(rec);
    if (t.accept === 'pdf') await probePdf(rec); else { rec.url = URL.createObjectURL(f); rec.pages = 1; }
    if (!rec.error) recordFile(f, { dom: 'pdf', tool: t.id, kind: t.accept === 'image' ? 'image' : 'pdf' });
    if (!t.multi) break;
  }
  renderMain();
}
function removeFile(id) { const i = S.files.findIndex(r => r.id === id); if (i < 0) return; const [r] = S.files.splice(i, 1); try { r.pdfjs && r.pdfjs.destroy(); } catch {} r.url && URL.revokeObjectURL(r.url); renderMain(); }

function renderMain() {
  const t = S.tool, main = $('#main'); if (!main) return;
  S.destroyers.forEach(f => { try { f(); } catch {} }); S.destroyers = []; S.listeners = {}; S.st = {}; $('#sideExtra').innerHTML = '';
  const hasInput = t.textInput ? true : S.files.length > 0; $('#side').hidden = !hasInput || (t.noRun && !t.opts.length);
  main.innerHTML = '';
  if (t.textInput) {
    main.innerHTML = `<div class="panel"><div class="panel-h">${t.textInput === 'md' ? 'Markdown' : 'Plain text'}<label class="btn sm" style="cursor:pointer">${icon('upload')}Load a file<input type="file" accept="${ACCEPT.text}" hidden id="tfile"></label></div><textarea id="txt" class="mono" rows="18" placeholder="${t.textInput === 'md' ? '# Title\n\nWrite **Markdown** here…\n\n- bullet one\n- bullet two' : 'Type or paste your text here…'}"></textarea></div>`;
    const ta = $('#txt'); ta.value = S.text; ta.oninput = () => S.text = ta.value; $('#tfile').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  } else if (!S.files.length) { main.innerHTML = dropHTML(t, false); bindDrop(main); return; }
  else {
    const box = el('<div class="files"></div>'); S.files.forEach((r, i) => box.appendChild(fileCard(r, i))); main.appendChild(box);
    if (t.multi) { const d = el(dropHTML(t, true)); d.style.marginTop = '12px'; main.appendChild(d); bindDrop(main); }
    const rec = S.files[0];
    if (t.multi && S.files.length < 2 && t.id === 'merge') main.appendChild(el(`<div class="note" style="margin-top:12px">${icon('info')}<span>Add at least one more PDF. Drag the cards to change the order.</span></div>`));
  }
  renderOpts(); updateRun();
  const rec = S.files[0];
  if (!t.multi && rec && t.accept === 'pdf' && !rec.locked && !rec.error && (t.stage || t.picker)) {
    const stage = el('<div class="stage"></div>'); main.appendChild(stage);
    const ctx = { rec, main: stage, side: $('#sideExtra'), st: S.st, getOpts: () => ({ ...S.vals }), setField, onField: (k, cb) => { (S.listeners[k] ||= []).push(cb); cb(S.vals[k]); }, onDestroy: f => S.destroyers.push(f), hideRun: () => { $('#runP').hidden = true; } };
    $('#runP').hidden = false;
    Promise.resolve().then(async () => { if (t.stage) await STAGES[t.stage](ctx); if (t.picker) mountPicker(ctx); }).catch(e => { console.error(e); stage.innerHTML = `<div class="note err">${icon('info')}<span>${esc(e.message || e)}</span></div>`; });
  }
}

function fileCard(r, i) {
  const t = S.tool, c = el(`<div class="fcard" data-id="${r.id}" ${t.multi && S.files.length > 1 ? 'draggable="true"' : ''}></div>`);
  const sub = r.error ? '' : r.locked ? 'Password protected' : t.accept === 'pdf' ? `${r.pages} page${r.pages === 1 ? '' : 's'} · ${fmtSize(r.size)}` : fmtSize(r.size);
  c.innerHTML = `${t.multi && S.files.length > 1 ? `<span class="grip" title="Drag to reorder">${icon('grip')}</span>` : ''}<div class="th">${r.thumb || r.url ? `<img src="${r.thumb || r.url}" alt="">` : icon('file')}</div>
    <div class="meta"><div class="nm" title="${esc(r.name)}">${esc(r.name)}</div><div class="sub">${esc(sub)}</div>${r.error ? `<div class="err">${esc(r.error)}</div>` : ''}${r.locked && !t.allowLocked ? `<div class="err">Locked file — <a href="#/t/unlock" data-unlock style="text-decoration:underline">remove the password first</a></div>` : ''}</div>
    ${t.id === 'merge' && !r.error && !r.locked ? `<input class="rng" type="text" placeholder="all pages" value="${esc(r.range)}" title="Pages to include, e.g. 1-3,5" aria-label="Pages to include from ${esc(r.name)}">` : ''}
    ${t.multi && S.files.length > 1 ? `<button class="btn icon sm ghost" data-mv="-1" aria-label="Move up">↑</button><button class="btn icon sm ghost" data-mv="1" aria-label="Move down">↓</button>` : ''}
    <button class="btn icon sm ghost" data-rm aria-label="Remove ${esc(r.name)}">${icon('x')}</button>`;
  c.onclick = e => {
    if (e.target.closest('[data-rm]')) removeFile(r.id);
    const mv = e.target.closest('[data-mv]'); if (mv) { const j = i + +mv.dataset.mv; if (j >= 0 && j < S.files.length) { [S.files[i], S.files[j]] = [S.files[j], S.files[i]]; renderMain(); } }
    if (e.target.closest('[data-unlock]')) { e.preventDefault(); S.carry = r.file; go('unlock'); }
  };
  const rng = $('.rng', c); if (rng) rng.oninput = () => { r.range = rng.value; };
  if (t.multi) {
    c.ondragstart = e => { S.dragId = r.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); };
    c.ondragend = () => { S.dragId = null; $$('.fcard').forEach(x => x.classList.remove('dragging', 'over')); };
    c.ondragover = e => { if (S.dragId) { e.preventDefault(); c.classList.add('over'); } }; c.ondragleave = () => c.classList.remove('over');
    c.ondrop = e => { if (!S.dragId) return; e.preventDefault(); e.stopPropagation(); const from = S.files.findIndex(x => x.id === S.dragId), [m] = S.files.splice(from, 1); S.files.splice(S.files.findIndex(x => x.id === r.id) + (from < i ? 0 : 1), 0, m); S.dragId = null; renderMain(); };
  }
  return c;
}
function updateRun() {
  const t = S.tool, run = $('#run'); if (!run) return; run.hidden = !!t.noRun;
  const bad = !t.textInput && (!S.files.length || S.files.some(r => r.error || (r.locked && !t.allowLocked))); run.disabled = bad || S.busy; $('#runP').hidden = !!t.noRun;
}

/* ───────── options form ───────── */
function fieldHTML(f) {
  const v = S.vals[f.k], rec = S.files[0];
  const lab = (extra = '') => `<label for="o-${f.k}">${esc(f.label)}${extra}</label>`;
  let h = '';
  switch (f.type) {
    case 'select': h = lab() + `<select id="o-${f.k}" data-k="${f.k}">${f.choices.map(([val, l]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`; break;
    case 'text': case 'password': h = lab() + `<input id="o-${f.k}" type="${f.type}" data-k="${f.k}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" autocomplete="off">`; break;
    case 'number': h = lab() + `<input id="o-${f.k}" type="number" data-k="${f.k}" value="${esc(v)}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.step || 'any'}">`; break;
    case 'range': h = lab(`<output>${v}${f.unit || ''}</output>`) + `<input id="o-${f.k}" type="range" data-k="${f.k}" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${v}" data-unit="${f.unit || ''}">`; break;
    case 'check': h = `<label class="check"><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>`; break;
    case 'seg': h = `<div class="lbl">${esc(f.label)}</div><div class="seg" data-k="${f.k}">${f.choices.map(([val, l]) => `<button type="button" data-v="${val}" class="${val == v ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`; break;
    case 'color': h = `<div class="lbl">${esc(f.label)}</div><div class="sw" data-k="${f.k}">${[...new Set([...SWATCH, v])].map(c => `<button type="button" style="background:${c}" data-v="${c}" class="${c === v ? 'on' : ''}" aria-label="${c}"></button>`).join('')}<input type="color" value="${v}" data-color aria-label="Custom colour"></div>`; break;
    case 'grid9': h = `<div class="lbl">${esc(f.label)}</div><div class="g9" data-k="${f.k}">${POS9.map(p => `<button type="button" data-v="${p}" class="${p === v ? 'on' : ''}" ${f.only && !f.only.includes(p) ? 'disabled' : ''} aria-label="${p}"></button>`).join('')}</div>`; break;
    case 'pages': h = lab() + `<input id="o-${f.k}" type="text" data-k="${f.k}" value="${esc(v)}" placeholder="e.g. 1-3, 5, 8-" autocomplete="off"><div class="qp">${['all', 'odd', 'even', 'first', 'last'].map(q => `<button type="button" data-q="${q}">${q}</button>`).join('')}</div>${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}<div class="help" data-pv></div>`; break;
    case 'textarea': h = lab() + `<textarea id="o-${f.k}" data-k="${f.k}" rows="3" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`; break;
    case 'file': h = lab() + `<input id="o-${f.k}" type="file" accept="${f.accept || '*'}" data-file="${f.k}" style="font-size:13px"><div class="help">${S.aux[f.k] ? esc(S.aux[f.k].name) : 'No file chosen'}</div>`; break;
    case 'note': return `<div class="note" data-f="${f.k}">${icon('info')}<span>${esc(f.text)}</span></div>`;
  }
  if (f.help && f.type !== 'pages') h += `<div class="help">${esc(f.help)}</div>`;
  return `<div class="field" data-f="${f.k}">${h}</div>`;
}
function renderOpts() {
  const t = S.tool, host = $('#optsP'); if (!t.opts.length) { host.innerHTML = ''; return; }
  let html = '', i = 0; const o = t.opts;
  while (i < o.length) { if (o[i].w) { let j = i, g = ''; while (j < o.length && o[j].w) g += fieldHTML(o[j++]); html += `<div class="row2">${g}</div>`; i = j; } else html += fieldHTML(o[i++]); }
  host.innerHTML = `<div class="panel"><div class="panel-h">Options</div>${html}</div>`; updateVisibility();
}
function updateVisibility() {
  const t = S.tool, host = $('#optsP'); if (!host) return;
  t.opts.forEach(f => { const w = $(`[data-f="${f.k}"]`, host); if (w) w.hidden = f.show ? !f.show(S.vals) : false; });
  const rec = S.files[0]; $$('[data-pv]', host).forEach(n => { n.textContent = rec && rec.pages ? `Document has ${rec.pages} page${rec.pages > 1 ? 's' : ''}` : ''; });
}
function setField(k, v) {
  S.vals[k] = v; const host = $('#optsP'); if (host) {
    const inp = $(`[data-k="${k}"]`, host); if (inp) { if (inp.matches('input,select,textarea')) { inp.type === 'checkbox' ? inp.checked = !!v : inp.value = v; const out = inp.parentElement.querySelector('output'); if (out) out.textContent = v + (inp.dataset.unit || ''); }
      else $$('button', inp).forEach(b => b.classList.toggle('on', b.dataset.v == v)); }
    updateVisibility();
  }
  (S.listeners[k] || []).forEach(cb => cb(v)); S.onOpt && S.onOpt();
}
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.k, host = $('#optsP'); if (!k || !host || !host.contains(e.target)) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (e.target.type === 'range') { const out = e.target.parentElement.querySelector('output'); if (out) out.textContent = v + (e.target.dataset.unit || ''); }
  S.vals[k] = v; updateVisibility(); (S.listeners[k] || []).forEach(cb => cb(v)); S.onOpt && S.onOpt();
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.k; if (k && e.target.matches('select,input[type=checkbox]') && $('#optsP')?.contains(e.target)) { S.vals[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; updateVisibility(); (S.listeners[k] || []).forEach(cb => cb(S.vals[k])); S.onOpt && S.onOpt(); }
  if (e.target.dataset && e.target.dataset.file) { S.aux[e.target.dataset.file] = e.target.files[0]; const h = e.target.nextElementSibling; if (h) h.textContent = e.target.files[0] ? e.target.files[0].name : 'No file chosen'; }
  if (e.target.dataset && e.target.dataset.color !== undefined) { const g = e.target.closest('[data-k]'); setField(g.dataset.k, e.target.value); $$('button', g).forEach(b => b.classList.remove('on')); }
});
document.addEventListener('click', e => {
  const host = $('#optsP'); const g = e.target.closest('[data-k]'); const b = e.target.closest('button[data-v]');
  if (b && g && host && host.contains(g)) { setField(g.dataset.k, b.dataset.v); if (g.classList.contains('sw')) $$('button', g).forEach(x => x.classList.toggle('on', x === b)); }
  const q = e.target.closest('button[data-q]'); if (q && host && host.contains(q) && !q.closest('.panel-h')) { const w = q.closest('.field'); setField(w.dataset.f, q.dataset.q); }
  const nav = e.target.closest('[data-go="privacy"]'); if (nav) { e.preventDefault(); if (S.tool) location.hash = '#/'; setTimeout(() => $('#why')?.scrollIntoView({ behavior: 'smooth' }), 60); }
  const car = e.target.closest('[data-carry]'); if (car && S.files[0]) { e.preventDefault(); S.carry = S.files[0].file; go(car.getAttribute('href').split('/').pop()); }
});

/* ───────── run + results ───────── */
function progress(txt, f) { const p = $('#prog'); if (!p) return; if (!p.firstChild) p.innerHTML = `<div class="prog"><div class="prog-t"><span></span><span></span></div><div class="prog-b"><i></i></div></div>`; const sp = $$('.prog-t span', p); sp[0].textContent = txt || 'Working…'; sp[1].textContent = Math.round(clamp(f || 0, 0, 1) * 100) + '%'; $('.prog-b i', p).style.width = clamp(f || 0, 0, 1) * 100 + '%'; }
async function runTool() {
  if (S.busy) return; const t = S.tool; $('#err').innerHTML = ''; S.busy = true; updateRun(); $('#run').innerHTML = 'Working…'; S.results.forEach(r => r.url && URL.revokeObjectURL(r.url)); S.results = []; $('#results').innerHTML = ''; progress('Starting…', 0);
  try {
    if (!t.textInput && !S.files.length) throw new Error('Add a file first');
    const ctx = { o: { ...S.vals }, files: S.files, f: S.files[0], aux: S.aux, st: S.st, text: S.text, progress }; await nextFrame();
    const r = await t.run(ctx); showResults(r); toast('Done', 'ok');
  } catch (e) { console.error(e); $('#err').innerHTML = `<div class="note err" style="margin-top:12px">${icon('info')}<span>${esc(e.message || String(e))}</span></div>`; }
  finally { S.busy = false; $('#prog').innerHTML = ''; const run = $('#run'); if (run) { run.textContent = t.cta || 'Run'; } updateRun(); }
}
const CHAIN = ['merge', 'split', 'reorder', 'rotate', 'watermark', 'pagenum', 'sign', 'addtext', 'redact', 'compress', 'protect', 'crop', 'stamps', 'extract', 'delete', 'info'];
function showResults(r) {
  const host = $('#results'), t = S.tool; let h = '';
  if (r.info) { host.innerHTML = `<div class="res" style="margin-top:16px"><div class="res-h">${icon('checkc')}Finished</div><div style="font-size:14px">${esc(r.info)}</div></div>`; return; }
  if (r.text !== undefined) {
    S.results = [{ name: r.name, blob: new Blob([r.text], { type: 'text/plain' }), kind: 'text' }];
    host.innerHTML = `<div class="res" style="margin-top:16px"><div class="res-h">${icon('checkc')}Text extracted</div><div style="font:12px var(--mono);color:var(--muted)">${r.text.length.toLocaleString()} characters · ${(r.text.match(/\S+/g) || []).length.toLocaleString()} words</div><div class="txt-out">${esc(r.text.slice(0, 20000))}${r.text.length > 20000 ? '\n\n… preview truncated — download for the full text' : ''}</div><div class="bar" style="margin:12px 0 0"><button class="btn pri" data-dl="0">${icon('download')}Download .txt</button><button class="btn" data-copy>${icon('copy')}Copy</button></div></div>`;
    host.onclick = e => { if (e.target.closest('[data-dl]')) download(S.results[0].blob, S.results[0].name); if (e.target.closest('[data-copy]')) { navigator.clipboard?.writeText(r.text); toast('Copied to clipboard', 'ok'); } }; return;
  }
  S.results = r; const imgs = r.every(x => x.kind === 'image'); r.forEach(x => { x.url = URL.createObjectURL(x.blob); });
  const many = r.length > 1, one = r[0];
  h += `<div class="res" style="margin-top:16px"><div class="res-h">${icon('checkc')}${many ? `${r.length} files ready` : 'Your file is ready'}</div>`;
  if (imgs) h += `<div class="imgs">${r.map((x, i) => `<figure><img src="${x.url}" alt="${esc(x.name)}"><figcaption><span>${fmtSize(x.size)}</span><button class="btn sm icon ghost" data-dl="${i}" aria-label="Download ${esc(x.name)}">${icon('download')}</button></figcaption></figure>`).join('')}</div>`;
  else h += `<div class="rlist">${r.map((x, i) => { let delta = ''; if (x.compare) { const p = Math.round((1 - x.size / x.compare) * 100); delta = p > 0 ? ` · <span class="good">${p}% smaller</span>` : ` · <span class="bad">${-p}% larger</span>`; } return `<div class="rfile"><div class="meta"><div class="nm" title="${esc(x.name)}">${esc(x.name)}</div><div class="sub">${fmtSize(x.size)}${delta}${x.note ? ' · ' + esc(x.note) : ''}</div></div>${x.kind === 'pdf' ? `<button class="btn sm icon" data-pv="${i}" aria-label="Preview" title="Preview in new tab">${icon('external')}</button>` : ''}<button class="btn sm pri" data-dl="${i}">${icon('download')}Save</button></div>`; }).join('')}</div>`;
  if (many) h += `<button class="btn dark block" style="margin-top:12px" data-zip>${icon('zip')}Download all as ZIP</button>`;
  if (one.compare && one.size >= one.compare) h += `<div class="note warn" style="margin-top:12px">${icon('info')}<span>The result isn't smaller than the original — this file is already efficiently compressed. Keep the original.</span></div>`;
  if (!many && one.kind === 'pdf') h += `<div class="chain"><label for="chain">Keep going with this file</label><select id="chain"><option value="">Choose another tool…</option>${CHAIN.filter(id => id !== t.id).map(id => `<option value="${id}">${esc(TOOL[id].name)}</option>`).join('')}</select><button class="btn sm block" style="margin-top:8px" data-reuse>Use as input for ${esc(t.name)} again</button></div>`;
  host.innerHTML = h + '</div>';
  host.onclick = async e => {
    const d = e.target.closest('[data-dl]'); if (d) { const x = S.results[+d.dataset.dl]; download(x.blob, x.name); }
    const pv = e.target.closest('[data-pv]'); if (pv) window.open(S.results[+pv.dataset.pv].url, '_blank');
    if (e.target.closest('[data-zip]')) { const z = new JSZip(); S.results.forEach(x => z.file(x.name, x.blob)); const b = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }); download(b, (S.files[0] ? baseName(S.files[0].name) : 'results') + '.zip'); }
    if (e.target.closest('[data-reuse]')) { const nf = new File([S.results[0].blob], S.results[0].name, { type: 'application/pdf' }); nf._gen = true; addFiles([nf]); }
  };
  const ch = $('#chain'); if (ch) ch.onchange = () => { if (!ch.value) return; S.carry = new File([S.results[0].blob], S.results[0].name, { type: 'application/pdf' }); S.carry._gen = true; go(ch.value); };
}

/* ───────── routing, drag & drop, boot ───────── */
function route() {
  const h = location.hash, m = h.match(/^#\/t\/([\w-]+)/), x = h.match(/^#\/x\/([\w-]+)/);
  if (m) openTool(m[1]); else if (x) openText(x[1]); else if (inSet()) openSettings(h.split('/')[2]); else if (h === '#/favorites' || h === '#/history') openFavorites(h === '#/history' ? 'history' : 'fav'); else { S.home.dom = h === '#/pdf' ? 'pdf' : h === '#/text' ? 'text' : (!S.started ? (CFG.defaultTab || 'all') : 'all'); S.home.cat = 'all'; renderHome(); }
  S.started = true;
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
window.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); }, true);
window.addEventListener('drop', e => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); const files = [...e.dataTransfer.files];
  if (S.tool && S.tool.dom === 'text') { loadTextFile(files[0]); return; }
  if (S.tool) addFiles(files); else acceptHomeFile(files);
}, true);
window.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !S.tool) { e.preventDefault(); $('#q')?.focus(); }
  if (e.key === 'Escape') { const m = $('.modal'); if (m) m.remove(); }
});

async function boot() {
  initChrome();
  for (let i = 0; i < 120 && !(window.PDFLib && window.pdfjsLib && window.JSZip); i++) await sleep(100);
  if (!(window.PDFLib && window.pdfjsLib && window.JSZip)) { app.innerHTML = `<div class="boot"><h2 style="color:var(--ink);margin-bottom:8px">Couldn't load the PDF engine</h2><p>${APP_NAME} needs an internet connection the first time it opens to fetch its libraries. Check your connection and reload.</p></div>`; return; }
  ({ PDFDocument, StandardFonts, rgb, degrees, PDFName } = window.PDFLib);
  TOOLS.forEach(t => t.dom = 'pdf'); TTOOLS.forEach(t => t.dom = 'text'); ALLT = [...TOOLS, ...TTOOLS];
  if (!location.hash || location.hash === '#/') S.home.dom = CFG.defaultTab || 'all';
  pdfjsLib.GlobalWorkerOptions.workerSrc = window.__PDFJS_WORKER__ || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  route();
}
boot();
