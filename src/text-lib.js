/* ═════════ Text Studio engine — helpers (DOM-free so every tool is unit-testable) ═════════ */
const TCATS = {
  spacing:   { n: 'Spacing & Layout',      c: '#c2410c', i: 'spacing' },
  splitjoin: { n: 'Split & Join',          c: '#1d6fa5', i: 'scissors' },
  reverse:   { n: 'Reverse & Swap',        c: '#7c3aed', i: 'reverse' },
  words:     { n: 'Words & Sentences',     c: '#15803d', i: 'text' },
  prefix:    { n: 'Prefix & Suffix',       c: '#be185d', i: 'tag' },
  lines:     { n: 'Lines & Filtering',     c: '#0e7490', i: 'lines' },
  sort:      { n: 'Sort & Randomize',      c: '#6d28d9', i: 'sort' },
  case:      { n: 'Text Case',             c: '#0369a1', i: 'type' },
  breaks:    { n: 'Line Breaks & Spaces',  c: '#047857', i: 'enter' },
  letters:   { n: 'Letters & Symbols',     c: '#a16207', i: 'letters' },
  quotes:    { n: 'Quotes',                c: '#5b21b6', i: 'quote' },
  encode:    { n: 'Encoding & Ciphers',    c: '#be123c', i: 'lock' },
  dev:       { n: 'Developer & Data',      c: '#334155', i: 'code' },
  effects:   { n: 'Text Effects',          c: '#1e40af', i: 'wand' },
  analysis:  { n: 'Analysis & Stats',      c: '#166534', i: 'bars' },
  generate:  { n: 'Generators',            c: '#b45309', i: 'zap' },
  extract:   { n: 'Extract & Find',        c: '#475569', i: 'search' },
  random:    { n: 'Random & Fake',         c: '#e11d48', i: 'dice' },
  convert:   { n: 'Convert',               c: '#0f766e', i: 'swap' },
  clean:     { n: 'Clean & Remove',        c: '#7e22ce', i: 'eraser' },
  enumerate: { n: 'Enumerate & Number',    c: '#ea580c', i: 'hash' }
};

/* option builders */
const oSel = (k, label, choices, def) => ({ k, label, type: 'select', choices, def: def ?? choices[0][0] });
const oNum = (k, label, def, min, max, step) => ({ k, label, type: 'number', def, min, max, step });
const oTxt = (k, label, def = '', ph = '') => ({ k, label, type: 'text', def, ph });
const oChk = (k, label, def = false) => ({ k, label, type: 'check', def });
const oRng = (k, label, def, min, max, unit = '') => ({ k, label, type: 'range', def, min, max, unit });
const oArea = (k, label, def = '', ph = '') => ({ k, label, type: 'textarea', def, ph });
const oNote = text => ({ k: 'note', type: 'note', text });
const YN = [['no', 'No'], ['yes', 'Yes']];
const CASE_OPT = (k = 'cs') => oChk(k, 'Case sensitive', false);

/* text helpers */
const RXE = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const RXC = s => s.replace(/[\\\]\[^-]/g, '\\$&');
const LINES = s => s.split(/\r\n|\r|\n/);
const WORDS = s => s.match(/\S+/g) || [];
const WRD = () => /[\p{L}\p{N}_]+(?:['’][\p{L}]+)*/gu;
const SENT = s => s.split(/(?<=[.!?…]["'”’)\]]*)\s+/).filter(x => x !== '');
const PARAS = s => s.split(/\n[ \t]*\n+/);
const CH = s => Array.from(s);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const cmpAlpha = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'accent', numeric: false });
const cmpBy = (by, cs) => (a, b) => by === 'length' ? a.length - b.length || cmpAlpha(a, b) : by === 'natural' ? a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) : by === 'num' ? (parseFloat(a) || 0) - (parseFloat(b) || 0) : (cs ? (a < b ? -1 : a > b ? 1 : 0) : cmpAlpha(a, b));
const mkRx = (pat, { regex = false, cs = false, whole = false, flags = '' } = {}) => {
  const lit = /^\/(.+)\/([gimsuy]*)$/.exec(pat);
  try {
    if (lit) return new RegExp(lit[1], flags + lit[2].replace(/g/g, ''));
    let src = regex ? pat : RXE(pat), fl = flags + (cs ? '' : 'i');
    if (whole) { src = '(?<![\\p{L}\\p{N}_])(?:' + src + ')(?![\\p{L}\\p{N}_])'; fl += 'u'; }
    return new RegExp(src, fl);
  } catch (e) { throw new Error('Invalid regular expression: ' + e.message); }
};
const needList = (s, what = 'at least one item') => { const l = s.split(/[,\n]+/).map(x => x.trim()).filter(Boolean); if (!l.length) throw new Error('Enter ' + what); return l; };
const pctBar = (v, max, w = 20) => { const f = Math.min(1, v / max), n = Math.round(f * w); return '█'.repeat(n) + '░'.repeat(w - n); };
const pad2 = (n, w) => String(n).padStart(w, '0');

/* unicode style maps */
const off = (U, L, D, ex = {}) => { const m = {}; for (let i = 0; i < 26; i++) { m[String.fromCharCode(65 + i)] = String.fromCodePoint(U + i); m[String.fromCharCode(97 + i)] = String.fromCodePoint(L + i); } if (D != null) for (let i = 0; i < 10; i++) m[String(i)] = String.fromCodePoint(D + i); return Object.assign(m, ex); };
const mapStr = (s, m) => Array.from(s).map(c => m[c] ?? c).join('');
const MAP = {
  boldSerif: off(0x1D400, 0x1D41A, 0x1D7CE), boldSans: off(0x1D5D4, 0x1D5EE, 0x1D7EC),
  italicSerif: off(0x1D434, 0x1D44E, null, { h: 'ℎ' }), italicSans: off(0x1D608, 0x1D622, null),
  boldItalicSerif: off(0x1D468, 0x1D482, null), boldItalicSans: off(0x1D63C, 0x1D656, null),
  script: off(0x1D49C, 0x1D4B6, null, { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' }),
  boldScript: off(0x1D4D0, 0x1D4EA, null), fraktur: off(0x1D504, 0x1D51E, null, { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' }),
  boldFraktur: off(0x1D56C, 0x1D586, null), double: off(0x1D538, 0x1D552, 0x1D7D8, { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' }),
  mono: off(0x1D670, 0x1D68A, 0x1D7F6), circled: Object.assign(off(0x24B6, 0x24D0, null), { 0: '⓪', 1: '①', 2: '②', 3: '③', 4: '④', 5: '⑤', 6: '⑥', 7: '⑦', 8: '⑧', 9: '⑨' }),
  squared: off(0x1F130, 0x1F130, null), negSquared: off(0x1F170, 0x1F170, null)
};
{ const fw = {}; for (let i = 33; i < 127; i++) fw[String.fromCharCode(i)] = String.fromCharCode(i + 0xFEE0); fw[' '] = '\u3000'; MAP.fullwidth = fw; }
{ const sc = 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ'; const m = {}; for (let i = 0; i < 26; i++) { m[String.fromCharCode(97 + i)] = sc[i]; m[String.fromCharCode(65 + i)] = sc[i]; } MAP.smallcaps = m; }
{ const f = 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz', m = {}; for (let i = 0; i < 26; i++) { m[String.fromCharCode(97 + i)] = f[i]; } Object.assign(m, { A: '∀', B: 'ᗺ', C: 'Ɔ', D: 'ᗡ', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ', K: '⋊', L: '˥', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥', U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z', 1: 'Ɩ', 2: 'ᄅ', 3: 'Ɛ', 4: 'ㄣ', 5: 'ϛ', 6: '9', 7: 'ㄥ', 8: '8', 9: '6', 0: '0', '.': '˙', ',': "'", '?': '¿', '!': '¡', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '_': '‾', "'": ',' }); MAP.upside = m; }
const SUB_MAP = { a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ', p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ', 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎' };
const SUP_MAP = { a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ', k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', q: 'ᵠ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ', v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ', A: 'ᴬ', B: 'ᴮ', C: 'ᶜ', D: 'ᴰ', E: 'ᴱ', F: 'ᶠ', G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ', K: 'ᴷ', L: 'ᴸ', M: 'ᴹ', N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ', W: 'ᵂ', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾' };
const FAKE = { a: 'а', c: 'с', e: 'е', i: 'і', j: 'ј', o: 'о', p: 'р', s: 'ѕ', x: 'х', y: 'у', A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', I: 'І', J: 'Ј', K: 'К', M: 'М', O: 'О', P: 'Р', S: 'Ѕ', T: 'Т', X: 'Х', Y: 'У' };
const UNFAKE = Object.fromEntries(Object.entries(FAKE).map(([k, v]) => [v, k]));
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.' };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
const RANDW = 'apple blue car dance echo forest green happy island jungle king love moon night ocean peace river smile tree voice water yellow bright cloud dream empty flame grace heart light stone swift wind spark harbor meadow lantern velvet copper silver thunder whisper canyon ember garden horizon marble orchid pebble quartz'.split(' ');
const STOP = new Set('a about above after again against all am an and any are aren\'t as at be because been before being below between both but by can can\'t cannot could couldn\'t did didn\'t do does doesn\'t doing don\'t down during each few for from further had hadn\'t has hasn\'t have haven\'t having he he\'d he\'ll he\'s her here here\'s hers herself him himself his how how\'s i i\'d i\'ll i\'m i\'ve if in into is isn\'t it it\'s its itself let\'s me more most mustn\'t my myself no nor not of off on once only or other ought our ours ourselves out over own same shan\'t she she\'d she\'ll she\'s should shouldn\'t so some such than that that\'s the their theirs them themselves then there there\'s these they they\'d they\'ll they\'re they\'ve this those through to too under until up very was wasn\'t we we\'d we\'ll we\'re we\'ve were weren\'t what what\'s when when\'s where where\'s which while who who\'s whom why why\'s with won\'t would wouldn\'t you you\'d you\'ll you\'re you\'ve your yours yourself yourselves'.split(' '));
const MINOR = new Set('a an the and but or nor for so yet at by in of on to up as vs via per with from into onto over off out'.split(' '));
const HTML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0', copy: '©', reg: '®', trade: '™', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', euro: '€', pound: '£', yen: '¥', cent: '¢', sect: '§', deg: '°', plusmn: '±', times: '×', divide: '÷', laquo: '«', raquo: '»', bull: '•', middot: '·', para: '¶', frac12: '½', frac14: '¼', frac34: '¾', larr: '←', rarr: '→', uarr: '↑', darr: '↓', hearts: '♥', infin: '∞', ne: '≠', le: '≤', ge: '≥' };
const decodeEntities = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => { if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } } return HTML_ENT[e] ?? HTML_ENT[e.toLowerCase()] ?? m; });
const utf8 = s => new TextEncoder().encode(s);
const unutf8 = b => new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(b));
const syllables = w => { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); const m = w.match(/[aeiouy]{1,2}/g); return m ? m.length : 1; };
const NUMW = { ones: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], tens: ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'], scales: ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'] };
function intWords(n) {
  n = BigInt(n); if (n === 0n) return 'zero'; if (n < 0n) return 'minus ' + intWords(-n);
  const parts = []; let si = 0;
  while (n > 0n) { const chunk = Number(n % 1000n); n /= 1000n; if (chunk) { let w = ''; const h = Math.floor(chunk / 100), r = chunk % 100; if (h) w += NUMW.ones[h] + ' hundred' + (r ? ' ' : ''); if (r < 20 && r > 0) w += NUMW.ones[r]; else if (r >= 20) w += NUMW.tens[Math.floor(r / 10)] + (r % 10 ? '-' + NUMW.ones[r % 10] : ''); if (NUMW.scales[si]) w += ' ' + NUMW.scales[si]; parts.unshift(w); } si++; if (si > 5 && n > 0n) throw new Error('Number is too large (max 999 quadrillion)'); }
  return parts.join(' ');
}
const ORD_IRR = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const toOrdinalWords = w => w.replace(/(\w+)$/, m => ORD_IRR[m] || (m.endsWith('y') ? m.slice(0, -1) + 'ieth' : m + 'th'));
const toRoman = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
const fromRoman = s => { const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let t = 0; s = s.toUpperCase(); for (let i = 0; i < s.length; i++) { const a = v[s[i]], b = v[s[i + 1]] || 0; t += a < b ? -a : a; } return toRoman(t) === s ? t : NaN; };

/* CSV */
function parseCSV(text, delim = ',') {
  const rows = []; let row = [], f = '', q = false, i = 0; text = text.replace(/^\uFEFF/, '');
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"' && f === '') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (q) throw new Error('Unterminated quoted field in CSV');
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
const csvCell = (v, d = ',') => { v = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /["\r\n]/.test(v) || v.includes(d) || /^\s|\s$/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const DELIMS = [[',', 'Comma ,'], [';', 'Semicolon ;'], ['\t', 'Tab'], ['|', 'Pipe |']];

/* hashing */
function md5(str) {
  const b = utf8(str), n = b.length, words = []; for (let i = 0; i < n; i++) words[i >> 2] |= b[i] << ((i % 4) * 8);
  words[n >> 2] |= 0x80 << ((n % 4) * 8); const len = (((n + 8) >>> 6) + 1) * 16; for (let i = 0; i < len; i++) words[i] = words[i] | 0; words[len - 2] = n * 8;
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  const rl = (x, c) => (x << c) | (x >>> (32 - c));
  for (let o = 0; o < len; o += 16) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) { let F, g; if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; } F = (F + A + K[i] + words[o + g]) | 0; A = D; D = C; C = B; B = (B + rl(F, S[(i >> 4) * 4 + (i % 4)])) | 0; }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  return [a0, b0, c0, d0].map(v => { let h = ''; for (let i = 0; i < 4; i++) h += ((v >>> (i * 8)) & 255).toString(16).padStart(2, '0'); return h; }).join('');
}
async function digest(algo, str) {
  const buf = await crypto.subtle.digest(algo, utf8(str)); return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function cryptoInt(max) { const a = new Uint32Array(1), lim = Math.floor(4294967296 / max) * max; do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % max; }

/* diff (LCS) */
function diffSeq(a, b) {
  const n = a.length, m = b.length; if (n * m > 9e6) throw new Error('Texts are too large to compare in this mode — try “Line by line”');
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]); else out.push(['+', b[j++]]); }
  while (i < n) out.push(['-', a[i++]]); while (j < m) out.push(['+', b[j++]]); return out;
}
