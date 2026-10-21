#!/usr/bin/env node
// Collect the facts of a Brief. No LLM runs here: each fact comes from a record, a commit, a file, or a
// command, and it keeps its source. It writes facts.json and, when it is absent, a starter brief.json.
// Invocation:
//   flint shard brf collect --kind fleet --fleet <handle> [--repo <path>]... [--note <path>]... [--media <dir>]... [--no-auto-repos] [--out <dir>]
//   flint shard brf collect --kind status|architecture|explainer --title "<Title>" [--repo <path>]... [--since <date>] [--until <date>] [--grep <text>] [--note <path>]... [--media <dir>]... [--out <dir>]
// Outputs: one JSON value { ok, dir, facts, brief, counts, next } (or { ok: false, code, reason, next }).

'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

const args = L.parseArgs(process.argv.slice(2), ['repo', 'note', 'media']);
const root = L.flintRoot();
const kind = args.kind;
if (!L.KINDS.includes(kind)) L.fail('usage', `--kind must be one of ${L.KINDS.join(', ')}`, ['flint shard brf collect --kind fleet --fleet <handle>']);
if (kind === 'fleet' && !args.fleet) L.fail('usage', 'a fleet Brief needs --fleet <handle>', ['flint shard brf collect --kind fleet --fleet <handle>']);
if (kind !== 'fleet' && !args.title) L.fail('usage', `a ${kind} Brief needs --title "<Title>"`);

const facts = [];
const ids = new Set();
function fact(id, text, source, extra = {}) {
  if (ids.has(id)) return;
  ids.add(id);
  facts.push({ id, text: String(text).slice(0, 1200), source, ...extra });
}
const tz = args.tz || L.localOffset();
const hm = (iso) => L.fmtTime(iso, tz).hm;
const dayhm = (iso) => { const f = L.fmtTime(iso, tz); return `${f.day} ${f.hm}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function run(cmd, argv, opts = {}) {
  return execFileSync(cmd, argv, { cwd: opts.cwd || root, encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}
function runJSON(cmd, argv) {
  try { return JSON.parse(run(cmd, argv)); } catch (e) {
    L.fail('command-failed', `${cmd} ${argv.join(' ')} failed: ${String(e.stderr || e.message).split('\n')[0]}`);
  }
}

// ---------- Orbh: the fleet ----------

let fleet = null, timeline = null, window = { start: args.since || null, end: args.until || null };
const derived = { tz };
let title = args.title;
let lanesOut = [];

function laneOf(sessions, s) {
  let cur = s;
  while (cur && cur.depth > 1 && sessions.get(cur.parentSessionId)) cur = sessions.get(cur.parentSessionId);
  return cur;
}
function laneName(t) {
  const m = /(?:^|[\s:(])([A-Z][A-Z0-9]{1,}(?:-[A-Z0-9]+)?)(?=[\s:)]|$)/.exec(t || '');
  return m ? m[1] : null;
}

if (kind === 'fleet') {
  const h = args.fleet;
  fleet = runJSON('flint', ['orbh', 'fleet', 'show', h, '--json']);
  timeline = runJSON('flint', ['orbh', 'timeline', `fleet:${h}`, '--json']);
  const def = fleet.definition || {};
  const st = fleet.state || {};
  title = title || fleet.name || h;
  const showCmd = `flint orbh fleet show ${h}`;
  const tlCmd = `flint orbh timeline fleet:${h}`;
  const events = timeline.events || [];
  const lastAt = events.reduce((a, e) => (e.at > a ? e.at : a), '');
  window.start = window.start || def.declaredAt || (timeline.sessions[0] || {}).started;
  window.end = window.end || st.closedAt || lastAt;

  fact('fleet:charter', `The charter of fleet ${h}: ${def.charter || '(none)'}`, { type: 'orbh', ref: showCmd });
  fact('fleet:status', `Fleet ${h} (${fleet.name}) is ${fleet.status}. Declared ${dayhm(def.declaredAt)}${st.closedAt ? `, closed ${dayhm(st.closedAt)}` : ''} (UTC${tz}). Root session ${String(def.rootSessionId || '').slice(0, 8)}.`, { type: 'orbh', ref: showCmd }, { at: st.closedAt || def.declaredAt });
  if (st.outcome) fact('fleet:outcome', `The outcome that the root wrote at the close: ${st.outcome}`, { type: 'orbh', ref: showCmd }, { at: st.closedAt });
  if (st.reportRef) fact('fleet:report', `The report of the fleet: ${st.reportRef}`, { type: 'mesh', path: st.reportRef });
  if (def.charterRef) fact('fleet:task', `The charter Task of the fleet: ${def.charterRef}`, { type: 'mesh', path: def.charterRef });
  const winMs = Date.parse(window.end) - Date.parse(window.start);
  fact('fleet:window', `The fleet ran from ${dayhm(window.start)} to ${dayhm(window.end)} (UTC${tz}): ${L.fmtDuration(winMs)}.`, { type: 'orbh', ref: showCmd }, { value: winMs });

  // Sessions, runs, and lanes.
  const sessions = new Map((timeline.sessions || []).map((s) => [s.id, { ...s, runs: [], messages: 0, jobs: 0, keys: {} }]));
  const open = new Map();
  for (const e of events) {
    const s = sessions.get(e.sessionId);
    if (e.kind === 'run-started') open.set(e.runId, e);
    else if (e.kind === 'run-ended' && s) {
      const a = open.get(e.runId);
      const end = e.at;
      const start = a ? a.at : new Date(Date.parse(end) - (e.durationMs || 0)).toISOString();
      s.runs.push({ id: e.runId, start, end, status: e.status, summary: e.resultSummary || '' });
      open.delete(e.runId);
    } else if (e.kind === 'session-message' && s) s.messages++;
    else if (e.kind === 'job-started' && s) s.jobs++;
    else if (e.kind === 'interface-key-change' && s && ['phase', 'progress', 'blockers'].includes(e.key)) s.keys[e.key] = e.newValue;
  }
  for (const a of open.values()) {
    const s = sessions.get(a.sessionId);
    if (s) s.runs.push({ id: a.runId, start: a.at, end: window.end, status: 'running', summary: '' });
  }
  const all = [...sessions.values()];
  const rootS = all.find((s) => s.depth === 0);
  let failedRuns = 0, totalRuns = 0;
  const lanes = new Map();
  for (const s of all) {
    // A lane is a session of depth 1 with a lane word in its title (ADDR, QA, …). Another session of depth 1
    // is a helper of the root.
    const top = s.depth === 0 ? s : laneOf(sessions, s);
    const key = s.depth === 0 ? 'root' : (laneName(top.title) || 'root');
    if (!lanes.has(key)) lanes.set(key, { key, lead: top, sessions: [] });
    lanes.get(key).sessions.push(s);
    totalRuns += s.runs.length;
    failedRuns += s.runs.filter((r) => r.status === 'failed').length;
    const workMs = s.runs.reduce((a, r) => a + (Date.parse(r.end) - Date.parse(r.start)), 0);
    s.workMs = workMs;
    const first = s.runs.reduce((a, r) => (!a || r.start < a ? r.start : a), '');
    const last = s.runs.reduce((a, r) => (r.end > a ? r.end : a), '');
    const prog = s.keys.progress || s.keys.phase;
    fact(`session:${s.id.slice(0, 8)}`, `Session ${s.id.slice(0, 8)} "${s.title}" (lane ${key}, depth ${s.depth}, ${s.runtime || 'agent'}): ${plural(s.runs.length, 'run', 'runs')}, ${L.fmtDuration(workMs)} of work${first ? `, from ${hm(first)} to ${hm(last)}` : ''}, ${plural(s.messages, 'message', 'messages')}.${prog ? ` Last progress: "${String(prog).slice(0, 220)}".` : ''}${s.keys.blockers && s.keys.blockers !== '[]' && s.keys.blockers !== 'null' ? ` Last blockers: ${String(s.keys.blockers).slice(0, 200)}.` : ''}`, { type: 'orbh', ref: `${tlCmd} --json` }, { value: workMs, at: s.started });
    for (const r of s.runs.filter((x) => x.status === 'failed')) {
      fact(`run:${r.id.slice(0, 8)}`, `Run ${r.id.slice(0, 8)} of session ${s.id.slice(0, 8)} ("${s.title}") failed at ${hm(r.end)}. ${r.summary.slice(0, 400)}`, { type: 'orbh', ref: `${tlCmd} --json` }, { at: r.end });
    }
  }
  const leads = all.filter((s) => s.depth === 1 && laneName(s.title)).length;
  const roots = all.filter((s) => s.depth === 0).length;
  fact('fleet:sessions', `${plural(all.length, 'session', 'sessions')} in fleet ${h}: ${roots} root, ${plural(leads, 'lane lead', 'lane leads')}, and ${all.length - roots - leads} helpers and reviewers. ${plural(totalRuns, 'run', 'runs')}; ${failedRuns} failed.`, { type: 'orbh', ref: tlCmd }, { value: all.length });
  const msgs = events.filter((e) => e.kind === 'session-message').length;
  fact('fleet:messages', `${plural(msgs, 'message', 'messages')} between the sessions of the fleet (and the manager).`, { type: 'orbh', ref: tlCmd }, { value: msgs });

  // Lane spans: one row per session, ordered by start; the union of the spans is the busy time.
  const union = (spans) => {
    const xs = spans.map((r) => [Date.parse(r.start), Date.parse(r.end)]).sort((a, b) => a[0] - b[0]);
    let tot = 0, cs = null, ce = null;
    for (const [a, b] of xs) { if (cs === null || a > ce) { if (cs !== null) tot += ce - cs; cs = a; ce = b; } else ce = Math.max(ce, b); }
    if (cs !== null) tot += ce - cs;
    return tot;
  };
  const order = [...lanes.values()].sort((a, b) => (a.key === 'root' ? -1 : b.key === 'root' ? 1 : (a.lead.started || '').localeCompare(b.lead.started || '')));
  for (const ln of order) {
    const ss = ln.sessions.sort((a, b) => (a.depth - b.depth) || (a.started || '').localeCompare(b.started || ''));
    const spans = [];
    ss.forEach((s, row) => {
      const review = /review/i.test(s.title);
      for (const r of s.runs) spans.push({ start: r.start, end: r.end, row, status: r.status === 'failed' ? 'failed' : r.status === 'running' ? 'running' : review ? 'review' : 'work', label: `${s.id.slice(0, 8)} ${s.title}` });
    });
    const busyMs = union(spans);
    const runs = ss.reduce((a, s) => a + s.runs.length, 0);
    const failed = ss.reduce((a, s) => a + s.runs.filter((r) => r.status === 'failed').length, 0);
    const name = ln.key === 'root' ? 'Root' : ln.key;
    const sub = ln.key === 'root' ? (rootS ? rootS.title : '') : String(ln.lead.title || '').replace(/^.*?:\s*/, '').slice(0, 40);
    lanesOut.push({ key: ln.key, name, sub, sessions: ss.length, spans, busyMs });
    fact(`lane:${ln.key}`, `Lane ${name}${ln.key !== 'root' ? ` ("${ln.lead.title}")` : ''}: ${plural(ss.length, 'session', 'sessions')}, ${plural(runs, 'run', 'runs')}, ${failed} failed, ${L.fmtDuration(busyMs)} with at least one agent at work, of ${L.fmtDuration(winMs)}.`, { type: 'orbh', ref: tlCmd }, { value: busyMs });
  }
  derived.timeline = {
    start: window.start, end: window.end,
    lanes: lanesOut.map((l) => ({ key: l.key, name: l.name, sub: l.sub, busyMs: l.busyMs, spans: l.spans })),
    marks: [
      ...(def.declaredAt ? [{ at: def.declaredAt, label: 'Declared' }] : []),
      ...(st.closedAt ? [{ at: st.closedAt, label: 'Closed' }] : []),
    ],
  };
  derived.lanes = lanesOut.map((l) => ({ key: l.key, name: l.name, sub: l.sub, sessions: l.sessions, busyMs: l.busyMs }));
}

// ---------- Git ----------

function gitRepos() {
  const out = [];
  const add = (p, label) => {
    const abs = path.resolve(root, p);
    if (!fs.existsSync(path.join(abs, '.git'))) return;
    out.push({ abs, label: label || path.basename(abs) });
  };
  add('.', 'flint');
  for (const r of args.repo) add(r);
  if (kind === 'fleet' && !args.noAutoRepos) {
    const reposDir = path.resolve(root, '..', 'Repos');
    if (fs.existsSync(reposDir)) {
      const names = fs.readdirSync(reposDir).filter((n) => !n.startsWith('.'))
        .sort((a, b) => (/-wt-|-deploy/.test(a) - /-wt-|-deploy/.test(b)) || a.localeCompare(b));
      for (const n of names) add(path.join(reposDir, n), n);
    }
  }
  const seen = new Set();
  return out.filter((r) => (seen.has(r.abs) ? false : seen.add(r.abs)));
}

const commitSeen = new Set();
const gitSummary = [];
const laneCommits = new Map();
let allCommits = [];
for (const repo of gitRepos()) {
  const argv = ['log', '--all', '--no-color', '--shortstat', '--format=%x1e%H%x1f%h%x1f%aI%x1f%s%x1f%(trailers:key=Orbh-Session,valueonly,separator=%x2C)'];
  const pad = 3600000;
  if (window.start) argv.push(`--since=${new Date(Date.parse(window.start) - pad).toISOString()}`);
  if (window.end) argv.push(`--until=${new Date(Date.parse(window.end) + pad).toISOString()}`);
  if (kind === 'fleet') argv.push(`--grep=Orbh-Fleet: ${args.fleet}`);
  else if (args.grep) argv.push(`--grep=${args.grep}`);
  if (kind !== 'fleet' && !window.start && !args.grep) argv.push('--since=7.days');
  let txt = '';
  try { txt = run('git', argv, { cwd: repo.abs }); } catch (e) { continue; }
  const commits = [];
  for (const rec of txt.split('\x1e').map((x) => x.trim()).filter(Boolean)) {
    const [head, ...rest] = rec.split('\n');
    const [full, short, at, subject, sessions] = head.split('\x1f');
    if (!full || commitSeen.has(full)) continue;
    commitSeen.add(full);
    const stat = rest.join(' ');
    const n = (re) => { const m = re.exec(stat); return m ? parseInt(m[1], 10) : 0; };
    commits.push({ full, short: full.slice(0, 8), at, subject, sessions: (sessions || '').trim(), files: n(/(\d+) files? changed/), ins: n(/(\d+) insertions?\(\+\)/), del: n(/(\d+) deletions?\(-\)/) });
  }
  if (!commits.length) continue;
  commits.sort((a, b) => a.at.localeCompare(b.at));
  const tot = commits.reduce((a, c) => ({ files: a.files + c.files, ins: a.ins + c.ins, del: a.del + c.del }), { files: 0, ins: 0, del: 0 });
  gitSummary.push({ repo: repo.label, path: path.relative(root, repo.abs) || '.', commits: commits.length, ...tot, first: commits[0].at, last: commits[commits.length - 1].at });
  fact(`git:${repo.label}`, `Repository ${repo.label}: ${plural(commits.length, 'commit', 'commits')}${kind === 'fleet' ? ` with the trailer Orbh-Fleet: ${args.fleet}` : ''}, from ${dayhm(commits[0].at)} to ${dayhm(commits[commits.length - 1].at)}; ${tot.files} file changes, +${tot.ins} −${tot.del} lines (the sum of the commits).`, { type: 'command', ref: `git -C "${path.relative(root, repo.abs) || '.'}" log --all${kind === 'fleet' ? ` --grep="Orbh-Fleet: ${args.fleet}"` : ''} --shortstat` }, { value: commits.length });
  for (const c of commits) {
    fact(`commit:${c.short}`, `${repo.label} ${c.short} at ${dayhm(c.at)}: ${c.subject}`, { type: 'git', repo: repo.label, ref: c.short }, { at: c.at, value: c.files });
    const m = /\blane ([A-Z][A-Z0-9-]*)\b/.exec(c.subject);
    if (m) {
      const k = m[1].replace(/-H\d+$/, '');
      if (!laneCommits.has(k)) laneCommits.set(k, { n: 0, repos: new Set(), ins: 0, del: 0 });
      const lc = laneCommits.get(k); lc.n++; lc.repos.add(repo.label); lc.ins += c.ins; lc.del += c.del;
    }
    allCommits.push({ repo: repo.label, ...c });
  }
}
for (const [k, v] of laneCommits) {
  fact(`git:lane:${k}`, `Lane ${k}: ${plural(v.n, 'commit', 'commits')} with the lane in the subject (${[...v.repos].join(', ')}), +${v.ins} −${v.del} lines.`, { type: 'command', ref: `git log --all --grep="lane ${k}"` }, { value: v.n });
}
if (gitSummary.length) {
  const t = gitSummary.reduce((a, r) => ({ c: a.c + r.commits, f: a.f + r.files, i: a.i + r.ins, d: a.d + r.del }), { c: 0, f: 0, i: 0, d: 0 });
  fact('git:total', `${plural(t.c, 'commit', 'commits')} in ${plural(gitSummary.length, 'repository', 'repositories')} (${gitSummary.map((r) => `${r.repo} ${r.commits}`).join(', ')}); ${t.f} file changes, +${t.i} −${t.d} lines (the sum of the commits).`, { type: 'command', ref: 'git log --shortstat (each repository above)' }, { value: t.c });
}
allCommits.sort((a, b) => a.at.localeCompare(b.at));
derived.git = gitSummary;

// ---------- Mesh notes ----------

function frontmatter(p) {
  try {
    const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(6000); const n = fs.readSync(fd, buf, 0, 6000, 0); fs.closeSync(fd);
    const s = buf.slice(0, n).toString('utf8');
    const m = /^---\n([\s\S]*?)\n---/.exec(s);
    return m ? m[1] : '';
  } catch (e) { return ''; }
}
function walk(dir, fn, filter) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn, filter);
    else if (!filter || filter(e.name)) fn(p);
  }
}
// Each note keeps the reason why collect took it.
const notes = new Map();
const addNote = (p, why) => { if (!notes.has(p)) notes.set(p, why); };
for (const n of args.note) addNote(path.resolve(root, n), 'given with --note');
// The value of orbh-fleet in a frontmatter: an inline value, an inline list, or a block list.
function fleetsOf(fm) {
  const m = /(?:^|\n)orbh-fleet:[ \t]*([^\n]*)((?:\n[ \t]+-[^\n]*)*)/.exec(fm);
  if (!m) return [];
  const inline = m[1].replace(/[\[\]"']/g, '').split(',').map((x) => x.trim()).filter(Boolean);
  const list = m[2].split('\n').map((x) => x.replace(/^[ \t]+-[ \t]*/, '').replace(/["']/g, '').trim()).filter(Boolean);
  return [...inline, ...list];
}
if (kind === 'fleet') {
  const h = args.fleet;
  const def = fleet.definition || {}, st = fleet.state || {};
  if (st.reportRef) addNote(path.resolve(root, st.reportRef), 'the report of the fleet');
  if (def.charterRef) addNote(path.resolve(root, def.charterRef), 'the charter Task of the fleet');
  const folder = path.join(root, 'Mesh', 'Notes', h);
  if (fs.existsSync(folder)) walk(folder, (p) => addNote(p, `in the folder Mesh/Notes/${h}`), (n) => n.endsWith('.md'));
  walk(path.join(root, 'Mesh'), (p) => { const fm = frontmatter(p); if (fm.includes(h) && fleetsOf(fm).includes(h)) addNote(p, `a session of the fleet edited it (orbh-fleet: ${h})`); }, (n) => n.endsWith('.md'));
}
const noteList = [];
for (const [p, why] of notes) {
  if (!fs.existsSync(p)) continue;
  const txt = fs.readFileSync(p, 'utf8');
  const body = txt.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const rel = path.relative(root, p);
  const heads = [...body.matchAll(/^#{1,2} (.+)$/gm)].map((m) => m[1].trim());
  const nTitle = path.basename(p, '.md');
  const w = L.words(body);
  noteList.push({ path: rel, title: nTitle, why, words: w, headings: heads.slice(0, 20) });
  fact(`note:${L.slug(nTitle).slice(0, 48)}`, `The Mesh note "${nTitle}" (${why}): ${w} words. Headings: ${heads.slice(0, 10).join(' · ') || '(none)'}.`, { type: 'mesh', path: rel }, { value: w });
}
derived.notes = noteList;

// ---------- Media ----------

const IMG = /\.(png|jpe?g|webp|gif|svg)$/i;
const mediaDirs = new Set(args.media.map((m) => path.resolve(root, m)));
if (kind === 'fleet') {
  const d = path.join(root, 'Media', 'Fleets', args.fleet);
  if (fs.existsSync(d)) mediaDirs.add(d);
}
const mediaOut = [];
for (const d of mediaDirs) {
  if (!fs.existsSync(d)) continue;
  const groups = new Map();
  walk(d, (p) => {
    const relTop = path.relative(d, p).split(path.sep);
    const g = relTop.length > 1 ? relTop[0] : '.';
    if (!groups.has(g)) groups.set(g, { images: [], videos: 0, other: 0 });
    const gr = groups.get(g);
    if (/\.(mp4|webm|mov)$/i.test(p)) gr.videos++;
    else if (IMG.test(p)) gr.images.push(p);
    else gr.other++;
  });
  for (const [g, gr] of groups) {
    const folder = path.relative(root, g === '.' ? d : path.join(d, g));
    gr.images.sort();
    mediaOut.push({ folder, images: gr.images.length, videos: gr.videos, other: gr.other, files: gr.images.slice(0, 2000).map((p) => path.relative(root, p)) });
    fact(`media:${L.slug(path.basename(folder))}`, `${folder}: ${plural(gr.images.length, 'image', 'images')}, ${plural(gr.videos, 'video', 'videos')}, ${plural(gr.other, 'other file', 'other files')}.`, { type: 'media', path: folder }, { value: gr.images.length });
  }
}
derived.media = mediaOut;

// ---------- Write ----------

const date = window.end ? L.fmtTime(window.end, tz).date : L.fmtTime(new Date().toISOString(), tz).date;
const sl = L.slug(title);
const dir = args.out ? path.resolve(root, args.out) : path.join(root, '.flint', 'briefs', `${date}-${sl}`);
const scope = kind === 'fleet' ? { fleet: args.fleet, task: ((fleet.definition || {}).charterRef || '').replace(/^.*\(Task\) (\d+).*$/, 'Task $1') || undefined } : {};
L.writeJSON(path.join(dir, 'facts.json'), { schema: L.FACTS_ID, collectedAt: new Date().toISOString(), kind, scope, window, facts, derived });

// A starter brief.json. Each TODO is a place that the agent fills; check refuses a TODO.
const briefPath = path.join(dir, 'brief.json');
let wroteBrief = false;
if (!fs.existsSync(briefPath)) {
  const has = (id) => ids.has(id);
  const todo = (text) => ({ type: 'callout', tone: 'warn', title: 'TODO', text });
  const stats = [];
  if (kind === 'fleet') {
    const sess = facts.find((f) => f.id === 'fleet:sessions');
    if (sess) stats.push({ value: sess.value, label: 'sessions in the fleet', evidence: ['fleet:sessions'] });
    if (has('git:total')) stats.push({ value: facts.find((f) => f.id === 'git:total').value, label: 'commits with the fleet trailer', evidence: ['git:total'] });
    if (has('fleet:window')) stats.push({ value: L.fmtDuration(facts.find((f) => f.id === 'fleet:window').value), label: 'from declare to close', evidence: ['fleet:window'] });
  }
  if (!stats.length) stats.push({ value: 'TODO', label: 'TODO: a number that matters, with its fact' });
  const SECTIONS = {
    fleet: [
      { id: 'board', title: 'The fleet at a glance', blocks: [todo('A board: one row for each lane (health, the stages, a note). Use the lane facts.')] },
      { id: 'changed', title: 'What changed', blocks: [todo('A changes block: what landed, grouped as a changelog, with a diffstat. Then before and after screenshots when the change is visible.')] },
      { id: 'failed', title: 'What failed', blocks: [todo('A failures block: symptom, cause (observed or inferred), what was tried, the state now. Then a retro block: went well, went wrong, got lucky.')] },
      { id: 'night', title: 'The night', blocks: [{ type: 'timeline', derived: 'timeline' }] },
      { id: 'lanes', title: 'The lanes', blocks: [todo('Cards: one for each lane, with a status, what it did in 2 or 3 claims, one screenshot, and the details in a part that opens.')] },
      { id: 'open', title: 'Open items', blocks: [todo('A table or claims: what is not done, who owns it, and the next step. Remove this section when nothing is open.')] },
      { id: 'verify', title: 'Check it yourself', blocks: [todo('Commands that show the proof: the fleet record, the health URLs, the smoke tests. Remove this section when there is nothing to run.')] },
    ],
    status: [
      { id: 'areas', title: 'Health by area', blocks: [todo('Cards or a board: one for each area, with a status and the reason.')] },
      { id: 'vision', title: 'The vision against what is built', blocks: [todo('A table: what the vision says, what is built, the gap, with evidence.')] },
      { id: 'proof', title: 'Proof', blocks: [todo('A gallery of screenshots that show the state now.')] },
      { id: 'gaps', title: 'Gaps and risks', blocks: [todo('Claims or failures: what is not done and what can go wrong.')] },
      { id: 'next', title: 'Next steps', blocks: [todo('Steps or claims: what comes next, in order.')] },
    ],
    architecture: [
      { id: 'map', title: 'The map', blocks: [todo('A diagram of at most 9 nodes, with 2 to 4 paths that a reader can step through.')] },
      { id: 'parts', title: 'The parts', blocks: [todo('Cards: one for each part of the map, with what it owns and where its code is.')] },
      { id: 'flows', title: 'How a request moves', blocks: [todo('Steps or a second diagram for the most important flow.')] },
      { id: 'unchecked', title: 'What this Brief did not check', blocks: [todo('Claims: the facts that are inferred or not checked live.')] },
    ],
    explainer: [
      { id: 'idea', title: 'The idea', blocks: [todo('A text and one diagram that give the idea in one view.')] },
      { id: 'steps', title: 'Step by step', blocks: [todo('Steps: how it works, in order.')] },
      { id: 'try', title: 'Try it', blocks: [todo('Commands that the reader can run, or an example.')] },
      { id: 'pitfalls', title: 'Pitfalls', blocks: [todo('Claims or failures: what goes wrong and why.')] },
    ],
  };
  const f0 = L.fmtTime(window.start || new Date().toISOString(), tz), f1 = L.fmtTime(window.end || new Date().toISOString(), tz);
  const windowText = f0.date === f1.date ? `${f0.day} ${f0.hm}–${f1.hm}` : `${f0.day} ${f0.hm} – ${f1.day} ${f1.hm}`;
  const related = noteList.filter((n) => !/orbh-fleet/.test(n.why))
    .sort((a, b) => (/report of the fleet/.test(b.why) - /report of the fleet/.test(a.why)) || (/charter/.test(b.why) - /charter/.test(a.why)))
    .slice(0, 12).map((n) => ({ label: n.title.slice(0, 80), href: n.path }));
  const brief = {
    schema: L.SCHEMA_ID,
    id: `${date}-${sl}`,
    kind,
    title,
    date,
    tz,
    eyebrow: kind === 'fleet' ? [args.fleet, scope.task, windowText].filter(Boolean) : [],
    lede: 'TODO: the bottom line in at most 3 sentences. The first screen must give the answer.',
    ledeEvidence: [],
    health: ['fleet', 'status'].includes(kind)
      ? { state: 'landed', label: 'TODO: choose landed, at-risk, or blocked, and say why in one sentence.', evidence: kind === 'fleet' && has('fleet:outcome') ? ['fleet:outcome'] : [] }
      : { state: 'info', label: 'TODO: what the reader can do after one read.', evidence: [] },
    asOf: {
      at: window.end || new Date().toISOString(),
      commits: allCommits.length ? [allCommits[allCommits.length - 1].short] : [],
      commands: kind === 'fleet' ? [`flint orbh fleet show ${args.fleet}`] : [],
    },
    stats,
    decisions: [{ id: 'todo', title: 'TODO: each decision that waits for the person, or remove this list', why: 'TODO', options: ['Yes', 'No'], recommend: 'Yes' }],
    sections: SECTIONS[kind],
    related,
    scope,
    facts: [],
  };
  L.writeJSON(briefPath, brief);
  wroteBrief = true;
}

process.stdout.write(JSON.stringify({
  ok: true,
  dir: path.relative(root, dir),
  facts: path.relative(root, path.join(dir, 'facts.json')),
  brief: path.relative(root, briefPath),
  wroteBrief,
  counts: {
    facts: facts.length,
    sessions: kind === 'fleet' ? (timeline.sessions || []).length : 0,
    lanes: lanesOut.length,
    commits: allCommits.length,
    repositories: gitSummary.map((r) => `${r.repo} ${r.commits}`),
    notes: noteList.length,
    media: mediaOut.map((m) => `${m.folder}: ${m.images} images`),
  },
  next: [
    `Read ${path.relative(root, path.join(dir, 'facts.json'))} and the notes it lists; then fill ${path.relative(root, briefPath)}`,
    `flint shard brf render "${path.relative(root, briefPath)}"`,
  ],
}, null, 2) + '\n');
