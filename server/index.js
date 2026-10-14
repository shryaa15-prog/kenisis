// Zero-dependency API server (Node 18+). Run: GEMINI_API_KEY=... node server/index.js
import http from 'node:http';
import fs from 'node:fs';
// Minimal .env loader (no dependency): reads KEY=value lines from ./.env
try { for (const l of fs.readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}

import { impl, declarations, findRoutes, searchPlaces } from './transport.js';
import { parseText, buildPlan, planSchema, planPrompt } from './plan.js';
import { stopNames, stats } from './search.js';

const PORT = process.env.PORT || 8787;
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const KEY = process.env.GEMINI_API_KEY;
const ENDPOINT = process.env.GEMINI_ENDPOINT || `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM = `You are KINESIS, a Goa public-transport assistant for tourists.
Never state routes, stops, fares, times or places from your own knowledge: always call the provided functions and use only their results.
If the data has no answer, say so plainly. Data is the Kadamba (KTCL) timetable, not live tracking; fares may be missing, say "not available" then. Be brief and friendly.
Format journeys as: Take <bus>, Board: <stop>, Get down: <stop>, Estimated journey: <n> min, Fare: ₹<n>, Next departures.`;

// Keyless fallback so the demo works offline: simple intent parse + the same verified functions.
function fallback(q) {
  const p = parseText(q);
  if (p.destination) {
    const r = findRoutes({ origin: p.origin || 'Panaji', destination: p.destination, time: p.time });
    const j = r.journeys?.[0];
    if (j) return `Take ${j.bus}\nBoard: ${j.board}\nGet down: ${j.getDownAt}\nEstimated journey: ${j.durationMin} min · Fare: ${typeof j.fareINR === 'number' ? '₹' + j.fareINR : 'not available'}\nNext departures: ${j.nextDepartures.join(', ')}${p.origin ? '' : '\n(Assuming you start from Panaji.)'}`;
    return r.note || 'No route found.';
  }
  const { places } = searchPlaces({ query: q.replace(/[?.!]/g, '').split(' ').pop() });
  if (places.length) return `You could explore: ${places.map(x => x.name).join(', ')}.`;
  return 'I can help with Goa bus routes. Try “How do I go from Panaji to Margao?”';
}

async function askGemini(question, history) {
  const contents = [...history, { role: 'user', parts: [{ text: question }] }];
  const used = [];
  for (let i = 0; i < 5; i++) {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, tools: [{ functionDeclarations: declarations }], contents }),
    });
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const content = (await r.json()).candidates?.[0]?.content;
    const parts = content?.parts || [];
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) return { answer: parts.map(p => p.text || '').join('').trim(), toolsUsed: used };
    contents.push(content);
    contents.push({ role: 'user', parts: calls.map(({ functionCall: c }) => { used.push(c.name); const fn = impl[c.name]; return { functionResponse: { name: c.name, response: { result: fn ? fn(c.args || {}) : { error: 'unknown function' } } } }; }) });
  }
  return { answer: 'Sorry, I could not complete that request.', toolsUsed: used };
}

async function parseWithGemini(text) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: planPrompt(text) }] }], generationConfig: { responseMimeType: 'application/json', responseSchema: planSchema, temperature: 0 } }) });
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const t = (await r.json()).candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
  return JSON.parse(t);
}

const ctxFrom = (lat, lon, now) => ({ here: lat && lon ? { lat: +lat, lon: +lon } : null, nowMin: now !== null && now !== '' && Number.isFinite(+now) ? +now : undefined });
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch (e) { no(e); } }); });

export async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.url === '/api/health') return send(res, 200, { ok: true, ai: !!KEY, model: KEY ? MODEL : null, ...stats });
  if (req.url === '/api/ask' && req.method === 'POST') {
    let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'invalid JSON' }); }
    const { question, history = [] } = body;
    if (typeof question !== 'string' || !question.trim() || question.length > 500) return send(res, 400, { error: 'question required (max 500 chars)' });
    if (!KEY) return send(res, 200, { answer: fallback(question), toolsUsed: [], mode: 'fallback' });
    try { return send(res, 200, { ...(await askGemini(question, history)), mode: 'gemini' }); }
    catch (e) { console.error(e.message); return send(res, 200, { answer: fallback(question), toolsUsed: [], mode: 'fallback' }); }
  }
  if (req.url.startsWith('/api/journeys') && req.method === 'GET') {
    const u = new URL(req.url, 'http://x'); const from = u.searchParams.get('from'), to = u.searchParams.get('to');
    if (!to) return send(res, 400, { error: 'to required' });
    return send(res, 200, { ...buildPlan({ origin: from || null, destination: to }, null, u.searchParams.get('when'), ctxFrom(u.searchParams.get('lat'), u.searchParams.get('lon'), u.searchParams.get('now'))), mode: 'direct' });
  }
  if (req.url === '/api/stops') return send(res, 200, { stops: stopNames });
  if (req.url === '/api/plan' && req.method === 'POST') {
    let body; try { body = await readBody(req); } catch { return send(res, 400, { error: 'invalid JSON' }); }
    const { text, defaultOrigin, when, here, nowMin } = body;
    if (typeof text !== 'string' || !text.trim() || text.length > 300) return send(res, 400, { error: 'text required (max 300 chars)' });
    let parsed, mode = 'fallback';
    if (KEY) { try { parsed = await parseWithGemini(text); mode = 'gemini'; } catch (e) { console.error(e.message); } }
    if (!parsed) parsed = parseText(text);
    return send(res, 200, { ...buildPlan(parsed, defaultOrigin, when, { here, nowMin: Number.isFinite(+nowMin) && nowMin !== null && nowMin !== '' ? +nowMin : undefined }), mode });
  }
  
  send(res, 404, { error: 'not found' });
}

if (process.env.VERCEL !== '1') {
  http.createServer(handler).listen(PORT, () => {
    console.log(
      `Kinesis API on :${PORT} (${KEY ? MODEL : 'fallback mode'})`
    );
  });
}
