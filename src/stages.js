/* ═════════ interactive stages ═════════ */
const STAGES = {};

/* ── thumbnail page picker (synced with the "pages" field) ── */
function mountPicker(ctx) {
  const { rec, main, setField, onField } = ctx, sel = new Set();
  const wrap = el(`<div class="panel"><div class="bar"><div class="panel-h" style="margin:0">Click pages to select</div><span class="sp"></span><span class="cnt"></span>
    <button class="btn sm" data-a="all">All</button><button class="btn sm" data-a="odd">Odd</button><button class="btn sm" data-a="even">Even</button><button class="btn sm" data-a="none">Clear</button></div><div class="tgrid"></div></div>`);
  const grid = $('.tgrid', wrap), cnt = $('.cnt', wrap);
  const paint = () => { $$('.tile', grid).forEach(t => t.classList.toggle('sel', sel.has(+t.dataset.n))); cnt.textContent = `${sel.size} of ${rec.pages} selected`; };
  for (let n = 1; n <= rec.pages; n++) {
    const t = el(`<div class="tile pick" data-n="${n}"><div class="pgbox"><img alt="Page ${n}" draggable="false"></div><div class="n">${n}</div></div>`);
    lazyThumb($('img', t), rec, n); t.onclick = () => { sel.has(n) ? sel.delete(n) : sel.add(n); paint(); setField('pages', toRanges(sel)); }; grid.appendChild(t);
  }
  wrap.onclick = e => { const a = e.target.dataset.a; if (!a) return; sel.clear(); if (a === 'all') range(1, rec.pages).forEach(n => sel.add(n)); if (a === 'odd') range(1, rec.pages).filter(n => n % 2).forEach(n => sel.add(n)); if (a === 'even') range(1, rec.pages).filter(n => !(n % 2)).forEach(n => sel.add(n)); paint(); setField('pages', a === 'all' ? 'all' : toRanges(sel)); };
  onField('pages', v => { sel.clear(); try { const t = (v || '').trim().toLowerCase(); if (t) parsePages(v, rec.pages).forEach(n => sel.add(n)); } catch {} paint(); });
  main.appendChild(wrap); paint();
}

/* ── visual page organizer ── */
STAGES.organize = ctx => {
  const { rec, main, st } = ctx; let id = 0; st.pages = range(0, rec.pages - 1).map(i => ({ i, rot: 0, id: ++id }));
  const wrap = el(`<div class="panel"><div class="bar"><div class="panel-h" style="margin:0">Drag pages to reorder</div><span class="sp"></span><span class="cnt"></span><button class="btn sm" data-a="rev">${icon('reverse')}Reverse</button><button class="btn sm" data-a="reset">Reset</button></div><div class="tgrid"></div></div>`);
  const grid = $('.tgrid', wrap); let dragId = null;
  const draw = () => {
    grid.innerHTML = ''; $('.cnt', wrap).textContent = `${st.pages.length} pages`;
    st.pages.forEach((p, k) => {
      const t = el(`<div class="tile org" draggable="true" data-id="${p.id}"><div class="pgbox"><img alt="" draggable="false" style="transform:rotate(${p.rot}deg)"></div><div class="n">${k + 1}${p.i + 1 !== k + 1 ? ` <span style="opacity:.5">(was ${p.i + 1})</span>` : ''}</div>
        <div class="tb"><button data-a="l" title="Move earlier" aria-label="Move earlier">${icon('left')}</button><button data-a="rot" title="Rotate" aria-label="Rotate">${icon('rotate')}</button><button data-a="dup" title="Duplicate" aria-label="Duplicate">${icon('copy')}</button><button class="del" data-a="del" title="Delete" aria-label="Delete">${icon('trash')}</button><button data-a="r" title="Move later" aria-label="Move later">${icon('right')}</button></div></div>`);
      lazyThumb($('img', t), rec, p.i + 1); grid.appendChild(t);
      t.ondragstart = e => { dragId = p.id; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); };
      t.ondragend = () => { dragId = null; $$('.tile', grid).forEach(x => x.classList.remove('dragging', 'over')); };
      t.ondragover = e => { if (dragId) { e.preventDefault(); t.classList.add('over'); } }; t.ondragleave = () => t.classList.remove('over');
      t.ondrop = e => { e.preventDefault(); if (!dragId || dragId === p.id) return; const from = st.pages.findIndex(x => x.id === dragId), [m] = st.pages.splice(from, 1); st.pages.splice(st.pages.findIndex(x => x.id === p.id) + (from < k ? 1 : 0), 0, m); draw(); };
    });
  };
  grid.onclick = e => {
    const b = e.target.closest('button'); if (!b) return; const t = b.closest('.tile'), k = st.pages.findIndex(x => x.id === +t.dataset.id), p = st.pages[k], a = b.dataset.a;
    if (a === 'rot') p.rot = (p.rot + 90) % 360; else if (a === 'del') st.pages.splice(k, 1); else if (a === 'dup') st.pages.splice(k + 1, 0, { ...p, id: ++id });
    else if (a === 'l' && k > 0) [st.pages[k - 1], st.pages[k]] = [st.pages[k], st.pages[k - 1]]; else if (a === 'r' && k < st.pages.length - 1) [st.pages[k + 1], st.pages[k]] = [st.pages[k], st.pages[k + 1]];
    draw();
  };
  wrap.querySelector('.bar').onclick = e => { const a = e.target.closest('button')?.dataset.a; if (a === 'rev') { st.pages.reverse(); draw(); } if (a === 'reset') { st.pages = range(0, rec.pages - 1).map(i => ({ i, rot: 0, id: ++id })); draw(); } };
  main.appendChild(wrap); draw();
};

/* ── single-page viewer with an overlay layer ── */
class PageView {
  constructor(host, rec, { onPage, maxW = 760 } = {}) {
    this.rec = rec; this.n = 1; this.zoom = 1; this.maxW = maxW; this.onPage = onPage; this.host = host;
    host.innerHTML = `<div class="pv"><div class="pv-bar"><button class="btn sm icon" data-a="prev" aria-label="Previous page">${icon('left')}</button><span class="pg"><input type="number" min="1" max="${rec.pages}" value="1" aria-label="Page number"> / ${rec.pages}</span><button class="btn sm icon" data-a="next" aria-label="Next page">${icon('right')}</button><span class="sp"></span>
      <button class="btn sm icon" data-a="zo" aria-label="Zoom out">${icon('minus')}</button><span class="cnt" data-z>100%</span><button class="btn sm icon" data-a="zi" aria-label="Zoom in">${icon('plus')}</button></div><div class="pv-sc"><div class="pv-page"><canvas></canvas><div class="pv-layer"></div></div></div></div>`;
    this.cv = $('canvas', host); this.layer = $('.pv-layer', host); this.pageEl = $('.pv-page', host); this.inp = $('input', host); this.sc = $('.pv-sc', host);
    host.onclick = e => { const a = e.target.closest('button')?.dataset.a; if (!a) return; if (a === 'prev') this.go(this.n - 1); if (a === 'next') this.go(this.n + 1); if (a === 'zi') this.setZoom(this.zoom * 1.2); if (a === 'zo') this.setZoom(this.zoom / 1.2); };
    this.inp.onchange = () => this.go(+this.inp.value);
    this.ro = new ResizeObserver(() => { clearTimeout(this._rt); this._rt = setTimeout(() => { if (Math.abs(this.sc.clientWidth - (this._lastW || 0)) > 24) this.show(this.n); }, 150); }); this.ro.observe(this.sc);
  }
  setZoom(z) { this.zoom = clamp(z, .5, 3); $('[data-z]', this.host).textContent = Math.round(this.zoom * 100) + '%'; this.show(this.n); }
  go(n) { n = clamp(Math.round(n) || 1, 1, this.rec.pages); if (n !== this.n || !this.vp1) this.show(n); else this.inp.value = n; }
  async show(n) {
    this.n = n; this.inp.value = n; const tok = this._tok = {};
    const pg = await this.rec.pdfjs.getPage(n), v1 = pg.getViewport({ scale: 1 }); this.vp1 = v1; this._lastW = this.sc.clientWidth;
    const cssW = Math.min(this.maxW, Math.max(260, this.sc.clientWidth - 8)) * this.zoom; this.k = cssW / v1.width;
    const dpr = Math.min(2, devicePixelRatio || 1), vp = pg.getViewport({ scale: this.k * dpr });
    try { this.task && this.task.cancel(); } catch {}
    const off = document.createElement('canvas'); off.width = Math.ceil(vp.width); off.height = Math.ceil(vp.height);
    const ctx = off.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, off.width, off.height);
    this.task = pg.render({ canvasContext: ctx, viewport: vp });
    try { await this.task.promise; } catch (e) { return; }
    if (tok !== this._tok) return;
    this.cv.width = off.width; this.cv.height = off.height; this.cv.getContext('2d').drawImage(off, 0, 0);
    this.cv.style.width = cssW + 'px'; this.cv.style.height = v1.height * this.k + 'px'; this.pageEl.style.width = cssW + 'px'; this.pageEl.style.height = v1.height * this.k + 'px';
    this.onPage && this.onPage(n, this);
  }
  pt(e) { const r = this.layer.getBoundingClientRect(); return { x: (e.clientX - r.left) / this.k, y: (e.clientY - r.top) / this.k }; }
  destroy() { this.ro.disconnect(); try { this.task && this.task.cancel(); } catch {} }
}

/* ── signature creator ── */
function signatureModal(done) {
  const m = el(`<div class="modal"><div class="modal-c"><h3>Create your signature<button class="btn icon sm ghost" data-a="x" aria-label="Close">${icon('x')}</button></h3>
    <div class="seg" style="margin-bottom:14px"><button class="on" data-t="draw">Draw</button><button data-t="type">Type</button><button data-t="up">Upload</button></div>
    <div data-p="draw"><canvas class="pad" width="1200" height="360"></canvas><div class="bar" style="margin-top:12px"><div class="sw" data-ink></div><span class="sp"></span><button class="btn sm" data-a="clear">Clear</button></div></div>
    <div data-p="type" hidden><input type="text" placeholder="Type your name" data-name style="height:46px;font-size:18px"><div class="row2" style="margin-top:10px"><select data-font><option value="Dancing Script">Dancing Script</option><option value="Caveat">Caveat</option><option value="cursive">Classic cursive</option></select><div class="sw" data-ink2></div></div><canvas class="pad" width="1200" height="360" data-tc style="margin-top:12px;cursor:default"></canvas></div>
    <div data-p="up" hidden><input type="file" accept="image/*" data-file><label class="check" style="margin-top:12px"><input type="checkbox" data-bg checked> Remove white background</label><canvas class="pad" width="1200" height="360" data-uc style="margin-top:12px;cursor:default"></canvas></div>
    <div class="bar" style="margin-top:16px"><span class="sp"></span><button class="btn" data-a="x">Cancel</button><button class="btn pri" data-a="use">Use signature</button></div></div></div>`);
  document.body.appendChild(m);
  const pad = $('.pad', m), pc = pad.getContext('2d'); let ink = '#111827', tab = 'draw', drawing = false, last = null, has = false;
  const inkBtns = host => { host.innerHTML = ['#111827', '#1d4ed8', '#7c3aed'].map((c, i) => `<button style="background:${c}" data-c="${c}" class="${i ? '' : 'on'}"></button>`).join(''); host.onclick = e => { const c = e.target.dataset.c; if (!c) return; ink = c; $$('button', host).forEach(b => b.classList.toggle('on', b.dataset.c === c)); renderType(); }; };
  inkBtns($('[data-ink]', m)); inkBtns($('[data-ink2]', m));
  const pos = e => { const r = pad.getBoundingClientRect(); return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height }; };
  pad.onpointerdown = e => { drawing = true; has = true; last = pos(e); pad.setPointerCapture(e.pointerId); pc.fillStyle = ink; pc.beginPath(); pc.arc(last.x, last.y, 3.5, 0, 7); pc.fill(); };
  pad.onpointermove = e => { if (!drawing) return; const p = pos(e); pc.strokeStyle = ink; pc.lineWidth = 7; pc.lineCap = pc.lineJoin = 'round'; pc.beginPath(); pc.moveTo(last.x, last.y); pc.lineTo(p.x, p.y); pc.stroke(); last = p; };
  pad.onpointerup = pad.onpointercancel = () => drawing = false;
  const tc = $('[data-tc]', m), tcx = tc.getContext('2d'), nameIn = $('[data-name]', m), fontSel = $('[data-font]', m);
  const renderType = async () => { tcx.clearRect(0, 0, tc.width, tc.height); const t = nameIn.value.trim(); if (!t) return; const fam = fontSel.value; try { await document.fonts.load(`90px "${fam}"`); } catch {} let px = 150; tcx.font = `${px}px "${fam}", cursive`; while (tcx.measureText(t).width > tc.width - 60 && px > 30) { px -= 6; tcx.font = `${px}px "${fam}", cursive`; } tcx.fillStyle = ink; tcx.textBaseline = 'middle'; tcx.fillText(t, 30, tc.height / 2); };
  nameIn.oninput = renderType; fontSel.onchange = renderType;
  const uc = $('[data-uc]', m), ucx = uc.getContext('2d'); let upImg = null;
  const renderUp = () => { ucx.clearRect(0, 0, uc.width, uc.height); if (!upImg) return; const k = Math.min(uc.width / upImg.width, uc.height / upImg.height); const w = upImg.width * k, h = upImg.height * k; ucx.drawImage(upImg, (uc.width - w) / 2, (uc.height - h) / 2, w, h);
    if ($('[data-bg]', m).checked) { const d = ucx.getImageData(0, 0, uc.width, uc.height), a = d.data; for (let i = 0; i < a.length; i += 4) { const l = .3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]; if (l > 235) a[i + 3] = 0; else if (l > 150) a[i + 3] = Math.min(a[i + 3], (235 - l) * 3); } ucx.putImageData(d, 0, 0); } };
  $('[data-file]', m).onchange = async e => { const f = e.target.files[0]; if (f) { upImg = await createImageBitmap(f); renderUp(); } }; $('[data-bg]', m).onchange = renderUp;
  m.onclick = e => {
    const b = e.target.closest('button'); if (e.target === m) return m.remove(); if (!b) return; const a = b.dataset.a, t = b.dataset.t;
    if (t) { tab = t; $$('.seg button', m).forEach(x => x.classList.toggle('on', x === b)); $$('[data-p]', m).forEach(p => p.hidden = p.dataset.p !== t); }
    if (a === 'x') m.remove(); if (a === 'clear') { pc.clearRect(0, 0, pad.width, pad.height); has = false; }
    if (a === 'use') {
      const src = tab === 'draw' ? pad : tab === 'type' ? tc : uc; if (tab === 'draw' && !has) return toast('Draw your signature first', 'err');
      const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (d[(y * src.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return toast('Nothing to use yet', 'err');
      const pd = 8, out = document.createElement('canvas'); out.width = x1 - x0 + pd * 2; out.height = y1 - y0 + pd * 2; out.getContext('2d').drawImage(src, x0, y0, x1 - x0, y1 - y0, pd, pd, x1 - x0, y1 - y0);
      out.toBlob(bl => { done(URL.createObjectURL(bl), out.width / out.height); m.remove(); }, 'image/png');
    }
  };
}

/* ── placing signatures / text / images ── */
function stagePlace(ctx, kind) {
  const { rec, main, side, st } = ctx; st.items = []; st.sel = null; st.sigs ??= [];
  const bar = el(`<div class="panel" style="margin-bottom:12px"></div>`), host = el('<div></div>'); main.append(bar, host);
  let pv, imgSrc = null, imgAR = 1;
  const hint = { sign: 'Create a signature, then click the page to place it.', text: 'Click anywhere on the page to add text.', image: 'Upload an image, then click the page to place it.' }[kind];
  const ins = el(`<div class="panel" hidden></div>`); side.appendChild(ins);
  const drawBar = () => {
    bar.innerHTML = `<div class="bar" style="margin:0"><div class="note" style="flex:1;min-width:200px">${icon('info')}<span>${hint}</span></div>${kind === 'sign' ? `<button class="btn pri" data-a="sig">${icon('pen')}New signature</button>` : ''}${kind === 'image' ? `<label class="btn pri" style="cursor:pointer">${icon('upload')}Choose image<input type="file" accept="image/*" hidden data-img></label>` : ''}</div>
      ${kind === 'sign' && st.sigs.length ? `<div class="sigs" style="margin:12px 0 0">${st.sigs.map((s, i) => `<button data-a="usesig" data-i="${i}" title="Use this signature"><img src="${s.url}" alt="Saved signature"></button>`).join('')}</div>` : ''}`;
  };
  drawBar();
  bar.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'sig') signatureModal((url, ar) => { st.sigs.push({ url, ar }); imgSrc = url; imgAR = ar; drawBar(); toast('Signature ready — click the page to place it', 'ok'); }); if (b.dataset.a === 'usesig') { const s = st.sigs[+b.dataset.i]; imgSrc = s.url; imgAR = s.ar; toast('Click the page to place it'); } };
  bar.onchange = async e => { if (e.target.dataset.img !== undefined) { const f = e.target.files[0]; if (!f) return; imgSrc = URL.createObjectURL(f); const bm = await createImageBitmap(f); imgAR = bm.width / bm.height; toast('Click the page to place it'); } };

  let uidc = 0; const redrawItems = () => {
    pv.layer.innerHTML = ''; st.items.filter(it => it.page === pv.n).forEach(it => {
      const d = el(`<div class="ov${st.sel === it.id ? ' sel' : ''}"></div>`), k = pv.k; d.style.cssText = `left:${it.x * k}px;top:${it.y * k}px;`;
      if (it.type === 'img') { d.style.width = it.w * k + 'px'; d.style.height = it.h * k + 'px'; d.innerHTML = `<img src="${it.src}" alt=""><span class="rz"></span>`; }
      else { d.innerHTML = `<div class="t" style="font-size:${it.size * k}px;line-height:1.2;color:${it.color};font-weight:${it.bold ? 700 : 400};font-family:${it.font === 'TimesRoman' ? 'Times New Roman,serif' : it.font === 'Courier' ? 'Courier New,monospace' : 'Helvetica,Arial,sans-serif'}">${esc(it.text || ' ')}</div>`; }
      d.onpointerdown = e => {
        e.stopPropagation(); st.sel = it.id; const p0 = pv.pt(e), o = { x: it.x, y: it.y, w: it.w }, rz = e.target.classList.contains('rz'); d.setPointerCapture(e.pointerId);
        d.onpointermove = ev => { const p = pv.pt(ev); if (rz && it.type === 'img') { it.w = clamp(o.w + (p.x - p0.x), 20, pv.vp1.width); it.h = it.w / (it.ar || 1); d.style.width = it.w * k + 'px'; d.style.height = it.h * k + 'px'; } else { it.x = clamp(o.x + p.x - p0.x, -10, pv.vp1.width - 10); it.y = clamp(o.y + p.y - p0.y, -10, pv.vp1.height - 10); d.style.left = it.x * k + 'px'; d.style.top = it.y * k + 'px'; } };
        d.onpointerup = () => { d.onpointermove = null; }; $$('.ov', pv.layer).forEach(x => x.classList.remove('sel')); d.classList.add('sel'); inspect();
      }; pv.layer.appendChild(d);
    });
  };
  const inspect = () => {
    const it = st.items.find(x => x.id === st.sel); ins.hidden = !it; if (!it) return;
    const sc = `<div class="field"><label>Apply to</label><select data-k="scope"><option value="page">This page only</option><option value="all">Every page</option><option value="first">First page</option><option value="last">Last page</option></select></div>`;
    ins.innerHTML = `<div class="panel-h">${it.type === 'img' ? 'Selected image' : 'Selected text'}<button class="btn sm" data-del>${icon('trash')}Remove</button></div>` + (it.type === 'text' ? `<div class="field"><label>Text</label><textarea data-k="text" rows="2" style="min-height:60px">${esc(it.text)}</textarea></div>
      <div class="field"><label>Size <output>${it.size}pt</output></label><input type="range" min="8" max="96" value="${it.size}" data-k="size"></div><div class="row2"><div class="field"><label>Font</label><select data-k="font"><option value="Helvetica">Helvetica</option><option value="TimesRoman">Times</option><option value="Courier">Courier</option></select></div><div class="field"><label>Colour</label><div class="sw">${SWATCH.map(c => `<button style="background:${c}" data-c="${c}" class="${it.color === c ? 'on' : ''}"></button>`).join('')}</div></div></div><label class="check" style="margin-bottom:14px"><input type="checkbox" data-k="bold" ${it.bold ? 'checked' : ''}> Bold</label>` : `<div class="field"><label>Width <output>${Math.round(it.w)}pt</output></label><input type="range" min="20" max="${Math.round(pv.vp1.width)}" value="${Math.round(it.w)}" data-k="w"></div>`) + sc;
    $('[data-k=scope]', ins).value = it.scope; const f = $('[data-k=font]', ins); if (f) f.value = it.font;
  };
  ins.oninput = ins.onchange = e => { const it = st.items.find(x => x.id === st.sel), k = e.target.dataset.k; if (!it || !k) return; let v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'size' || k === 'w') v = +v; it[k] = v; if (k === 'w') it.h = it.w / (it.ar || 1); const o = e.target.parentElement.querySelector('output'); if (o) o.textContent = v + (k === 'size' ? 'pt' : 'pt'); redrawItems(); };
  ins.onclick = e => { if (e.target.closest('[data-del]')) { st.items = st.items.filter(x => x.id !== st.sel); st.sel = null; inspect(); redrawItems(); } const c = e.target.dataset.c; if (c) { const it = st.items.find(x => x.id === st.sel); it.color = c; inspect(); redrawItems(); } };

  pv = new PageView(host, rec, { onPage: redrawItems });
  pv.layer.onpointerdown = e => {
    if (e.target !== pv.layer) return; const p = pv.pt(e); st.sel = null;
    if (kind === 'text') { const it = { id: ++uidc, type: 'text', page: pv.n, x: p.x - 4, y: p.y - 10, text: 'Your text', size: 14, color: '#000000', font: 'Helvetica', bold: false, scope: 'page' }; st.items.push(it); st.sel = it.id; }
    else { if (!imgSrc) return toast(kind === 'sign' ? 'Create a signature first' : 'Choose an image first', 'err'); const w = kind === 'sign' ? 160 : 140; const it = { id: ++uidc, type: 'img', page: pv.n, src: imgSrc, ar: imgAR, w, h: w / imgAR, x: p.x - w / 2, y: p.y - w / imgAR / 2, scope: kind === 'sign' ? 'page' : 'page', opacity: 1 }; st.items.push(it); st.sel = it.id; }
    inspect(); redrawItems();
  };
  pv.show(1); ctx.onDestroy(() => pv.destroy());
}
STAGES.sign = c => stagePlace(c, 'sign'); STAGES.text = c => stagePlace(c, 'text'); STAGES.image = c => stagePlace(c, 'image');

/* ── redaction ── */
STAGES.redact = ctx => {
  const { rec, main, side, st } = ctx; st.rects = [];
  const tools = el(`<div class="panel" style="margin-bottom:12px"><div class="bar" style="margin:0"><div class="note" style="flex:1;min-width:200px">${icon('info')}<span>Drag on the page to draw black boxes. Click a box to remove it.</span></div></div></div>`), host = el('<div></div>'); main.append(tools, host);
  const auto = el(`<div class="panel"><div class="panel-h">Find &amp; redact text</div><div class="field"><input type="text" placeholder="e.g. John Smith, 4111, @acme.com" data-q><div class="help">Separate several terms with commas. Matches on every page become redaction boxes.</div></div><button class="btn block" data-find>${icon('wand')}Find &amp; mark</button><div class="help" data-msg style="margin-top:8px"></div></div>`),
    list = el(`<div class="panel"><div class="panel-h">Redactions <button class="btn sm" data-clear>Clear all</button></div><div class="mini-list" data-l></div></div>`); side.append(auto, list);
  let pv; const paintList = () => { const l = $('[data-l]', list); l.innerHTML = st.rects.length ? Object.entries(st.rects.reduce((a, r) => (a[r.page] = (a[r.page] || 0) + 1, a), {})).map(([p, c]) => `<div><span>Page ${p}</span><span>${c} area${c > 1 ? 's' : ''}</span></div>`).join('') : '<div style="color:var(--muted)">None yet</div>'; };
  const redraw = () => { pv.layer.innerHTML = ''; st.rects.filter(r => r.page === pv.n).forEach(r => { const d = el('<div class="rd" title="Click to remove"></div>'), k = pv.k; d.style.cssText = `left:${r.x * k}px;top:${r.y * k}px;width:${r.w * k}px;height:${r.h * k}px`; d.onpointerdown = e => { e.stopPropagation(); st.rects = st.rects.filter(x => x !== r); redraw(); paintList(); }; pv.layer.appendChild(d); }); paintList(); };
  pv = new PageView(host, rec, { onPage: redraw });
  pv.layer.onpointerdown = e => {
    if (e.target !== pv.layer) return; const p0 = pv.pt(e), d = el('<div class="rd draft"></div>'); pv.layer.appendChild(d); pv.layer.setPointerCapture(e.pointerId); const k = pv.k;
    pv.layer.onpointermove = ev => { const p = pv.pt(ev); d.style.cssText = `left:${Math.min(p.x, p0.x) * k}px;top:${Math.min(p.y, p0.y) * k}px;width:${Math.abs(p.x - p0.x) * k}px;height:${Math.abs(p.y - p0.y) * k}px`; };
    pv.layer.onpointerup = ev => { pv.layer.onpointermove = pv.layer.onpointerup = null; const p = pv.pt(ev), w = Math.abs(p.x - p0.x), h = Math.abs(p.y - p0.y); if (w > 4 && h > 4) st.rects.push({ page: pv.n, x: Math.min(p.x, p0.x), y: Math.min(p.y, p0.y), w, h }); redraw(); };
  };
  list.onclick = e => { if (e.target.closest('[data-clear]')) { st.rects = []; redraw(); } };
  auto.onclick = async e => {
    if (!e.target.closest('[data-find]')) return; const terms = $('[data-q]', auto).value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean), msg = $('[data-msg]', auto); if (!terms.length) return;
    let found = 0; msg.textContent = 'Searching…'; const mctx = document.createElement('canvas').getContext('2d');
    for (let n = 1; n <= rec.pages; n++) {
      const pg = await rec.pdfjs.getPage(n), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      for (const it of tc.items) {
        if (!it.str) continue; const low = it.str.toLowerCase(), t = pdfjsLib.Util.transform(vp.transform, it.transform), fh = Math.hypot(t[2], t[3]), w = it.width * vp.scale;
        const fam = (tc.styles[it.fontName] || {}).fontFamily || 'sans-serif'; mctx.font = `${fh}px ${fam}`; const full = mctx.measureText(it.str).width || 1, ratio = w / full;
        for (const term of terms) { let i = low.indexOf(term); while (i >= 0) { const x = t[4] + mctx.measureText(it.str.slice(0, i)).width * ratio, ww = mctx.measureText(it.str.slice(i, i + term.length)).width * ratio; st.rects.push({ page: n, x: x - 1.5, y: t[5] - fh * .92, w: ww + 3, h: fh * 1.1 }); found++; i = low.indexOf(term, i + term.length); } }
      }
    }
    msg.textContent = found ? `Marked ${found} match${found > 1 ? 'es' : ''}. Review them on each page before applying.` : 'No matches found (scanned pages have no searchable text).'; redraw();
  };
  pv.show(1); ctx.onDestroy(() => pv.destroy());
};

/* ── crop ── */
STAGES.crop = ctx => {
  const { rec, main, getOpts, setField, onField } = ctx, host = el('<div></div>'); main.appendChild(host);
  const bar = el(`<div class="panel" style="margin-bottom:12px"><div class="bar" style="margin:0"><div class="note" style="flex:1;min-width:200px">${icon('info')}<span>The shaded area is removed. Adjust the margins in the sidebar.</span></div><button class="btn pri" data-auto>${icon('wand')}Auto-trim whitespace</button></div></div>`); main.insertBefore(bar, host);
  let pv; const shade = () => {
    if (!pv || !pv.vp1) return; const o = getOpts(), k = pv.k, W = pv.vp1.width * k, H = pv.vp1.height * k, [t, b, l, r] = [o.top, o.bottom, o.left, o.right].map(v => (+v || 0) * MM * k);
    pv.layer.innerHTML = ''; const add = (x, y, w, h) => { const d = el('<div class="crop-shade"></div>'); d.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px`; pv.layer.appendChild(d); };
    add(0, 0, W, t); add(0, H - b, W, b); add(0, t, l, H - t - b); add(W - r, t, r, H - t - b); const bx = el('<div class="crop-box"></div>'); bx.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(0, W - l - r)}px;height:${Math.max(0, H - t - b)}px`; pv.layer.appendChild(bx);
  };
  pv = new PageView(host, rec, { onPage: shade }); pv.layer.style.touchAction = 'auto'; ['top', 'bottom', 'left', 'right'].forEach(k => onField(k, shade)); pv.show(1);
  bar.onclick = async e => {
    if (!e.target.closest('[data-auto]')) return; const pg = await rec.pdfjs.getPage(pv.n), vp = pg.getViewport({ scale: .6 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); await pg.render({ canvasContext: cx, viewport: vp }).promise;
    const d = cx.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
    for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4; if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 <= x0) return toast('Page looks empty', 'err'); const pt = 1 / .6, pad = 6, mm = v => Math.max(0, Math.round(v / MM * 10) / 10);
    setField('left', mm(x0 * pt - pad)); setField('top', mm(y0 * pt - pad)); setField('right', mm(pv.vp1.width - x1 * pt - pad)); setField('bottom', mm(pv.vp1.height - y1 * pt - pad)); shade(); toast('Margins detected from page ' + pv.n, 'ok');
  };
  ctx.onDestroy(() => pv.destroy());
};

/* ── fill forms ── */
STAGES.form = async ctx => {
  const { rec, main, st } = ctx; st.values = {}; const box = el('<div class="panel"><div class="panel-h">Form fields</div><div class="ff"></div></div>'); main.appendChild(box); const ff = $('.ff', box);
  let doc; try { doc = await plib(rec); } catch (e) { ff.innerHTML = `<div class="note err">${icon('info')}<span>${esc(e.message)}</span></div>`; return; }
  const fields = doc.getForm().getFields();
  if (!fields.length) { ff.innerHTML = `<div class="note">${icon('info')}<span>This PDF has no fillable form fields. Use <a href="#/t/addtext" style="color:var(--acc);font-weight:600" data-carry>Add Text</a> to type directly on the page instead.</span></div>`; ctx.hideRun(); return; }
  fields.forEach(f => {
    const t = fieldType(f), name = f.getName(), w = el('<div></div>'); let inp;
    if (t === 'text') { st.values[name] = f.getText() || ''; w.innerHTML = `<div class="fname">${esc(name)}</div>`; inp = el(f.isMultiline() ? '<textarea rows="3"></textarea>' : '<input type="text">'); inp.value = st.values[name]; inp.oninput = () => st.values[name] = inp.value; w.appendChild(inp); }
    else if (t === 'check') { st.values[name] = f.isChecked(); w.innerHTML = `<label class="check"><input type="checkbox" ${f.isChecked() ? 'checked' : ''}> <span>${esc(name)}</span></label>`; $('input', w).onchange = e => st.values[name] = e.target.checked; }
    else if (t === 'drop' || t === 'list' || t === 'radio') { const opts = f.getOptions(), cur = (f.getSelected && f.getSelected()); st.values[name] = Array.isArray(cur) ? cur[0] || '' : cur || ''; w.innerHTML = `<div class="fname">${esc(name)}</div>`; inp = el(`<select><option value="">—</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select>`); inp.value = st.values[name]; inp.onchange = () => st.values[name] = inp.value; w.appendChild(inp); }
    else return; ff.appendChild(w);
  });
  if (!ff.children.length) ff.innerHTML = `<div class="note">${icon('info')}<span>The form only contains buttons or signature fields, which can't be filled here.</span></div>`;
};

/* ── properties editor ── */
STAGES.meta = async ctx => {
  const { rec, main, st } = ctx; const d = await plib(rec); const v = st.values = { title: d.getTitle() || '', author: d.getAuthor() || '', subject: d.getSubject() || '', keywords: d.getKeywords() || '', creator: d.getCreator() || '' };
  const box = el(`<div class="panel"><div class="panel-h">Document properties</div>${[['title', 'Title'], ['author', 'Author'], ['subject', 'Subject'], ['keywords', 'Keywords (comma separated)'], ['creator', 'Creator application']].map(([k, l]) => `<div class="field"><label>${l}</label><input type="text" data-k="${k}"></div>`).join('')}</div>`);
  $$('input', box).forEach(i => { i.value = v[i.dataset.k]; i.oninput = () => v[i.dataset.k] = i.value; }); main.appendChild(box);
};

/* ── document info ── */
STAGES.info = async ctx => {
  const { rec, main } = ctx; const box = el('<div class="panel"><div class="panel-h">Document details <button class="btn sm" data-copy>Copy as JSON</button></div><dl class="kv"></dl></div>'); main.appendChild(box);
  const rows = []; const add = (k, v) => { if (v !== undefined && v !== '' && v !== null) rows.push([k, v]); };
  const dl = $('dl', box), paint = () => { dl.innerHTML = rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); };
  add('File name', rec.name); add('File size', fmtSize(rec.size)); add('PDF version', rec.version); add('Pages', rec.pages);
  const meta = await rec.pdfjs.getMetadata().catch(() => ({ info: {} })), i = meta.info || {}; add('Title', i.Title); add('Author', i.Author); add('Subject', i.Subject); add('Keywords', i.Keywords); add('Creator', i.Creator); add('Producer', i.Producer);
  const dt = s => { const m = /D:(\d{4})(\d\d)(\d\d)(\d\d)?(\d\d)?/.exec(s || ''); return m ? `${m[1]}-${m[2]}-${m[3]}${m[4] ? ` ${m[4]}:${m[5] || '00'}` : ''}` : s; }; add('Created', dt(i.CreationDate)); add('Modified', dt(i.ModDate));
  add('Encrypted', i.IsAcroFormPresent === undefined ? undefined : undefined); add('Has form fields', i.IsAcroFormPresent ? 'Yes' : 'No'); add('Tagged / accessible', i.IsXFAPresent ? 'XFA form' : undefined);
  paint(); const sizes = {};
  for (let n = 1; n <= rec.pages; n++) { const v = (await rec.pdfjs.getPage(n)).getViewport({ scale: 1 }), w = Math.round(v.width), h = Math.round(v.height), nm = Object.entries(PAGE_SIZES).find(([, s]) => (Math.abs(s[0] - w) < 3 && Math.abs(s[1] - h) < 3) || (Math.abs(s[1] - w) < 3 && Math.abs(s[0] - h) < 3)); const key = `${nm ? nm[0].toUpperCase() + ' · ' : ''}${(w / 72 * 25.4).toFixed(0)} × ${(h / 72 * 25.4).toFixed(0)} mm`; sizes[key] = (sizes[key] || 0) + 1; }
  add('Page sizes', Object.entries(sizes).map(([k, c]) => `${k} ×${c}`).join('\n')); paint();
  if (rec.pages <= 300) { add('Words', 'counting…'); paint(); try { const t = await extractText(rec.pdfjs, range(1, rec.pages), false), wc = (t.match(/\S+/g) || []).length; rows[rows.findIndex(r => r[0] === 'Words')] = ['Words', wc ? `${wc.toLocaleString()}  (~${Math.max(1, Math.round(wc / 230))} min read)` : '0 — likely a scanned document']; } catch { rows.pop(); } paint(); }
  box.onclick = e => { if (e.target.closest('[data-copy]')) { navigator.clipboard?.writeText(JSON.stringify(Object.fromEntries(rows), null, 2)); toast('Copied to clipboard', 'ok'); } };
};

/* ── reader ── */
STAGES.reader = ctx => {
  const { rec, main } = ctx, host = el('<div></div>'), sbox = el(`<div class="panel" style="margin-bottom:12px"><div class="bar" style="margin:0"><div class="search" style="margin:0;max-width:none;flex:1"><input type="text" placeholder="Search this document…" style="height:40px;padding-left:44px;font-size:14px;box-shadow:none" data-q>${IC.search ? icon('search') : ''}</div><button class="btn" data-go>Search</button></div><div class="qp" data-res></div></div>`);
  main.append(sbox, host); const pv = new PageView(host, rec, { maxW: 900 }); pv.layer.style.touchAction = 'auto'; pv.show(1);
  const go = async () => {
    const q = $('[data-q]', sbox).value.trim().toLowerCase(), r = $('[data-res]', sbox); if (!q) return; r.innerHTML = '<span class="cnt">Searching…</span>'; const hits = [];
    for (let n = 1; n <= rec.pages; n++) { const tc = await (await rec.pdfjs.getPage(n)).getTextContent(), t = tc.items.map(i => i.str).join(' ').toLowerCase(); let c = 0, i = t.indexOf(q); while (i >= 0) { c++; i = t.indexOf(q, i + q.length); } if (c) hits.push([n, c]); }
    r.innerHTML = hits.length ? hits.map(([n, c]) => `<button data-p="${n}">Page ${n} · ${c}</button>`).join('') : '<span class="cnt">No matches</span>'; if (hits.length) pv.go(hits[0][0]);
  };
  sbox.onclick = e => { if (e.target.closest('[data-go]')) go(); const p = e.target.dataset.p; if (p) pv.go(+p); }; $('[data-q]', sbox).onkeydown = e => { if (e.key === 'Enter') go(); };
  ctx.onDestroy(() => pv.destroy());
};
