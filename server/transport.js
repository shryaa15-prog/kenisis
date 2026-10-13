// Source of truth for transport facts. Gemini never invents these; it calls these functions.
import { places } from '../src/data/extras.js';
import { searchJourneys, patternsFor, stopName, routesAtStop, fareBetween, norm } from './search.js';

const brief = j => ({ routeId: j.id, bus: j.name, board: j.from, getDownAt: j.to, changes: j.changes, durationMin: j.duration, fareINR: j.fare ?? 'not available', nextDepartures: j.nextDepartures, change: j.changes ? j.via : undefined, legs: j.legs });

export function findRoutes({ origin, destination, time }) {
  const r = searchJourneys(origin, destination, time, { limit: 5 });
  if (!r.ok) return { count: 0, note: r.reason === 'no-route' ? 'No direct or one-change route found in the data.' : `Could not find the ${r.reason} on the network.` };
  return { count: r.total, matchedOrigin: r.origin.names, matchedDestination: r.destination.names, approximateMatch: r.origin.approx || r.destination.approx, journeys: r.journeys.map(brief) };
}
export function getBusSchedule({ routeId }) {
  const p = patternsFor(routeId)[0]; if (!p) return { error: `Unknown route ${routeId}` };
  const fmt = m => { const t = Math.round(m) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
  return { routeId: p.id, bus: p.name, name: p.longName, durationMin: p.dur, stops: p.ids.slice(0, 40).map(stopName), departuresFromFirstStop: p.starts.slice(0, 30).map(fmt) };
}
export function getNearbyStops({ location }) { return routesAtStop(location); }
export function getFare({ routeId, origin, destination }) { const f = fareBetween(routeId, origin, destination); return f == null ? { fareINR: 'not available in the data' } : { routeId, fareINR: f }; }
export function searchPlaces({ query }) {
  const q = norm(query);
  return { places: places.filter(p => norm(`${p.name} ${p.type} ${p.area} ${p.desc}`).includes(q)).map(({ name, type, area, desc }) => ({ name, type, area, desc })) };
}
export const impl = { findRoutes, getBusSchedule, getNearbyStops, getFare, searchPlaces };

const str = { type: 'string' };
export const declarations = [
  { name: 'findRoutes', description: 'Find bus journeys (direct or one change) between two places in Goa, with departures, duration and fare. Optional time such as "morning" or "6:30 pm".', parameters: { type: 'object', properties: { origin: str, destination: str, time: str }, required: ['origin', 'destination'] } },
  { name: 'getBusSchedule', description: 'Get stops and departure times for a route id or bus number.', parameters: { type: 'object', properties: { routeId: str }, required: ['routeId'] } },
  { name: 'getNearbyStops', description: 'List buses that serve a stop or place name.', parameters: { type: 'object', properties: { location: str }, required: ['location'] } },
  { name: 'getFare', description: 'Fare in INR for a bus between two stops.', parameters: { type: 'object', properties: { routeId: str, origin: str, destination: str }, required: ['routeId', 'origin', 'destination'] } },
  { name: 'searchPlaces', description: 'Search tourist places to explore in Goa.', parameters: { type: 'object', properties: { query: str }, required: ['query'] } },
];
