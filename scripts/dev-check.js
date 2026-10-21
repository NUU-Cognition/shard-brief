#!/usr/bin/env node
// Check a Brief before a person reads it.
// Static checks: the schema, each cited fact, the grounding of numbers and names, each quote of a Mesh note,
// each image and link path, the limits of the kind, a TODO, and secrets or raw transcript text in the page.
// Browser checks (headless Chrome, no network): the page renders at 1280 px and 390 px with no horizontal
// scroll, no broken image, and no script error, and the first screen shows the title and the health. It saves
// the screenshots for the visual inspection.
// Invocation: flint shard brf check "<Media/Briefs/(Brief) ….html>" [--shots <dir>] [--no-browser]
// Outputs: one JSON value { ok, file, errors, warnings, stats, shots } and exit 1 when there is an error.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

function loadLib() {
  const dir = path.join(__dirname, '..', 'assets');
  for (const f of ['ast-brf-lib.js', 'dev-ast-brf-lib.js']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) return require(p);
  }
  process.stdout.write(JSON.stringify({ ok: false, code: 'asset-missing', reason: `the library of the shard is not in ${dir}` }) + '\n');
  process.exit(1);
}
const L = loadLib();

const LIMITS = {
  fleet: { words: 3000, sections: 10 },
  status: { words: 2500, sections: 10 },
  architecture: { words: 2000, sections: 8 },
  explainer: { words: 2500, sections: 8 },
};

const args = L.parseArgs(process.argv.slice(2));
const root = L.flintRoot();
const target = args._[0];
if (!target) L.fail('usage', 'give the path of the Brief page', ['flint shard brf check "<Media/Briefs/(Brief) ….html>"']);
const file = path.resolve(root, target);
if (!fs.existsSync(file)) L.fail('not-found', `${target} does not exist`);
const html = fs.readFileSync(file, 'utf8');
const errors = [], warnings = [];
const err = (m) => { if (!errors.includes(m)) errors.push(m); };
const warn = (m) => { if (!warnings.includes(m)) warnings.push(m); };
let browser = 'not run';

// ---------- The data in the page ----------

const m = /<script type="application\/json" id="brief-source">([\s\S]*?)<\/script>/.exec(html);
if (!m) L.fail('no-source', 'the page has no brief-source data; render it with flint shard brf render');
let source;
try { source = JSON.parse(m[1]); } catch (e) { L.fail('bad-source', `the brief-source data is not JSON: ${e.message}`); }
const spec = source.spec;
const facts = new Map((source.facts || []).map((f) => [f.id, f]));

// 1. The schema.
const schema = JSON.parse(L.readAsset('schema.json'));
for (const e of L.validate(schema, spec)) err(`schema: ${e}`);

// 2. Placeholders.
const specText = JSON.stringify(spec);
const todos = specText.match(/TODO/g);
if (todos) err(`the spec has ${todos.length} TODO placeholders: fill or remove each one`);

// 3. Each cited fact exists; a claim that is observed cites a fact.
const cited = new Set();
L.walkEvidence(spec, (ids, where) => {
  for (const id of ids) { cited.add(id); if (!facts.has(id)) err(`${where}: cites the fact "${id}", which does not exist`); }
});
(spec.stats || []).forEach((s, i) => { if (!(s.evidence || []).length) warn(`stats[${i}] ("${s.label}"): a stat with no evidence`); });
if (!(spec.health.evidence || []).length) warn('health: the health has no evidence');
L.walkClaims(spec, (c) => {
  if (c.basis === 'observed' && !(c.evidence || []).length) err(`the observed claim "${L.plain(c.text).slice(0, 80)}" cites no fact`);
  if (c.basis === 'inferred' && !(c.evidence || []).length) warn(`the inferred claim "${L.plain(c.text).slice(0, 80)}" cites no fact`);
});

// 4. Grounding: each number in a cited text is in the facts that it cites. The check reads the text, the
// value, the quote, and the ref of each fact. A name that holds digits (S2b, A17, nuu-net01-1015, v0.2, a sha,
// Task 1274) is not a number.
const norm = (s) => String(s).replace(/(\d),(?=\d{3}\b)/g, '$1').toLowerCase();
const snippet = (t) => { const p = L.plain(t).replace(/\s+/g, ' ').trim(); return p.length > 70 ? p.slice(0, 67) + '…' : p; };
let grounded = 0, ungrounded = 0;
L.walkEvidence(spec, (ids, where, text) => {
  if (!ids.length) return;
  const base = ids.map((id) => facts.get(id)).filter(Boolean).map((f) => norm(`${f.text} ${f.value === undefined ? '' : f.value} ${(f.source || {}).quote || ''} ${(f.source || {}).ref || ''}`)).join(' ');
  const seen = new Set();
  for (const n of L.numbersIn(text)) {
    if (seen.has(n)) continue;
    seen.add(n);
    if (new RegExp(`(^|[^0-9.])${n.replace('.', '\\.')}([^0-9]|$)`).test(base)) grounded++;
    else { ungrounded++; warn(`${where} ("${snippet(text)}"): the number ${n} is not in its facts (${ids.join(', ')})`); }
  }
});
if (!Array.isArray(spec.ledeEvidence) && L.numbersIn(spec.lede).length) warn(`the lede has numbers (${L.numbersIn(spec.lede).join(', ')}) and no ledeEvidence`);

// The health fits the kind; a recommendation is one of the options.
if (['fleet', 'status'].includes(spec.kind) && spec.health.state === 'info') err(`a ${spec.kind} Brief needs a verdict: the health is landed, at-risk, or blocked, not info`);
if (['architecture', 'explainer'].includes(spec.kind) && spec.health.state !== 'info') warn(`an ${spec.kind} Brief usually has the health info, not ${spec.health.state}`);
(spec.decisions || []).forEach((d, i) => { if (d.recommend && !(d.options || []).includes(d.recommend)) err(`decision ${i + 1} ("${d.id}"): the recommendation "${d.recommend}" is not one of its options`); });

// 5. Quotes of Mesh notes and the paths of facts.
const squash = (s) => String(s).replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim().toLowerCase();
for (const f of source.facts || []) {
  const s = f.source || {};
  if (['mesh', 'media', 'file'].includes(s.type)) {
    const p = s.path || s.ref;
    if (!p) { err(`fact ${f.id}: a ${s.type} source needs a path`); continue; }
    const abs = path.join(root, p);
    if (!fs.existsSync(abs)) { (cited.has(f.id) ? err : warn)(`fact ${f.id}: the path ${p} does not exist`); continue; }
    if (s.quote) {
      if (fs.statSync(abs).isDirectory()) err(`fact ${f.id}: a quote needs a file, not the folder ${p}`);
      else if (!squash(fs.readFileSync(abs, 'utf8')).includes(squash(s.quote))) err(`fact ${f.id}: the quote is not in ${p}: "${s.quote.slice(0, 80)}"`);
    }
  }
}
for (const f of spec.facts || []) {
  const s = f.source || {};
  if (s.type === 'mesh' && !s.quote) warn(`fact ${f.id}: a fact that the agent adds from a Mesh note should quote the note`);
}

// 6. The paths of images and links.
L.walkPaths(spec, (p, where, k) => {
  if (!p) { err(`${where}: an empty ${k} path`); return; }
  if (/^https?:/i.test(p)) { if (k === 'image') warn(`${where}: the image ${p} needs the network`); return; }
  if (L.isUrl(p)) return;
  const clean = decodeURIComponent(p.replace(/#.*$/, '')).replace(/^\.?\//, '');
  if (!fs.existsSync(path.join(root, clean))) err(`${where}: the ${k} path ${p} does not exist (paths are relative to the Flint root)`);
});
// The links in the page itself, relative to the page.
const dir = path.dirname(file);
for (const mm of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
  const h = mm[1].replace(/&amp;/g, '&');
  if (L.isUrl(h) || h.startsWith('data:')) continue;
  const abs = path.resolve(dir, decodeURIComponent(h.replace(/#.*$/, '')));
  if (!fs.existsSync(abs)) err(`the page links to ${h}, which does not resolve from ${path.relative(root, dir)}`);
}

// 7. Limits of the kind.
const lim = LIMITS[spec.kind] || LIMITS.fleet;
const words = L.specWords(spec);
if (words > lim.words) warn(`the Brief has ${words} words; the limit for a ${spec.kind} Brief is about ${lim.words}. Move detail into a details block or cut it`);
if ((spec.sections || []).length > lim.sections) err(`the Brief has ${spec.sections.length} sections; the limit for a ${spec.kind} Brief is ${lim.sections}`);
const ls = L.sentences(spec.lede);
if (ls > 3) err(`the lede has ${ls} sentences; give the bottom line in at most 3`);
if ((spec.stats || []).length < 3) warn('the hero has fewer than 3 stats');

// 8. The page: external scripts, a doctype, secrets, and raw transcript text.
if (!/^<!doctype html>/i.test(html)) err('the page has no doctype');
if (!/<meta charset="utf-8">/i.test(html)) err('the page has no charset');
for (const s of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) err(`the page loads the script ${s[1]}; a Brief loads no script`);
const SECRETS = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, 'an Anthropic key'], [/\bsk-[A-Za-z0-9]{32,}/, 'an API key'], [/\bghp_[A-Za-z0-9]{30,}/, 'a GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'], [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'], [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS key'],
  [/\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[A-Za-z0-9_\-\/+]{12,}/i, 'a secret value'],
];
const TRANSCRIPT = [
  [/"role"\s*:\s*"(?:user|assistant|system)"/, 'a message of a transcript ("role": …)'], [/<system-reminder>|&lt;system-reminder&gt;/, 'a system reminder'],
  [/"type"\s*:\s*"tool_(?:use|result)"/, 'a tool call of a transcript'], [/\bHuman:\s|\bAssistant:\s/, 'a turn of a transcript'],
];
for (const [re, what] of SECRETS) if (re.test(html)) err(`the page contains ${what}. Remove it from the spec and the facts`);
for (const [re, what] of TRANSCRIPT) if (re.test(html)) err(`the page contains ${what}. A Brief summarizes; it does not copy a transcript`);
const bytes = Buffer.byteLength(html);
if (bytes > 3 * 1024 * 1024) warn(`the page is ${(bytes / 1048576).toFixed(1)} MB`);

const claims = { total: 0, observed: 0, inferred: 0 };
L.walkClaims(spec, (c) => { claims.total++; claims[c.basis] = (claims[c.basis] || 0) + 1; });

// ---------- The browser ----------

function findChrome() {
  const c = [process.env.BRIEF_CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'].filter(Boolean);
  return c.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserChecks(shotsDir) {
  const chrome = findChrome();
  if (!chrome) { browser = 'skipped: no Chrome was found (set BRIEF_CHROME)'; warn(`the browser checks did not run: ${browser.slice(9)}`); return []; }
  if (typeof WebSocket === 'undefined') { browser = 'skipped: this Node.js has no WebSocket (use Node 22 or later)'; warn(`the browser checks did not run: ${browser.slice(9)}`); return []; }
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-chrome-'));
  const proc = spawn(chrome, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-gpu', '--disable-extensions', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
  const shots = [];
  try {
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      await sleep(100);
      try { port = fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch (e) { /* not yet */ }
    }
    if (!port) { browser = 'skipped: Chrome did not start (a sandbox can stop it)'; warn(`the browser checks did not run: ${browser.slice(9)}`); return shots; }
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = list.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const waiting = new Map(); const listeners = [];
    ws.onmessage = (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (msg.id && waiting.has(msg.id)) { const w = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? w.rej(new Error(msg.error.message)) : w.res(msg.result); }
      else if (msg.method) listeners.forEach((l) => l(msg));
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; waiting.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    const problems = [];
    listeners.push((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') problems.push(`a script error: ${(msg.params.exceptionDetails.exception || {}).description || msg.params.exceptionDetails.text}`);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') problems.push(`a console error: ${(msg.params.args || []).map((a) => a.value || a.description).join(' ')}`);
    });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const fileUrl = require('url').pathToFileURL(file).href;
    const views = [
      { name: '1280', width: 1280, height: 800, mobile: false },
      { name: '390', width: 390, height: 844, mobile: true },
    ];
    for (const v of views) {
      await send('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.mobile });
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
      const loaded = new Promise((res) => { const l = (msg) => { if (msg.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); res(); } }; listeners.push(l); });
      await send('Page.navigate', { url: fileUrl });
      await Promise.race([loaded, sleep(15000)]);
      await sleep(700);
      const probe = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const de = document.documentElement, vw = de.clientWidth, vh = innerHeight;
          const wide = [];
          document.querySelectorAll('body *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width && r.right > vw + 1 && !el.closest('.tl-scroll, .dg-canvas, .tbl-wrap, .mnav, pre')) wide.push((el.className && el.className.baseVal === undefined ? '.' + String(el.className).split(' ')[0] : el.tagName.toLowerCase()) + ' (' + Math.round(r.right - vw) + ' px)');
          });
          const broken = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('loading') !== 'lazy').map((i) => decodeURI(i.getAttribute('src')));
          const h1 = document.querySelector('h1'), hl = document.querySelector('.health');
          return {
            scrollWidth: de.scrollWidth, clientWidth: vw, height: de.scrollHeight,
            wide: [...new Set(wide)].slice(0, 6), broken,
            h1Visible: !!h1 && h1.getBoundingClientRect().bottom <= vh,
            healthVisible: !!hl && hl.getBoundingClientRect().top < vh,
            healthTop: hl ? Math.round(hl.getBoundingClientRect().top) : null,
          };
        })()`,
      });
      const r = probe.result.value;
      if (r.scrollWidth > r.clientWidth + 1) err(`at ${v.width} px the page scrolls sideways (${r.scrollWidth} > ${r.clientWidth})${r.wide.length ? ': ' + r.wide.join(', ') : ''}`);
      if (r.broken.length) err(`at ${v.width} px ${r.broken.length} images do not load: ${r.broken.slice(0, 5).join(', ')}`);
      if (!r.h1Visible) err(`at ${v.width} px the title is not on the first screen`);
      if (v.width >= 1024 && !r.healthVisible) err(`at ${v.width} px the health is not on the first screen (top ${r.healthTop} px)`);
      fs.mkdirSync(shotsDir, { recursive: true });
      const first = await send('Page.captureScreenshot', { format: 'png' });
      const p1 = path.join(shotsDir, `first-${v.name}.png`); fs.writeFileSync(p1, Buffer.from(first.data, 'base64')); shots.push(p1);
      // Load and decode each lazy image before the full screenshot (at most 15 s).
      await send('Runtime.evaluate', { awaitPromise: true, expression: `(async () => {
        document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; });
        const wait = [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }));
        await Promise.race([Promise.all(wait), new Promise((r) => setTimeout(r, 12000))]);
        await Promise.race([Promise.all([...document.images].map((i) => (i.decode ? i.decode().catch(() => {}) : null))), new Promise((r) => setTimeout(r, 3000))]);
      })()` });
      await sleep(300);
      const lazyBroken = await send('Runtime.evaluate', { returnByValue: true, expression: `[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => decodeURI(i.getAttribute('src')))` });
      if (lazyBroken.result.value.length && v.width === 1280) err(`${lazyBroken.result.value.length} images do not load: ${lazyBroken.result.value.slice(0, 5).join(', ')}`);
      const metrics = await send('Page.getLayoutMetrics');
      const H = Math.min(Math.ceil((metrics.cssContentSize || metrics.contentSize).height), 16000);
      const full = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: v.width, height: H, scale: 1 } });
      const p2 = path.join(shotsDir, `full-${v.name}.png`); fs.writeFileSync(p2, Buffer.from(full.data, 'base64')); shots.push(p2);
      if (v.width === 1280) {
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
        await send('Page.reload');
        await sleep(1200);
        const dark = await send('Page.captureScreenshot', { format: 'png' });
        const p3 = path.join(shotsDir, 'first-1280-dark.png'); fs.writeFileSync(p3, Buffer.from(dark.data, 'base64')); shots.push(p3);
      }
    }
    for (const p of [...new Set(problems)]) if (!/fonts\.(googleapis|gstatic)\.com|net::ERR_INTERNET_DISCONNECTED/.test(p)) err(`the page: ${p}`);
    browser = 'ran';
    ws.close();
  } catch (e) {
    browser = `skipped: the browser checks stopped (${e.message})`;
    warn(`the browser checks did not run: ${browser.slice(9)}`);
  } finally {
    proc.kill('SIGKILL');
    await sleep(200);
    try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* the profile stays in the temp folder */ }
  }
  return shots;
}

(async () => {
  const shotsDir = path.resolve(root, args.shots || path.join('.flint', 'briefs', spec.id, 'shots'));
  if (args.noBrowser) browser = 'skipped: --no-browser';
  const shots = args.noBrowser ? [] : await browserChecks(shotsDir);
  const out = {
    ok: errors.length === 0,
    file: path.relative(root, file),
    browser,
    errors,
    warnings,
    stats: { claims, facts: facts.size, cited: cited.size, grounded, ungrounded, words, sections: (spec.sections || []).length, decisions: (spec.decisions || []).length, bytes },
    shots: shots.map((p) => path.relative(root, p)),
    next: errors.length
      ? ['Fix each error in brief.json (or in the facts), then render and check again']
      : browser === 'ran'
        ? ['Give the screenshots to a fresh agent for the visual inspection (sk-brf-check)']
        : ['The static checks pass, but the browser checks and the screenshots did not run. Run this check on a machine where Chrome starts, then do the visual inspection'],
  };
  const report = path.join(shotsDir, '..', 'check.json');
  try { L.writeJSON(report, out); out.report = path.relative(root, report); } catch (e) { /* no report file */ }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  process.exit(errors.length ? 1 : 0);
})();
