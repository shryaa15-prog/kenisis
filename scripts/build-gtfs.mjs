// Usage: node scripts/build-gtfs.mjs <path-to-unzipped-gtfs-folder>
// Produces: src/data/routes.generated.js (app), server/data/network.json, server/data/fares.json.gz (server).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2];
if (!dir) { console.error('usage: node scripts/build-gtfs.mjs <gtfs-folder>'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

function parseLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}
function readCsv(name, fn) {
  const f = path.join(dir, name);
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
  const head = parseLine(lines[0]); const rows = [];
  for (let i = 1; i < lines.length; i++) { if (!lines[i]) continue; const v = parseLine(lines[i]); const o = {}; head.forEach((h, k) => o[h] = v[k]); if (fn) fn(o); else rows.push(o); }
  return rows;
}
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const mins = t => { if (!t) return null; const [h, m, s] = t.split(':').map(Number); return h * 60 + m + (s || 0) / 60; };
const hav = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const x = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const fmt = m => { const t = Math.round(m) % 1440; const h = Math.floor(t / 60), mm = t % 60; return `${String(h % 12 || 12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

console.log('reading…');
const stops = {}; readCsv('stops.txt', r => { stops[r.stop_id] = { name: clean(r.stop_name), lat: +r.stop_lat, lon: +r.stop_lon }; });
const routeInfo = {}; readCsv('routes.txt', r => { routeInfo[r.route_id] = { short: clean(r.route_short_name) || r.route_id, long: clean(r.route_long_name) }; });
const trips = {}; readCsv('trips.txt', r => { trips[r.trip_id] = r; });
const byTrip = {};
readCsv('stop_times.txt', r => { (byTrip[r.trip_id] ||= []).push({ seq: +r.stop_sequence, id: r.stop_id, t: mins(r.arrival_time || r.departure_time) }); });

const freq = {}; readCsv('frequencies.txt', r => { (freq[r.trip_id] ||= []).push({ s: mins(r.start_time), e: mins(r.end_time), h: (+r.headway_secs) / 60 }); });
// Group trips into patterns (same route + direction + stop sequence).
const pats = new Map();
for (const [tid, list] of Object.entries(byTrip)) {
  const trip = trips[tid]; if (!trip) continue;
  list.sort((a, b) => a.seq - b.seq);
  const ids = list.map(x => x.id); const first = list[0].t, last = list.at(-1).t;
  if (first == null || last == null || ids.length < 2) continue;
  const key = `${trip.route_id}|${trip.direction_id}|${ids.join('>')}`;
  const p = pats.get(key) || { route: trip.route_id, dir: trip.direction_id, ids, starts: [], durs: [], head: trip.trip_headsign };
  p.durs.push(last - first); pats.set(key, p);
  if (freq[tid]) for (const f of freq[tid]) { if (f.h > 0) for (let t = f.s; t <= f.e; t += f.h) p.starts.push(t); } else p.starts.push(first);
}
const seen = {}; const patterns = [];
[...pats.values()].sort((a, b) => b.starts.length - a.starts.length).forEach(p => {
  const base = `${p.route}_${p.dir}`; const n = seen[base] = (seen[base] ?? -1) + 1;
  const dur = Math.max(1, Math.round(median(p.durs)));
  const coords = p.ids.map(i => [stops[i]?.lat, stops[i]?.lon]);
  const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + (coords[i][0] && coords[i - 1][0] ? hav(coords[i - 1], coords[i]) : 0));
  const total = cum.at(-1);
  const offs = cum.map((c, i) => total > 0 ? dur * c / total : dur * i / (cum.length - 1));
  patterns.push({ id: n ? `${base}_${n}` : base, route: p.route, dir: p.dir, ids: p.ids, starts: [...new Set(p.starts.map(Math.round))].sort((a, b) => a - b), dur, offs: offs.map(o => Math.round(o * 10) / 10), head: clean(p.head) });
});
console.log('patterns', patterns.length);

// Fares: route → origin → dest → price (only pairs that occur on that route's patterns).
const price = {}; readCsv('fare_attributes.txt', r => { price[r.fare_id] = +r.price; });
const onRoute = {}; patterns.forEach(p => { (onRoute[p.route] ||= new Set()); p.ids.forEach(i => onRoute[p.route].add(i)); });
const fares = {}; let nf = 0;
readCsv('fare_rules.txt', r => { const s = onRoute[r.route_id]; if (!s || !s.has(r.origin_id) || !s.has(r.destination_id)) return; const pr = price[r.fare_id]; if (pr == null) return; ((fares[r.route_id] ||= {})[r.origin_id] ||= {})[r.destination_id] = pr; nf++; });
console.log('fare pairs', nf, 'routes with fares', Object.keys(fares).length);
const fareOf = (route, o, d) => fares[route]?.[o]?.[d] ?? null;

// ---- app data ----
const names = new Set();
const appRoutes = patterns.map(p => {
  const nm = p.ids.map(i => stops[i]?.name || `Stop ${i}`); nm.forEach(n => names.add(n));
  const mid = nm.slice(1, -1).filter(n => n !== nm[0] && n !== nm.at(-1));
  const via = [...new Set([mid[Math.floor(mid.length / 3)], mid[Math.floor(2 * mid.length / 3)]].filter(Boolean))].join(' · ');
  const ri = routeInfo[p.route] || { short: p.route, long: '' };
  return { id: p.id, name: ri.short, longName: ri.long || p.head, from: nm[0], to: nm.at(-1), duration: p.dur, fare: fareOf(p.route, p.ids[0], p.ids.at(-1)), changes: 0, via: via || ' ', departure: fmt(p.starts[0]), recommended: false, status: 'Scheduled', nextStop: nm[1], stops: nm.map((n, i) => ({ name: n, time: i === 0 ? 'Start' : `${Math.round(p.offs[i])} min` })), timetable: p.starts.map(fmt), startMins: p.starts };
});
fs.writeFileSync(path.join(root, 'src/data/routes.generated.js'), `// Generated by scripts/build-gtfs.mjs from the Kadamba (KTCL) GTFS feed. Do not edit.\nexport const routes=${JSON.stringify(appRoutes)};\nexport const stopNames=${JSON.stringify([...names].sort())};\n`);

// ---- server data ----
const used = new Set(patterns.flatMap(p => p.ids)); const sOut = {}; used.forEach(i => { const s = stops[i]; if (s) sOut[i] = [s.name, +s.lat.toFixed(5), +s.lon.toFixed(5)]; });
fs.writeFileSync(path.join(root, 'server/data/network.json'), JSON.stringify({ stops: sOut, patterns: patterns.map(p => ({ id: p.id, route: p.route, name: (routeInfo[p.route] || {}).short || p.route, longName: (routeInfo[p.route] || {}).long || p.head, ids: p.ids, starts: p.starts, offs: p.offs, dur: p.dur })) }));
fs.writeFileSync(path.join(root, 'server/data/fares.json.gz'), zlib.gzipSync(JSON.stringify(fares)));
console.log('done');
