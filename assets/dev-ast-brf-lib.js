// Brief — the shared library of the scripts collect, render, and check.
// Node.js built-ins only. The scripts load it from the assets folder of the shard.
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_ID = 'brief/0.1';
const FACTS_ID = 'brief-facts/0.1';
const KINDS = ['fleet', 'status', 'architecture', 'explainer'];

// ---------- Places ----------

function flintRoot() {
  return process.env.FLINT_ROOT || process.cwd();
}

// An asset of the shard: the build has ast-brf-<name>, the source has dev-ast-brf-<name>.
function assetPath(name) {
  const dir = path.join(__dirname);
  for (const f of [`ast-brf-${name}`, `dev-ast-brf-${name}`]) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`the asset ${name} is not in ${dir}`);
}

function readAsset(name) {
  return fs.readFileSync(assetPath(name), 'utf8');
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJSON(p, v) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
}

// ---------- Arguments ----------

// parseArgs(['--kind', 'fleet', '--repo', 'a', '--repo', 'b', 'x']) → { kind: 'fleet', repo: ['a', 'b'], _: ['x'] }
function parseArgs(argv, multi = []) {
  const out = { _: [] };
  for (const m of multi) out[m] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let key = eq > 0 ? a.slice(2, eq) : a.slice(2);
      let val = eq > 0 ? a.slice(eq + 1) : undefined;
      if (val === undefined) {
        const n = argv[i + 1];
        if (n !== undefined && !n.startsWith('--')) { val = n; i++; } else val = true;
      }
      key = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (multi.includes(key)) out[key].push(val);
      else out[key] = val;
    } else out._.push(a);
  }
  return out;
}

function fail(code, reason, next) {
  process.stdout.write(JSON.stringify({ ok: false, code, reason, next: next || [] }, null, 2) + '\n');
  process.exit(1);
}

// ---------- Text ----------

function slug(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'brief';
}

// The file name of a Brief: "(Brief) <date> <Title>.html". The title keeps its words; characters that a
// file name cannot hold are removed.
function briefFileName(date, title) {
  const clean = String(title).replace(/[\/\\:*?"<>|#^\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  return `(Brief) ${date} ${clean}.html`;
}

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Inline text: **bold**, `code`, and [label](href). Everything else is escaped. `link` maps an href.
function inline(s, link) {
  const src = String(s === undefined || s === null ? '' : s);
  let out = '';
  let i = 0;
  const re = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let m;
  while ((m = re.exec(src))) {
    out += esc(src.slice(i, m.index));
    if (m[1]) out += `<strong>${esc(m[2])}</strong>`;
    else if (m[3]) out += `<code>${esc(m[4])}</code>`;
    else if (m[5]) out += `<a href="${esc(link ? link(m[7]) : m[7])}">${esc(m[6])}</a>`;
    i = re.lastIndex;
  }
  return out + esc(src.slice(i));
}

// The plain words of an inline text, for the word count and the checks.
function plain(s) {
  return String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function words(s) {
  const t = plain(s).trim();
  return t ? t.split(/\s+/).length : 0;
}

function sentences(s) {
  const t = plain(s).replace(/\b(e\.g|i\.e|vs|etc|approx)\./gi, '$1').trim();
  if (!t) return 0;
  return t.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/).filter(Boolean).length;
}

// ---------- Paths ----------

const isUrl = (h) => /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith('#');

// A path in a spec is relative to the Flint root. The page is in Media/Briefs/, so the link goes up two folders.
function pageHref(p, fromDir) {
  if (!p) return '';
  if (isUrl(p)) return p;
  const clean = p.replace(/^\.?\//, '');
  const rel = path.relative(fromDir, path.join(flintRoot(), clean)).split(path.sep).join('/');
  return rel.split('/').map((seg) => (seg === '..' || seg === '.' ? seg : encodeURIComponent(seg))).join('/');
}

// ---------- Time ----------

function parseOffset(tz) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(tz || '');
  if (!m) return null;
  return (m[1] === '-' ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

function localOffset() {
  const o = -new Date().getTimezoneOffset();
  const s = o < 0 ? '-' : '+';
  const a = Math.abs(o);
  return `${s}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

// fmtTime('2026-10-15T13:07:00Z', '+11:00') → { date: '2026-10-16', hm: '00:07', day: 'Fri 16 Oct' }
function fmtTime(iso, tz) {
  const d = new Date(iso);
  if (isNaN(d)) return { date: '', hm: '', day: '' };
  const off = parseOffset(tz);
  const t = new Date(d.getTime() + (off === null ? -d.getTimezoneOffset() : off) * 60000);
  const p = (n) => String(n).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    date: `${t.getUTCFullYear()}-${p(t.getUTCMonth() + 1)}-${p(t.getUTCDate())}`,
    hm: `${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`,
    day: `${days[t.getUTCDay()]} ${t.getUTCDate()} ${months[t.getUTCMonth()]}`,
  };
}

function fmtDuration(ms) {
  if (!(ms >= 0)) return '';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

// ---------- A small JSON Schema validator ----------
// It supports: type, enum, const, required, properties, additionalProperties: false, items, minItems,
// maxItems, minLength, maxLength, pattern, minimum, maximum, additionalProperties as a schema, $ref (#/$defs/<name>), oneOf (with a
// "type" const as the discriminator), and anyOf.

function validate(schema, value) {
  const errors = [];
  const root = schema;
  function typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
  }
  function typeOk(t, v) {
    const vt = typeOf(v);
    return t === vt || (t === 'number' && vt === 'integer');
  }
  function resolve(s) {
    while (s && s.$ref) {
      const m = /^#\/\$defs\/(.+)$/.exec(s.$ref);
      if (!m || !root.$defs || !root.$defs[m[1]]) throw new Error(`bad $ref ${s.$ref}`);
      s = root.$defs[m[1]];
    }
    return s;
  }
  function check(s, v, at, out) {
    s = resolve(s);
    if (!s) return;
    if (s.type) {
      const ts = Array.isArray(s.type) ? s.type : [s.type];
      if (!ts.some((t) => typeOk(t, v))) { out.push(`${at}: must be ${ts.join(' or ')}, not ${typeOf(v)}`); return; }
    }
    if (s.const !== undefined && v !== s.const) out.push(`${at}: must be ${JSON.stringify(s.const)}`);
    if (s.enum && !s.enum.includes(v)) out.push(`${at}: must be one of ${s.enum.join(', ')}, not ${JSON.stringify(v)}`);
    if (typeof v === 'string') {
      if (s.minLength !== undefined && v.length < s.minLength) out.push(`${at}: is shorter than ${s.minLength} characters`);
      if (s.maxLength !== undefined && v.length > s.maxLength) out.push(`${at}: is longer than ${s.maxLength} characters (${v.length})`);
      if (s.pattern && !new RegExp(s.pattern).test(v)) out.push(`${at}: does not match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum !== undefined && v < s.minimum) out.push(`${at}: is less than ${s.minimum}`);
      if (s.maximum !== undefined && v > s.maximum) out.push(`${at}: is more than ${s.maximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems !== undefined && v.length < s.minItems) out.push(`${at}: has fewer than ${s.minItems} items`);
      if (s.maxItems !== undefined && v.length > s.maxItems) out.push(`${at}: has more than ${s.maxItems} items (${v.length})`);
      if (s.items) v.forEach((x, i) => check(s.items, x, `${at}[${i}]`, out));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const r of s.required || []) if (v[r] === undefined) out.push(`${at}: needs "${r}"`);
      for (const [k, x] of Object.entries(v)) {
        if (s.properties && s.properties[k]) check(s.properties[k], x, `${at}.${k}`, out);
        else if (s.additionalProperties === false) out.push(`${at}: has the unknown field "${k}"`);
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(s.additionalProperties, x, `${at}.${k}`, out);
      }
    }
    if (s.oneOf) {
      // Use the discriminator when the value has a "type": the errors of that branch are the useful ones.
      if (v && typeof v === 'object' && typeof v.type === 'string') {
        const branch = s.oneOf.map(resolve).find((b) => b.properties && b.properties.type && b.properties.type.const === v.type);
        if (!branch) {
          const names = s.oneOf.map(resolve).map((b) => b.properties && b.properties.type && b.properties.type.const).filter(Boolean);
          out.push(`${at}: the block type "${v.type}" is not known (${names.join(', ')})`);
        } else check(branch, v, `${at}<${v.type}>`, out);
      } else {
        const ok = s.oneOf.filter((b) => { const e = []; check(b, v, at, e); return e.length === 0; });
        if (ok.length !== 1) out.push(`${at}: must match exactly one form (matches ${ok.length})`);
      }
    }
    if (s.anyOf) {
      const any = s.anyOf.some((b) => { const e = []; check(b, v, at, e); return e.length === 0; });
      if (!any) {
        const first = []; check(s.anyOf[s.anyOf.length - 1], v, at, first);
        out.push(...(first.length ? first : [`${at}: does not match any form`]));
      }
    }
  }
  check(schema, value, '$', errors);
  return errors;
}

// ---------- Facts ----------

// Every fact has an id, a text, and a source. sourceText gives one line for the popover and the table.
function sourceText(src) {
  if (!src) return '';
  switch (src.type) {
    case 'git': return `git ${src.repo ? src.repo + ' ' : ''}${src.ref || ''}`.trim();
    case 'orbh': return src.ref || 'orbh';
    case 'command': return `$ ${src.ref || ''}`;
    case 'mesh':
    case 'media':
    case 'file': return src.path || src.ref || '';
    case 'url': return src.ref || src.url || '';
    default: return src.ref || '';
  }
}

// Walk each place in a spec that can cite facts. fn(evidence[], where, text, basis).
// A place reads like: section "failed", block 1 (failures), item 2.
function walkEvidence(spec, fn) {
  const cite = (o, where, text) => { if (o && Array.isArray(o.evidence)) fn(o.evidence, where, text, o.basis); };
  if (Array.isArray(spec.ledeEvidence)) fn(spec.ledeEvidence, 'the lede', spec.lede);
  if (spec.health) cite(spec.health, 'the health', spec.health.label);
  (spec.stats || []).forEach((s, i) => cite(s, `stat ${i + 1}`, `${s.value} ${s.label}`));
  (spec.decisions || []).forEach((d, i) => cite(d, `decision ${i + 1} ("${d.id}")`, `${d.title} ${d.why || ''}`));
  const blocks = (bs, at) => (bs || []).forEach((b, i) => block(b, `${at}, block ${i + 1} (${b && b.type})`));
  function block(b, at) {
    if (!b || typeof b !== 'object') return;
    cite(b, at, b.text || '');
    switch (b.type) {
      case 'claims': (b.items || []).forEach((c, i) => cite(c, `${at}, item ${i + 1}`, c.text)); break;
      case 'stats': (b.items || []).forEach((s, i) => cite(s, `${at}, item ${i + 1}`, `${s.value} ${s.label}`)); break;
      case 'board': (b.rows || []).forEach((r, i) => cite(r, `${at}, row ${i + 1} (${r.lane})`, `${r.note || ''}`)); break;
      case 'table': (b.rows || []).forEach((r, i) => (r || []).forEach((c, j) => { if (c && typeof c === 'object') cite(c, `${at}, row ${i + 1}, column ${j + 1}`, c.text); })); break;
      case 'cards': (b.items || []).forEach((c, i) => {
        cite(c, `${at}, card ${i + 1} ("${c.title}")`, `${c.text || ''}`);
        (c.claims || []).forEach((x, j) => cite(x, `${at}, card ${i + 1} ("${c.title}"), claim ${j + 1}`, x.text));
        blocks(c.details, `${at}, card ${i + 1} ("${c.title}"), details`);
      }); break;
      case 'changes':
        if (b.diffstat) cite(b.diffstat, `${at}, diffstat`, `${b.diffstat.files} ${b.diffstat.insertions} ${b.diffstat.deletions}`);
        (b.groups || []).forEach((g, i) => (g.items || []).forEach((x, j) => cite(x, `${at}, group "${g.label}", item ${j + 1}`, x.text)));
        break;
      case 'failures': (b.items || []).forEach((x, i) => cite(x, `${at}, item ${i + 1} ("${x.title}")`, `${x.symptom} ${x.cause} ${x.tried || ''}`)); break;
      case 'retro': ['well', 'wrong', 'lucky'].forEach((k) => (b[k] || []).forEach((x, i) => { if (x && typeof x === 'object') cite(x, `${at}, ${k} ${i + 1}`, x.text); })); break;
      case 'timeline':
        (b.marks || []).forEach((m, i) => cite(m, `${at}, mark ${i + 1} ("${m.label}")`, m.label));
        (b.bands || []).forEach((m, i) => cite(m, `${at}, band ${i + 1} ("${m.label}")`, m.label));
        break;
      case 'gallery': (b.items || []).forEach((x, i) => cite(x, `${at}, image ${i + 1}`, x.caption)); break;
      case 'details': blocks(b.blocks, at); break;
      default: break;
    }
  }
  (spec.sections || []).forEach((s) => blocks(s.blocks, `section "${s.id}"`));
}

// Walk each claim with a basis: the strip "N claims · N observed · N inferred".
function walkClaims(spec, fn) {
  const blocks = (bs) => (bs || []).forEach(block);
  function block(b) {
    if (!b) return;
    if (b.type === 'claims') (b.items || []).forEach(fn);
    if (b.type === 'text' && b.basis) fn(b);
    if (b.type === 'failures') (b.items || []).forEach((x) => fn({ text: x.cause, basis: x.basis, evidence: x.evidence }));
    if (b.type === 'retro') ['well', 'wrong', 'lucky'].forEach((k) => (b[k] || []).forEach((x) => { if (x && typeof x === 'object' && x.basis) fn(x); }));
    if (b.type === 'cards') (b.items || []).forEach((c) => { (c.claims || []).forEach(fn); blocks(c.details); });
    if (b.type === 'details') blocks(b.blocks);
  }
  (spec.sections || []).forEach((s) => blocks(s.blocks));
}

// Each image and link path of a spec: fn(path, where, kind).
function walkPaths(spec, fn) {
  const linksIn = (text, where) => {
    const re = /\[[^\]]+\]\(([^)\s]+)\)/g;
    let m;
    while ((m = re.exec(String(text || '')))) fn(m[1], where, 'link');
  };
  linksIn(spec.lede, 'lede');
  (spec.related || []).forEach((r, i) => fn(r.href, `related[${i}]`, 'link'));
  (spec.decisions || []).forEach((d, i) => linksIn(d.why, `decisions[${i}]`));
  const blocks = (bs, at) => (bs || []).forEach((b, i) => block(b, `${at}.blocks[${i}]`));
  function block(b, at) {
    if (!b) return;
    linksIn(b.text, at);
    if (b.type === 'claims') (b.items || []).forEach((c, i) => linksIn(c.text, `${at}.items[${i}]`));
    if (b.type === 'gallery') (b.items || []).forEach((x, i) => fn(x.src, `${at}.items[${i}]`, 'image'));
    if (b.type === 'compare') { if (b.before) fn(b.before.src, `${at}.before`, 'image'); if (b.after) fn(b.after.src, `${at}.after`, 'image'); }
    if (b.type === 'cards') (b.items || []).forEach((c, i) => {
      if (c.image) fn(c.image.src, `${at}.items[${i}].image`, 'image');
      (c.links || []).forEach((l, j) => fn(l.href, `${at}.items[${i}].links[${j}]`, 'link'));
      linksIn(c.text, `${at}.items[${i}]`);
      (c.claims || []).forEach((x, j) => linksIn(x.text, `${at}.items[${i}].claims[${j}]`));
      blocks(c.details, `${at}.items[${i}].details`);
    });
    if (b.type === 'board') (b.rows || []).forEach((r, i) => linksIn(r.note, `${at}.rows[${i}]`));
    if (b.type === 'table') (b.rows || []).forEach((r, i) => (r || []).forEach((c, j) => linksIn(typeof c === 'object' && c ? c.text : c, `${at}.rows[${i}][${j}]`)));
    if (b.type === 'details') blocks(b.blocks, at);
  }
  (spec.sections || []).forEach((s, i) => blocks(s.blocks, `sections[${i}]`));
}

// All text of a spec that the page shows, for the word count.
const TEXT_KEYS = new Set(['title', 'lede', 'label', 'text', 'note', 'caption', 'summary', 'why', 'symptom', 'cause', 'tried',
  'sub', 'lane', 'name', 'options', 'notes', 'well', 'wrong', 'lucky', 'columns', 'rows', 'value', 'recommend']);
const SKIP_KEYS = new Set(['evidence', 'src', 'href', 'id', 'cmd', 'from', 'to', 'steps', 'start', 'end', 'at', 'facts',
  'asOf', 'schema', 'kind', 'date', 'type', 'tone', 'status', 'state', 'basis', 'cells', 'derived', 'laneNames', 'scope', 'tz']);
function specWords(spec) {
  let n = 0;
  function walk(v, counted) {
    if (typeof v === 'string') { if (counted) n += words(v); return; }
    if (typeof v === 'number') return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, counted)); return; }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if (SKIP_KEYS.has(k)) continue;
        walk(x, counted || TEXT_KEYS.has(k));
      }
    }
  }
  walk(spec, false);
  return n;
}

// ---------- Grounding ----------

// The numbers of a text that must be in its facts. Names that hold digits are not numbers: a step or a
// test id (S2b, A17, T4), a handle (nuu-net01-1015), a version (v0.2), a sha (067be327), an artifact number
// (Task 1274, Report 114), a date, and a time.
const NAMED = /\b(?:Task|Tasks|Notepad|Report|Reports|Proposal|Increment|Mission|Program|Fleet|Lane|Step|Steps|Wave|Round|Phase|Stage|Section|Level|Rule|Item|Spec|Story|PR|Issue|Commit|Port|Version|Node)\s+#?\d+(?:\s*(?:to|and|-|–)\s*\d+)?\b/gi;
function numbersIn(text) {
  let t = plain(text);
  t = t.replace(/\b\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(NAMED, ' ')
    .replace(/\bv\d+(?:\.\d+)*\b/gi, ' ')
    .replace(/\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{7,40}\b/g, ' ')
    .replace(/\b[a-z0-9]*[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/gi, (m) => (/\d/.test(m) ? ' ' : m))
    .replace(/\b[A-Za-z]+\d+[A-Za-z]?\b/g, ' ')
    .replace(/\b\d+[A-Za-z]{1,2}\d+[a-z]?\b/g, ' ');
  t = t.replace(/(\d),(?=\d{3}\b)/g, '$1');
  return (t.match(/\d+(?:\.\d+)?/g) || []).filter((n) => !/^[01]$/.test(n));
}

// A stable fact id for one image, so that a figure cites its own screenshot.
function imageFactId(p) {
  let h = 2166136261;
  for (const c of String(p)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `image:${h.toString(16).padStart(8, '0')}`;
}

module.exports = {
  SCHEMA_ID, FACTS_ID, KINDS,
  flintRoot, assetPath, readAsset, readJSON, writeJSON, parseArgs, fail,
  slug, briefFileName, esc, inline, plain, words, sentences,
  isUrl, pageHref, parseOffset, localOffset, fmtTime, fmtDuration,
  validate, sourceText, walkEvidence, walkClaims, walkPaths, specWords, numbersIn, imageFactId,
};
