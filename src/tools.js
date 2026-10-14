/* ═════════ tool registry ═════════ */
const CATS = {
  organize: { n: 'Organize', c: '#7c3aed' },
  edit: { n: 'Edit & Annotate', c: '#e4461e' },
  convert: { n: 'Convert', c: '#2563eb' },
  create: { n: 'Create', c: '#0891b2' },
  security: { n: 'Security & Privacy', c: '#059669' },
  optimize: { n: 'Optimize & Inspect', c: '#d97706' }
};
const POS9 = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];
const POS6 = POS9.filter(p => p[0] !== 'm');
const SWATCH = ['#000000', '#e4461e', '#2563eb', '#059669', '#7c3aed', '#6b7280'];
const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a3: [841.89, 1190.55], a5: [419.53, 595.28] };
const SIZE_CH = [['a4', 'A4'], ['letter', 'US Letter'], ['legal', 'US Legal'], ['a3', 'A3'], ['a5', 'A5']];
const F_PAGES = (label = 'Pages', def = 'all') => ({ k: 'pages', label, type: 'pages', def });
const FONTS = [['Helvetica', 'Helvetica'], ['TimesRoman', 'Times'], ['Courier', 'Courier']];
const pad = (n, w = 3) => String(n).padStart(w, '0');
const roman = n => { let s = ''; for (const [v, r] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]) while (n >= v) { s += r; n -= v; } return s; };
const letters = n => { let s = ''; while (n > 0) { s = String.fromCharCode(97 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s; };
const fontKey = (fam, bold, ital) => fam + (bold ? (fam === 'TimesRoman' ? 'Bold' : 'Bold') : '') + (ital ? 'Italic' : '');

/* ── text extraction ── */
async function extractText(pdf, pages, sep) {
  let out = '';
  for (const n of pages) {
    const tc = await (await pdf.getPage(n)).getTextContent(); let line = '', lastY = null, buf = '';
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 3 && line) { buf += line + '\n'; line = ''; }
      line += it.str; lastY = y;
      if (it.hasEOL) { buf += line + '\n'; line = ''; }
    }
    if (line) buf += line + '\n';
    out += (sep ? `\n──────── Page ${n} ────────\n` : '') + buf + '\n';
  }
  return out.trim();
}

/* ── flowing text layout (txt/markdown → pdf) ── */
class Flow {
  constructor(doc, size, margin) { this.doc = doc; this.size = size; this.m = margin; this.skipped = 0; this.cache = new Map(); this.newPage(); }
  newPage() { this.page = this.doc.addPage(this.size); this.y = this.size[1] - this.m; }
  safe(font, s) {
    let o = '';
    for (const ch of s) {
      const k = font.name + ch; let ok = this.cache.get(k);
      if (ok === undefined) { try { font.encodeText(ch); ok = true; } catch { ok = false; } this.cache.set(k, ok); }
      if (ok) o += ch; else { o += '?'; this.skipped++; }
    }
    return o;
  }
  wrap(runs, width) { // runs: [{t,font,color,u}] → lines of [{t,font,color,w}]
    const words = []; for (const r of runs) for (const part of r.t.split(/(\s+)/)) if (part) words.push({ ...r, t: this.safe(r.font, part) });
    const lines = []; let cur = [], w = 0;
    for (const wd of words) {
      const ww = wd.font.widthOfTextAtSize(wd.t, wd.size);
      if (/^\s+$/.test(wd.t)) { if (cur.length) { cur.push({ ...wd, w: ww }); w += ww; } continue; }
      if (w + ww > width && cur.length) { while (cur.length && /^\s+$/.test(cur[cur.length - 1].t)) cur.pop(); lines.push(cur); cur = []; w = 0; }
      if (ww > width) { // break very long tokens
        let chunk = ''; for (const ch of wd.t) { if (wd.font.widthOfTextAtSize(chunk + ch, wd.size) > width) { cur.push({ ...wd, t: chunk, w: wd.font.widthOfTextAtSize(chunk, wd.size) }); lines.push(cur); cur = []; chunk = ''; } chunk += ch; }
        wd.t = chunk; w = 0; cur.push({ ...wd, w: wd.font.widthOfTextAtSize(chunk, wd.size) }); w = cur[0].w; continue;
      }
      cur.push({ ...wd, w: ww }); w += ww;
    }
    if (cur.length) lines.push(cur);
    return lines.length ? lines : [[]];
  }
  para(runs, { size, lh = 1.4, indent = 0, gap = 0, bar = null, bg = null, bullet = null }) {
    const width = this.size[0] - this.m * 2 - indent;
    runs = runs.map(r => ({ ...r, size }));
    const lines = this.wrap(runs, width);
    lines.forEach((ln, i) => {
      this.ensure(size * lh);
      const base = this.y - size * .9; let x = this.m + indent;
      if (bg) this.page.drawRectangle({ x: this.m + indent - 6, y: this.y - size * lh + 2, width: width + 12, height: size * lh, color: bg });
      if (bar) this.page.drawRectangle({ x: this.m + indent - 12, y: this.y - size * lh + 1, width: 3, height: size * lh, color: bar });
      if (i === 0 && bullet) this.page.drawText(this.safe(bullet.font, bullet.t), { x: x - bullet.w - 6, y: base, size, font: bullet.font, color: bullet.color });
      for (const r of ln) { if (!/^\s+$/.test(r.t)) this.page.drawText(r.t, { x, y: base, size: r.size, font: r.font, color: r.color }); if (r.u) this.page.drawLine({ start: { x, y: base - 1.5 }, end: { x: x + r.w, y: base - 1.5 }, thickness: .6, color: r.color }); x += r.w; }
      this.y -= size * lh;
    });
    this.y -= gap;
  }
  ensure(h) { if (this.y - h < this.m) this.newPage(); }
  rule() { this.ensure(14); this.y -= 6; this.page.drawLine({ start: { x: this.m, y: this.y }, end: { x: this.size[0] - this.m, y: this.y }, thickness: .8, color: rgb(.8, .8, .8) }); this.y -= 10; }
}
function inlineRuns(text, fonts, size, color) {
  const runs = [], re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g; let last = 0, m;
  const add = (t, o = {}) => t && runs.push({ t, font: fonts.reg, color, ...o });
  while ((m = re.exec(text))) {
    add(text.slice(last, m.index)); const s = m[0];
    if (s.startsWith('**') || s.startsWith('__')) add(s.slice(2, -2), { font: fonts.bold });
    else if (s[0] === '`') add(s.slice(1, -1), { font: fonts.mono, color: rgb(.72, .18, .1) });
    else if (s[0] === '[') { const mm = s.match(/\[([^\]]+)\]\(([^)]+)\)/); add(mm[1], { color: rgb(.1, .35, .85), u: true }); }
    else add(s.slice(1, -1), { font: fonts.ital });
    last = m.index + s.length;
  }
  add(text.slice(last)); return runs;
}

/* ── per-tool helpers ── */
async function stampPages(ctx, build) { // shared by watermark/pagenum/header/stamps
  const { f, o, progress } = ctx, doc = await plib(f), N = doc.getPageCount(), sel = new Set(parsePages(o.pages, N)), P = new Painter(doc), pages = doc.getPages();
  for (let i = 0; i < N; i++) { if (!sel.has(i + 1) || (o.skipFirst && i === 0)) continue; await build({ page: pages[i], vi: vpInfo(pages[i]), n: i + 1, N, P, doc }); progress(`Page ${i + 1} of ${N}`, (i + 1) / N); }
  return [pdfOut(outName(f, ctx.suffix), await finish(doc))];
}
function tokens(s, n, N, f, fmtn = x => x) {
  return s.replace(/\{n\}/g, fmtn(n)).replace(/\{N\}/g, N).replace(/\{date\}/g, new Date().toLocaleDateString()).replace(/\{file\}/g, baseName(f.name));
}
async function applyItems(doc, items, progress) {
  const P = new Painter(doc), pages = doc.getPages(), N = pages.length, cache = new Map();
  let done = 0;
  for (const it of items) {
    const targets = it.scope === 'all' ? range(1, N) : it.scope === 'first' ? [1] : it.scope === 'last' ? [N] : [it.page];
    for (const pn of targets) {
      const pg = pages[pn - 1]; if (!pg) continue; const vi = vpInfo(pg);
      if (it.type === 'img') {
        let img = cache.get(it.src); if (!img) { img = await embedAnyImage(doc, it.src); cache.set(it.src, img); }
        const o = toUser(vi, it.x, it.y + it.h); pg.drawImage(img, { x: o.x, y: o.y, width: it.w, height: it.h, rotate: degrees(vi.r), opacity: it.opacity ?? 1 });
      } else {
        const lines = it.text.split('\n');
        for (let i = 0; i < lines.length; i++) { if (!lines[i]) continue; const p = await P.prep(lines[i], it.size, fontKey(it.font, it.bold), it.color); P.place(pg, p, { x: it.x, y: it.y + it.size * (.95 + 1.2 * i) }, 0); }
      }
    }
    progress && progress('Applying', ++done / items.length);
  }
}
async function openForRaster(f, pwd) {
  if (!f.locked) return f.pdfjs;
  try { return await openPdfjs(f.bytes, pwd); } catch (e) { throw new Error(pwd ? 'That password is incorrect.' : 'Enter the PDF password.'); }
}

const TOOLS = [
/* ─────────── ORGANIZE ─────────── */
{ id: 'merge', name: 'Merge PDFs', desc: 'Combine several PDFs into one, in the order you choose', cat: 'organize', icon: 'merge', accept: 'pdf', multi: true, cta: 'Merge PDFs', popular: 1,
  opts: [{ k: 'title', label: 'Document title (optional)', type: 'text', def: '', ph: 'Merged document' }],
  async run({ files, o, progress }) {
    if (files.length < 2) throw new Error('Add at least two PDFs to merge');
    const out = await newDoc();
    for (let i = 0; i < files.length; i++) {
      const rec = files[i], src = await plib(rec), idx = parsePages(rec.range, rec.pages, { sort: false }).map(n => n - 1);
      (await out.copyPages(src, idx)).forEach(p => out.addPage(p)); progress(`Merging ${rec.name}`, (i + 1) / files.length);
    }
    if (o.title) out.setTitle(o.title);
    return [pdfOut('merged.pdf', await finish(out))];
  } },
{ id: 'split', name: 'Split PDF', desc: 'Break a PDF into single pages, chunks or custom ranges', cat: 'organize', icon: 'scissors', accept: 'pdf', cta: 'Split PDF', popular: 1,
  opts: [
    { k: 'mode', label: 'Split by', type: 'select', def: 'each', choices: [['each', 'Every page'], ['every', 'Every N pages'], ['ranges', 'Custom ranges']] },
    { k: 'n', label: 'Pages per file', type: 'number', def: 2, min: 1, show: o => o.mode === 'every' },
    { k: 'ranges', label: 'Ranges', type: 'text', def: '1-3; 4-6', ph: '1-3; 4-6; 7-', help: 'Separate files with semicolons. Each file can have its own pages, e.g. 1,3,5; 2-4', show: o => o.mode === 'ranges' }],
  async run({ f, o, progress }) {
    const src = await plib(f), N = f.pages; let groups;
    if (o.mode === 'each') groups = range(1, N).map(n => [n]);
    else if (o.mode === 'every') { const k = Math.max(1, +o.n | 0); groups = []; for (let i = 1; i <= N; i += k) groups.push(range(i, Math.min(N, i + k - 1))); }
    else groups = o.ranges.split(/[;\n]+/).map(s => s.trim()).filter(Boolean).map(s => parsePages(s, N, { sort: false }));
    if (!groups.length) throw new Error('Enter at least one range');
    const res = [];
    for (let g = 0; g < groups.length; g++) {
      const d = await newDoc(); (await d.copyPages(src, groups[g].map(n => n - 1))).forEach(p => d.addPage(p));
      const label = o.mode === 'each' ? `page-${pad(groups[g][0])}` : `part-${pad(g + 1, 2)}`;
      res.push(pdfOut(`${baseName(f.name)}-${label}.pdf`, await finish(d), { note: `pages ${toRanges(groups[g])}` })); progress(`File ${g + 1} of ${groups.length}`, (g + 1) / groups.length);
    }
    return res;
  } },
{ id: 'extract', name: 'Extract Pages', desc: 'Pull selected pages out into a new PDF', cat: 'organize', icon: 'extract', accept: 'pdf', cta: 'Extract pages', picker: true,
  opts: [{ k: 'pages', label: 'Pages to extract', type: 'pages', def: '1', help: 'Click thumbnails or type a range. Order is kept as typed, e.g. 5,1-3' }],
  async run({ f, o }) {
    const sel = parsePages(o.pages, f.pages, { sort: false }), src = await plib(f), d = await newDoc();
    (await d.copyPages(src, sel.map(n => n - 1))).forEach(p => d.addPage(p));
    return [pdfOut(outName(f, 'extracted'), await finish(d), { note: `${sel.length} pages` })];
  } },
{ id: 'delete', name: 'Delete Pages', desc: 'Remove unwanted pages from a PDF', cat: 'organize', icon: 'trash', accept: 'pdf', cta: 'Delete pages', picker: true,
  opts: [{ k: 'pages', label: 'Pages to delete', type: 'pages', def: '', help: 'Click thumbnails to mark pages for removal.' }],
  async run({ f, o }) {
    if (!o.pages.trim()) throw new Error('Select at least one page to delete');
    const rm = new Set(parsePages(o.pages, f.pages)), keep = range(1, f.pages).filter(n => !rm.has(n));
    if (!keep.length) throw new Error('You cannot delete every page');
    const src = await plib(f), d = await newDoc(); (await d.copyPages(src, keep.map(n => n - 1))).forEach(p => d.addPage(p));
    return [pdfOut(outName(f, 'trimmed'), await finish(d), { note: `${rm.size} removed · ${keep.length} left` })];
  } },
{ id: 'reorder', name: 'Organize Pages', desc: 'Drag to reorder, rotate, duplicate or delete pages visually', cat: 'organize', icon: 'grid', accept: 'pdf', cta: 'Save new order', stage: 'organize', popular: 1, opts: [],
  async run({ f, st }) {
    if (!st.pages.length) throw new Error('Your document has no pages left');
    const src = await plib(f), d = await newDoc(), cps = await d.copyPages(src, st.pages.map(p => p.i));
    cps.forEach((p, k) => { const r = st.pages[k].rot; if (r) p.setRotation(degrees((p.getRotation().angle + r) % 360)); d.addPage(p); });
    return [pdfOut(outName(f, 'organized'), await finish(d), { note: `${st.pages.length} pages` })];
  } },
{ id: 'rotate', name: 'Rotate Pages', desc: 'Turn all or selected pages 90°, 180° or 270°', cat: 'organize', icon: 'rotate', accept: 'pdf', cta: 'Rotate PDF', picker: true,
  opts: [{ k: 'deg', label: 'Rotation', type: 'seg', def: '90', choices: [['270', '↺ 90°'], ['90', '↻ 90°'], ['180', '180°']] }, F_PAGES('Pages to rotate')],
  async run({ f, o }) {
    const d = await plib(f), sel = new Set(parsePages(o.pages, f.pages));
    d.getPages().forEach((p, i) => { if (sel.has(i + 1)) p.setRotation(degrees((p.getRotation().angle + +o.deg) % 360)); });
    return [pdfOut(outName(f, 'rotated'), await finish(d))];
  } },
{ id: 'duplicate', name: 'Duplicate Pages', desc: 'Repeat chosen pages in place or at the end', cat: 'organize', icon: 'copy', accept: 'pdf', cta: 'Duplicate pages', picker: true,
  opts: [{ k: 'pages', label: 'Pages to duplicate', type: 'pages', def: '1' }, { k: 'copies', label: 'Extra copies', type: 'number', def: 1, min: 1, max: 20 },
    { k: 'where', label: 'Insert', type: 'select', def: 'after', choices: [['after', 'Right after each page'], ['end', 'At the end']] }],
  async run({ f, o }) {
    const sel = new Set(parsePages(o.pages, f.pages)), src = await plib(f), order = [];
    for (let n = 1; n <= f.pages; n++) { order.push(n); if (o.where === 'after' && sel.has(n)) for (let c = 0; c < o.copies; c++) order.push(n); }
    if (o.where === 'end') for (let c = 0; c < o.copies; c++) sel.forEach(n => order.push(n));
    const d = await newDoc(); (await d.copyPages(src, order.map(n => n - 1))).forEach(p => d.addPage(p));
    return [pdfOut(outName(f, 'duplicated'), await finish(d), { note: `${order.length} pages` })];
  } },
{ id: 'reverse', name: 'Reverse Pages', desc: 'Flip the page order of the whole document', cat: 'organize', icon: 'reverse', accept: 'pdf', cta: 'Reverse order', opts: [],
  async run({ f }) { const src = await plib(f), d = await newDoc(); (await d.copyPages(src, range(0, f.pages - 1).reverse())).forEach(p => d.addPage(p)); return [pdfOut(outName(f, 'reversed'), await finish(d))]; } },
{ id: 'blankpage', name: 'Insert Blank Pages', desc: 'Add empty pages anywhere in the document', cat: 'organize', icon: 'filePlus', accept: 'pdf', cta: 'Insert pages',
  opts: [{ k: 'after', label: 'Insert after page', type: 'number', def: 1, min: 0, help: 'Use 0 to insert at the very beginning.' },
    { k: 'count', label: 'How many', type: 'number', def: 1, min: 1, max: 100 },
    { k: 'size', label: 'Page size', type: 'select', def: 'match', choices: [['match', 'Match neighbouring page'], ...SIZE_CH] }],
  async run({ f, o }) {
    const d = await plib(f), at = clamp(+o.after | 0, 0, d.getPageCount()), ref = d.getPage(Math.max(0, Math.min(at, d.getPageCount()) - 1) || 0);
    const sz = o.size === 'match' ? [ref.getWidth(), ref.getHeight()] : PAGE_SIZES[o.size];
    for (let i = 0; i < o.count; i++) d.insertPage(at + i, sz);
    return [pdfOut(outName(f, 'with-blanks'), await finish(d), { note: `${d.getPageCount()} pages` })];
  } },
{ id: 'removeblank', name: 'Remove Blank Pages', desc: 'Detect and delete empty pages automatically', cat: 'organize', icon: 'blank', accept: 'pdf', cta: 'Scan & remove', isNew: 1,
  opts: [{ k: 'sens', label: 'Sensitivity', type: 'select', def: '0.002', choices: [['0.0005', 'Strict — only truly empty'], ['0.002', 'Balanced'], ['0.01', 'Lenient — ignore specks & stamps']], help: 'Pages with less ink than this threshold are treated as blank.' }],
  async run({ f, o, progress }) {
    needPdf(f); const blanks = [];
    for (let n = 1; n <= f.pages; n++) {
      const pg = await f.pdfjs.getPage(n), vp = pg.getViewport({ scale: 0.4 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data; let ink = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) ink++;
      if (ink / (cv.width * cv.height) < +o.sens) blanks.push(n);
      progress(`Scanning page ${n} of ${f.pages}`, n / f.pages);
    }
    if (!blanks.length) return { info: 'No blank pages were found in this document.' };
    if (blanks.length === f.pages) throw new Error('Every page looks blank at this sensitivity. Try a stricter setting.');
    const bs = new Set(blanks), keep = range(1, f.pages).filter(n => !bs.has(n)), src = await plib(f), d = await newDoc();
    (await d.copyPages(src, keep.map(n => n - 1))).forEach(p => d.addPage(p));
    return [pdfOut(outName(f, 'no-blanks'), await finish(d), { note: `removed page${blanks.length > 1 ? 's' : ''} ${toRanges(blanks)}` })];
  } },
{ id: 'nup', name: 'Multiple Pages per Sheet', desc: 'Print 2, 4, 6 or 9 pages on a single sheet', cat: 'organize', icon: 'nup', accept: 'pdf', cta: 'Create layout',
  opts: [{ k: 'layout', label: 'Pages per sheet', type: 'select', def: '2x1', choices: [['2x1', '2 (side by side)'], ['1x2', '2 (stacked)'], ['2x2', '4'], ['3x2', '6'], ['3x3', '9']] },
    { k: 'size', label: 'Sheet size', type: 'select', def: 'a4', choices: SIZE_CH }, { k: 'orient', label: 'Orientation', type: 'select', def: 'auto', choices: [['auto', 'Automatic'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] },
    { k: 'margin', label: 'Margin (mm)', type: 'number', def: 8, min: 0, max: 40 }, { k: 'gap', label: 'Gap (mm)', type: 'number', def: 4, min: 0, max: 30 }, { k: 'border', label: 'Draw thin border around pages', type: 'check', def: true }],
  async run({ f, o, progress }) {
    const [cols, rows] = o.layout.split('x').map(Number), src = await plib(f), d = await newDoc(), emb = await d.embedPages(src.getPages());
    let [W, H] = PAGE_SIZES[o.size]; const land = o.orient === 'auto' ? cols > rows : o.orient === 'landscape'; if (land) [W, H] = [H, W];
    const m = o.margin * MM, g = o.gap * MM, cw = (W - 2 * m - g * (cols - 1)) / cols, ch = (H - 2 * m - g * (rows - 1)) / rows, per = cols * rows;
    for (let s = 0; s < emb.length; s += per) {
      const pg = d.addPage([W, H]);
      for (let k = 0; k < per && s + k < emb.length; k++) {
        const e = emb[s + k], sc = Math.min(cw / e.width, ch / e.height), w = e.width * sc, h = e.height * sc, c = k % cols, r = Math.floor(k / cols);
        const x = m + c * (cw + g) + (cw - w) / 2, y = H - m - r * (ch + g) - ch + (ch - h) / 2;
        pg.drawPage(e, { x, y, width: w, height: h }); if (o.border) pg.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(.75, .75, .75), borderWidth: .5 });
      } progress('Laying out sheets', Math.min(1, (s + per) / emb.length));
    }
    return [pdfOut(outName(f, `${per}up`), await finish(d), { note: `${d.getPageCount()} sheets` })];
  } },
{ id: 'resize', name: 'Resize Page Size', desc: 'Scale every page to A4, Letter or another paper size', cat: 'organize', icon: 'resize', accept: 'pdf', cta: 'Resize pages', isNew: 1,
  opts: [{ k: 'size', label: 'Target size', type: 'select', def: 'a4', choices: SIZE_CH }, { k: 'orient', label: 'Orientation', type: 'select', def: 'auto', choices: [['auto', 'Match each page'], ['portrait', 'Portrait'], ['landscape', 'Landscape']] },
    { k: 'margin', label: 'Margin (mm)', type: 'number', def: 0, min: 0, max: 40 }],
  async run({ f, o, progress }) {
    const src = await plib(f), d = await newDoc(), emb = await d.embedPages(src.getPages());
    emb.forEach((e, i) => {
      let [W, H] = PAGE_SIZES[o.size]; const land = o.orient === 'auto' ? e.width > e.height : o.orient === 'landscape'; if (land !== W > H) [W, H] = [H, W];
      const m = o.margin * MM, sc = Math.min((W - 2 * m) / e.width, (H - 2 * m) / e.height), w = e.width * sc, h = e.height * sc;
      d.addPage([W, H]).drawPage(e, { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h }); progress('Resizing', (i + 1) / emb.length);
    });
    return [pdfOut(outName(f, o.size), await finish(d))];
  } },
{ id: 'pdf2zip', name: 'Bundle into ZIP', desc: 'Package several PDFs into one compressed archive', cat: 'organize', icon: 'zip', accept: 'pdf', multi: true, cta: 'Create ZIP', opts: [{ k: 'name', label: 'Archive name', type: 'text', def: 'pdf-bundle' }],
  async run({ files, o, progress }) {
    const z = new JSZip(); files.forEach(r => z.file(r.name, r.bytes));
    const blob = await z.generateAsync({ type: 'blob', compression: 'DEFLATE' }, m => progress('Compressing', m.percent / 100));
    return [{ name: (o.name || 'pdf-bundle') + '.zip', blob, kind: 'zip', size: blob.size, note: `${files.length} files` }];
  } },

/* ─────────── EDIT & ANNOTATE ─────────── */
{ id: 'sign', name: 'Sign PDF', desc: 'Draw, type or upload a signature and place it on any page', cat: 'edit', icon: 'pen', accept: 'pdf', cta: 'Apply signature', stage: 'sign', isNew: 1, popular: 1, opts: [],
  async run({ f, st, progress }) {
    if (!st.items.length) throw new Error('Create a signature and click on the page to place it'); const d = await plib(f); await applyItems(d, st.items, progress);
    return [pdfOut(outName(f, 'signed'), await finish(d))];
  } },
{ id: 'addtext', name: 'Add Text', desc: 'Type anywhere on a page — notes, dates, form entries', cat: 'edit', icon: 'type', accept: 'pdf', cta: 'Apply text', stage: 'text', isNew: 1, opts: [],
  async run({ f, st, progress }) {
    if (!st.items.length) throw new Error('Click on the page to add some text'); const d = await plib(f); await applyItems(d, st.items, progress);
    return [pdfOut(outName(f, 'annotated'), await finish(d))];
  } },
{ id: 'addimage', name: 'Add Image / Logo', desc: 'Place a logo, photo or stamp image on your pages', cat: 'edit', icon: 'imagePlus', accept: 'pdf', cta: 'Apply image', stage: 'image', isNew: 1, opts: [],
  async run({ f, st, progress }) {
    if (!st.items.length) throw new Error('Upload an image and click the page to place it'); const d = await plib(f); await applyItems(d, st.items, progress);
    return [pdfOut(outName(f, 'with-image'), await finish(d))];
  } },
{ id: 'fillform', name: 'Fill Forms', desc: 'Complete fillable PDF form fields and optionally flatten', cat: 'edit', icon: 'form', accept: 'pdf', cta: 'Save filled form', stage: 'form', isNew: 1,
  opts: [{ k: 'flatten', label: 'Flatten after filling (make fields permanent)', type: 'check', def: false }],
  async run({ f, o, st }) {
    const d = await plib(f), form = d.getForm(), errs = [];
    for (const [name, val] of Object.entries(st.values)) {
      try { const fld = form.getField(name), t = fieldType(fld);
        if (t === 'text') fld.setText(val || undefined); else if (t === 'check') val ? fld.check() : fld.uncheck();
        else if (t === 'drop' || t === 'list' || t === 'radio') { if (val) fld.select(val); }
      } catch (e) { errs.push(name); }
    }
    if (o.flatten) form.flatten();
    return [pdfOut(outName(f, 'filled'), await finish(d), { note: errs.length ? `${errs.length} field(s) skipped (unsupported characters)` : 'form saved' })];
  } },
{ id: 'watermark', name: 'Watermark', desc: 'Stamp text or an image diagonally or tiled on every page', cat: 'edit', icon: 'drop', accept: 'pdf', cta: 'Add watermark', popular: 1,
  opts: [{ k: 'kind', label: 'Type', type: 'seg', def: 'text', choices: [['text', 'Text'], ['image', 'Image']] },
    { k: 'text', label: 'Text', type: 'text', def: 'CONFIDENTIAL', show: o => o.kind === 'text' },
    { k: 'image', label: 'Image', type: 'file', accept: 'image/*', show: o => o.kind === 'image' },
    { k: 'size', label: 'Font size', type: 'range', min: 12, max: 160, def: 64, unit: 'pt', show: o => o.kind === 'text' },
    { k: 'scale', label: 'Image width', type: 'range', min: 5, max: 100, def: 50, unit: '%', show: o => o.kind === 'image' },
    { k: 'color', label: 'Colour', type: 'color', def: '#6b7280', show: o => o.kind === 'text' },
    { k: 'opacity', label: 'Opacity', type: 'range', min: 5, max: 100, def: 20, unit: '%' }, { k: 'angle', label: 'Rotation', type: 'range', min: -90, max: 90, def: 45, unit: '°' },
    { k: 'pos', label: 'Position', type: 'grid9', def: 'mc' }, { k: 'tile', label: 'Repeat across the page', type: 'check', def: false }, F_PAGES()],
  async run(ctx) {
    ctx.suffix = 'watermarked'; const { o, aux } = ctx; let img;
    if (o.kind === 'image' && !aux.image) throw new Error('Choose an image first');
    if (o.kind === 'text' && !o.text.trim()) throw new Error('Enter watermark text');
    return stampPages(ctx, async ({ page, vi, P, doc }) => {
      let p, w, h; if (o.kind === 'text') { p = await P.prep(o.text, +o.size, 'HelveticaBold', o.color); w = p.w; h = p.h; }
      else { img ??= await embedAnyImage(doc, aux.image); w = vi.vw * o.scale / 100; h = w * img.height / img.width; }
      const centers = []; if (o.tile) { const st = Math.max(w, h) * 1.5 + 20; for (let y = st / 2; y < vi.vh + st; y += st) for (let x = st / 2 + ((Math.round(y / st) % 2) * st / 2); x < vi.vw + st; x += st) centers.push({ cx: x, cy: y }); } else centers.push(anchorBox(o.pos, vi.vw, vi.vh, w, h, 28));
      for (const { cx, cy } of centers) {
        const bl = blOf(cx, cy, w, h, +o.angle);
        if (p) P.place(page, p, bl, +o.angle, { opacity: o.opacity / 100 });
        else { const u = toUser(vi, bl.x, bl.y); page.drawImage(img, { x: u.x, y: u.y, width: w, height: h, rotate: degrees(+o.angle + vi.r), opacity: o.opacity / 100 }); }
      }
    });
  } },
{ id: 'pagenum', name: 'Page Numbers', desc: 'Add page numbers in any corner or edge position', cat: 'edit', icon: 'hash', accept: 'pdf', cta: 'Add numbers', popular: 1,
  opts: [{ k: 'fmt', label: 'Format', type: 'select', def: '{n}', choices: [['{n}', '1'], ['Page {n}', 'Page 1'], ['{n} / {N}', '1 / 10'], ['Page {n} of {N}', 'Page 1 of 10'], ['– {n} –', '– 1 –']] },
    { k: 'style', label: 'Numerals', type: 'select', def: 'arabic', choices: [['arabic', '1, 2, 3'], ['roman', 'i, ii, iii'], ['alpha', 'a, b, c']] },
    { k: 'pos', label: 'Position', type: 'grid9', def: 'bc', only: POS6 }, { k: 'start', label: 'Start at', type: 'number', def: 1, min: 0 },
    { k: 'size', label: 'Size', type: 'range', min: 6, max: 24, def: 11, unit: 'pt' }, { k: 'margin', label: 'Margin from edge', type: 'range', min: 8, max: 80, def: 28, unit: 'pt' },
    { k: 'font', label: 'Font', type: 'select', def: 'Helvetica', choices: FONTS }, { k: 'color', label: 'Colour', type: 'color', def: '#374151' },
    { k: 'skipFirst', label: 'Skip the first page (cover)', type: 'check', def: false }, F_PAGES()],
  async run(ctx) {
    ctx.suffix = 'numbered'; const { o, f } = ctx, fmtn = n => o.style === 'roman' ? roman(n) : o.style === 'alpha' ? letters(n) : n;
    return stampPages(ctx, async ({ page, vi, P, n, N }) => {
      const txt = o.fmt.replace('{N}', fmtn(N)).replace('{n}', fmtn(n - 1 + (+o.start || 0))), p = await P.prep(txt, +o.size, o.font, o.color);
      const { cx, cy } = anchorBox(o.pos, vi.vw, vi.vh, p.w, p.h, +o.margin); P.place(page, p, blOf(cx, cy, p.w, p.h, 0));
    });
  } },
{ id: 'header', name: 'Header & Footer', desc: 'Print running text — title, date, filename — on each page', cat: 'edit', icon: 'header', accept: 'pdf', cta: 'Apply header & footer',
  opts: [{ k: 'hl', label: 'Header · left', type: 'text', def: '' }, { k: 'hc', label: 'Header · centre', type: 'text', def: '' }, { k: 'hr', label: 'Header · right', type: 'text', def: '' },
    { k: 'fl', label: 'Footer · left', type: 'text', def: '' }, { k: 'fc', label: 'Footer · centre', type: 'text', def: '{file}' }, { k: 'fr', label: 'Footer · right', type: 'text', def: 'Page {n} of {N}', help: 'Tokens: {n} page · {N} total · {date} · {file}' },
    { k: 'size', label: 'Size', type: 'range', min: 6, max: 20, def: 9, unit: 'pt' }, { k: 'margin', label: 'Margin', type: 'range', min: 10, max: 80, def: 30, unit: 'pt' },
    { k: 'font', label: 'Font', type: 'select', def: 'Helvetica', choices: FONTS }, { k: 'color', label: 'Colour', type: 'color', def: '#4b5563' }, { k: 'skipFirst', label: 'Skip first page', type: 'check', def: false }, F_PAGES()],
  async run(ctx) {
    ctx.suffix = 'header-footer'; const { o, f } = ctx; if (!['hl', 'hc', 'hr', 'fl', 'fc', 'fr'].some(k => o[k].trim())) throw new Error('Fill in at least one header or footer field');
    const map = { hl: 'tl', hc: 'tc', hr: 'tr', fl: 'bl', fc: 'bc', fr: 'br' };
    return stampPages(ctx, async ({ page, vi, P, n, N }) => {
      for (const k in map) { if (!o[k].trim()) continue; const p = await P.prep(tokens(o[k], n, N, f), +o.size, o.font, o.color), { cx, cy } = anchorBox(map[k], vi.vw, vi.vh, p.w, p.h, +o.margin); P.place(page, p, blOf(cx, cy, p.w, p.h, 0)); }
    });
  } },
{ id: 'stamps', name: 'Stamps', desc: 'Approved, Draft, Confidential and other bordered stamps', cat: 'edit', icon: 'stamp', accept: 'pdf', cta: 'Apply stamp',
  opts: [{ k: 'preset', label: 'Stamp', type: 'select', def: 'APPROVED', choices: ['APPROVED', 'REJECTED', 'DRAFT', 'CONFIDENTIAL', 'FINAL', 'PAID', 'VOID', 'COPY', 'REVIEWED', 'URGENT'].map(s => [s, s]).concat([['custom', 'Custom text…']]) },
    { k: 'text', label: 'Custom text', type: 'text', def: 'SAMPLE', show: o => o.preset === 'custom' }, { k: 'color', label: 'Colour', type: 'color', def: '#059669' },
    { k: 'size', label: 'Size', type: 'range', min: 18, max: 120, def: 48, unit: 'pt' }, { k: 'angle', label: 'Rotation', type: 'range', min: -60, max: 60, def: 18, unit: '°' },
    { k: 'opacity', label: 'Opacity', type: 'range', min: 20, max: 100, def: 85, unit: '%' }, { k: 'pos', label: 'Position', type: 'grid9', def: 'mc' }, F_PAGES()],
  async run(ctx) {
    ctx.suffix = 'stamped'; const { o } = ctx, txt = o.preset === 'custom' ? o.text.trim() : o.preset; if (!txt) throw new Error('Enter stamp text');
    return stampPages(ctx, async ({ page, vi, P }) => {
      const p = await P.prep(txt, +o.size, 'HelveticaBold', o.color), pd = +o.size * .35, bw = p.w + pd * 2, bh = p.h + pd * 2, { cx, cy } = anchorBox(o.pos, vi.vw, vi.vh, bw, bh, 40), a = +o.angle;
      const b = blOf(cx, cy, bw, bh, a), u = toUser(vi, b.x, b.y);
      page.drawRectangle({ x: u.x, y: u.y, width: bw, height: bh, borderColor: hexRgb(o.color), borderWidth: Math.max(2, +o.size / 14), borderOpacity: o.opacity / 100, rotate: degrees(a + vi.r) });
      P.place(page, p, blOf(cx, cy, p.w, p.h, a), a, { opacity: o.opacity / 100 });
    });
  } },
{ id: 'crop', name: 'Crop Pages', desc: 'Trim margins from every page, with automatic whitespace detection', cat: 'edit', icon: 'crop', accept: 'pdf', cta: 'Crop PDF', stage: 'crop',
  opts: [{ k: 'top', label: 'Top (mm)', type: 'number', def: 10, min: 0, w: 1 }, { k: 'bottom', label: 'Bottom (mm)', type: 'number', def: 10, min: 0, w: 1 }, { k: 'left', label: 'Left (mm)', type: 'number', def: 10, min: 0, w: 1 }, { k: 'right', label: 'Right (mm)', type: 'number', def: 10, min: 0, w: 1 }, F_PAGES()],
  async run({ f, o }) {
    const d = await plib(f), sel = new Set(parsePages(o.pages, f.pages)), [t, b, l, r] = [o.top, o.bottom, o.left, o.right].map(v => (+v || 0) * MM);
    d.getPages().forEach((pg, i) => {
      if (!sel.has(i + 1)) return; const vi = vpInfo(pg); if (l + r >= vi.vw - 10 || t + b >= vi.vh - 10) throw new Error('Margins are larger than the page');
      const a = toUser(vi, l, t), c = toUser(vi, vi.vw - r, vi.vh - b), x = Math.min(a.x, c.x), y = Math.min(a.y, c.y), w = Math.abs(a.x - c.x), h = Math.abs(a.y - c.y);
      pg.setCropBox(x, y, w, h); pg.setMediaBox(x, y, w, h);
    });
    return [pdfOut(outName(f, 'cropped'), await finish(d))];
  } },
{ id: 'redact', name: 'Redact PDF', desc: 'Permanently black out sensitive text or areas', cat: 'edit', icon: 'redact', accept: 'pdf', cta: 'Apply redactions', stage: 'redact', isNew: 1, popular: 1,
  opts: [{ k: 'scale', label: 'Output quality', type: 'select', def: '2.5', choices: [['2', 'Standard (smaller)'], ['2.5', 'High'], ['3.5', 'Maximum']] }],
  async run({ f, o, st, progress }) {
    const byPage = {}; st.rects.forEach(r => (byPage[r.page] ??= []).push(r)); const pages = Object.keys(byPage).map(Number);
    if (!pages.length) throw new Error('Draw at least one redaction box on the page');
    const doc = await rasterMix(f, { sel: new Set(pages), scale: +o.scale, quality: .92, progress, label: 'Redacting', paint: (ctx, cv, p, s) => { ctx.fillStyle = '#000'; byPage[p].forEach(r => ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s)); } });
    doc.setTitle(''); return [pdfOut(outName(f, 'redacted'), await finish(doc), { note: `${st.rects.length} area(s) on ${pages.length} page(s) — flattened to image so text underneath is gone` })];
  } },
{ id: 'grayscale', name: 'Grayscale', desc: 'Convert colour pages to black & white for printing', cat: 'edit', icon: 'contrast', accept: 'pdf', cta: 'Convert to grayscale', picker: true,
  opts: [F_PAGES(), { k: 'scale', label: 'Quality', type: 'select', def: '2', choices: [['1.5', 'Standard'], ['2', 'High'], ['3', 'Maximum']] }, { k: 'note', type: 'note', text: 'Pages are re-rendered as images, so text on converted pages is no longer selectable.' }],
  async run({ f, o, progress }) {
    const doc = await rasterMix(f, { sel: new Set(parsePages(o.pages, f.pages)), scale: +o.scale, quality: .88, progress, label: 'Converting', paint: (ctx, cv) => { ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'hsl(0,0%,50%)'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; } });
    return [pdfOut(outName(f, 'grayscale'), await finish(doc))];
  } },
{ id: 'invert', name: 'Invert Colors', desc: 'Create a dark-mode negative version for night reading', cat: 'edit', icon: 'moon', accept: 'pdf', cta: 'Invert colours', picker: true,
  opts: [F_PAGES(), { k: 'scale', label: 'Quality', type: 'select', def: '2', choices: [['1.5', 'Standard'], ['2', 'High'], ['3', 'Maximum']] }, { k: 'note', type: 'note', text: 'Pages are re-rendered as images, so text on converted pages is no longer selectable.' }],
  async run({ f, o, progress }) {
    const doc = await rasterMix(f, { sel: new Set(parsePages(o.pages, f.pages)), scale: +o.scale, quality: .9, progress, label: 'Inverting', paint: (ctx, cv) => { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.globalCompositeOperation = 'source-over'; } });
    return [pdfOut(outName(f, 'inverted'), await finish(doc))];
  } },

/* ─────────── CONVERT ─────────── */
{ id: 'pdf2img', name: 'PDF to Image', desc: 'Export pages as PNG, JPG or WebP images', cat: 'convert', icon: 'image', accept: 'pdf', cta: 'Convert to images', picker: true, popular: 1,
  opts: [{ k: 'fmt', label: 'Format', type: 'select', def: 'png', choices: [['png', 'PNG — lossless'], ['jpeg', 'JPG — smaller'], ['webp', 'WebP — modern']] },
    { k: 'scale', label: 'Resolution', type: 'select', def: '2', choices: [['1', 'Standard · 72 DPI'], ['2', 'High · 144 DPI'], ['3', 'Ultra · 216 DPI'], ['4', 'Print · 288 DPI']] },
    { k: 'q', label: 'Quality', type: 'range', min: 40, max: 100, def: 90, unit: '%', show: o => o.fmt !== 'png' }, { k: 'bg', label: 'Background', type: 'select', def: '#ffffff', choices: [['#ffffff', 'White'], ['transparent', 'Transparent']], show: o => o.fmt !== 'jpeg' },
    { k: 'pages', label: 'Pages', type: 'pages', def: 'all' }],
  async run({ f, o, progress }) {
    needPdf(f); const pgs = parsePages(o.pages, f.pages), res = [], ext = o.fmt === 'jpeg' ? 'jpg' : o.fmt;
    for (let i = 0; i < pgs.length; i++) {
      const pg = await f.pdfjs.getPage(pgs[i]), v1 = pg.getViewport({ scale: 1 }), s = Math.min(+o.scale, Math.sqrt(25e6 / (v1.width * v1.height))), vp = pg.getViewport({ scale: s });
      const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); const ctx = cv.getContext('2d');
      if (o.fmt === 'jpeg' || o.bg !== 'transparent') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
      await pg.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await canvasBlob(cv, 'image/' + o.fmt, o.q / 100); res.push({ name: `${baseName(f.name)}-page-${pad(pgs[i])}.${ext}`, blob, kind: 'image', size: blob.size });
      cv.width = cv.height = 0; progress(`Rendering page ${pgs[i]}`, (i + 1) / pgs.length); await nextFrame();
    }
    return res;
  } },
{ id: 'img2pdf', name: 'Images to PDF', desc: 'Turn JPG, PNG or WebP images into a single PDF', cat: 'convert', icon: 'file', accept: 'image', multi: true, cta: 'Create PDF', popular: 1,
  opts: [{ k: 'size', label: 'Page size', type: 'select', def: 'a4', choices: [['fit', 'Fit to image'], ...SIZE_CH] }, { k: 'orient', label: 'Orientation', type: 'select', def: 'auto', choices: [['auto', 'Match each image'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], show: o => o.size !== 'fit' },
    { k: 'margin', label: 'Margin (mm)', type: 'number', def: 10, min: 0, max: 50, show: o => o.size !== 'fit' }, { k: 'maxdim', label: 'Max image size', type: 'select', def: '2600', choices: [['0', 'Original'], ['3500', 'Large · 3500 px'], ['2600', 'Balanced · 2600 px'], ['1600', 'Small · 1600 px']] },
    { k: 'q', label: 'JPEG quality', type: 'range', min: 40, max: 100, def: 88, unit: '%' }],
  async run({ files, o, progress }) {
    const d = await newDoc();
    for (let i = 0; i < files.length; i++) {
      const bmp = await createImageBitmap(files[i].file); let w = bmp.width, h = bmp.height; const md = +o.maxdim; if (md && Math.max(w, h) > md) { const k = md / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const ctx = cv.getContext('2d'), alpha = /png|webp|gif|svg/.test(files[i].file.type);
      if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); } ctx.drawImage(bmp, 0, 0, w, h);
      const blob = await canvasBlob(cv, alpha ? 'image/png' : 'image/jpeg', o.q / 100), img = alpha ? await d.embedPng(await blob.arrayBuffer()) : await d.embedJpg(await blob.arrayBuffer());
      if (o.size === 'fit') d.addPage([w * .75, h * .75]).drawImage(img, { x: 0, y: 0, width: w * .75, height: h * .75 });
      else { let [W, H] = PAGE_SIZES[o.size]; const land = o.orient === 'auto' ? w > h : o.orient === 'landscape'; if (land !== W > H) [W, H] = [H, W]; const m = o.margin * MM, k = Math.min((W - 2 * m) / w, (H - 2 * m) / h), iw = w * k, ih = h * k; d.addPage([W, H]).drawImage(img, { x: (W - iw) / 2, y: (H - ih) / 2, width: iw, height: ih }); }
      bmp.close && bmp.close(); progress(`Image ${i + 1} of ${files.length}`, (i + 1) / files.length); await nextFrame();
    }
    return [pdfOut('images.pdf', await finish(d), { note: `${files.length} page(s)` })];
  } },
{ id: 'pdf2txt', name: 'Extract Text', desc: 'Pull all readable text out of a PDF', cat: 'convert', icon: 'text', accept: 'pdf', cta: 'Extract text', picker: true,
  opts: [{ k: 'pages', label: 'Pages', type: 'pages', def: 'all' }, { k: 'sep', label: 'Add page separators', type: 'check', def: true }],
  async run({ f, o }) {
    needPdf(f); const text = await extractText(f.pdfjs, parsePages(o.pages, f.pages), o.sep);
    if (!text.trim()) throw new Error('No selectable text found. This looks like a scanned document (images only).');
    return { text, name: baseName(f.name) + '.txt' };
  } },

/* ─────────── CREATE ─────────── */
{ id: 'txt2pdf', name: 'Text to PDF', desc: 'Turn plain text into a neatly typeset PDF', cat: 'create', icon: 'file', accept: 'text', cta: 'Create PDF', textInput: 'txt',
  opts: [{ k: 'font', label: 'Font', type: 'select', def: 'Helvetica', choices: [...FONTS] }, { k: 'size', label: 'Size', type: 'range', min: 8, max: 20, def: 11, unit: 'pt' }, { k: 'lh', label: 'Line spacing', type: 'range', min: 1, max: 2.2, step: .1, def: 1.45 },
    { k: 'paper', label: 'Paper', type: 'select', def: 'a4', choices: SIZE_CH }, { k: 'margin', label: 'Margin (mm)', type: 'number', def: 22, min: 5, max: 50 }, { k: 'title', label: 'Title (optional)', type: 'text', def: '' }],
  async run({ text, o }) {
    if (!text.trim()) throw new Error('Type or paste some text first');
    const d = await newDoc(), font = await d.embedFont(StandardFonts[o.font]), bold = await d.embedFont(StandardFonts[o.font + 'Bold']), fl = new Flow(d, PAGE_SIZES[o.paper], o.margin * MM);
    if (o.title) fl.para([{ t: o.title, font: bold, color: rgb(0, 0, 0) }], { size: +o.size * 1.8, gap: 10 });
    text.replace(/\r\n?/g, '\n').split('\n').forEach(l => { if (!l.trim()) { fl.y -= +o.size * +o.lh; fl.ensure(0); } else fl.para([{ t: l.replace(/\t/g, '    '), font, color: rgb(.1, .1, .1) }], { size: +o.size, lh: +o.lh }); });
    d.setTitle(o.title || 'Document');
    return [pdfOut('document.pdf', await finish(d), { note: `${d.getPageCount()} page(s)${fl.skipped ? ` · ${fl.skipped} unsupported character(s) replaced with ?` : ''}` })];
  } },
{ id: 'md2pdf', name: 'Markdown to PDF', desc: 'Headings, lists, quotes and code blocks to a clean PDF', cat: 'create', icon: 'code', accept: 'text', cta: 'Create PDF', textInput: 'md',
  opts: [{ k: 'family', label: 'Typeface', type: 'select', def: 'Helvetica', choices: [['Helvetica', 'Sans-serif'], ['TimesRoman', 'Serif']] }, { k: 'size', label: 'Body size', type: 'range', min: 9, max: 16, def: 11, unit: 'pt' },
    { k: 'paper', label: 'Paper', type: 'select', def: 'a4', choices: SIZE_CH }, { k: 'margin', label: 'Margin (mm)', type: 'number', def: 22, min: 8, max: 50 }],
  async run({ text, o }) {
    if (!text.trim()) throw new Error('Type or paste some Markdown first');
    const d = await newDoc(), E = k => d.embedFont(StandardFonts[k]), fam = o.family, tm = fam === 'TimesRoman';
    const fonts = { reg: await E(fam), bold: await E(fam + 'Bold'), ital: await E(tm ? 'TimesRomanItalic' : 'HelveticaOblique'), mono: await E('Courier') }, S = +o.size, fl = new Flow(d, PAGE_SIZES[o.paper], o.margin * MM), ink = rgb(.09, .09, .09);
    const HS = [2.1, 1.7, 1.4, 1.2, 1.1, 1.05], lines = text.replace(/\r\n?/g, '\n').split('\n'); let i = 0, para = [], title = '';
    const flush = () => { if (para.length) { fl.para(inlineRuns(para.join(' '), fonts, S, ink), { size: S, gap: S * .6 }); para = []; } };
    for (; i < lines.length; i++) {
      const L = lines[i]; let m;
      if (/^```/.test(L)) { flush(); const code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); fl.y -= 4; code.forEach(c => fl.para([{ t: c.replace(/\t/g, '  ') || ' ', font: fonts.mono, color: ink }], { size: S * .88, lh: 1.35, bg: rgb(.95, .94, .93) })); fl.y -= S * .6; }
      else if ((m = L.match(/^(#{1,6})\s+(.*)$/))) { flush(); const lv = m[1].length - 1; if (!title && lv === 0) title = m[2]; fl.y -= S * (lv < 2 ? .8 : .4); fl.ensure(S * HS[lv] * 3); fl.para([{ t: m[2], font: fonts.bold, color: ink }], { size: S * HS[lv], lh: 1.25, gap: S * .45 }); if (lv < 2) { fl.y += S * .2; fl.rule(); } }
      else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(L)) { flush(); fl.rule(); }
      else if ((m = L.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/))) { flush(); const lvl = Math.floor(m[1].replace(/\t/g, '  ').length / 2), ord = /\d/.test(m[2]), b = ord ? m[2] : '•', bw = fonts.reg.widthOfTextAtSize(b, S); fl.para(inlineRuns(m[3], fonts, S, ink), { size: S, indent: 16 + lvl * 16, gap: S * .25, bullet: { t: b, font: ord ? fonts.bold : fonts.reg, color: ink, w: bw } }); }
      else if ((m = L.match(/^>\s?(.*)$/))) { flush(); fl.para(inlineRuns(m[1], { ...fonts, reg: fonts.ital }, S, rgb(.35, .35, .35)), { size: S, indent: 14, bar: rgb(.8, .8, .8), gap: S * .3 }); }
      else if (!L.trim()) flush(); else para.push(L.trim());
    }
    flush(); d.setTitle(title || 'Document');
    return [pdfOut('document.pdf', await finish(d), { note: `${d.getPageCount()} page(s)${fl.skipped ? ` · ${fl.skipped} unsupported character(s) replaced with ?` : ''}` })];
  } },

/* ─────────── SECURITY & PRIVACY ─────────── */
{ id: 'protect', name: 'Protect with Password', desc: 'Encrypt a PDF so it needs a password to open', cat: 'security', icon: 'lock', accept: 'pdf', cta: 'Encrypt PDF',
  opts: [{ k: 'pw', label: 'Password to open', type: 'password', def: '' }, { k: 'pw2', label: 'Confirm password', type: 'password', def: '' },
    { k: 'print', label: 'Allow printing', type: 'check', def: true }, { k: 'copy', label: 'Allow copying text', type: 'check', def: true }, { k: 'modify', label: 'Allow editing', type: 'check', def: false },
    { k: 'scale', label: 'Quality', type: 'select', def: '2', choices: [['1.5', 'Standard'], ['2', 'High'], ['3', 'Maximum']] },
    { k: 'note', type: 'note', text: 'Encryption is applied by re-rendering each page as an image, so text will not be selectable in the protected copy.' }],
  async run({ f, o, progress }) {
    needPdf(f); if (!o.pw) throw new Error('Enter a password'); if (o.pw !== o.pw2) throw new Error('The passwords do not match');
    try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); } catch { throw new Error('Could not load the encryption library. Check your internet connection and try again.'); } const { jsPDF } = window.jspdf;
    const perms = ['print', 'copy', 'modify'].filter(k => o[k]).map(k => k), pdf = []; let doc;
    for (let p = 1; p <= f.pages; p++) {
      const pg = await f.pdfjs.getPage(p), v1 = pg.getViewport({ scale: 1 }), s = Math.min(+o.scale, Math.sqrt(16e6 / (v1.width * v1.height))), vp = pg.getViewport({ scale: s });
      const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height); const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: ctx, viewport: vp }).promise; const url = cv.toDataURL('image/jpeg', .88), orient = v1.width > v1.height ? 'l' : 'p';
      if (!doc) doc = new jsPDF({ unit: 'pt', format: [v1.width, v1.height], orientation: orient, compress: true, encryption: { userPassword: o.pw, ownerPassword: o.pw + '-owner-' + Math.random().toString(36).slice(2), userPermissions: perms } }); else doc.addPage([v1.width, v1.height], orient);
      doc.addImage(url, 'JPEG', 0, 0, v1.width, v1.height, undefined, 'FAST'); cv.width = cv.height = 0; progress(`Encrypting page ${p} of ${f.pages}`, p / f.pages); await nextFrame();
    }
    const blob = doc.output('blob'); return [{ name: outName(f, 'protected'), blob: new Blob([blob], { type: 'application/pdf' }), kind: 'pdf', size: blob.size, note: 'AES-encrypted · password required to open' }];
  } },
{ id: 'unlock', name: 'Unlock PDF', desc: 'Remove a password or usage restrictions you are allowed to lift', cat: 'security', icon: 'unlock', accept: 'pdf', cta: 'Unlock PDF', isNew: 1, allowLocked: true,
  opts: [{ k: 'pw', label: 'Password (if the file asks for one)', type: 'password', def: '' }, { k: 'scale', label: 'Quality', type: 'select', def: '2', choices: [['1.5', 'Standard'], ['2', 'High'], ['3', 'Maximum']] },
    { k: 'note', type: 'note', text: 'Only unlock files you own or have permission to open. The unlocked copy is rebuilt from page images, so text will not be selectable.' }],
  async run({ f, o, progress }) {
    const pj = await openForRaster(f, o.pw), doc = await rasterMix(f, { doc: pj, sel: new Set(range(1, pj.numPages)), scale: +o.scale, quality: .9, progress, label: 'Rebuilding' });
    return [pdfOut(outName(f, 'unlocked'), await finish(doc), { note: `${pj.numPages} page(s) · no password` })];
  } },
{ id: 'flatten', name: 'Flatten PDF', desc: 'Merge form fields and annotations into the page content', cat: 'security', icon: 'layers', accept: 'pdf', cta: 'Flatten PDF',
  opts: [{ k: 'mode', label: 'Method', type: 'select', def: 'forms', choices: [['forms', 'Flatten form fields (keeps text)'], ['raster', 'Flatten everything to images']] }],
  async run({ f, o, progress }) {
    if (o.mode === 'forms') { const d = await plib(f), n = d.getForm().getFields().length; d.getForm().flatten(); return [pdfOut(outName(f, 'flattened'), await finish(d), { note: n ? `${n} field(s) flattened` : 'no form fields found' })]; }
    return [pdfOut(outName(f, 'flattened'), await finish(await rasterMix(f, { sel: new Set(range(1, f.pages)), scale: 2, progress })))];
  } },
{ id: 'removemeta', name: 'Remove Metadata', desc: 'Strip author, title, dates and hidden properties', cat: 'security', icon: 'eraser', accept: 'pdf', cta: 'Clean metadata', opts: [],
  async run({ f }) {
    const d = await plib(f), info = d.context.lookup(d.context.trailerInfo.Info);
    if (info && info.keys) [...info.keys()].forEach(k => info.delete(k)); d.catalog.delete(PDFName.of('Metadata'));
    return [pdfOut(outName(f, 'clean'), await d.save({ useObjectStreams: true }), { note: 'author, title, dates and XMP data removed' })];
  } },
{ id: 'metadata', name: 'Edit Properties', desc: 'Set the title, author, subject and keywords', cat: 'security', icon: 'tag', accept: 'pdf', cta: 'Save properties', stage: 'meta', isNew: 1, opts: [],
  async run({ f, st }) {
    const d = await plib(f), v = st.values; d.setTitle(v.title || ''); d.setAuthor(v.author || ''); d.setSubject(v.subject || ''); d.setKeywords((v.keywords || '').split(',').map(s => s.trim()).filter(Boolean)); d.setCreator(v.creator || APP_NAME); d.setProducer(APP_NAME); d.setModificationDate(new Date());
    return [pdfOut(outName(f, 'properties'), await d.save({ useObjectStreams: true }), { note: 'properties updated' })];
  } },

/* ─────────── OPTIMIZE & INSPECT ─────────── */
{ id: 'compress', name: 'Compress PDF', desc: 'Shrink file size by recompressing page images', cat: 'optimize', icon: 'compress', accept: 'pdf', cta: 'Compress PDF', popular: 1,
  opts: [{ k: 'lvl', label: 'Compression', type: 'select', def: 'med', choices: [['low', 'Light — best quality'], ['med', 'Balanced'], ['high', 'Strong — smallest file']] },
    { k: 'note', type: 'note', text: 'Works best on scanned or image-heavy PDFs. Text-based PDFs may not shrink — use Repair & Optimize for a lossless pass instead.' }],
  async run({ f, o, progress }) {
    needPdf(f); const P = { low: [2, .85], med: [1.5, .7], high: [1.1, .55] }[o.lvl];
    const doc = await rasterMix(f, { sel: new Set(range(1, f.pages)), scale: P[0], quality: P[1], progress, label: 'Compressing' }), bytes = await finish(doc);
    return [pdfOut(outName(f, 'compressed'), bytes, { compare: f.size })];
  } },
{ id: 'optimize', name: 'Repair & Optimize', desc: 'Lossless clean-up that repairs structure and trims overhead', cat: 'optimize', icon: 'zap', accept: 'pdf', cta: 'Optimize PDF', isNew: 1,
  opts: [{ k: 'strip', label: 'Also remove metadata', type: 'check', def: false }],
  async run({ f, o }) {
    const d = await plib(f), nd = await newDoc(); (await nd.copyPages(d, d.getPageIndices())).forEach(p => nd.addPage(p));
    const t = d.getTitle(), a = d.getAuthor(); if (!o.strip) { if (t) nd.setTitle(t); if (a) nd.setAuthor(a); }
    return [pdfOut(outName(f, 'optimized'), await finish(nd), { compare: f.size })];
  } },
{ id: 'info', name: 'Document Info', desc: 'Inspect page sizes, properties, text volume and structure', cat: 'optimize', icon: 'info', accept: 'pdf', stage: 'info', noRun: true, opts: [] },
{ id: 'reader', name: 'PDF Reader', desc: 'Read, zoom and search a PDF without leaving the page', cat: 'optimize', icon: 'book', accept: 'pdf', stage: 'reader', noRun: true, opts: [] }
];
const TOOL = Object.fromEntries(TOOLS.map(t => [t.id, t]));
