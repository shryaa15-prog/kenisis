// Journey search over the real KTCL GTFS network (server/data, built by scripts/build-gtfs.mjs).
import fs from 'node:fs';
import zlib from 'node:zlib';

const read = f => new URL(f, import.meta.url);
const net = JSON.parse(fs.readFileSync(read('./data/network.json'), 'utf8'));
const fares = JSON.parse(zlib.gunzipSync(fs.readFileSync(read('./data/fares.json.gz'))).toString());

export const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const nameOf = id => net.stops[id]?.[0] || `Stop ${id}`;
const stopNorm = {}; Object.keys(net.stops).forEach(id => { stopNorm[id] = norm(nameOf(id)); });
const byName = new Map(); // normalized name -> {name, ids:Set}
for (const id of Object.keys(net.stops)) { const k = stopNorm[id]; const e = byName.get(k) || { name: nameOf(id).replace(/\s+/g, ' ').trim(), ids: new Set() }; e.ids.add(id); byName.set(k, e); }
export const stopNames = [...byName.values()].map(e => e.name).sort();

// Tourist places without their own stop -> nearest served stop (flagged "approx" in results).
const ALIASES = {
  fontainhas: 'Fountainhas',
  'basilica of bom jesus': 'Old Goa', 'bom jesus': 'Old Goa', 'se cathedral': 'Old Goa',
  'dudhsagar falls': 'Dudhsagar Hotel', 'palolem': 'Palolem Beach',
  panjim: 'Panaji KTC Bus Stand', panaji: 'Panaji KTC Bus Stand', madgaon: 'Margao KTC Bus Stand', margao: 'Margao KTC Bus Stand',
  mapusa: 'Mapusa KTC Bus Stand', vasco: 'Vasco KTC Bus Stand', ponda: 'Ponda KTC Bus Stand', airport: 'Dabolim Airport', 'goa airport': 'Dabolim Airport', 'dabolim airport': 'Dabolim Airport',
};

// Famous places that have no stop of their own (or whose name clashes with a village elsewhere):
// matched to the nearest real bus stops by GPS (approximate coordinates, radius in km).
const PLACES = {
  'fort aguada': [15.4925, 73.7737], aguada: [15.4925, 73.7737], baga: [15.5553, 73.7517], 'baga beach': [15.5553, 73.7517],
  vagator: [15.6003, 73.7391], 'vagator beach': [15.6003, 73.7391], 'chapora fort': [15.6050, 73.7370], anjuna: [15.5736, 73.7411], 'anjuna beach': [15.5736, 73.7411],
  'bom jesus': [15.5009, 73.9115], 'basilica of bom jesus': [15.5009, 73.9115], arambol: [15.6869, 73.7040], 'arambol beach': [15.6869, 73.7040],
  'dona paula': [15.4528, 73.8057], 'calangute beach': [15.5438, 73.7553], 'sinquerim beach': [15.4930, 73.7690],
};
const hav = (a, b) => { const r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const x = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
function nearStops(c, radiusKm = 1.5) {
  const hits = Object.entries(net.stops).map(([id, s]) => [id, hav(c, [s[1], s[2]])]).filter(h => h[1] <= radiusKm).sort((a, b) => a[1] - b[1]);
  if (!hits.length) return null;
  const names = [...new Set(hits.map(h => nameOf(h[0]).replace(/\s+/g, ' ')))].slice(0, 4);
  const keep = new Set(names.map(norm));
  return { names, ids: new Set(hits.filter(h => keep.has(stopNorm[h[0]])).map(h => h[0])), approx: true, distKm: hits[0][1] };
}
// Passenger's GPS position -> nearest bus stops (widening search up to 15 km).
export function resolveHere(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  for (const r of [0.4, 0.8, 1.5, 3, 6, 15]) { const x = nearStops([lat, lon], r); if (x) return { ...x, here: true }; }
  return null;
}

// text -> {names:[...], ids:Set, approx:boolean} or null
export function resolve(text) {
  const q = norm(text); if (!q) return null;
  if (PLACES[q]) { const r = nearStops(PLACES[q]) || nearStops(PLACES[q], 4); if (r) return r; }
  const alias = ALIASES[q];
  if (alias && byName.has(norm(alias))) { const e = byName.get(norm(alias)); return { names: [e.name], ids: e.ids, approx: false }; }
  if (byName.has(q)) { const e = byName.get(q); return { names: [e.name], ids: e.ids, approx: false }; }
  const bus = byName.get(`${q} ktc bus stand`); if (bus) return { names: [bus.name], ids: bus.ids, approx: false };
  const qt = q.split(' ');
  const hits = [...byName.entries()].filter(([k]) => { const t = k.split(' '); return qt.every(w => t.some(x => x.startsWith(w))); })
    .sort((a, b) => a[0].split(' ').length - b[0].split(' ').length || a[0].length - b[0].length).slice(0, 6);
  if (!hits.length) return null;
  return { names: hits.map(h => h[1].name), ids: new Set(hits.flatMap(h => [...h[1].ids])), approx: false };
}

const fmt = m => { const t = ((Math.round(m) % 1440) + 1440) % 1440; const h = Math.floor(t / 60), mm = t % 60; return `${String(h % 12 || 12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
export function nowMinutesIST() { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()); return +p.find(x => x.type === 'hour').value % 24 * 60 + +p.find(x => x.type === 'minute').value; }
// "morning", "evening", "6:30 pm", "18:30" -> minutes of day (null = now)
export function parseWhen(w) {
  if (!w) return null; const s = String(w).toLowerCase().trim(); if (!s || s === 'now') return null;
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m && (m[2] || m[3])) { let h = +m[1]; if (m[3] === 'pm' && h < 12) h += 12; if (m[3] === 'am' && h === 12) h = 0; return h * 60 + +(m[2] || 0); }
  return { morning: 7 * 60, noon: 12 * 60, afternoon: 14 * 60, evening: 18 * 60, night: 21 * 60 }[Object.keys({ morning: 1, noon: 1, afternoon: 1, evening: 1, night: 1 }).find(k => s.includes(k))] ?? null;
}

const fareOf = (route, a, b) => fares[route]?.[a]?.[b] ?? null;
const addFares = (x, y) => (x == null || y == null) ? null : x + y;
const legAt = (p, i, j) => ({ p, i, j, dur: Math.max(1, Math.round(p.offs[j] - p.offs[i])), fare: fareOf(p.route, p.ids[i], p.ids[j]), deps: p.starts.map(s => s + p.offs[i]).sort((a, b) => a - b) });
function nextDeps(deps, from, n = 4) { const later = deps.filter(d => d >= from); return later.length ? { list: later.slice(0, n), tomorrow: false } : { list: deps.slice(0, n), tomorrow: true }; }

function directLegs(O, D) {
  const out = [];
  for (const p of net.patterns) {
    const i = p.ids.findIndex(id => O.has(id)); if (i < 0) continue;
    const j = p.ids.findIndex((id, k) => k > i && D.has(id)); if (j < 0) continue;
    out.push(legAt(p, i, j));
  }
  return out;
}

export function searchJourneys(originText, destText, when, opts = {}) {
  const O = opts.originRes || resolve(originText), D = resolve(destText);
  if (!O || !D) return { ok: false, origin: O, destination: D, journeys: [], reason: !D ? 'destination' : 'origin' };
  const from = parseWhen(when) ?? (Number.isFinite(opts.now) ? opts.now : nowMinutesIST());
  const legs = directLegs(O.ids, D.ids);
  // merge duplicate patterns of the same bus between the same two stops
  const merged = new Map();
  for (const l of legs) {
    const k = `${l.p.name}|${nameOf(l.p.ids[l.i])}|${nameOf(l.p.ids[l.j])}`; const m = merged.get(k);
    if (!m) merged.set(k, { ...l, deps: [...l.deps] }); else { m.deps = [...new Set([...m.deps, ...l.deps])].sort((a, b) => a - b); if (l.dur < m.dur) m.dur = l.dur; if (m.fare == null) m.fare = l.fare; }
  }
  let journeys = [...merged.values()].map(l => {
    const nd = nextDeps(l.deps, from), { p } = l;
    return { id: p.id, name: p.name, longName: p.longName, from: nameOf(p.ids[l.i]).replace(/\s+/g, ' '), to: nameOf(p.ids[l.j]).replace(/\s+/g, ' '), duration: l.dur, fare: l.fare, changes: 0, via: l.j - l.i === 1 ? 'Non-stop' : `${l.j - l.i - 1} stops between`,
      departure: fmt(nd.list[0]) + (nd.tomorrow ? ' (next day)' : ''), status: 'Scheduled', timetable: nd.list.map(fmt), nextDepartures: nd.list.map(fmt), arrivalAt: fmt(nd.list[0] + l.dur),
      _score: (nd.tomorrow ? 1440 : 0) + (nd.list[0] - from) + l.dur };
  });
  if (!journeys.length && !opts.noTransfer) journeys = transferJourneys(O.ids, D.ids, from);
  journeys.sort((a, b) => a._score - b._score);
  const total = journeys.length;
  return { ok: total > 0, leaveAt: fmt(from), origin: O, destination: D, total, journeys: journeys.slice(0, opts.limit || 15).map(({ _score, ...j }) => j), reason: total ? undefined : 'no-route' };
}

function transferJourneys(O, D, from) {
  const idx = new Map(); // normalized stop name -> [{p, m}]
  net.patterns.forEach(p => p.ids.forEach((id, m) => { const k = stopNorm[id]; (idx.get(k) || idx.set(k, []).get(k)).push({ p, m }); }));
  const best = new Map();
  for (const A of net.patterns) {
    const i = A.ids.findIndex(id => O.has(id)); if (i < 0) continue;
    const depA = nextDeps(A.starts.map(s => s + A.offs[i]).sort((a, b) => a - b), from, 1).list[0];
    for (let k = i + 1; k < A.ids.length; k++) {
      const arrA = depA + (A.offs[k] - A.offs[i]);
      for (const { p: B, m } of idx.get(stopNorm[A.ids[k]]) || []) {
        if (B === A || B.route === A.route) continue;
        const j = B.ids.findIndex((id, q) => q > m && D.has(id)); if (j < 0) continue;
        const depB = B.starts.map(s => s + B.offs[m]).filter(t => t >= arrA).sort((a, b) => a - b)[0]; if (depB == null || depB - arrA > 240) continue;
        const arrive = depB + (B.offs[j] - B.offs[m]); const key = `${A.name}|${B.name}`;
        if (!best.has(key) || best.get(key).arrive > arrive) best.set(key, { A, B, i, k, m, j, depA, arrA, depB, arrive });
      }
    }
  }
  return [...best.values()].sort((x, y) => x.arrive - y.arrive).slice(0, 8).map(t => {
    const f1 = fareOf(t.A.route, t.A.ids[t.i], t.A.ids[t.k]), f2 = fareOf(t.B.route, t.B.ids[t.m], t.B.ids[t.j]);
    const at = nameOf(t.A.ids[t.k]).replace(/\s+/g, ' ');
    return { id: t.A.id, name: `${t.A.name} + ${t.B.name}`, longName: `${t.A.longName} → ${t.B.longName}`, from: nameOf(t.A.ids[t.i]).replace(/\s+/g, ' '), to: nameOf(t.B.ids[t.j]).replace(/\s+/g, ' '), duration: Math.round(t.arrive - t.depA), fare: addFares(f1, f2), changes: 1,
      via: `Change at ${at}`, departure: fmt(t.depA), status: 'Scheduled', timetable: [fmt(t.depA), fmt(t.depB)], nextDepartures: [fmt(t.depA)], arrivalAt: fmt(t.arrive), _score: t.arrive - from,
      legs: [{ bus: t.A.name, from: nameOf(t.A.ids[t.i]), to: at, departs: fmt(t.depA), arrives: fmt(t.arrA) }, { bus: t.B.name, from: nameOf(t.B.ids[t.m]), to: nameOf(t.B.ids[t.j]), departs: fmt(t.depB), arrives: fmt(t.arrive) }] };
  });
}

export function patternsFor(routeIdOrName) {
  const k = String(routeIdOrName).toLowerCase();
  return net.patterns.filter(p => p.id.toLowerCase() === k || p.route.toLowerCase() === k || p.name.toLowerCase() === k);
}
export const stopName = nameOf;
export function routesAtStop(text) {
  const r = resolve(text); if (!r) return { names: [], routes: [] };
  const routes = net.patterns.filter(p => p.ids.some(id => r.ids.has(id))).map(p => ({ routeId: p.id, name: p.name, longName: p.longName }));
  return { names: r.names, routes: routes.slice(0, 30) };
}
export const fareBetween = (routeId, a, b) => { const p = patternsFor(routeId)[0]; const A = resolve(a), B = resolve(b); if (!p || !A || !B) return null; const i = p.ids.findIndex(id => A.ids.has(id)); const j = p.ids.findIndex((id, k) => k > i && B.ids.has(id)); return i < 0 || j < 0 ? null : fareOf(p.route, p.ids[i], p.ids[j]); };
export const stats = { patterns: net.patterns.length, stops: Object.keys(net.stops).length };
