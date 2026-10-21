#!/usr/bin/env node
// Render a Brief: the spec (brief.json) and its facts (facts.json) become one full-width HTML page
// in the NUU Cognition styles, at Media/Briefs/(Brief) <date> <Title>.html.
// Invocation: flint shard brf render <brief.json> [--out <file.html>]
//             flint shard brf render --from "<Media/Briefs/(Brief) ….html>"   (render a Brief again from the data in its page)
//             flint shard brf render --from "<page>" --extract [<dir>]        (write its brief.json and facts.json into a work folder)
// Outputs: one JSON value { ok, file, bytes, facts, cited, claims, warnings } (or { ok: false, code, reason, next }).

'use strict';
const fs = require('fs');
const path = require('path');

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
const { esc, inline } = L;

const STATUS = {
  done: ['earth', 'Done'], landed: ['earth', 'Landed'], pass: ['earth', 'Pass'], fixed: ['earth', 'Fixed'],
  partial: ['sun', 'Partial'], 'at-risk': ['sun', 'At risk'], open: ['sun', 'Open'], deferred: ['air', 'Deferred'],
  failed: ['fire', 'Failed'], blocked: ['fire', 'Blocked'], fail: ['fire', 'Fail'],
  running: ['water', 'Running'], info: ['water', 'Info'], review: ['storm', 'Review'],
  skipped: ['moon', 'Skipped'], na: ['moon', '—'], accepted: ['moon', 'Accepted'], mitigated: ['sun', 'Mitigated'],
};
const ENV = { dev: 'Dev', staging: 'Staging', prod: 'Production', local: 'Local' };
const HEALTH = { landed: ['earth', 'Landed'], 'at-risk': ['sun', 'At risk'], blocked: ['fire', 'Blocked'], info: ['water', 'Overview'] };
const CALLOUT = { info: 'water', ok: 'earth', warn: 'sun', risk: 'fire' };
const KIND_LABEL = { fleet: 'Fleet brief', status: 'Status brief', architecture: 'Architecture brief', explainer: 'Explainer brief' };
const GROUP_TONE = { added: 'earth', new: 'earth', changed: 'water', fixed: 'sun', removed: 'fire', deprecated: 'fire', security: 'storm', docs: 'air', tests: 'ocean' };
const NUU_GLYPH = 'M139.944 296L72.4167 96.0247C67.9352 82.8149 62.0278 69.8084 54.6944 57.0052C47.3611 44.2019 37.2778 37.8002 24.4444 37.8002C18.3333 37.8002 11.6111 39.1212 4.27778 41.7631L0 31.0937L76.0833 0L89.5278 0L169.889 234.422L219.694 132.91C228.861 114.62 233.444 100.292 233.444 89.9279C233.444 81.5956 231.713 69.9101 228.25 54.8713C225.602 43.897 224.278 35.6663 224.278 30.1792C224.278 10.0597 235.176 0 256.972 0C276.324 0 286 9.14521 286 27.4356C286 45.5228 272.556 80.0714 245.667 131.081L158.278 296L139.944 296Z';

// ---------- Input ----------

const args = L.parseArgs(process.argv.slice(2));
const root = L.flintRoot();
let spec, factsDoc = { facts: [], derived: {} }, specPath = args._[0];

function extractSource(html) {
  const m = /<script type="application\/json" id="brief-source">([\s\S]*?)<\/script>/.exec(html);
  if (!m) return null;
  return JSON.parse(m[1]);
}

if (args.from && !specPath) {
  const p = path.resolve(root, args.from);
  if (!fs.existsSync(p)) L.fail('not-found', `the Brief ${args.from} does not exist`);
  const src = extractSource(fs.readFileSync(p, 'utf8'));
  if (!src) L.fail('no-source', `the page ${args.from} has no brief-source data; it was not made by brf render`);
  spec = src.spec;
  // The page holds all the facts, the facts of the spec too; take those from the spec only, so that a render
  // from the page does not add them a second time.
  const ownIds = new Set((spec.facts || []).map((f) => f.id));
  factsDoc = { facts: (src.facts || []).filter((f) => !ownIds.has(f.id)), derived: src.derived || {} };
  if (args.extract) {
    // Write the spec and the facts back into a work folder, so that a person or an agent can edit them.
    const dir = path.resolve(root, args.extract === true ? path.join('.flint', 'briefs', spec.id) : args.extract);
    const own = new Set((spec.facts || []).map((f) => f.id));
    L.writeJSON(path.join(dir, 'brief.json'), spec);
    L.writeJSON(path.join(dir, 'facts.json'), { schema: L.FACTS_ID, collectedAt: src.renderedAt, kind: spec.kind, scope: spec.scope || {}, facts: factsDoc.facts.filter((f) => !own.has(f.id)), derived: factsDoc.derived });
    process.stdout.write(JSON.stringify({ ok: true, extracted: path.relative(root, dir), next: [`flint shard brf render "${path.relative(root, path.join(dir, 'brief.json'))}"`] }, null, 2) + '\n');
    process.exit(0);
  }
  if (!args.out) args.out = p;
} else {
  if (!specPath) L.fail('usage', 'give the path of brief.json', ['flint shard brf render <brief.json>']);
  specPath = path.resolve(root, specPath);
  if (!fs.existsSync(specPath)) L.fail('not-found', `${specPath} does not exist`);
  try { spec = L.readJSON(specPath); } catch (e) { L.fail('bad-json', `${specPath}: ${e.message}`); }
  const fp = path.resolve(path.dirname(specPath), spec.factsFile || 'facts.json');
  if (fs.existsSync(fp)) {
    try { factsDoc = L.readJSON(fp); } catch (e) { L.fail('bad-json', `${fp}: ${e.message}`); }
  }
}

const schema = JSON.parse(L.readAsset('schema.json'));
const errs = L.validate(schema, spec);
if (errs.length) L.fail('spec-invalid', `the spec does not match ${L.SCHEMA_ID} (${errs.length} problems): ${errs.slice(0, 25).join('; ')}`, ['Fix brief.json, then run flint shard brf render again']);

const outFile = args.out ? path.resolve(root, args.out) : path.join(root, 'Media', 'Briefs', L.briefFileName(spec.date, spec.title));
const outDir = path.dirname(outFile);
const link = (h) => L.pageHref(h, outDir);
const md = (s) => inline(s, link);
const tz = spec.tz || (factsDoc.derived && factsDoc.derived.tz) || L.localOffset();
const warnings = [];

// ---------- Facts and their numbers ----------

// One fact for each id: a fact of the spec replaces a collected fact with the same id.
const factById = new Map();
for (const f of [...(factsDoc.facts || []), ...(spec.facts || [])]) factById.set(f.id, f);
const allFacts = [...factById.values()];
// A fact gets its number when the page first cites it, so the numbers go up from the top of the page.
const number = new Map();
const missing = new Set();

function ev(ids) {
  if (!ids || !ids.length) return '';
  const parts = [...new Set(ids)].map((id) => {
    if (!factById.has(id)) { missing.add(id); return `<span class="ev missing" title="Unknown fact ${esc(id)}">?</span>`; }
    if (!number.has(id)) number.set(id, number.size + 1);
    return `<a class="ev" href="#fact-${esc(id)}" data-fact="${esc(id)}" aria-label="Evidence ${number.get(id)}">${number.get(id)}</a>`;
  });
  return ` <span class="evs">${parts.join('')}</span>`;
}

// Each screenshot is its own evidence: a fact with the path of the image.
function imageFact(src, env) {
  if (!src || L.isUrl(src)) return null;
  const id = L.imageFactId(src);
  if (!factById.has(id)) {
    const f = { id, kind: 'image', text: `The screenshot ${src}${env ? ` (${ENV[env] || env})` : ''}.`, source: { type: 'media', path: src } };
    allFacts.push(f); factById.set(id, f);
  }
  return id;
}
const envTag = (env) => (env ? `<span class="env env-${esc(env)}">${esc(ENV[env] || env)}</span> ` : '');
const basisTag = (b) => (b === 'inferred' ? ' <span class="basis inferred">inferred</span>' : '');
const chip = (status, label, cls = '') => {
  const [tone, def] = STATUS[status] || ['moon', status || ''];
  return `<span class="chip tone-${tone} ${cls}">${esc(label || def)}</span>`;
};
const paras = (text, tail = '') => {
  const ps = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return ps.map((p, i) => `<p>${md(p)}${i === ps.length - 1 ? tail : ''}</p>`).join('');
};

// ---------- Images ----------

function img(src, alt, cls = '') {
  if (!src) return '';
  const local = !L.isUrl(src);
  if (local && !fs.existsSync(path.join(root, src))) {
    warnings.push(`the image ${src} does not exist`);
    return `<div class="frame ${cls}"><div class="missing">Image not found: ${esc(src)}</div></div>`;
  }
  return `<div class="frame ${cls}"><img src="${esc(link(src))}" alt="${esc(alt || '')}" loading="lazy" decoding="async"></div>`;
}

// ---------- Blocks ----------

function blocks(bs) { return (bs || []).map(block).join('\n'); }

function title(b) { return b.title ? `<h3 class="blk-title">${md(b.title)}</h3>` : ''; }

function block(b) {
  switch (b.type) {
    case 'text': return `<div>${title(b)}<div class="prose">${paras(b.text, basisTag(b.basis) + ev(b.evidence))}</div></div>`;
    case 'claims': return `<div>${title(b)}${claimList(b.items)}</div>`;
    case 'callout': return `<div class="callout tone-${CALLOUT[b.tone]}">${b.title ? `<h4>${md(b.title)}</h4>` : ''}${paras(b.text, ev(b.evidence))}</div>`;
    case 'stats': return `<div>${title(b)}<div class="stats">${b.items.map(stat).join('')}</div></div>`;
    case 'board': return board(b);
    case 'table': return table(b);
    case 'cards': return cards(b);
    case 'changes': return changes(b);
    case 'failures': return failures(b);
    case 'retro': return retro(b);
    case 'timeline': return timeline(b);
    case 'diagram': return diagram(b);
    case 'gallery': return `<div>${title(b)}<div class="gallery">${b.items.map((x) => { const f = imageFact(x.src, x.env); return `<figure class="${x.tall ? 'tall' : ''}">${img(x.src, x.caption)}<figcaption>${envTag(x.env)}${md(x.caption)}${ev([...(x.evidence || []), ...(f ? [f] : [])])}</figcaption></figure>`; }).join('')}</div></div>`;
    case 'compare': return `<div>${title(b)}<div class="compare">${['before', 'after'].map((k) => { const f = imageFact(b[k].src, b[k].env); return `<figure class="side"><span class="meta">${k === 'before' ? 'Before' : 'After'}</span>${img(b[k].src, b[k].caption || b[k].alt)}<figcaption>${envTag(b[k].env)}${md(b[k].caption || '')}${ev(f ? [f] : [])}</figcaption></figure>`; }).join('')}</div>${b.evidence ? `<p class="meta" style="margin-top:8px">Evidence${ev(b.evidence)}</p>` : ''}</div>`;
    case 'steps': return `<div>${title(b)}<ol class="steps">${b.items.map((s) => `<li class="card tight"><div class="hd"><h3>${md(s.title)}</h3></div><div class="txt">${paras(s.text)}</div>${s.code ? `<pre><code>${esc(s.code)}</code></pre>` : ''}</li>`).join('')}</ol></div>`;
    case 'commands': return `<div>${title(b)}<div class="cmds">${b.items.map((c) => `<div class="card cmd"><span class="lbl">${md(c.label)}</span><code>${esc(c.cmd)}</code><button class="btn outline sm copy" type="button" data-copy="${esc(c.cmd)}">Copy</button></div>`).join('')}</div></div>`;
    case 'code': return `<div>${title(b)}<pre><code${b.lang ? ` data-lang="${esc(b.lang)}"` : ''}>${esc(b.text)}</code></pre></div>`;
    case 'details': return `<details class="fold"${b.open ? ' open' : ''}><summary>${md(b.title)}</summary><div class="inner">${blocks(b.blocks)}</div></details>`;
    default: return '';
  }
}

function claimList(items, compact) {
  return `<ul class="claims${compact ? ' compact' : ''}">${items.map((c) => `<li class="${esc(c.basis)}">${md(c.text)}${basisTag(c.basis)}${ev(c.evidence)}</li>`).join('')}</ul>`;
}

function stat(s) {
  const tone = s.tone ? ` tone-${s.tone}` : '';
  return `<div class="card stat${tone}"><span class="v">${esc(s.value)}</span><span class="l">${s.tone ? '<span class="dot"></span>' : ''}${md(s.label)}${ev(s.evidence)}</span></div>`;
}

function board(b) {
  const head = `<tr><th>Lane</th><th>Health</th>${b.stages.map((s) => `<th>${esc(s)}</th>`).join('')}<th>Note</th></tr>`;
  const rows = b.rows.map((r) => {
    const [tone, label] = HEALTH[r.health];
    const cells = b.stages.map((s) => {
      const st = (r.cells || {})[s] || 'na';
      const [t, l] = STATUS[st] || ['moon', st];
      return `<td><span class="stage tone-${t} s-${esc(st)}" title="${esc(s)}: ${esc(l)}">${esc(l)}</span></td>`;
    }).join('');
    return `<tr><td><div class="lane"><b>${esc(r.lane)}</b>${r.sub ? `<span>${esc(r.sub)}</span>` : ''}</div></td><td><span class="chip tone-${tone}">${label}</span></td>${cells}<td class="note">${md(r.note || '')}${ev(r.evidence)}</td></tr>`;
  }).join('');
  const used = new Set();
  b.rows.forEach((r) => Object.values(r.cells || {}).forEach((v) => used.add(v)));
  const LEGEND = { na: '— Not in this lane', done: 'Done', landed: 'Landed', pass: 'Pass: the QA run passed', fixed: 'Fixed', partial: 'Partial: some steps are not done', 'at-risk': 'At risk', open: 'Open', failed: 'Failed', blocked: 'Blocked', fail: 'Fail', deferred: 'Deferred', skipped: 'Skipped', running: 'Running', review: 'In review', info: 'Info', accepted: 'Accepted', mitigated: 'Mitigated' };
  // The legend names each status of a cell and each health of a row.
  b.rows.forEach((r) => used.add(r.health));
  const legend = [...used].filter((s) => STATUS[s]).map((s) => chip(s, LEGEND[s])).join('');
  return `<div>${title(b)}${b.note ? `<p class="blk-note">${md(b.note)}</p>` : ''}<div class="tbl-wrap"><table class="tbl board"><thead>${head}</thead><tbody>${rows}</tbody></table></div><div class="legend">${legend}</div></div>`;
}

function table(b) {
  const head = `<tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const rows = b.rows.map((r) => `<tr>${(r || []).map((c, j) => {
    const cls = j === 0 ? ' class="first"' : (typeof c === 'number' ? ' class="num-col"' : '');
    if (c && typeof c === 'object') return `<td${cls}>${c.status ? chip(c.status, String(c.text)) : md(String(c.text))}${ev(c.evidence)}</td>`;
    return `<td${cls}>${md(c === null || c === undefined ? '—' : String(c))}</td>`;
  }).join('')}</tr>`).join('');
  return `<div>${title(b)}<div class="tbl-wrap"><table class="tbl"><thead>${head}</thead><tbody>${rows}</tbody>${b.caption ? `<caption>${md(b.caption)}${ev(b.evidence)}</caption>` : ''}</table></div></div>`;
}

function cards(b) {
  const cols = b.columns ? ` c${b.columns}` : ' c3';
  const items = b.items.map((c) => {
    const st = c.status ? chip(c.status, c.statusLabel) : '';
    const shotFact = c.image ? imageFact(c.image.src, c.image.env) : null;
    // The screenshot cites itself in its caption; the text cites the evidence of the card.
    const shot = c.image ? `<div class="shot">${img(c.image.src, c.image.alt || c.image.caption || c.title).replace(/^<div class="frame ">|<\/div>$/g, '')}</div><div class="sub">${envTag(c.image.env)}${md(c.image.caption || '')}${ev(shotFact ? [shotFact] : [])}</div>` : '';
    const cev = c.evidence || [];
    const links = c.links && c.links.length ? `<div class="links">${c.links.map((l) => `<a href="${esc(link(l.href))}">${esc(l.label)}</a>`).join('')}</div>` : '';
    const det = c.details && c.details.length ? `<details><summary>${esc(c.detailsLabel || 'Details')}</summary><div class="inner">${blocks(c.details)}</div></details>` : '';
    return `<article class="card item"><div class="hd"><div><h3>${md(c.title)}</h3>${c.sub ? `<div class="sub">${md(c.sub)}</div>` : ''}</div>${st}</div>${shot}${c.text ? `<div class="txt">${paras(c.text, ev(cev))}</div>` : (cev.length ? `<div class="txt">${ev(cev)}</div>` : '')}${c.claims && c.claims.length ? claimList(c.claims, true) : ''}${links}${det}</article>`;
  }).join('');
  return `<div>${title(b)}<div class="grid${cols}">${items}</div></div>`;
}

function changes(b) {
  let ds = '';
  if (b.diffstat) {
    const d = b.diffstat;
    const tot = d.insertions + d.deletions || 1;
    ds = `<div class="card diffstat"><span class="fig">${d.files.toLocaleString('en-US')}</span><span>files</span><span class="fig add">+${d.insertions.toLocaleString('en-US')}</span><span class="fig del">−${d.deletions.toLocaleString('en-US')}</span><span class="bar" aria-hidden="true"><i style="width:${(100 * d.insertions / tot).toFixed(1)}%;background:var(--earth)"></i><i style="width:${(100 * d.deletions / tot).toFixed(1)}%;background:var(--fire)"></i></span>${d.label ? `<span class="meta">${esc(d.label)}</span>` : ''}${ev(d.evidence)}</div>`;
  }
  const groups = b.groups.map((g) => {
    const tone = g.tone || GROUP_TONE[String(g.label).toLowerCase()] || 'water';
    return `<div class="card grp tone-${tone}"><div><span class="chip tone-${tone} lg">${esc(g.label)}</span></div><ul>${g.items.map((x) => `<li>${md(x.text)}${ev(x.evidence)}</li>`).join('')}</ul></div>`;
  }).join('');
  return `<div class="changes">${title(b)}<div class="stack">${ds}<div class="grid c3">${groups}</div></div></div>`;
}

function failures(b) {
  const st = { fixed: 'fixed', mitigated: 'mitigated', open: 'open', deferred: 'deferred', accepted: 'accepted' };
  const items = b.items.map((x) => `<article class="card item fail"><div class="hd"><h3>${md(x.title)}</h3>${chip(st[x.state])}</div><dl><dt>Symptom</dt><dd>${md(x.symptom)}</dd><dt>Cause</dt><dd>${md(x.cause)}${basisTag(x.basis)}${ev(x.evidence)}</dd>${x.tried ? `<dt>Tried</dt><dd>${md(x.tried)}</dd>` : ''}</dl></article>`).join('');
  return `<div>${title(b)}<div class="grid c2">${items}</div></div>`;
}

function retro(b) {
  const col = (k, label, tone) => {
    const xs = b[k] || [];
    if (!xs.length) return '';
    const lis = xs.map((x) => (typeof x === 'string' ? `<li>${md(x)}</li>` : `<li class="${esc(x.basis)}">${md(x.text)}${basisTag(x.basis)}${ev(x.evidence)}</li>`)).join('');
    return `<div class="card col tone-${tone}"><span class="chip tone-${tone} lg">${label}</span><ul class="claims compact">${lis}</ul></div>`;
  };
  return `<div class="retro">${title(b)}<div class="grid c3">${col('well', 'Went well', 'earth')}${col('wrong', 'Went wrong', 'fire')}${col('lucky', 'Got lucky', 'sun')}</div></div>`;
}

// ---------- Timeline ----------

function timeline(b) {
  let lanes, marks, start, end;
  if (b.derived === 'timeline') {
    const d = factsDoc.derived && factsDoc.derived.timeline;
    if (!d) { warnings.push('the timeline asks for derived data, but facts.json has no derived.timeline (run collect --kind fleet)'); return ''; }
    const hide = new Set(b.hide || []);
    lanes = d.lanes.filter((l) => !hide.has(l.key)).map((l) => ({ ...l, name: (b.laneNames || {})[l.key] || l.name }));
    marks = b.marks || d.marks || [];
    start = b.start || d.start; end = b.end || d.end;
  } else {
    lanes = b.lanes || []; marks = b.marks || [];
    const ts = lanes.flatMap((l) => l.spans.flatMap((s) => [Date.parse(s.start), Date.parse(s.end)])).filter((x) => !isNaN(x));
    start = b.start || new Date(Math.min(...ts)).toISOString(); end = b.end || new Date(Math.max(...ts)).toISOString();
  }
  const t0 = Date.parse(start), t1 = Date.parse(end);
  if (!(t1 > t0) || !lanes.length) { warnings.push('the timeline has no time window or no lane'); return ''; }
  // The width of the viewBox is about the width of the main column at 1280 to 1440 px, so that the text of the
  // timeline shows near its CSS size.
  const W = 1000, LW = 188, RW = 76, X0 = LW, X1 = W - RW;
  const X = (t) => X0 + (Math.min(Math.max(Date.parse(t), t0), t1) - t0) / (t1 - t0) * (X1 - X0);

  // The labels of the marks go on rows, so that two labels never overlap.
  const bands = b.bands || [];
  const markRows = [];
  const labelled = [
    ...(marks || []).map((m) => ({ ...m, x: X(m.at) })),
    ...bands.map((d) => ({ ...d, band: true, at: d.start, label: `${d.label} · ${L.fmtTime(d.start, tz).hm}–${L.fmtTime(d.end, tz).hm}`, x: X(d.start), x2: X(d.end) })),
  ];
  const placed = labelled.sort((a, b2) => a.x - b2.x).map((m) => {
    const w = Math.min(300, m.label.length * 6.4 + 16);
    let x = Math.min(Math.max(m.x - 6, X0), X1 - w);
    let r = 0;
    while (markRows[r] !== undefined && markRows[r] > x - 6) r++;
    markRows[r] = x + w;
    return { ...m, w, lx: x, row: r };
  });
  const MH = markRows.length * 20;
  const AXIS = 22;
  let y = MH + AXIS + 6;
  const laneSvg = [];
  for (const l of lanes) {
    const n = Math.max(1, Math.max(0, ...l.spans.map((s) => s.row || 0)) + 1);
    const rowH = n <= 2 ? 9 : n <= 4 ? 7 : n <= 6 ? 5 : 4;
    const h = Math.max(32, n * (rowH + 2) + 14);
    const spans = l.spans.map((s) => {
      const x1 = X(s.start), x2 = X(s.end);
      const ry = y + 7 + (s.row || 0) * (rowH + 2);
      const a = L.fmtTime(s.start, tz).hm, z = L.fmtTime(s.end, tz).hm;
      return `<rect class="span s-${esc(s.status || 'work')}" x="${x1.toFixed(1)}" y="${ry}" width="${Math.max(1.5, x2 - x1).toFixed(1)}" height="${rowH}" rx="1.5"><title>${esc(s.label ? s.label + ' · ' : '')}${a}–${z}</title></rect>`;
    }).join('');
    const busy = l.busyMs !== undefined ? L.fmtDuration(l.busyMs) : '';
    laneSvg.push(`<g class="lane"><rect class="track" x="${X0}" y="${y + 3}" width="${X1 - X0}" height="${h - 6}" rx="4"></rect>${spans}<text class="lane-label" x="0" y="${y + h / 2 - (l.sub ? 3 : -4)}">${esc(l.name)}</text>${l.sub ? `<text class="lane-sub" x="0" y="${y + h / 2 + 11}">${esc(l.sub)}</text>` : ''}${busy ? `<text class="busy" x="${X1 + 10}" y="${y + h / 2 + 4}">${esc(busy)}</text>` : ''}</g>`);
    y += h;
  }
  const H = y + 8;
  // Ticks: the step that gives at most 12 ticks.
  const steps = [15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * 60000);
  const step = steps.find((s) => (t1 - t0) / s <= 12) || steps[steps.length - 1];
  const off = (L.parseOffset(tz) || 0) * 60000;
  let tick = Math.ceil((t0 + off) / step) * step - off;
  const ticks = [];
  let lastDay = '';
  // The axis text is 11px mono (about 6.7 units a character); a label that would touch the one before it is not drawn.
  let lastLabelEnd = -Infinity;
  for (; tick <= t1; tick += step) {
    const x = X(new Date(tick).toISOString());
    const f = L.fmtTime(new Date(tick).toISOString(), tz);
    const label = f.day !== lastDay && lastDay !== '' ? `${f.day.split(' ').slice(0, 2).join(' ')} ${f.hm}` : f.hm;
    lastDay = f.day;
    const lx = x + 3;
    const fits = lx >= lastLabelEnd + 6;
    if (fits) lastLabelEnd = lx + label.length * 6.7;
    ticks.push(`<line class="grid-line" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${MH + AXIS - 4}" y2="${H}"></line>${fits ? `<text class="axis" x="${lx.toFixed(1)}" y="${MH + AXIS - 8}">${esc(label)}</text>` : ''}`);
  }
  const markSvg = placed.map((m) => (m.band
    ? `<g class="band tone-${esc(m.tone || 'sun')}"><rect class="fill" x="${m.x.toFixed(1)}" y="${MH + AXIS - 4}" width="${Math.max(2, m.x2 - m.x).toFixed(1)}" height="${(H - MH - AXIS + 4).toFixed(1)}"></rect><line x1="${m.x.toFixed(1)}" x2="${m.x.toFixed(1)}" y1="${m.row * 20 + 16}" y2="${MH + AXIS - 4}"></line><rect class="tag" x="${m.lx.toFixed(1)}" y="${m.row * 20}" width="${m.w.toFixed(1)}" height="17" rx="4"></rect><text x="${(m.lx + 7).toFixed(1)}" y="${m.row * 20 + 12.5}">${esc(m.label)}</text></g>`
    : `<g class="mark"><line x1="${m.x.toFixed(1)}" x2="${m.x.toFixed(1)}" y1="${m.row * 20 + 16}" y2="${H}"></line><rect x="${m.lx.toFixed(1)}" y="${m.row * 20}" width="${m.w.toFixed(1)}" height="17" rx="4"></rect><text x="${(m.lx + 7).toFixed(1)}" y="${m.row * 20 + 12.5}">${esc(m.label)}</text></g>`)).join('');
  // The bands go under the lanes; the marks go over them.
  const bandSvg = markSvg.split('</g>').filter((g) => g.includes('class="band')).map((g) => g + '</g>').join('');
  const markOnly = markSvg.split('</g>').filter((g) => g.includes('class="mark')).map((g) => g + '</g>').join('');
  // The moments that the spec names, with their evidence, under the timeline.
  const moments = [...(b.marks || []).map((m) => ({ t: L.fmtTime(m.at, tz).hm, at: m.at, label: m.label, evidence: m.evidence })),
    ...bands.map((d) => ({ t: `${L.fmtTime(d.start, tz).hm}–${L.fmtTime(d.end, tz).hm}`, at: d.start, label: d.label, evidence: d.evidence }))]
    .sort((a, z) => Date.parse(a.at) - Date.parse(z.at));
  const momentsHtml = moments.length ? `<ul class="moments">${moments.map((m) => `<li><b>${esc(m.t)}</b> ${md(m.label)}${ev(m.evidence)}</li>`).join('')}</ul>` : '';
  const f0 = L.fmtTime(start, tz), f1 = L.fmtTime(end, tz);
  const legend = ['work', 'review', 'failed'].map((s) => `<span class="chip ${s === 'work' ? 'tone-water' : s === 'review' ? 'tone-storm' : 'tone-fire'}">${s === 'work' ? 'Agent at work' : s === 'review' ? 'Review at work' : 'Run failed'}</span>`).join('') + `<span class="meta">Empty track: the session waits · times in UTC${esc(tz)}</span>`;
  const svg = `<svg class="tl" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeline from ${esc(f0.day)} ${f0.hm} to ${esc(f1.day)} ${f1.hm}">${bandSvg}${ticks.join('')}${laneSvg.join('')}${markOnly}</svg>`;
  return `<div>${title(b)}${b.note ? `<p class="blk-note">${md(b.note)}</p>` : ''}<div class="card tl-wrap"><div class="tl-scroll">${svg}</div><div class="tl-legend">${legend}</div>${momentsHtml}</div></div>`;
}

// ---------- Diagram ----------

function diagram(b) {
  const ids = b.nodes.map((n) => n.id);
  const idSet = new Set(ids);
  const edges = b.edges.filter((e) => {
    if (!idSet.has(e.from) || !idSet.has(e.to)) { warnings.push(`the diagram edge ${e.from} → ${e.to} names a node that does not exist`); return false; }
    return true;
  });
  // Find the back edges with a depth-first walk, then rank the nodes by the longest path.
  const out = new Map(ids.map((i) => [i, []]));
  edges.forEach((e) => out.get(e.from).push(e.to));
  const color = new Map(); const back = new Set();
  const visit = (u) => { color.set(u, 1); for (const v of out.get(u)) { if (color.get(v) === 1) back.add(`${u}>${v}`); else if (!color.get(v)) visit(v); } color.set(u, 2); };
  ids.forEach((i) => { if (!color.get(i)) visit(i); });
  const rank = new Map(ids.map((i) => [i, 0]));
  for (let k = 0; k < ids.length; k++) edges.forEach((e) => { if (!back.has(`${e.from}>${e.to}`) && e.from !== e.to) rank.set(e.to, Math.max(rank.get(e.to), rank.get(e.from) + 1)); });
  const cols = [];
  ids.forEach((i) => { const r = rank.get(i); (cols[r] = cols[r] || []).push(i); });
  const node = new Map(b.nodes.map((n) => [n.id, n]));
  const maxLabel = Math.max(...b.nodes.map((n) => Math.max(n.label.length * 7.4, (n.note || '').length * 5.9)));
  const NW = Math.round(Math.min(250, Math.max(150, maxLabel + 30)));
  const nh = (n) => (n.note ? 60 : 44);
  const GX = 86, GY = 28, PAD = 24;
  const colH = cols.map((c) => c.reduce((a, i) => a + nh(node.get(i)), 0) + (c.length - 1) * GY);
  const maxH = Math.max(...colH);
  const pos = new Map();
  cols.forEach((c, r) => {
    let yy = PAD + (maxH - colH[r]) / 2;
    c.forEach((i) => { const n = node.get(i); pos.set(i, { x: PAD + r * (NW + GX), y: yy, w: NW, h: nh(n) }); yy += nh(n) + GY; });
  });
  const W = PAD * 2 + cols.length * NW + (cols.length - 1) * GX;
  const H = PAD * 2 + maxH + 46;
  const edgeSvg = edges.map((e) => {
    const a = pos.get(e.from), z = pos.get(e.to);
    let d, ex, ey, ang, mx, my;
    if (rank.get(e.to) > rank.get(e.from)) {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = z.x - 2, y2 = z.y + z.h / 2, cx = (x2 - x1) / 2;
      d = `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`; ex = x2; ey = y2; ang = 0;
      mx = (x1 + x2) / 2; my = (y1 + y2) / 2;
    } else {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = z.x + z.w / 2, y2 = z.y + z.h + 2, dip = Math.max(y1, y2) + 40;
      d = `M${x1},${y1} C${x1},${dip} ${x2},${dip} ${x2},${y2}`; ex = x2; ey = y2; ang = -90;
      mx = (x1 + x2) / 2; my = dip - 10;
    }
    const arrow = `<polygon points="0,0 -9,-4.5 -9,4.5" transform="translate(${ex},${ey}) rotate(${ang})" fill="currentColor"></polygon>`;
    const lbl = e.label ? `<rect class="lbg" x="${(mx - e.label.length * 3 - 6).toFixed(1)}" y="${(my - 9).toFixed(1)}" width="${(e.label.length * 6 + 12).toFixed(1)}" height="16" rx="4"></rect><text x="${mx.toFixed(1)}" y="${(my + 3).toFixed(1)}" text-anchor="middle">${esc(e.label)}</text>` : '';
    return `<g class="edge" data-from="${esc(e.from)}" data-to="${esc(e.to)}"><path d="${d}"></path>${arrow}${lbl}</g>`;
  }).join('');
  const nodeSvg = b.nodes.map((n) => {
    const p = pos.get(n.id);
    const tone = n.tone ? ` g tone-${n.tone}` : '';
    return `<g class="node${tone}" data-id="${esc(n.id)}"><rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="10"></rect><text class="label" x="${p.x + p.w / 2}" y="${p.y + (n.note ? 25 : p.h / 2 + 4.5)}" text-anchor="middle">${esc(n.label)}</text>${n.note ? `<text class="note" x="${p.x + p.w / 2}" y="${p.y + 43}" text-anchor="middle">${esc(n.note)}</text>` : ''}</g>`;
  }).join('');
  const svg = `<svg class="dg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(b.title || 'Diagram')}">${edgeSvg}${nodeSvg}</svg>`;
  const paths = (b.paths || []).filter((p) => p.steps.every((s) => idSet.has(s)));
  if ((b.paths || []).length !== paths.length) warnings.push('a diagram path names a node that does not exist; the path is left out');
  const panel = paths.length ? `<div class="card paths"><span class="meta">Follow a path</span><div class="pick">${paths.map((p) => `<button class="opt" type="button" aria-pressed="false">${esc(p.name)}</button>`).join('')}</div><div class="stepper"><button class="btn outline sm prev" type="button" aria-label="Previous step">←</button><span class="pos"></span><button class="btn outline sm next" type="button" aria-label="Next step">→</button></div><p class="steptext" aria-live="polite"></p></div>` : '';
  // In an attribute, the JSON must be escaped.
  return `<div>${title(b)}<div class="dg-wrap${paths.length ? ' has-paths' : ''}" data-paths="${esc(JSON.stringify(paths))}" tabindex="-1"><div class="card dg-canvas">${svg}${b.caption ? `<p class="meta" style="margin-top:8px">${esc(b.caption)}</p>` : ''}</div>${panel}</div></div>`;
}

// ---------- The page ----------

for (const d of spec.decisions || []) {
  if (d.recommend && !(d.options || []).includes(d.recommend)) warnings.push(`decision "${d.id}": the recommendation "${d.recommend}" is not one of its options`);
}
const sections = spec.sections;
const decisions = spec.decisions || [];
const kind = KIND_LABEL[spec.kind] || 'Brief';
const [htone, hlabel] = HEALTH[spec.health.state];

let claims = { total: 0, observed: 0, inferred: 0 };
L.walkClaims(spec, (c) => { claims.total++; if (c.basis === 'inferred') claims.inferred++; else if (c.basis === 'observed') claims.observed++; });

const asOf = spec.asOf || {};
const asOfTime = asOf.at ? L.fmtTime(asOf.at, tz) : null;
const asOfHtml = (asOfTime || (asOf.commits || []).length || (asOf.commands || []).length)
  ? `<div class="asof"><span>As of</span>${asOfTime ? `<span>${esc(asOfTime.day)} ${esc(asOfTime.hm)} UTC${esc(tz)}</span>` : ''}${(asOf.commits || []).map((c) => `<code>${esc(c)}</code>`).join('')}${(asOf.commands || []).map((c) => `<code title="Click to copy" data-copy="${esc(c)}" style="cursor:copy">${esc(c)}</code>`).join('')}</div>`
  : '';

const eyebrow = `<span class="badge">${esc(kind)}</span>` + (spec.eyebrow || []).map((e) => `<span class="eb">${esc(e)}</span>`).join('');
const decJump = decisions.length
  ? `<a class="btn" href="#decisions">${decisions.length === 1 ? '1 decision waits for you' : `${decisions.length} decisions wait for you`}</a>`
  : `<span class="muted">No decision waits for you</span>`;

const hero = `<section class="hero" id="top">
  <div class="lead">
    <div class="eyebrow">${eyebrow}</div>
    <h1>${esc(spec.title)}</h1>
    <p class="lede">${md(spec.lede)}${ev(spec.ledeEvidence)}</p>
    ${asOfHtml}
  </div>
  <aside class="card health tone-${htone}" aria-label="Health">
    <span class="meta">Health</span>
    <div class="state"><span class="dot"></span>${hlabel}</div>
    <p class="label">${md(spec.health.label)}${ev(spec.health.evidence)}</p>
    <div class="jump">${decJump}</div>
  </aside>
  <div class="stats n${spec.stats.length}">${spec.stats.map(stat).join('')}</div>
</section>`;

const decHtml = decisions.length ? `<section class="sec decisions" id="decisions">
  <header class="sec-head"><div class="kicker"><span class="meta">For you</span></div><h2>Decisions for you</h2><p class="summary">Choose an option or write a note for each decision. The browser keeps your answers on this machine. Then copy the answers and paste them to the agent.</p></header>
  <div class="grid">${decisions.map((d, i) => `<article class="card dec" data-id="${esc(d.id)}">
    <div class="top"><span class="num">${i + 1}</span><div class="stack" style="gap:6px"><h3>${md(d.title)}</h3>${d.why ? `<div class="why">${paras(d.why, ev(d.evidence))}</div>` : (d.evidence ? ev(d.evidence) : '')}</div></div>
    ${(d.options || []).length ? `<div class="opts" role="group" aria-label="Options">${d.options.map((o) => `<button class="opt" type="button" data-opt="${esc(o)}" aria-pressed="false">${esc(o)}${d.recommend === o ? '<span class="rec">Recommended</span>' : ''}</button>`).join('')}</div>` : ''}
    <input class="note" type="text" placeholder="A note for the agent (optional)" aria-label="Note for decision ${i + 1}">
  </article>`).join('')}</div>
  <div class="decbar"><span class="count" id="dec-count"></span><span style="display:flex;gap:8px"><button class="btn outline" id="clear-answers" type="button">Clear</button><button class="btn" id="copy-answers" type="button">Copy the answers</button></span></div>
</section>` : '';

const secHtml = sections.map((s, i) => `<section class="sec" id="s-${esc(s.id)}">
  <header class="sec-head"><div class="kicker"><span class="meta">${String(i + 1).padStart(2, '0')}</span></div><h2>${md(s.title)}</h2>${s.summary ? `<p class="summary">${md(s.summary)}</p>` : ''}</header>
  <div class="stack">${blocks(s.blocks)}</div>
</section>`).join('\n');

// The evidence: each cited fact, in the order of its number, grouped by the kind of its source.
const cited = [...number.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => factById.get(id));
const GROUPS = [['orbh', 'Orbh records'], ['git', 'Commits'], ['mesh', 'Mesh notes'], ['media', 'Screenshots and media'], ['command', 'Commands'], ['file', 'Files'], ['url', 'Web pages']];
function srcCell(f) {
  const s = f.source || {};
  if (['mesh', 'media', 'file'].includes(s.type) && (s.path || s.ref)) {
    const p = s.path || s.ref;
    return `<a href="${esc(link(p))}">${esc(p).replace(/\//g, '/<wbr>')}</a>${s.quote ? `<span class="q">“${esc(s.quote)}”</span>` : ''}`;
  }
  if (s.type === 'url') return `<a href="${esc(s.ref)}">${esc(s.ref)}</a>`;
  if (s.type === 'orbh' || s.type === 'command') return `<code title="Click to copy" data-copy="${esc(s.ref || '')}" style="cursor:copy">${esc(s.ref || '')}</code>`;
  return `<code>${esc(L.sourceText(s))}</code>`;
}
const evGroups = GROUPS.map(([t, label]) => {
  const fs2 = cited.filter((f) => (f.source || {}).type === t);
  if (!fs2.length) return '';
  return `<details class="fold"><summary>${label} <span class="meta">${fs2.length}</span></summary><div class="inner"><div class="tbl-wrap"><table class="tbl facts"><thead><tr><th>#</th><th>Fact</th><th>Source</th></tr></thead><tbody>${fs2.map((f) => `<tr id="fact-${esc(f.id)}"><td class="fid">${number.get(f.id)}</td><td>${md(f.text)}</td><td class="src">${srcCell(f)}</td></tr>`).join('')}</tbody></table></div></div></details>`;
}).join('');
const evHtml = `<section class="sec" id="evidence">
  <header class="sec-head"><div class="kicker"><span class="meta">Sources</span></div><h2>Evidence</h2><p class="summary">Each small number on this page opens a fact here. Each fact has a source that you can open: a record of Orbh, a commit, a Mesh note, or a screenshot. ${claims.total ? `Of the ${claims.total} claims, ${claims.observed} ${claims.observed === 1 ? 'is' : 'are'} observed and ${claims.inferred} ${claims.inferred === 1 ? 'is' : 'are'} inferred.` : ''}</p></header>
  <div class="stack">${evGroups || '<p>No fact is cited.</p>'}</div>
</section>`;

const navItems = [['top', 'Overview', '']]
  .concat(decisions.length ? [['decisions', `Decisions for you`, String(decisions.length)]] : [])
  .concat(sections.map((s, i) => [`s-${s.id}`, s.title, String(i + 1).padStart(2, '0')]))
  .concat([['evidence', 'Evidence', '']]);
const rail = `<aside class="rail" aria-label="Sections">
  <div class="grp"><div class="grp-label">On this page</div>
  <nav><ol>${navItems.map(([id, t, n]) => `<li><a href="#${esc(id)}">${id === 'decisions' ? `<span class="n"></span><span class="t">${md(t)}</span><span class="cnt">${esc(n)}</span>` : `<span class="n">${esc(n)}</span><span class="t">${md(t)}</span>`}</a></li>`).join('')}</ol></nav></div>
  <div class="grp"><div class="grp-label">This brief</div>
  <div class="strip">
    <div class="row"><span>Claims</span><b>${claims.total}</b></div>
    <div class="row"><span>Observed</span><b>${claims.observed}</b></div>
    <div class="row"><span>Inferred</span><b>${claims.inferred}</b></div>
    <div class="row"><span>Facts cited</span><b>${number.size}</b></div>
    <div class="row"><span>Words</span><b>${L.specWords(spec).toLocaleString('en-US')}</b></div>
  </div></div>
</aside>`;
const mnav = `<nav class="mnav" aria-label="Sections"><div class="list">${navItems.map(([id, t]) => `<a href="#${esc(id)}">${esc(L.plain(t))}</a>`).join('')}</div></nav>`;

const now = new Date().toISOString();
const rendered = L.fmtTime(now, tz);
// product-logo.tsx: the 512 canvas, the glyph scaled so that its long side is 410 (IDEAL_SQUARE), and the
// production calibration of nuu (scale 1, dx -7, dy 3), so that the mark centres on the wordmark.
const NUU_SCALE = (410 / 296).toFixed(6);
const glyph = `<svg viewBox="0 0 512 512" aria-hidden="true" shape-rendering="geometricPrecision"><g transform="translate(249 259) scale(${NUU_SCALE}) translate(-256 -256)"><path transform="translate(106 108)" fill-rule="evenodd" d="${NUU_GLYPH}" fill="currentColor"></path></g></svg>`;
const favicon = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -40 366 376"><rect x="-40" y="-40" width="366" height="376" rx="70" fill="#3D6A9A"/><path d="${NUU_GLYPH}" fill="#fff"/></svg>`);

const pageData = {
  spec: { id: spec.id, title: spec.title, kind: spec.kind },
  facts: Object.fromEntries(cited.map((f) => [f.id, { n: number.get(f.id), text: f.text, src: L.sourceText(f.source) }])),
};
const usedDerived = {};
if (JSON.stringify(spec).includes('"derived":"timeline"') && factsDoc.derived && factsDoc.derived.timeline) usedDerived.timeline = factsDoc.derived.timeline;
if (factsDoc.derived && factsDoc.derived.tz) usedDerived.tz = factsDoc.derived.tz;
const source = { schema: 'brief-source/0.1', renderedAt: now, spec, facts: allFacts, derived: usedDerived };
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.title)} · Brief</title>
<meta name="description" content="${esc(L.plain(spec.lede))}">
<meta name="generator" content="Brief shard (brf render, ${L.SCHEMA_ID})">
<link rel="icon" href="${favicon}">
<script>(function(){try{var m=JSON.parse(localStorage.getItem("nuu-brief-theme")||'"auto"');if(m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark");}catch(e){}})();</script>
<style>
${L.readAsset('fonts.css')}
${L.readAsset('tokens.css')}
${L.readAsset('page.css')}
</style>
</head>
<body class="kind-${esc(spec.kind)}">
<header class="topbar">
  <div class="crumbs"><a class="brand" href="#top" aria-label="NUU Cognition">${glyph}<span>NUU Cognition</span></a><span class="vsep" aria-hidden="true"></span><nav class="bc" aria-label="Breadcrumb"><span class="kind">${esc(kind)}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg><span class="cur">${esc(spec.title)}</span></nav></div>
  <div class="tools"><a class="btn outline sm" href="#evidence">Evidence</a><button class="btn ghost icon" id="theme" type="button" aria-label="Theme"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button></div>
</header>
${mnav}
<div class="shell">
${rail}
<main id="main">
${hero}
${decHtml}
${secHtml}
${evHtml}
<footer class="foot"><span>${esc(kind)} · <code>${esc(spec.id)}</code>${spec.related && spec.related.length ? ' · ' + spec.related.map((r) => `<a href="${esc(link(r.href))}">${esc(r.label)}</a>`).join(' · ') : ''}</span><span>Rendered by the Brief shard (<code>brf render</code>, ${L.SCHEMA_ID}) on ${esc(rendered.day)} ${esc(rendered.hm)} UTC${esc(tz)}</span></footer>
</main>
</div>
<script type="application/json" id="brief-data">${json(pageData)}</script>
<script type="application/json" id="brief-source">${json(source)}</script>
<script>
${L.readAsset('page.js')}
</script>
</body>
</html>
`;

if (missing.size) warnings.push(`unknown fact ids: ${[...missing].join(', ')}`);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);
process.stdout.write(JSON.stringify({
  ok: true,
  file: path.relative(root, outFile),
  bytes: Buffer.byteLength(html),
  facts: allFacts.length,
  cited: number.size,
  claims,
  words: L.specWords(spec),
  warnings,
  next: [`flint shard brf check "${path.relative(root, outFile)}"`],
}, null, 2) + '\n');
