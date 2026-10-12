/* ═════════ text workspace ═════════ */
const TTOOL = Object.fromEntries(TTOOLS.map(t => [t.id, t]));
const textStats = s => { const w = (s.match(/\S+/g) || []).length; return `${Array.from(s).length.toLocaleString()} chars · ${w.toLocaleString()} words · ${s ? s.split(/\r\n|\r|\n/).length.toLocaleString() : 0} lines`; };
function coerceText(t) {
  const o = {};
  for (const f of t.opts) {
    if (f.type === 'note') continue; let v = S.vals[f.k];
    if (f.type === 'number' || f.type === 'range') { v = parseFloat(v); if (Number.isNaN(v)) v = f.def; if (f.min != null) v = Math.max(f.min, v); if (f.max != null) v = Math.min(f.max, v); }
    else if (f.type === 'text' || f.type === 'textarea') v = String(v ?? '').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    else if (f.type === 'check') v = !!v;
    o[f.k] = v;
  }
  return o;
}
function loadTextFile(f) {
  if (!f) return; if (f.size > 20e6) return toast('That file is too large (20 MB max)', 'err');
  f.text().then(t => { const ta = $('#tin'); if (!ta) return; ta.value = t; ta.dispatchEvent(new Event('input')); toast(`Loaded ${f.name}`, 'ok'); });
}
function openText(id) {
  const t = TTOOL[id]; if (!t) { location.hash = '#/'; return; }
  const carry = S.carryText; S.carryText = null; S.carry = S.carry && S.carry.dom ? null : S.carry;
  cleanup(); Object.assign(S, { tool: t, vals: defaults(t), aux: {}, st: {}, text: '', busy: false, live: !(t.random || t.gen), runId: 0 }); setChrome(t); pushRecent('x:' + t.id);
  const cat = TCATS[t.cat];
  app.innerHTML = `<div class="wrap ws"><nav class="crumbs"><a href="#/text">${icon('back')}All tools</a><span>/</span><span style="color:var(--ink2)">${esc(cat.n)}</span></nav>
    <header class="ws-head" style="--c:${cat.c}"><span class="ic">${icon(cat.i)}</span><div><h1>${esc(t.name)}</h1><p>${esc(t.desc)}</p></div></header>
    <div class="ws-grid ws-text" id="wsg"><section id="main">
      <div class="panel io o1" id="inP"><div class="io-h"><div class="panel-h" style="margin:0">${t.gen ? 'Optional input' : 'Input'}</div><div class="io-acts">
        <button class="btn sm" data-a="paste">${icon('clipboard')}Paste</button><label class="btn sm" style="cursor:pointer">${icon('upload')}Open file<input type="file" hidden id="tfile" accept=".txt,.md,.csv,.tsv,.json,.html,.htm,.xml,.log,.yml,.yaml,text/*"></label>
        <button class="btn sm" data-a="sample">${icon('sample')}Sample</button><button class="btn sm" data-a="clear">${icon('x')}Clear</button></div></div>
        <textarea id="tin" class="tx" spellcheck="false" placeholder="${t.gen ? 'Not required — adjust the options and press Generate' : 'Type or paste your text here…'}"></textarea><div class="io-f"><span class="cnt" id="inStats"></span><span class="cnt hint">Ctrl + Enter to run</span></div></div>
      ${t.second ? `<div class="panel io o1"><div class="io-h"><div class="panel-h" style="margin:0">Second text</div></div><textarea id="tin2" class="tx" spellcheck="false" placeholder="Paste the text to compare against…"></textarea></div>` : ''}
      <div class="panel io o3" id="outP"><div class="io-h"><div class="panel-h" style="margin:0">${t.report ? 'Result' : 'Output'}</div><div class="io-acts">
        <button class="btn sm pri" data-a="copy">${icon('copy')}Copy</button><button class="btn sm" data-a="dl">${icon('download')}Download</button>${t.gen || t.report ? '' : `<button class="btn sm" data-a="reuse">${icon('arrowRight')}Use as input</button>`}</div></div>
        <textarea id="tout" class="tx out" readonly spellcheck="false" placeholder="Result appears here…"></textarea><div id="terr"></div><div class="io-f"><span class="cnt" id="outStats"></span></div></div>
    </section>
    <aside class="ws-side" id="side"><div id="optsP"></div>
      <div class="panel" id="runP"><button class="btn pri lg block" id="run">${t.gen ? 'Generate' : 'Run'} ${icon('arrowRight')}</button>${t.gen ? '' : `<label class="check" style="margin-top:12px"><input type="checkbox" id="live" ${S.live ? 'checked' : ''}><span>Live<span class="live-long"> preview</span> <span class="live-long" style="color:var(--muted)">— update as you type</span></span></label>`}</div>
      <div class="panel o4" id="sendP"><div class="panel-h">Send result to another tool</div><select id="sendTo" aria-label="Send result to another tool"><option value="">Choose a tool…</option>${Object.entries(TCATS).map(([k, v]) => `<optgroup label="${esc(v.n)}">${TTOOLS.filter(x => x.cat === k && x.id !== t.id).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}</select></div>
    </aside></div></div>`;
  renderOpts();
  const tin = $('#tin'), tout = $('#tout'), tin2 = $('#tin2'); let timer = 0;
  const upIn = () => { $('#inStats').textContent = textStats(tin.value); }, upOut = () => { $('#outStats').textContent = tout.value ? textStats(tout.value) : ''; };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => { if (S.live && tin.value.length < 3e5) runText(false); }, 200); };
  tin.oninput = () => { upIn(); schedule(); }; if (tin2) tin2.oninput = schedule;
  S.onOpt = () => { if (t.gen) return; schedule(); }; S.destroyers.push(() => { clearTimeout(timer); S.onOpt = null; });
  S.text = { upIn, upOut };
  if (carry) { tin.value = carry.text; if (carry.name) toast(`${carry.name} loaded`, 'ok'); }
  upIn();
  $('#run').onclick = () => runText(true);
  const live = $('#live'); if (live) live.onchange = () => { S.live = live.checked; if (S.live) runText(false); };
  $('#tfile').onchange = e => { loadTextFile(e.target.files[0]); e.target.value = ''; };
  $('#sendTo').onchange = e => { const to = e.target.value; if (!to) return; S.carryText = { name: null, text: tout.value || tin.value }; goText(to); };
  $('#main').onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'clear') { tin.value = ''; if (tin2) tin2.value = ''; tout.value = ''; $('#terr').innerHTML = ''; upIn(); upOut(); tin.focus(); }
    if (a === 'sample') { tin.value = TSAMPLES[t.id] ?? TSAMPLE; upIn(); if (t.second && tin2) tin2.value = 'The quick brown cat\njumps over\nthe happy dog\nextra line'; runText(false); }
    if (a === 'paste') navigator.clipboard.readText().then(x => { tin.value = x; upIn(); runText(false); }).catch(() => toast('Clipboard access was blocked — paste with Ctrl+V instead', 'err'));
    if (a === 'copy') { if (!tout.value) return toast('Nothing to copy yet', 'err'); navigator.clipboard.writeText(tout.value).then(() => toast('Copied to clipboard', 'ok')).catch(() => { tout.select(); document.execCommand('copy'); toast('Copied', 'ok'); }); }
    if (a === 'dl') { if (!tout.value) return toast('Nothing to download yet', 'err'); download(new Blob([tout.value], { type: 'text/plain;charset=utf-8' }), `${t.id}.${t.ext || 'txt'}`); }
    if (a === 'reuse') { if (!tout.value) return; tin.value = tout.value; tout.value = ''; upIn(); upOut(); toast('Output moved to input', 'ok'); if (S.live) runText(false); }
  };
  const key = e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runText(true); } };
  document.addEventListener('keydown', key); S.destroyers.push(() => document.removeEventListener('keydown', key));
  if (t.gen) runText(false); else if (carry && carry.text) runText(false);
  window.scrollTo(0, 0);
}
async function runText(manual) {
  const t = S.tool; if (!t || t.dom !== 'text') return; const tin = $('#tin'), tout = $('#tout'), err = $('#terr'); if (!tin) return;
  const input = tin.value, id = ++S.runId; const fin = () => S.text.upOut();
  if (!t.gen && !input.trim()) { tout.value = ''; err.innerHTML = ''; fin(); if (manual) toast('Enter or paste some text first', 'err'); return; }
  try {
    const res = await t.run(input, coerceText(t), { s2: $('#tin2') ? $('#tin2').value : '' });
    if (id !== S.runId) return; tout.value = typeof res === 'string' ? res : String(res); err.innerHTML = ''; fin();
    if (manual) toast('Done', 'ok');
  } catch (e) {
    if (id !== S.runId) return; tout.value = ''; fin(); const soft = /^(Enter|Paste|Choose|Add) /.test(e.message || ''); err.innerHTML = `<div class="note${soft ? '' : ' err'}" style="margin-top:12px">${icon('info')}<span>${esc(e.message || String(e))}${soft ? ' — set it in the options.' : ''}</span></div>`;
  }
}
