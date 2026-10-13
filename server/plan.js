// Turns free text ("I want to travel to Margao") into origin/destination/time, then searches the GTFS network.
import { searchJourneys, resolveHere } from './search.js';

const HERE = /^(?:here|me|my (?:current |present )?(?:location|place|position)|(?:the |this )?(?:current|present) (?:location|place|position)|where i am|where i'm|this place|near me|nearby|mere paas|yahan)$/i;
const isHere = t => !t || HERE.test(t.trim());

const END = String.raw`(?:\s+(?:by|at|in|on|around|after|before|tomorrow|today|now|this|tonight|early|late)\b|[?.!,]|$)`;
export function parseText(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  let m = t.match(new RegExp(String.raw`from\s+(.+?)\s+(?:to|towards)\s+(.+?)${END}`, 'i'));
  let origin = null, destination = null;
  if (m) { origin = m[1]; destination = m[2]; }
  else if ((m = t.match(new RegExp(String.raw`(?:to|reach|visit|towards)\s+(.+?)\s+from\s+(.+?)${END}`, 'i')))) { destination = m[1]; origin = m[2]; }
  else if ((m = t.match(new RegExp(String.raw`(?:^|\b)(.+?)\s+to\s+(.+?)${END}`, 'i'))) && !/^(i|want|need|how|take|go|travel|get)\b/i.test(m[1])) { origin = m[1]; destination = m[2]; }
  else if ((m = t.match(new RegExp(String.raw`^.*\b(?:to|reach|visit|towards)\s+(.+?)${END}`, 'i')))) destination = m[1];
  const w = t.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|morning|afternoon|evening|night|noon)\b/i);
  const strip = s => s && s.replace(/^(?:the|go|travel|get|reach|visit)\s+/i, '').replace(/\s+(?:please|pls)$/i, '').trim();
  return { origin: strip(origin), destination: strip(destination), time: w ? w[1] : null };
}

export const planSchema = {
  type: 'OBJECT',
  properties: {
    origin: { type: 'STRING', nullable: true, description: 'Starting place exactly as a place name (fix spelling, e.g. Panjim->Panaji), or null if the user did not say' },
    destination: { type: 'STRING', nullable: true, description: 'Place the user wants to reach, or null' },
    time: { type: 'STRING', nullable: true, description: 'Departure time wish: "morning", "evening", "6:30 pm" etc., or null' },
  },
  required: ['origin', 'destination'],
};
export const planPrompt = text => `Extract the bus trip from this tourist message in Goa, India. The message may be in English, Hindi, Konkani or mixed. Return only place names (no words like "bus"). If the user says "here", "my location" or does not say where they start, origin must be null.\nMessage: "${text}"`;

export function buildPlan(parsed, defaultOrigin, when, ctx = {}) {
  const base = { heardOrigin: parsed.origin || null, heardDestination: parsed.destination || null, time: parsed.time || when || null, journeys: [], total: 0 };
  if (!parsed.destination) return { ...base, ok: false, message: 'Tell me where you want to go, e.g. “I want to go to Margao”.' };
  // Origin priority: place named in the sentence > From box > GPS position ("here"/nothing said).
  const named = parsed.origin && !isHere(parsed.origin) ? parsed.origin : null;
  let originText = named || (!parsed.origin ? defaultOrigin : null) || null, originRes, usedLocation = false;
  if (!originText) {
    originRes = ctx.here ? resolveHere(+ctx.here.lat, +ctx.here.lon) : null; usedLocation = !!originRes;
    if (!originRes) return { ...base, ok: false, needLocation: true, message: 'I need your starting point. Allow location access in the browser, or say e.g. “from Panaji to ' + parsed.destination + '”.' };
  }
  const r = searchJourneys(originText, parsed.destination, parsed.time || when, { originRes, now: ctx.nowMin });
  const origin = r.origin, destination = r.destination;
  const out = { ...base, leaveAt: r.leaveAt, usedLocation, origin: origin?.names?.[0] || null, destination: destination?.names?.[0] || null, originStops: origin?.names || [], destinationStops: destination?.names || [], approx: !!((origin?.approx && !usedLocation) || destination?.approx), distanceToStopKm: usedLocation ? Math.round(origin.distKm * 10) / 10 : undefined };
  if (!origin) return { ...out, ok: false, message: `I couldn't find “${originText}” on the bus network.` };
  if (!destination) return { ...out, ok: false, message: `I couldn't find “${parsed.destination}” on the bus network.` };
  if (!r.ok) return { ...out, ok: false, message: `No direct or one-change bus found from ${origin.names[0]} to ${destination.names[0]} in the timetable data.` };
  return { ...out, ok: true, total: r.total, journeys: r.journeys, message: `${r.total} bus option${r.total > 1 ? 's' : ''} from ${origin.names[0]} to ${destination.names[0]}` };
}
