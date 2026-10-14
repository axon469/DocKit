/* ═════════ Text tool registry (a): layout → encoding ═════════ */
const TTOOLS = [];
const T = (cat, id, name, desc, opts, run, x = {}) => TTOOLS.push({ id, cat, name, desc, opts, run, ...x });
const perLine = (s, f) => LINES(s).map(f).join('\n');
const QUOTE = { double: ['"', '"'], single: ["'", "'"], backtick: ['`', '`'], curly: ['“', '”'], curlysingle: ['‘', '’'], guillemet: ['«', '»'], custom: null };
const QSEL = oSel('type', 'Quote style', [['double', '"Double"'], ['single', "'Single'"], ['backtick', '`Backtick`'], ['curly', '“Curly”'], ['curlysingle', '‘Curly single’'], ['guillemet', '«Guillemets»'], ['custom', 'Custom…']]);
const qpair = o => o.type === 'custom' ? [o.open, o.close] : QUOTE[o.type];
const QCUSTOM = [oTxt('open', 'Opening quote', '«', '«'), oTxt('close', 'Closing quote', '»', '»')].map(f => ({ ...f, show: o => o.type === 'custom' }));

/* ── SPACING & LAYOUT ── */
T('spacing', 'spacing', 'Text Spacing Increaser', 'Add extra spaces between letters or words',
  [oSel('mode', 'Add spaces', [['letters', 'Between letters'], ['words', 'Between words'], ['both', 'Both']]), oNum('n', 'Spaces to add', 1, 1, 20)],
  (s, o) => { const sp = ' '.repeat(o.n); let r = s; if (o.mode !== 'words') r = r.replace(/\S+/g, w => CH(w).join(sp)); if (o.mode !== 'letters') r = r.replace(/ +/g, m => m + sp); return r; });
T('spacing', 'unwrap', 'Text Line Unwrapper', 'Join hard-wrapped lines back into paragraphs',
  [oSel('mode', 'Keep', [['para', 'Paragraph breaks'], ['none', 'Nothing — one single line']]), oTxt('sym', 'Join with', ' ', 'space'), oChk('trim', 'Trim each line', true)],
  (s, o) => { const j = o.sym === '' ? ' ' : o.sym; const ls = LINES(s).map(l => o.trim ? l.trim() : l); if (o.mode === 'none') return ls.filter(l => l.trim()).join(j); const ps = []; let cur = []; for (const l of ls) { if (!l.trim()) { if (cur.length) { ps.push(cur.join(j)); cur = []; } } else cur.push(l); } if (cur.length) ps.push(cur.join(j)); return ps.join('\n\n'); });
T('spacing', 'wrap', 'Wrap Words in Text', 'Wrap text to a maximum line length',
  [oNum('len', 'Max line length', 80, 5, 2000), oSel('unit', 'Break', [['words', 'At word boundaries'], ['chars', 'Anywhere (hard wrap)']])],
  (s, o) => perLine(s, line => { if (line.length <= o.len) return line; if (o.unit === 'chars') { const c = CH(line), out = []; for (let i = 0; i < c.length; i += o.len) out.push(c.slice(i, i + o.len).join('')); return out.join('\n'); } const out = []; let cur = ''; for (const w of line.split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > o.len) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) out.push(cur); return out.join('\n'); }));
T('spacing', 'indent', 'Indent Text', 'Add indentation to each line',
  [oSel('unit', 'Indent with', [['  ', '2 spaces'], ['    ', '4 spaces'], ['\t', 'Tab']], '    '), oNum('n', 'Levels', 1, 1, 20), oChk('skip', 'Skip empty lines', true)],
  (s, o) => perLine(s, l => o.skip && !l.trim() ? l : o.unit.repeat(o.n) + l));
T('spacing', 'unindent', 'Unindent Text', 'Remove indentation from each line',
  [oSel('unit', 'Indent size', [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tab']], '4'), oNum('n', 'Levels to remove', 1, 1, 20), oChk('all', 'Remove all leading whitespace', false)],
  (s, o) => perLine(s, l => { if (o.all) return l.trimStart(); const sz = o.unit === 'tab' ? 1 : +o.unit; let r = l; for (let i = 0; i < o.n; i++) { if (r[0] === '\t') r = r.slice(1); else { const m = r.match(new RegExp('^ {1,' + sz + '}')); if (m) r = r.slice(m[0].length); else break; } } return r; }));
T('spacing', 'justify', 'Justify Text', 'Stretch spaces so every line has equal width',
  [oNum('len', 'Line width (chars)', 60, 10, 500), oChk('rewrap', 'Re-wrap paragraphs to this width first', true), oChk('last', 'Also justify the last line of each paragraph', false)],
  (s, o) => { const just = (line, w) => { const ws = line.trim().split(/\s+/); if (ws.length < 2) return line.trim(); const tot = w - ws.join('').length; if (tot <= ws.length - 1) return ws.join(' '); const gaps = ws.length - 1, base = Math.floor(tot / gaps); let ex = tot % gaps; return ws.reduce((a, x, i) => i ? a + ' '.repeat(base + (ex-- > 0 ? 1 : 0)) + x : x, ''); };
    if (!o.rewrap) return perLine(s, l => just(l, o.len)); return PARAS(s).map(p => { const ws = WORDS(p), ls = []; let cur = []; for (const w of ws) { if (cur.length && (cur.join(' ') + ' ' + w).length > o.len) { ls.push(cur.join(' ')); cur = [w]; } else cur.push(w); } if (cur.length) ls.push(cur.join(' ')); return ls.map((l, i) => i < ls.length - 1 || o.last ? just(l, o.len) : l).join('\n'); }).join('\n\n'); });
T('spacing', 'leftpad', 'Left-pad Text', 'Pad the left side of each line to a fixed width',
  [oNum('len', 'Total width', 40, 1, 500), oTxt('ch', 'Pad character', ' ', ' ')], (s, o) => perLine(s, l => l.padStart(o.len, o.ch || ' ')));
T('spacing', 'rightpad', 'Right-pad Text', 'Pad the right side of each line to a fixed width',
  [oNum('len', 'Total width', 40, 1, 500), oTxt('ch', 'Pad character', ' ', ' ')], (s, o) => perLine(s, l => l.padEnd(o.len, o.ch || ' ')));
T('spacing', 'leftalign', 'Left-align Text', 'Remove leading spaces so lines align left', [], s => perLine(s, l => l.trimStart()));
T('spacing', 'rightalign', 'Right-align Text', 'Align each line to the right edge of a column',
  [oNum('len', 'Column width', 60, 5, 500)], (s, o) => perLine(s, l => l.trim().padStart(o.len)));
T('spacing', 'center', 'Center Text', 'Center each line within a column',
  [oNum('len', 'Column width', 60, 5, 500), oChk('pad', 'Pad right side too', false)],
  (s, o) => perLine(s, l => { const t = l.trim(), p = Math.max(0, Math.floor((o.len - t.length) / 2)), r = ' '.repeat(p) + t; return o.pad ? r.padEnd(o.len) : r; }));
T('spacing', 'truncate', 'Truncate Text', 'Cut text to a given length',
  [oNum('len', 'Max length (chars)', 100, 1, 999999), oTxt('suf', 'Add suffix', '…', 'e.g. …'), oChk('word', 'Cut at a word boundary', true)],
  (s, o) => { if (s.length <= o.len) return s; const keep = Math.max(0, o.len - o.suf.length); let r = s.slice(0, keep); if (o.word && s[keep] && !/\s/.test(s[keep]) && !/\s/.test(r.slice(-1))) { const i = r.search(/\s\S*$/); if (i > 0) r = r.slice(0, i); } return r.trimEnd() + o.suf; });
T('spacing', 'slice', 'Slice Text', 'Extract a portion of the text by position',
  [oNum('start', 'Start (0-based, negative = from end)', 0, -999999, 999999), oNum('end', 'End (exclusive, 0 = to the end)', 100, -999999, 999999)],
  (s, o) => { const c = CH(s); return (o.end === 0 ? c.slice(o.start) : c.slice(o.start, o.end)).join(''); });
T('spacing', 'trim', 'Trim Text', 'Trim whitespace from the left or right',
  [oSel('side', 'Trim', [['both', 'Both sides'], ['left', 'Left only'], ['right', 'Right only']]), oSel('scope', 'Apply to', [['lines', 'Every line'], ['text', 'Whole text']])],
  (s, o) => { const f = x => o.side === 'left' ? x.trimStart() : o.side === 'right' ? x.trimEnd() : x.trim(); return o.scope === 'text' ? f(s) : perLine(s, f); });

/* ── SPLIT & JOIN ── */
T('splitjoin', 'split', 'Split Text', 'Split text into pieces by a delimiter, word, sentence or length',
  [oSel('by', 'Split by', [['delim', 'Delimiter'], ['word', 'Every word'], ['sentence', 'Every sentence'], ['length', 'Fixed length'], ['regex', 'Regular expression']]), oTxt('d', 'Delimiter / length / pattern', ',', 'e.g. , or 50'), oTxt('out', 'Join pieces with', '\\n', '\\n = new line'), oChk('trim', 'Trim each piece', true), oChk('drop', 'Drop empty pieces', true)],
  (s, o) => { let p; if (o.by === 'word') p = WORDS(s); else if (o.by === 'sentence') p = SENT(s); else if (o.by === 'length') { const n = Math.max(1, parseInt(o.d) || 50), c = CH(s); p = []; for (let i = 0; i < c.length; i += n) p.push(c.slice(i, i + n).join('')); } else if (o.by === 'regex') p = s.split(mkRx(o.d || ' ', { regex: true, cs: true })); else p = s.split(o.d === '' ? ',' : o.d); if (o.trim) p = p.map(x => x.trim()); if (o.drop) p = p.filter(Boolean); return p.join(o.out); });
T('splitjoin', 'join', 'Join Text', 'Merge lines together with a delimiter',
  [oTxt('d', 'Delimiter', ', ', 'e.g. , or space'), oChk('skip', 'Skip empty lines', true), oChk('trim', 'Trim each line', true)],
  (s, o) => { let l = LINES(s); if (o.trim) l = l.map(x => x.trim()); if (o.skip) l = l.filter(x => x !== ''); return l.join(o.d); });
T('splitjoin', 'repeat', 'Repeat Text', 'Repeat text a number of times',
  [oNum('n', 'Repeat count', 3, 1, 10000), oTxt('sep', 'Separator', '\\n', '\\n = new line'), oChk('trim', 'Trim the text first', false)],
  (s, o) => { const t = o.trim ? s.trim() : s; if (t.length * o.n > 5e6) throw new Error('Result would be too large'); return Array(o.n).fill(t).join(o.sep); });

/* ── REVERSE & SWAP ── */
const inOrder = [['inside', 'Reverse the characters inside each'], ['order', 'Reverse the order of']];
T('reverse', 'reverse', 'Reverse Text', 'Write the text backwards', [oSel('mode', 'Reverse', [['all', 'Whole text'], ['lines', 'Each line separately']])],
  (s, o) => o.mode === 'lines' ? perLine(s, l => CH(l).reverse().join('')) : CH(s).reverse().join(''));
T('reverse', 'revwords', 'Reverse Words in Text', 'Reverse every word, or the order of the words', [oSel('mode', 'Mode', [['inside', 'Reverse letters inside each word'], ['order', 'Reverse word order in each line']])],
  (s, o) => o.mode === 'inside' ? s.replace(WRD(), w => CH(w).reverse().join('')) : perLine(s, l => { const ws = WORDS(l); return ws.reverse().join(' '); }));
T('reverse', 'revsentences', 'Reverse Sentences in Text', 'Reverse every sentence, or the sentence order', [oSel('mode', 'Mode', [['inside', 'Reverse the characters in each sentence'], ['order', 'Reverse sentence order']])],
  (s, o) => { const p = SENT(s.trim()); return (o.mode === 'inside' ? p.map(x => CH(x).reverse().join('')) : p.reverse()).join(' '); });
T('reverse', 'revparagraphs', 'Reverse Paragraphs in Text', 'Reverse every paragraph, or the paragraph order', [oSel('mode', 'Mode', [['inside', 'Reverse the characters in each paragraph'], ['order', 'Reverse paragraph order']])],
  (s, o) => { const p = PARAS(s); return (o.mode === 'inside' ? p.map(x => CH(x).reverse().join('')) : p.reverse()).join('\n\n'); });
T('reverse', 'revlines', 'Reverse Line Order', 'Flip the order of lines — last line first', [], s => LINES(s).reverse().join('\n'), { isNew: 1 });
T('reverse', 'swapletters', 'Swap Letters in Words', 'Swap pairs of neighbouring letters in each word', [oChk('all', 'Swap every pair (not just the first)', true)],
  (s, o) => s.replace(WRD(), w => { const a = CH(w); for (let i = 0; i < a.length - 1; i += 2) { [a[i], a[i + 1]] = [a[i + 1], a[i]]; if (!o.all) break; } return a.join(''); }));
T('reverse', 'swapwords', 'Swap Words in Text', 'Swap pairs of neighbouring words', [oChk('all', 'Swap every pair', true)],
  (s, o) => { const t = s.split(/(\s+)/), idx = []; t.forEach((x, i) => { if (/\S/.test(x)) idx.push(i); }); for (let i = 0; i + 1 < idx.length; i += 2) { [t[idx[i]], t[idx[i + 1]]] = [t[idx[i + 1]], t[idx[i]]]; if (!o.all) break; } return t.join(''); });

/* ── WORDS & SENTENCES ── */
T('words', 'dupwords', 'Duplicate Words in Text', 'Make every word appear more than once', [oNum('n', 'Total copies of each word', 2, 2, 10)],
  (s, o) => s.replace(WRD(), w => Array(o.n).fill(w).join(' ')));
T('words', 'removewords', 'Remove Words from Text', 'Delete specific words', [oTxt('list', 'Words to remove (comma-separated)', '', 'the, a, is'), CASE_OPT(), oChk('whole', 'Whole words only', true)],
  (s, o) => { const rx = new RegExp(needList(o.list, 'at least one word').map(RXE).join('|'), 'g' + (o.cs ? '' : 'i')), full = o.whole ? new RegExp('(?<![\\p{L}\\p{N}_])(?:' + rx.source + ')(?![\\p{L}\\p{N}_])', 'gu' + (o.cs ? '' : 'i')) : rx; return s.replace(full, '').replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/gm, ''); });
T('words', 'dupsentences', 'Duplicate Sentences', 'Make every sentence appear more than once', [oNum('n', 'Total copies', 2, 2, 10)], (s, o) => SENT(s.trim()).map(x => Array(o.n).fill(x).join(' ')).join(' '));
T('words', 'removesentences', 'Remove Sentences from Text', 'Delete sentences that contain given keywords', [oTxt('kw', 'Keywords (comma-separated)', '', 'e.g. cat, dog'), CASE_OPT(), oChk('invert', 'Keep only the matching sentences instead', false)],
  (s, o) => { const k = needList(o.kw, 'at least one keyword').map(x => o.cs ? x : x.toLowerCase()); return SENT(s.trim()).filter(x => { const h = k.some(w => (o.cs ? x : x.toLowerCase()).includes(w)); return o.invert ? h : !h; }).join(' '); });
T('words', 'replacewords', 'Replace Words in Text', 'Substitute certain words with other words', [oTxt('find', 'Find', '', 'word'), oTxt('rep', 'Replace with', ''), CASE_OPT(), oChk('whole', 'Whole words only', true), oChk('all', 'Replace all occurrences', true)],
  (s, o) => { if (!o.find) return s; return s.replace(mkRx(o.find, { cs: o.cs, whole: o.whole, flags: o.all ? 'g' : '' }), () => o.rep); });

/* ── PREFIX & SUFFIX ── */
const skipE = oChk('skip', 'Skip empty lines', false);
T('prefix', 'addprefix', 'Add Prefix to Lines', 'Prepend text to every line', [oTxt('v', 'Prefix', '', 'Enter prefix…'), skipE], (s, o) => perLine(s, l => o.skip && !l.trim() ? l : o.v + l));
T('prefix', 'addsuffix', 'Add Suffix to Lines', 'Append text to every line', [oTxt('v', 'Suffix', '', 'Enter suffix…'), skipE], (s, o) => perLine(s, l => o.skip && !l.trim() ? l : l + o.v));
T('prefix', 'removeprefix', 'Remove Prefix from Lines', 'Strip a prefix from every line', [oTxt('v', 'Prefix to remove', ''), CASE_OPT()], (s, o) => perLine(s, l => o.v && (o.cs ? l.startsWith(o.v) : l.toLowerCase().startsWith(o.v.toLowerCase())) ? l.slice(o.v.length) : l));
T('prefix', 'removesuffix', 'Remove Suffix from Lines', 'Strip a suffix from every line', [oTxt('v', 'Suffix to remove', ''), CASE_OPT()], (s, o) => perLine(s, l => o.v && (o.cs ? l.endsWith(o.v) : l.toLowerCase().endsWith(o.v.toLowerCase())) ? l.slice(0, l.length - o.v.length) : l));
T('prefix', 'addprefixwords', 'Add Prefix to Words', 'Prepend text to every word', [oTxt('v', 'Prefix', '')], (s, o) => s.replace(WRD(), w => o.v + w));
T('prefix', 'addsuffixwords', 'Add Suffix to Words', 'Append text to every word', [oTxt('v', 'Suffix', '')], (s, o) => s.replace(WRD(), w => w + o.v));
T('prefix', 'removeprefixwords', 'Remove Prefix from Words', 'Strip a prefix from every word', [oTxt('v', 'Prefix to remove', '')], (s, o) => s.replace(WRD(), w => o.v && w.startsWith(o.v) && w.length > o.v.length ? w.slice(o.v.length) : w));
T('prefix', 'removesuffixwords', 'Remove Suffix from Words', 'Strip a suffix from every word', [oTxt('v', 'Suffix to remove', '')], (s, o) => s.replace(WRD(), w => o.v && w.endsWith(o.v) && w.length > o.v.length ? w.slice(0, -o.v.length) : w));
T('prefix', 'addaroundwords', 'Add Symbols Around Words', 'Wrap every word in a before/after pattern', [oTxt('b', 'Before each word', '['), oTxt('a', 'After each word', ']'), oChk('skipnum', 'Skip numbers', false)],
  (s, o) => s.replace(WRD(), w => o.skipnum && /^\d+$/.test(w) ? w : o.b + w + o.a));
T('prefix', 'removearoundwords', 'Remove Symbols Around Words', 'Unwrap words surrounded by a pattern', [oTxt('b', 'Before pattern', '['), oTxt('a', 'After pattern', ']')],
  (s, o) => { if (!o.b && !o.a) return s; return s.replace(new RegExp(RXE(o.b) + '([\\p{L}\\p{N}_]+)' + RXE(o.a), 'gu'), '$1'); });
T('prefix', 'insertbetween', 'Insert Between Letters', 'Insert a character between all letters', [oTxt('c', 'Character to insert', '-'), oChk('words', 'Only inside words (keep spaces)', true)],
  (s, o) => o.words ? s.replace(/\S+/g, w => CH(w).join(o.c)) : CH(s).join(o.c));
T('prefix', 'addaroundletters', 'Add Symbols Around Letters', 'Surround each letter with decorative symbols', [oTxt('b', 'Before each letter', '*'), oTxt('a', 'After each letter', '*'), oSel('scope', 'Apply to', [['letters', 'Letters only'], ['all', 'All non-space characters']])],
  (s, o) => s.replace(o.scope === 'letters' ? /\p{L}/gu : /\S/gu, c => o.b + c + o.a));

/* ── LINES & FILTERING ── */
T('lines', 'rmemptylines', 'Remove All Empty Lines', 'Delete every blank line', [oChk('trim', 'Also remove whitespace-only lines', true)], (s, o) => LINES(s).filter(l => o.trim ? l.trim() !== '' : l !== '').join('\n'));
T('lines', 'rmduplines', 'Remove Duplicate Lines', 'Delete repeated lines, keeping one', [oChk('cs', 'Case sensitive', true), oChk('trim', 'Ignore surrounding whitespace', true), oSel('keep', 'Keep', [['first', 'First occurrence'], ['last', 'Last occurrence']]), oChk('empty', 'Keep empty lines', true)], 
  (s, o) => { const key = l => { let k = o.trim ? l.trim() : l; return o.cs ? k : k.toLowerCase(); }; const arr = o.keep === 'last' ? LINES(s).reverse() : LINES(s), seen = new Set(), res = []; for (const l of arr) { if (o.empty && !l.trim()) { res.push(l); continue; } const k = key(l); if (!seen.has(k)) { seen.add(k); res.push(l); } } return (o.keep === 'last' ? res.reverse() : res).join('\n'); }, { popular: 1 });
const FILT = [oTxt('p', 'Pattern', '', 'text or /regex/i'), oChk('regex', 'Treat as regular expression', false), CASE_OPT(), oSel('mode', 'Mode', [['include', 'Keep matches'], ['exclude', 'Remove matches']])];
const filt = (split, join) => (s, o) => { if (!o.p) return s; const rx = mkRx(o.p, { regex: o.regex, cs: o.cs }); return split(s).filter(x => o.mode === 'include' ? rx.test(x) : !rx.test(x)).join(join); };
T('lines', 'filterlines', 'Filter Text Lines', 'Keep or remove lines that match a pattern', FILT, filt(LINES, '\n'));
T('lines', 'filterwords', 'Filter Words in Text', 'Keep or remove words that match a pattern', FILT, filt(WORDS, ' '));
T('lines', 'filtersentences', 'Filter Text Sentences', 'Keep or remove sentences that match a pattern', FILT, filt(s => SENT(s.trim()), ' '));
T('lines', 'filterparagraphs', 'Filter Text Paragraphs', 'Keep or remove paragraphs that match a pattern', FILT, filt(PARAS, '\n\n'));
T('lines', 'addlinenumbers', 'Add Line Numbers', 'Add a number before every line', [oTxt('sep', 'Separator', '. '), oNum('start', 'Start from', 1, -9999, 999999), oChk('pad', 'Right-align numbers', true), oChk('skip', 'Skip empty lines (no number)', false)],
  (s, o) => { const ls = LINES(s); let n = o.start; const total = ls.filter(l => !(o.skip && !l.trim())).length, w = String(o.start + total).length; return ls.map(l => { if (o.skip && !l.trim()) return l; const num = String(n++); return (o.pad ? num.padStart(w) : num) + o.sep + l; }).join('\n'); });
T('lines', 'removelinenumbers', 'Remove Line Numbers', 'Strip leading numbering like “1.” “2)” “3:”', [oChk('own', 'Only remove when followed by a separator (. ) : -)', true)],
  (s, o) => perLine(s, l => l.replace(o.own ? /^\s*\d+\s*[.):\-]\s?/ : /^\s*\d+\s*[.):\-]?\s?/, '')));

/* ── SORT & RANDOMIZE ── */
T('sort', 'sortlines', 'Sort Text Lines', 'Sort lines alphabetically, naturally, numerically or by length',
  [oSel('by', 'Sort by', [['alpha', 'Alphabetical'], ['natural', 'Natural (file2 before file10)'], ['num', 'Numeric'], ['length', 'Length']]), oSel('order', 'Order', [['asc', 'Ascending'], ['desc', 'Descending']]), CASE_OPT(), oChk('trim', 'Trim lines first', false), oChk('uniq', 'Remove duplicates', false), oChk('empty', 'Drop empty lines', false)],
  (s, o) => { let a = LINES(s); if (o.trim) a = a.map(l => l.trim()); if (o.empty) a = a.filter(Boolean); if (o.uniq) a = [...new Set(a)]; a.sort(cmpBy(o.by, o.cs)); if (o.order === 'desc') a.reverse(); return a.join('\n'); }, { popular: 1 });
const SORTX = [oSel('order', 'Order', [['asc', 'Ascending'], ['desc', 'Descending']]), oSel('by', 'Sort by', [['alpha', 'Alphabetical'], ['length', 'Length']]), CASE_OPT()];
const sortx = (split, join) => (s, o) => { const a = split(s); a.sort(cmpBy(o.by, o.cs)); if (o.order === 'desc') a.reverse(); return a.join(join); };
T('sort', 'sortsentences', 'Sort Sentences in Text', 'Sort sentences alphabetically or by length', SORTX, sortx(s => SENT(s.trim()), ' '));
T('sort', 'sortparagraphs', 'Sort Paragraphs in Text', 'Sort paragraphs alphabetically or by length', SORTX, sortx(PARAS, '\n\n'));
T('sort', 'sortwords', 'Sort Words in Text', 'Sort words alphabetically or by length', SORTX, sortx(WORDS, ' '));
T('sort', 'sortletters', 'Sort Letters in Words', 'Sort the letters inside every word', [oSel('order', 'Order', [['asc', 'Ascending'], ['desc', 'Descending']]), CASE_OPT()],
  (s, o) => s.replace(WRD(), w => { const a = CH(w).sort((x, y) => o.cs ? (x < y ? -1 : x > y ? 1 : 0) : cmpAlpha(x, y)); return (o.order === 'desc' ? a.reverse() : a).join(''); }));
T('sort', 'randletters', 'Randomize Letters in Text', 'Shuffle the letters of the text', [oChk('words', 'Keep words intact (shuffle inside each word)', true)], (s, o) => o.words ? s.replace(WRD(), w => shuffle(CH(w)).join('')) : shuffle(CH(s)).join(''), { random: 1 });
T('sort', 'scramblewords', 'Scramble Words', 'Scramble the middle of each word — still readable', [oChk('keep', 'Keep first and last letters', true)], (s, o) => s.replace(WRD(), w => { const c = CH(w); if (c.length < 4 && o.keep) return w; return o.keep ? c[0] + shuffle(c.slice(1, -1)).join('') + c[c.length - 1] : shuffle(c).join(''); }), { random: 1 });
T('sort', 'randwords', 'Randomize Words in Text', 'Shuffle the order of the words', [], s => shuffle(WORDS(s)).join(' '), { random: 1 });
T('sort', 'randlines', 'Randomize Text Lines', 'Shuffle the order of the lines', [], s => shuffle(LINES(s)).join('\n'), { random: 1 });
T('sort', 'randsentences', 'Randomize Text Sentences', 'Shuffle the order of the sentences', [], s => shuffle(SENT(s.trim())).join(' '), { random: 1 });
T('sort', 'randparagraphs', 'Randomize Text Paragraphs', 'Shuffle the order of the paragraphs', [], s => shuffle(PARAS(s)).join('\n\n'), { random: 1 });

/* ── TEXT CASE ── */
const titleCase = (s, small) => { let first = true; const toks = [...s.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu)]; const last = toks.length - 1; let ti = 0; return s.toLowerCase().replace(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu, w => { const i = ti++; if (small && i !== 0 && i !== last && MINOR.has(w)) return w; return w.charAt(0).toUpperCase() + w.slice(1); }); };
T('case', 'uppercase', 'Convert to Uppercase', 'Convert every letter to UPPERCASE', [], s => s.toUpperCase());
T('case', 'lowercase', 'Convert to Lowercase', 'Convert every letter to lowercase', [], s => s.toLowerCase());
T('case', 'titlecase', 'Convert to Title Case', 'Capitalize the first letter of every word', [oChk('small', 'Keep small words lowercase (a, of, the…)', false), oChk('lower', 'Lowercase the rest of each word', true)],
  (s, o) => o.lower ? titleCase(s, o.small) : s.replace(/(^|[^\p{L}\p{N}'’])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase()), { popular: 1 });
T('case', 'propercase', 'Convert to Sentence Case', 'Capitalize the first letter of every sentence', [oChk('lower', 'Lowercase everything else first', true), oChk('fixi', 'Capitalize the standalone word “i”', true)],
  (s, o) => { let r = o.lower ? s.toLowerCase() : s; r = r.replace(/(^\s*|[.!?]["'”’)\]]*\s+|\n\s*)(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase()); if (o.fixi) r = r.replace(/(^|[^\p{L}\p{N}'’])i(?=$|[^\p{L}\p{N}]|'m|'ll|'d|'ve)/gu, '$1I'); return r; });
T('case', 'randomcase', 'Randomize Text Case', 'Randomly uppercase or lowercase each letter', [oRng('rate', 'Uppercase chance', 50, 1, 99, '%')], (s, o) => s.replace(/\p{L}/gu, c => Math.random() * 100 < o.rate ? c.toUpperCase() : c.toLowerCase()), { random: 1 });
T('case', 'invertcase', 'Invert Text Case', 'Flip upper case to lower and vice versa', [], s => CH(s).map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join(''));
T('case', 'altcase', 'Alternating Case', 'aLtErNaTiNg lower and upper case letters', [oSel('start', 'Start with', [['lower', 'lowercase'], ['upper', 'UPPERCASE']])], (s, o) => { let i = o.start === 'lower' ? 0 : 1; return s.replace(/\p{L}/gu, c => (i++ % 2 ? c.toUpperCase() : c.toLowerCase())); }, { isNew: 1 });

/* ── LINE BREAKS & SPACES ── */
T('breaks', 'addlinebreaks', 'Add Line Breaks', 'Add new lines after sentences, words or characters', [oSel('mode', 'Add after', [['sentence', 'Each sentence'], ['word', 'Every N words'], ['char', 'Every N characters']]), { ...oNum('n', 'N (words / characters)', 10, 1, 9999), show: o => o.mode !== 'sentence' }],
  (s, o) => { if (o.mode === 'sentence') return SENT(s.trim()).join('\n'); if (o.mode === 'word') { const w = WORDS(s), out = []; for (let i = 0; i < w.length; i += o.n) out.push(w.slice(i, i + o.n).join(' ')); return out.join('\n'); } const c = CH(s.replace(/\n/g, ' ')), out = []; for (let i = 0; i < c.length; i += o.n) out.push(c.slice(i, i + o.n).join('')); return out.join('\n'); });
T('breaks', 'removelinebreaks', 'Remove Line Breaks', 'Remove new lines between text lines', [oSel('mode', 'Remove', [['all', 'All line breaks'], ['single', 'Single breaks only (keep paragraphs)'], ['double', 'Blank lines only']]), oTxt('rep', 'Replace with', ' ', 'space')],
  (s, o) => o.mode === 'single' ? s.replace(/(?<!\n)\r?\n(?!\r?\n)/g, o.rep) : o.mode === 'double' ? s.replace(/(\r?\n){2,}/g, '\n') : s.replace(/(\r?\n)+/g, o.rep));
T('breaks', 'replacelinebreaks', 'Replace Line Breaks', 'Replace every line break with something else', [oTxt('with', 'Replace with', ' | ')], (s, o) => s.replace(/\r?\n/g, o.with));
T('breaks', 'normalizebreaks', 'Normalize Line Breaks', 'Make line break counts consistent', [oSel('mode', 'Normalize to', [['single', 'Single line breaks'], ['double', 'One blank line between paragraphs'], ['unix', 'Unix (LF) endings'], ['windows', 'Windows (CRLF) endings']])],
  (s, o) => { const u = s.replace(/\r\n?/g, '\n'); if (o.mode === 'single') return u.replace(/\n+/g, '\n'); if (o.mode === 'double') return u.replace(/\n+/g, '\n\n'); if (o.mode === 'windows') return u.replace(/\n/g, '\r\n'); return u; });
T('breaks', 'fancifybreaks', 'Fancify Line Breaks', 'Add a decorative symbol at the end of each line', [oTxt('sym', 'Symbol', ' ◆'), oChk('nonempty', 'Non-empty lines only', true)], (s, o) => perLine(s, l => o.nonempty && !l.trim() ? l : l + o.sym));
T('breaks', 'spaces2newlines', 'Convert Spaces to Newlines', 'Put every word on its own line', [oChk('multi', 'Collapse repeated spaces', true)], (s, o) => o.multi ? s.replace(/[ \t]+/g, '\n') : s.replace(/ /g, '\n'));
T('breaks', 'newlines2spaces', 'Convert Newlines to Spaces', 'Replace line breaks with spaces', [oChk('multi', 'Collapse repeated spaces', true)], (s, o) => { const r = s.replace(/\r?\n/g, ' '); return o.multi ? r.replace(/ {2,}/g, ' ').trim() : r; });
T('breaks', 'spaces2tabs', 'Convert Spaces to Tabs', 'Replace runs of spaces with tabs', [oNum('n', 'Spaces per tab', 4, 1, 16), oChk('lead', 'Leading indentation only', true)], (s, o) => perLine(s, l => o.lead ? l.replace(/^ +/, sp => '\t'.repeat(Math.floor(sp.length / o.n)) + ' '.repeat(sp.length % o.n)) : l.replace(new RegExp(' '.repeat(o.n), 'g'), '\t')));
T('breaks', 'tabs2spaces', 'Convert Tabs to Spaces', 'Replace tabs with spaces', [oNum('n', 'Spaces per tab', 4, 1, 16)], (s, o) => s.replace(/\t/g, ' '.repeat(o.n)));
T('breaks', 'comma2newline', 'Convert Comma to Newline', 'Replace commas with new lines', [oChk('trim', 'Trim whitespace after commas', true)], (s, o) => s.replace(o.trim ? /,\s*/g : /,/g, '\n'));
T('breaks', 'newline2comma', 'Convert Newline to Comma', 'Replace new lines with commas', [oTxt('sep', 'Separator', ', '), oChk('skip', 'Skip empty lines', true)], (s, o) => LINES(s).filter(l => !o.skip || l.trim()).join(o.sep));
T('breaks', 'spaces2commas', 'Convert Spaces to Commas', 'Replace spaces with commas', [oChk('multi', 'Collapse repeated spaces', true)], (s, o) => s.replace(o.multi ? / +/g : / /g, ','));
T('breaks', 'commas2spaces', 'Convert Commas to Spaces', 'Replace commas with spaces', [], s => s.replace(/,\s*/g, ' '));
T('breaks', 'removeextraspaces', 'Remove Extra Spaces', 'Collapse repeated spaces between words', [oChk('lead', 'Remove leading spaces on each line', false), oChk('trail', 'Remove trailing spaces on each line', true), oChk('nl', 'Collapse multiple blank lines', false)],
  (s, o) => { let r = s.replace(/[ \t]{2,}/g, ' '); if (o.lead) r = r.replace(/^[ \t]+/gm, ''); if (o.trail) r = r.replace(/[ \t]+$/gm, ''); if (o.nl) r = r.replace(/\n{3,}/g, '\n\n'); return r; });
T('breaks', 'removespaces', 'Remove All Whitespace', 'Delete every space, tab and newline', [oChk('keepnl', 'Keep line breaks', false)], (s, o) => o.keepnl ? s.replace(/[^\S\r\n]/g, '') : s.replace(/\s/g, ''));

/* ── LETTERS & SYMBOLS ── */
const shiftLetters = k => c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + k + 26) % 26) + b); };
T('letters', 'incrementletters', 'Increment Letters', 'Replace each letter with the next one (a→b, z→a)', [oNum('n', 'Shift by', 1, 1, 25)], (s, o) => s.replace(/[a-zA-Z]/g, shiftLetters(o.n)));
T('letters', 'decrementletters', 'Decrement Letters', 'Replace each letter with the previous one (b→a, a→z)', [oNum('n', 'Shift by', 1, 1, 25)], (s, o) => s.replace(/[a-zA-Z]/g, shiftLetters(-o.n)));
T('letters', 'replaceletters', 'Replace Letters in Text', 'Substitute certain letters with other letters', [oTxt('from', 'Letters to replace', '', 'e.g. aeiou'), oTxt('to', 'Replace with', '', 'one char, or one per letter'), CASE_OPT()],
  (s, o) => { if (!o.from) return s; const f = CH(o.from), t = CH(o.to); const map = new Map(f.map((c, i) => [o.cs ? c : c.toLowerCase(), t[i] ?? t[t.length - 1] ?? ''])); return CH(s).map(c => map.has(o.cs ? c : c.toLowerCase()) ? map.get(o.cs ? c : c.toLowerCase()) : c).join(''); });
T('letters', 'letters2digits', 'Convert Letters to Digits', 'A=1, B=2 … Z=26', [oTxt('sep', 'Separator between numbers', ' ', 'space')], (s, o) => s.replace(/[a-zA-Z]+/g, w => CH(w).map(c => c.toLowerCase().charCodeAt(0) - 96).join(o.sep)));
T('letters', 'digits2letters', 'Convert Digits to Letters', '1=A, 2=B … 26=Z', [oChk('upper', 'Uppercase letters', false)], (s, o) => s.replace(/\d+/g, n => { const v = parseInt(n, 10); return v >= 1 && v <= 26 ? String.fromCharCode((o.upper ? 64 : 96) + v) : n; }));
T('letters', 'dupletters', 'Duplicate Letters in Text', 'Repeat each letter', [oTxt('chars', 'Only these letters (empty = all)', '', 'e.g. aeiou'), oNum('n', 'Copies of each', 2, 2, 10)], (s, o) => { const set = o.chars ? new Set(CH(o.chars.toLowerCase())) : null; return s.replace(/\p{L}/gu, c => !set || set.has(c.toLowerCase()) ? c.repeat(o.n) : c); });
T('letters', 'removeletters', 'Remove Letters from Text', 'Delete certain letters', [oTxt('chars', 'Letters to remove', '', 'e.g. xyz'), CASE_OPT()], (s, o) => o.chars ? s.replace(new RegExp('[' + RXC(o.chars) + ']', 'gu' + (o.cs ? '' : 'i')), '') : s);
const VOW = /[aeiouAEIOU]/g, CON = /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g;
T('letters', 'replacevowels', 'Replace Vowels in Text', 'Substitute vowels with another character', [oTxt('with', 'Replace with', '*'), oSel('case', 'Case of replacement', [['keep', 'Match original'], ['lower', 'lowercase'], ['upper', 'UPPERCASE']])], (s, o) => s.replace(VOW, c => o.case === 'upper' ? o.with.toUpperCase() : o.case === 'lower' ? o.with.toLowerCase() : c === c.toUpperCase() ? o.with.toUpperCase() : o.with.toLowerCase()));
T('letters', 'dupvowels', 'Duplicate Vowels in Text', 'Repeat each vowel', [oNum('n', 'Copies of each', 2, 2, 10)], (s, o) => s.replace(VOW, c => c.repeat(o.n)));
T('letters', 'removevowels', 'Remove Vowels from Text', 'Delete all vowels', [], s => s.replace(VOW, ''));
T('letters', 'replaceconsonants', 'Replace Consonants', 'Substitute consonants with another character', [oTxt('with', 'Replace with', '*')], (s, o) => s.replace(CON, c => c === c.toUpperCase() ? o.with.toUpperCase() : o.with.toLowerCase()));
T('letters', 'removeconsonants', 'Remove Consonants', 'Delete all consonants', [], s => s.replace(CON, ''));

/* ── QUOTES ── */
T('quotes', 'addquotes', 'Add Quotes to Text', 'Wrap the whole text in quotes', [QSEL, ...QCUSTOM], (s, o) => { const [a, b] = qpair(o); return a + s + b; });
T('quotes', 'removequotes', 'Remove Quotes from Text', 'Delete quotation marks', [oChk('d', 'Straight double quotes "', true), oChk('s', "Straight single quotes '", true), oChk('c', 'Curly and angle quotes “ ” ‘ ’ « »', true)],
  (s, o) => { let r = s; if (o.d) r = r.replace(/"/g, ''); if (o.s) r = r.replace(/'/g, ''); if (o.c) r = r.replace(/[“”‘’«»„‟]/g, ''); return r; });
T('quotes', 'addquoteswords', 'Add Quotes to Words', 'Surround every word with quotes', [QSEL, ...QCUSTOM], (s, o) => { const [a, b] = qpair(o); return s.replace(WRD(), w => a + w + b); });
T('quotes', 'rmquoteswords', 'Remove Quotes from Words', 'Delete quotes around single words', [oChk('d', 'Double quotes', true), oChk('s', 'Single quotes', true), oChk('c', 'Curly quotes', true)],
  (s, o) => { let r = s; if (o.d) r = r.replace(/"([\p{L}\p{N}_'’-]+)"/gu, '$1'); if (o.s) r = r.replace(/(^|[^\p{L}\p{N}])'([\p{L}\p{N}_-]+)'/gu, '$1$2'); if (o.c) r = r.replace(/[“‘«]([\p{L}\p{N}_-]+)[”’»]/gu, '$1'); return r; });
T('quotes', 'addquoteslines', 'Add Quotes to Lines', 'Enclose each line in quotes', [QSEL, ...QCUSTOM, oChk('skip', 'Skip empty lines', true), oTxt('end', 'Append after closing quote', '', 'e.g. a comma')], (s, o) => { const [a, b] = qpair(o); return perLine(s, l => o.skip && !l.trim() ? l : a + l + b + o.end); });
T('quotes', 'rmquoteslines', 'Remove Quotes from Lines', 'Delete quotes enclosing each line', [oChk('d', 'Double quotes', true), oChk('s', 'Single quotes', true), oChk('c', 'Curly quotes', true)],
  (s, o) => perLine(s, l => { const t = l.trim(); const pairs = []; if (o.d) pairs.push(['"', '"']); if (o.s) pairs.push(["'", "'"]); if (o.c) pairs.push(['“', '”'], ['‘', '’'], ['«', '»']); for (const [a, b] of pairs) if (t.length >= 2 && t.startsWith(a) && t.endsWith(b)) return l.replace(t, t.slice(1, -1)); return l; }));

/* ── ENCODING & CIPHERS ── */
T('encode', 'rot13', 'ROT13 Text', 'Encode or decode with the ROT13 cipher', [oNote('ROT13 shifts every letter by 13 places. Run it twice to get the original back.')], s => s.replace(/[a-zA-Z]/g, shiftLetters(13)));
T('encode', 'rot47', 'ROT47 Text', 'Encode or decode printable ASCII with ROT47', [oNote('ROT47 rotates all printable ASCII characters. Run it twice to decode.')], s => s.replace(/[\x21-\x7E]/g, c => String.fromCharCode(((c.charCodeAt(0) - 33 + 47) % 94) + 33)));
T('encode', 'caesar', 'Caesar Cipher', 'Shift letters by any amount to encode or decode', [oNum('n', 'Shift', 3, -25, 25), oSel('dir', 'Direction', [['enc', 'Encode'], ['dec', 'Decode']])], (s, o) => s.replace(/[a-zA-Z]/g, shiftLetters(o.dir === 'enc' ? o.n : -o.n)), { isNew: 1 });
T('encode', 'urlencode', 'URL-encode Text', 'Percent-encode text for use in URLs', [oSel('mode', 'Mode', [['comp', 'Encode everything (component)'], ['full', 'Keep URL characters (: / ? # &)']]), oChk('plus', 'Use + for spaces', false)], (s, o) => { let r = o.mode === 'full' ? encodeURI(s) : encodeURIComponent(s); if (o.plus) r = r.replace(/%20/g, '+'); return r; });
T('encode', 'urldecode', 'URL-decode Text', 'Decode percent-encoded text', [oChk('plus', 'Treat + as a space', true)], (s, o) => { try { return decodeURIComponent(o.plus ? s.replace(/\+/g, ' ') : s); } catch { throw new Error('Malformed percent-encoding (e.g. a stray % sign)'); } });
T('encode', 'htmlencode', 'HTML-encode Text', 'Convert special characters to HTML entities', [oChk('all', 'Also encode non-ASCII characters', false)], (s, o) => { let r = s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); if (o.all) r = r.replace(/[^\x00-\x7F]/gu, c => '&#' + c.codePointAt(0) + ';'); return r; });
T('encode', 'htmldecode', 'HTML-decode Text', 'Convert HTML entities back to characters', [], s => decodeEntities(s));
T('encode', 'b64encode', 'Base64-encode Text', 'Encode text (UTF-8) to Base64', [oChk('url', 'URL-safe alphabet', false), oChk('nopad', 'Remove = padding', false), oNum('wrap', 'Wrap lines at (0 = no wrap)', 0, 0, 500)],
  (s, o) => { const b = utf8(s); let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode(...b.subarray(i, i + 8192)); let r = btoa(bin); if (o.url) r = r.replace(/\+/g, '-').replace(/\//g, '_'); if (o.nopad) r = r.replace(/=+$/, ''); return o.wrap ? r.replace(new RegExp('(.{' + o.wrap + '})', 'g'), '$1\n').trim() : r; });
T('encode', 'b64decode', 'Base64-decode Text', 'Decode Base64 back to text', [], s => { let t = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/'); if (!/^[A-Za-z0-9+/]*={0,2}$/.test(t)) throw new Error('This is not valid Base64'); while (t.length % 4) t += '='; let bin; try { bin = atob(t); } catch { throw new Error('This is not valid Base64'); } return unutf8(Array.from(bin, c => c.charCodeAt(0))); });
const SEPS = [['space', 'Space'], ['newline', 'New line'], ['none', 'None']];
const sepOf = k => k === 'newline' ? '\n' : k === 'none' ? '' : ' ';
T('encode', 'text2binary', 'Convert Text to Binary', 'Convert text (UTF-8) to binary', [oSel('sep', 'Separator', SEPS)], (s, o) => [...utf8(s)].map(b => b.toString(2).padStart(8, '0')).join(sepOf(o.sep)));
T('encode', 'binary2text', 'Convert Binary to Text', 'Convert binary back to text', [], s => { const t = s.replace(/[^01]/g, ''); if (!t.length) throw new Error('No binary digits found'); if (t.length % 8) throw new Error('Binary length must be a multiple of 8 bits (' + t.length + ' bits found)'); return unutf8(t.match(/.{8}/g).map(b => parseInt(b, 2))); });
T('encode', 'text2hex', 'Convert Text to Hex', 'Convert text (UTF-8) to hexadecimal', [oSel('sep', 'Format', [['space', 'ab cd ef'], ['none', 'abcdef'], ['0x', '0xab 0xcd'], ['x', '\\xab\\xcd']]), oSel('case', 'Case', [['lower', 'lowercase'], ['upper', 'UPPERCASE']])],
  (s, o) => { const h = [...utf8(s)].map(b => { let x = b.toString(16).padStart(2, '0'); if (o.case === 'upper') x = x.toUpperCase(); return o.sep === '0x' ? '0x' + x : o.sep === 'x' ? '\\x' + x : x; }); return h.join(o.sep === 'none' || o.sep === 'x' ? '' : ' '); });
T('encode', 'hex2text', 'Convert Hex to Text', 'Convert hexadecimal back to text', [], s => { const t = s.replace(/0x|\\x|[\s,:-]/gi, ''); if (!/^[0-9a-f]*$/i.test(t)) throw new Error('Contains characters that are not hexadecimal'); if (t.length % 2) throw new Error('Hex must have an even number of digits'); return unutf8((t.match(/../g) || []).map(h => parseInt(h, 16))); });
T('encode', 'text2morse', 'Convert Text to Morse', 'Write text in Morse code', [oSel('wsep', 'Word separator', [[' / ', 'Slash ( / )'], ['   ', 'Three spaces']])], (s, o) => s.toUpperCase().split(/\s+/).filter(Boolean).map(w => CH(w).map(c => MORSE[c] ?? '?').join(' ')).join(o.wsep));
T('encode', 'morse2text', 'Convert Morse to Text', 'Decode Morse code to text', [oNote('Use spaces between letters and “/” (or three spaces) between words.')], s => s.trim().split(/\s*\/\s*|\s{3,}|\n/).map(w => w.trim().split(/\s+/).map(c => MORSE_REV[c] ?? '?').join('')).join(' '));
T('encode', 'urlslug', 'Convert Text to URL Slug', 'Make a clean, URL-friendly slug', [oTxt('sep', 'Separator', '-'), oChk('lower', 'Lowercase', true), oChk('each', 'One slug per line', false)], (s, o) => { const f = x => { let r = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); if (o.lower) r = r.toLowerCase(); const sep = o.sep || '-'; return r.replace(/[^a-zA-Z0-9]+/g, sep).replace(new RegExp('^' + RXE(sep) + '+|' + RXE(sep) + '+$', 'g'), ''); }; return o.each ? perLine(s, f) : f(s); });
T('encode', 'striphtml', 'Strip HTML Tags', 'Remove all HTML tags from text', [oChk('br', 'Turn <br> and block tags into line breaks', true), oChk('dec', 'Decode HTML entities', true)],
  (s, o) => { let r = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ''); if (o.br) r = r.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n'); r = r.replace(/<[^>]+>/g, ''); if (o.dec) r = decodeEntities(r); return r.replace(/\n{3,}/g, '\n\n').trim(); });
