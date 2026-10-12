/* ── Rename the whole app by changing this one line ── */
const APP_NAME = 'DocKit';
'use strict';
/* ═════════ utilities ═════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB';
const MM = 72 / 25.4;
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
const baseName = n => n.replace(/\.[^.]+$/, '');
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
let chain = Promise.resolve();
const queue = fn => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + type;
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
}
function download(blob, name) {
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 8000);
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if ($(`script[src="${src}"]`)) return res();
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s);
  });
}

/* ═════════ icons ═════════ */
const IC = {
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
  text: '<path d="M5 6h14M5 11h14M5 16h9"/>',
  merge: '<path d="M7 4v6a5 5 0 0 0 5 5"/><path d="M17 4v6a5 5 0 0 1-5 5"/><path d="M12 15v6"/><path d="m9 18 3 3 3-3"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  extract: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 17v-6M9.5 13.5 12 11l2.5 2.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  reverse: '<path d="M7 4v16M7 20l-3-3M7 20l3-3"/><path d="M17 20V4M17 4l-3 3M17 4l3 3"/>',
  filePlus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>',
  nup: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
  header: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M3 16h18"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  redact: '<path d="M4 5h16M4 19h16"/><rect x="3" y="9" width="18" height="6" rx="1" fill="currentColor" stroke="none"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  stamp: '<path d="M5 21h14M7 17h10v-3a4 4 0 0 0-2-3.5V7a3 3 0 0 0-6 0v3.5A4 4 0 0 0 7 14z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  eraser: '<path d="m7 21-4-4a2 2 0 0 1 0-3L14 3a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L11 21z"/><path d="M8 21h13"/>',
  compress: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  book: '<path d="M2 5h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z"/>',
  code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
  zip: '<path d="M21 8v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8"/><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M10 12h4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  type: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
  imagePlus: '<rect x="3" y="6" width="15" height="14" rx="2"/><circle cx="8" cy="11" r="1.4"/><path d="m18 16-4-4-7 7M19 2v6M16 5h6"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  resize: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  blank: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke-dasharray="3 3"/><path d="M9 14h6"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  left: '<path d="m15 6-6 6 6 6"/>', right: '<path d="m9 6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  infinity: '<path d="M18 8a4 4 0 1 0 0 8c3 0 6-8 0-8-6 0-9 8-12 8a4 4 0 1 1 0-8c3 0 6 8 12 8"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  upload: '<path d="M12 16V4M7 8l5-5 5 5M5 20h14"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  wand: '<path d="m15 4 5 5L9 20l-5-5z"/><path d="M5 3v3M3.5 4.5h3M19 15v3M17.5 16.5h3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  spacing: '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
  lines: '<path d="M4 6h16M4 12h10M4 18h16"/>',
  sort: '<path d="M4 6h10M4 12h7M4 18h4M17 5v14M14 16l3 3 3-3"/>',
  enter: '<path d="M20 5v6a2 2 0 0 1-2 2H5M9 9l-4 4 4 4"/>',
  letters: '<path d="M3 18 8 6l5 12M5 14h6M15 18v-6a3 3 0 0 1 6 0v6M15 15h6"/>',
  quote: '<path d="M9 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3V7zM9 14c0 2-1 3-3 4M20 7h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h3V7zM20 14c0 2-1 3-3 4"/>',
  bars: '<path d="M4 20V11M10 20V4M16 20v-7M22 20H2"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
  sample: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  sliders: '<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 22a10 10 0 1 1 10-10c0 3-2 4-4 4h-2a2 2 0 0 0-1 3.7 1.5 1.5 0 0 1-1 2.3z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  home: '<path d="M3 11 12 3l9 8M5 10v10h5v-6h4v6h5V10"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

/* ═════════ pdf basics ═════════ */
let { PDFDocument, StandardFonts, rgb, degrees, PDFName } = window.PDFLib || {};
let uid = 0;

async function openPdfjs(bytes, password) {
  return pdfjsLib.getDocument({ data: bytes.slice(), password: password || undefined, isEvalSupported: false }).promise;
}
async function probePdf(rec) {
  rec.bytes = new Uint8Array(await rec.file.arrayBuffer());
  const head = new TextDecoder().decode(rec.bytes.subarray(0, 1024));
  if (!/%PDF-/.test(head)) { rec.error = 'Not a valid PDF file'; rec.pages = 0; return; }
  rec.version = (head.match(/%PDF-(\d\.\d)/) || [])[1];
  rec.thumbs = {};
  try {
    rec.pdfjs = await openPdfjs(rec.bytes);
    rec.pages = rec.pdfjs.numPages;
    rec.thumb = await thumbURL(rec, 1, 120);
  } catch (e) {
    if (e && e.name === 'PasswordException') { rec.locked = true; rec.pages = 0; }
    else { rec.error = 'Could not read this PDF'; rec.pages = 0; console.error(e); }
  }
}
function thumbURL(rec, n, w = 160) {
  if (rec.thumbs[n]) return Promise.resolve(rec.thumbs[n]);
  return queue(async () => {
    if (rec.thumbs[n]) return rec.thumbs[n];
    const pg = await rec.pdfjs.getPage(n), v1 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: (w / v1.width) * (devicePixelRatio > 1 ? 1.6 : 1) });
    const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    return (rec.thumbs[n] = cv.toDataURL('image/jpeg', .72));
  });
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { io.unobserve(e.target); const t = e.target; thumbURL(t._rec, t._n, 150).then(u => { t.src = u; }).catch(() => {}); }
}), { rootMargin: '400px' });
function lazyThumb(img, rec, n) { img._rec = rec; img._n = n; if (rec.thumbs[n]) img.src = rec.thumbs[n]; else io.observe(img); }

function needPdf(rec) {
  if (!rec) throw new Error('Add a PDF first');
  if (rec.locked) throw new Error('This PDF is password-protected. Remove the password with the Unlock PDF tool first.');
  if (rec.error) throw new Error(rec.error);
}
async function plib(rec) {
  needPdf(rec);
  try { return await PDFDocument.load(rec.bytes, { updateMetadata: false }); }
  catch (e) { throw new Error('This PDF could not be edited losslessly (' + (e.message || e) + '). Try Repair & Optimize first.'); }
}
async function newDoc() { return PDFDocument.create({ updateMetadata: false }); }
async function finish(doc) {
  doc.setProducer(APP_NAME); doc.setCreator(APP_NAME); doc.setModificationDate(new Date());
  return doc.save({ useObjectStreams: true });
}
const pdfOut = (name, bytes, extra = {}) => ({ name, blob: new Blob([bytes], { type: 'application/pdf' }), kind: 'pdf', size: bytes.length || bytes.byteLength, ...extra });
const outName = (rec, suffix, ext = 'pdf') => `${baseName(rec.name)}-${suffix}.${ext}`;

function parsePages(str, total, { sort = true } = {}) {
  str = (str || '').trim().toLowerCase();
  if (!str || str === 'all') return range(1, total);
  if (str === 'odd') return range(1, total).filter(n => n % 2);
  if (str === 'even') return range(1, total).filter(n => !(n % 2));
  const out = [], seen = new Set(), add = n => { if (n >= 1 && n <= total && !seen.has(n)) { seen.add(n); out.push(n); } };
  for (const part of str.split(/[,;\s]+/).filter(Boolean)) {
    let m;
    if (part === 'last') add(total);
    else if (part === 'first') add(1);
    else if ((m = part.match(/^(\d*)-(\d*)$/)) && (m[1] || m[2])) {
      const a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total;
      if (a <= b) for (let i = a; i <= b; i++) add(i); else for (let i = a; i >= b; i--) add(i);
    } else if (/^\d+$/.test(part)) add(+part);
    else throw new Error(`"${part}" is not a valid page number or range`);
  }
  if (!out.length) throw new Error(`No pages matched "${str}" (document has ${total})`);
  return sort ? out.sort((a, b) => a - b) : out;
}
function toRanges(nums) {
  nums = [...nums].sort((a, b) => a - b); const out = [];
  for (let i = 0; i < nums.length; i++) { let j = i; while (nums[j + 1] === nums[j] + 1) j++; out.push(j > i ? `${nums[i]}-${nums[j]}` : '' + nums[i]); i = j; }
  return out.join(',');
}

/* ═════════ viewport-space drawing (handles rotated / cropped pages) ═════════ */
function vpInfo(page) {
  const r = ((page.getRotation().angle % 360) + 360) % 360, cb = page.getCropBox();
  const swap = r === 90 || r === 270;
  return { r, cb, vw: swap ? cb.height : cb.width, vh: swap ? cb.width : cb.height };
}
function toUser(vi, vx, vy) {
  const { r, cb } = vi; let ux, uy;
  if (r === 0) { ux = vx; uy = cb.height - vy; } else if (r === 90) { ux = vy; uy = vx; }
  else if (r === 180) { ux = cb.width - vx; uy = vy; } else { ux = cb.width - vy; uy = cb.height - vx; }
  return { x: cb.x + ux, y: cb.y + uy };
}
function blOf(cx, cy, w, h, deg) { // bottom-left corner (viewport, y-down) of a w×h box centred at cx,cy and rotated ccw by deg
  const t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), dx = -w / 2, dy = -h / 2;
  return { x: cx + dx * c - dy * s, y: cy - (dx * s + dy * c) };
}
function anchorBox(pos, vw, vh, w, h, m) { // returns centre of box for 9-grid position
  const col = pos[1], row = pos[0];
  const x = col === 'l' ? m : col === 'r' ? vw - w - m : (vw - w) / 2;
  const y = row === 't' ? m : row === 'b' ? vh - h - m : (vh - h) / 2;
  return { cx: x + w / 2, cy: y + h / 2 };
}
const hexRgb = h => { h = (h || '#000').replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

class Painter {
  constructor(doc) { this.doc = doc; this.fonts = {}; this.imgs = {}; }
  async font(key) { return this.fonts[key] ??= await this.doc.embedFont(StandardFonts[key] || StandardFonts.Helvetica); }
  async prep(text, size, key = 'Helvetica', color = '#000000') {
    const font = await this.font(key);
    try { font.encodeText(text); return { mode: 'font', font, text, size, w: font.widthOfTextAtSize(text, size), h: size * .74, color }; }
    catch {
      const S = 3, px = size * S, cv = document.createElement('canvas'), ctx = cv.getContext('2d');
      const bold = /Bold/.test(key) ? '700 ' : '';
      ctx.font = `${bold}${px}px Inter,Arial,sans-serif`; const w = ctx.measureText(text).width;
      cv.width = Math.ceil(w) + 6; cv.height = Math.ceil(px * 1.35);
      ctx.font = `${bold}${px}px Inter,Arial,sans-serif`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, 3, px * 1.0);
      const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
      const img = await this.doc.embedPng(await blob.arrayBuffer());
      return { mode: 'img', img, w: cv.width / S, h: size * .74, ih: cv.height / S, size, color, fallback: true };
    }
  }
  place(page, p, bl, rot = 0, { opacity = 1 } = {}) {
    const vi = vpInfo(page), o = toUser(vi, bl.x, bl.y), R = degrees(rot + vi.r);
    if (p.mode === 'font') page.drawText(p.text, { x: o.x, y: o.y, size: p.size, font: p.font, color: hexRgb(p.color), opacity, rotate: R });
    else { // canvas-rendered text (non-Latin): lower the image by its descent so the baseline matches
      const d = p.ih - p.size, t = rot * Math.PI / 180, s = toUser(vi, bl.x + d * Math.sin(t), bl.y + d * Math.cos(t));
      page.drawImage(p.img, { x: s.x, y: s.y, width: p.w, height: p.ih, opacity, rotate: R });
    }
  }
}
async function embedAnyImage(doc, src) { // src: File | Blob | dataURL
  let blob = src;
  if (typeof src === 'string') blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  const t = blob.type;
  if (t === 'image/png') return doc.embedPng(buf);
  if (t === 'image/jpeg') {
    const bmp = await createImageBitmap(blob); // honours EXIF orientation
    const raw = await doc.embedJpg(buf);
    if (raw.width === bmp.width && raw.height === bmp.height) return raw;
  }
  const bmp = await createImageBitmap(blob), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
  cv.getContext('2d').drawImage(bmp, 0, 0);
  const png = await new Promise(r => cv.toBlob(r, 'image/png'));
  return doc.embedPng(await png.arrayBuffer());
}

/* rasterise selected pages (others copied untouched) */
async function rasterMix(rec, { doc, sel, scale = 2, quality = .9, fmt = 'jpeg', paint, progress, label = 'Rendering' }) {
  const pj = doc || rec.pdfjs, n = pj.numPages, all = sel.size === n;
  const src = all ? null : await plib(rec), out = await newDoc();
  for (let p = 1; p <= n; p++) {
    if (!sel.has(p)) { const [cp] = await out.copyPages(src, [p - 1]); out.addPage(cp); continue; }
    const pg = await pj.getPage(p), v1 = pg.getViewport({ scale: 1 });
    const s = Math.min(scale, Math.sqrt(16e6 / (v1.width * v1.height))), vp = pg.getViewport({ scale: s });
    const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: ctx, viewport: vp }).promise;
    if (paint) paint(ctx, cv, p, s);
    const blob = await new Promise(r => cv.toBlob(r, fmt === 'png' ? 'image/png' : 'image/jpeg', quality));
    const img = fmt === 'png' ? await out.embedPng(await blob.arrayBuffer()) : await out.embedJpg(await blob.arrayBuffer());
    out.addPage([v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height });
    cv.width = cv.height = 0; pg.cleanup();
    progress && progress(`${label} page ${p} of ${n}`, p / n);
    await nextFrame();
  }
  return out;
}
const canvasBlob = (cv, type = 'image/png', q) => new Promise(r => cv.toBlob(r, type, q));

function fieldType(f) { const L = window.PDFLib; return f instanceof L.PDFTextField ? 'text' : f instanceof L.PDFCheckBox ? 'check' : f instanceof L.PDFDropdown ? 'drop' : f instanceof L.PDFRadioGroup ? 'radio' : f instanceof L.PDFOptionList ? 'list' : 'other'; }
