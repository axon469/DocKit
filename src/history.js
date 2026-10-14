/* ═════════ favorites + history (saved locally: localStorage for lists, IndexedDB for file copies) ═════════ */
const FAV_KEY = 'dockit-favs', HT_KEY = 'dockit-hist-tools', HF_KEY = 'dockit-hist-files', OLD_RECENT = 'dockit-recent';
const IDB_NAME = 'dockit', IDB_STORE = 'files';
const FILE_MAX = 40 * 1024 * 1024, FILES_TOTAL_MAX = 120 * 1024 * 1024, FILES_KEEP = 20, TOOLS_KEEP = 30;
const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/* ── favorites ── */
const favKey = t => t.dom + ':' + t.id;
const getFavs = () => lsGet(FAV_KEY, []).filter(k => typeof k === 'string');
const isFav = t => getFavs().includes(favKey(t));
function toggleFav(t) { const a = getFavs(), k = favKey(t), i = a.indexOf(k); if (i >= 0) a.splice(i, 1); else a.unshift(k); lsSet(FAV_KEY, a); return i < 0; }
const toolByKey = k => { const i = k.indexOf(':'); const d = k.slice(0, i), id = k.slice(i + 1); return ALLT.find(t => t.dom === d && t.id === id); };
const favBtnHTML = t => `<button type="button" class="fav${isFav(t) ? ' on' : ''}" data-fav="${favKey(t)}" aria-pressed="${isFav(t)}" aria-label="${isFav(t) ? 'Remove from favorites' : 'Add to favorites'}">${icon('star')}</button>`;
function syncFavUI() {
  const favs = new Set(getFavs());
  $$('.fav[data-fav]').forEach(b => { const on = favs.has(b.dataset.fav); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites'); });
  const fb = $('#favBtn'); if (fb && S.tool && S.tool.dom) { const on = isFav(S.tool); fb.classList.toggle('on', on); fb.setAttribute('aria-pressed', on); fb.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites'); }
}

/* ── recent tools ── */
const histOn = () => CFG.histOn !== false;
function recordTool(t) { if (!histOn() || !t || !t.dom) return; const k = favKey(t), a = getHistTools().filter(x => x.key !== k); a.unshift({ key: k, ts: Date.now() }); lsSet(HT_KEY, a.slice(0, TOOLS_KEEP)); }
const getHistTools = () => lsGet(HT_KEY, []).filter(x => x && typeof x.key === 'string');
const removeHistTool = k => lsSet(HT_KEY, getHistTools().filter(x => x.key !== k));
function migrateHistory() {
  try {
    if (localStorage.getItem(HT_KEY) === null) { const old = lsGet(OLD_RECENT, []); if (old.length) lsSet(HT_KEY, old.map((k, i) => ({ key: k.startsWith('x:') ? 'text:' + k.slice(2) : 'pdf:' + k, ts: Date.now() - i * 60000 }))); }
  } catch {}
}

/* ── IndexedDB (file copies) ── */
let _db = null;
const idb = () => _db ||= new Promise((res, rej) => { const r = indexedDB.open(IDB_NAME, 1); r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE, { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => { _db = null; rej(r.error); }; });
const idbReq = (mode, fn) => idb().then(db => new Promise((res, rej) => { const tx = db.transaction(IDB_STORE, mode); let rq; try { rq = fn(tx.objectStore(IDB_STORE)); } catch (e) { return rej(e); } tx.oncomplete = () => res(rq && rq.result); tx.onerror = tx.onabort = () => rej(tx.error); }));
const idbPut = (id, blob) => idbReq('readwrite', s => s.put({ id, blob }));
const idbGet = id => idbReq('readonly', s => s.get(id)).then(r => r && r.blob);
const idbDel = id => idbReq('readwrite', s => s.delete(id));
const idbClear = () => idbReq('readwrite', s => s.clear());

/* ── recent files ── */
const getHistFiles = () => lsGet(HF_KEY, []).filter(x => x && x.id);
async function pruneFiles(list) {
  let total = 0;
  for (const m of list) if (m.stored) { total += m.size; if (total > FILES_TOTAL_MAX) { try { await idbDel(m.id); } catch {} m.stored = false; } }
  while (list.length > FILES_KEEP) { const m = list.pop(); if (m.stored) { try { await idbDel(m.id); } catch {} } }
}
async function recordFile(file, { dom, tool, kind }) {
  if (!histOn() || !file || file._gen) return;
  try {
    const list = getHistFiles(), sig = `${dom}:${tool}:${file.name}:${file.size}`; let m = list.find(x => x.sig === sig);
    if (m) list.splice(list.indexOf(m), 1); else m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), sig, name: file.name, size: file.size, type: file.type || '', kind, dom, tool, stored: false };
    m.ts = Date.now(); list.unshift(m);
    if (CFG.histFiles !== false && file.size <= FILE_MAX && !m.stored) { try { await idbPut(m.id, file); m.stored = true; } catch { m.stored = false; } }
    await pruneFiles(list); lsSet(HF_KEY, list);
  } catch (e) { console.warn('history', e); }
}
async function removeHistFile(id) { lsSet(HF_KEY, getHistFiles().filter(x => x.id !== id)); try { await idbDel(id); } catch {} }
async function clearHistory() { lsSet(HT_KEY, []); lsSet(HF_KEY, []); try { await idbClear(); } catch {} }
async function reopenFile(id) {
  const m = getHistFiles().find(x => x.id === id); if (!m) return;
  let blob = null; if (m.stored) { try { blob = await idbGet(id); } catch {} }
  if (!blob) { const list = getHistFiles(); const x = list.find(y => y.id === id); if (x) { x.stored = false; lsSet(HF_KEY, list); } renderFavBody(); return toast('This file is no longer stored on this device', 'err'); }
  const ok = ALLT.some(t => t.dom === m.dom && t.id === m.tool);
  if (m.kind === 'text') { S.carry = null; S.carryText = { name: m.name, text: await blob.text() }; } else { S.carryText = null; S.carry = new File([blob], m.name, { type: m.type || blob.type }); }
  recordTool({ dom: m.dom, id: m.tool });
  if (!ok) { location.hash = '#/'; return; }
  m.dom === 'pdf' ? go(m.tool) : goText(m.tool);
}
function ago(ts) {
  const s = (Date.now() - ts) / 1000; if (s < 45) return 'Just now'; const m = Math.round(s / 60); if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago'); const d = Math.round(h / 24); if (d === 1) return 'Yesterday'; if (d < 7) return d + ' days ago'; return new Date(ts).toLocaleDateString();
}

/* ── pages: Favorites | History ── */
function openFavorites(tab) {
  cleanup(); S.tool = null; S.onOpt = null; S.favTab = tab === 'history' ? 'history' : 'fav'; setChrome({ settings: true, title: S.favTab === 'history' ? 'History' : 'Favorites' });
  app.innerHTML = `<div class="wrap ws set"><nav class="crumbs"><a href="#/">${icon('back')}All tools</a><span>/</span><span style="color:var(--ink2)" id="favCrumb"></span></nav>
    <header class="ws-head" style="--c:#e8a317"><span class="ic">${icon('star')}</span><div><h1>Favorites &amp; history</h1><p>Your starred tools and everything you used recently — saved only on this device.</p></div></header>
    <div class="seg page-tabs" role="tablist"><button type="button" data-tab="fav">Favorites <b id="nFav"></b></button><button type="button" data-tab="history">History <b id="nHist"></b></button></div>
    <div id="favBody" style="max-width:900px"></div></div>`;
  renderFavBody();
}
function emptyState(ic, title, text, btn) { return `<div class="empty-st"><div class="big">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${btn || ''}</div>`; }
function renderFavBody() {
  const body = $('#favBody'); if (!body) return; const tab = S.favTab;
  const favs = getFavs().map(toolByKey).filter(Boolean), ht = getHistTools().map(x => ({ ...x, t: toolByKey(x.key) })).filter(x => x.t), hf = getHistFiles();
  $$('.page-tabs button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-pressed', b.dataset.tab === tab); });
  $('#nFav').textContent = favs.length; $('#nHist').textContent = ht.length + hf.length; const fc = $('#favCrumb'); if (fc) fc.textContent = tab === 'history' ? 'History' : 'Favorites';
  if (tab === 'fav') {
    body.innerHTML = favs.length ? `<div class="bar" style="margin-bottom:14px"><span class="cnt">${favs.length} tools</span><span class="sp"></span><button type="button" class="btn sm" data-clear="favs">Clear favorites</button></div><div class="grid">${favs.map(toolCard).join('')}</div>`
      : emptyState('star', 'No favorites yet', 'Tap the star on any tool to keep it here for quick access.', `<a class="btn pri" href="#/">Browse tools</a>`);
    return;
  }
  const toolRow = x => { const t = x.t, ct = catOf(t); return `<div class="h-item" style="--c:${ct.c}"><span class="ic">${icon(t.dom === 'pdf' ? t.icon : ct.i)}</span><div class="meta"><b>${esc(t.name)}</b><span>${esc(ago(x.ts))}</span></div><button type="button" class="btn sm" data-h="open" data-key="${esc(x.key)}">Open</button><button type="button" class="btn icon sm ghost" data-h="rmtool" data-key="${esc(x.key)}" aria-label="Remove from history">${icon('x')}</button></div>`; };
  const fileRow = m => { const t = ALLT.find(y => y.dom === m.dom && y.id === m.tool), ic = m.kind === 'image' ? 'image' : m.kind === 'text' ? 'text' : 'file'; return `<div class="h-item${m.stored ? '' : ' gone'}" style="--c:#475569"><span class="ic">${icon(ic)}</span><div class="meta"><b title="${esc(m.name)}">${esc(m.name)}</b><span>${esc(fmtSize(m.size))}</span> · <span>${esc(t ? t.name : 'Tool')}</span> · <span>${esc(ago(m.ts))}</span>${m.stored ? '' : `<br><span class="off">File copy not stored</span>`}</div>${m.stored ? `<button type="button" class="btn sm pri" data-h="reopen" data-id="${m.id}">Reopen</button>` : `<button type="button" class="btn sm" disabled>Unavailable</button>`}<button type="button" class="btn icon sm ghost" data-h="rmfile" data-id="${m.id}" aria-label="Remove from history">${icon('x')}</button></div>`; };
  const off = !histOn() ? `<div class="note warn" style="margin-bottom:16px">${icon('info')}<span>History is turned off. Turn it on in <a href="#/settings" style="text-decoration:underline">Settings</a> to keep track of tools and files.</span></div>` : '';
  body.innerHTML = off + (ht.length || hf.length ? `<div class="bar" style="margin-bottom:6px"><span class="cnt">${ht.length + hf.length} items</span><span class="sp"></span><button type="button" class="btn sm" data-clear="history">Clear history</button></div>` : '') +
    `<div class="sec-h" style="margin-top:12px"><h2>Recent tools</h2><span class="cnt">${ht.length}</span><hr></div>` + (ht.length ? `<div class="h-list">${ht.map(toolRow).join('')}</div>` : emptyState('history', 'No recent tools', 'Tools you open will show up here.')) +
    `<div class="sec-h" style="margin-top:28px"><h2>Recent files</h2><span class="cnt">${hf.length}</span><hr></div>` + (hf.length ? `<div class="h-list">${hf.map(fileRow).join('')}</div>` : emptyState('file', 'No recent files', 'Files you open in a tool will be listed here so you can reopen them.')) +
    `<div class="note" style="margin-top:18px">${icon('shield')}<span>History never leaves this device. File copies are kept privately in your browser storage and can be removed at any time.</span></div>`;
}

/* ── delegated clicks: stars, tabs, history actions, two-tap clear ── */
document.addEventListener('click', async e => {
  const fb = e.target.closest('.fav[data-fav]');
  if (fb) { e.preventDefault(); e.stopPropagation(); const t = toolByKey(fb.dataset.fav); if (!t) return; const on = toggleFav(t); syncFavUI(); toast(on ? 'Added to favorites' : 'Removed from favorites', on ? 'ok' : ''); if (S.favTab && !S.tool && /^#\/(favorites|history)/.test(location.hash)) renderFavBody(); else if (!S.tool && $('#catalog')) paintCatalog(); return; }
  if (e.target.closest('#favBtn') && S.tool) { const on = toggleFav(S.tool); syncFavUI(); toast(on ? 'Added to favorites' : 'Removed from favorites', on ? 'ok' : ''); return; }
  const tb = e.target.closest('.page-tabs [data-tab]'); if (tb) { S.favTab = tb.dataset.tab; history.replaceState(null, '', S.favTab === 'history' ? '#/history' : '#/favorites'); setChrome({ settings: true, title: S.favTab === 'history' ? 'History' : 'Favorites' }); renderFavBody(); return; }
  const ha = e.target.closest('[data-h]');
  if (ha) {
    const a = ha.dataset.h;
    if (a === 'open') { const t = toolByKey(ha.dataset.key); if (t) t.dom === 'pdf' ? go(t.id) : goText(t.id); }
    else if (a === 'rmtool') { removeHistTool(ha.dataset.key); renderFavBody(); }
    else if (a === 'rmfile') { await removeHistFile(ha.dataset.id); renderFavBody(); }
    else if (a === 'reopen') { ha.disabled = true; await reopenFile(ha.dataset.id); }
    return;
  }
  const cl = e.target.closest('[data-clear]');
  if (cl) {
    const kind = cl.dataset.clear;
    if (!cl.dataset.armed) { const txt = cl.textContent; cl.dataset.armed = '1'; cl.dataset.txt = txt; cl.textContent = 'Tap again to confirm'; cl._t = setTimeout(() => { cl.dataset.armed = ''; cl.textContent = txt; }, 3000); return; }
    clearTimeout(cl._t);
    if (kind === 'history') { await clearHistory(); toast('History cleared', 'ok'); } else { lsSet(FAV_KEY, []); syncFavUI(); toast('Favorites cleared', 'ok'); }
    if (S.favTab && /^#\/(favorites|history)/.test(location.hash)) renderFavBody(); else if (inSet()) paintSettings(); else if ($('#catalog')) paintCatalog();
  }
});
