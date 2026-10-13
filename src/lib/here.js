// Device position + clock, read in the browser when a search starts.
// getHere() -> { pos: {lat,lon} | null, reason?: 'denied'|'unavailable'|'timeout'|'insecure'|'unsupported' }
let cache = null;
export function getHere(timeoutMs = 8000) {
  if (cache && Date.now() - cache.at < 120000) return Promise.resolve({ pos: cache.pos });
  if (typeof window !== 'undefined' && window.isSecureContext === false) return Promise.resolve({ pos: null, reason: 'insecure' });
  if (!('geolocation' in navigator)) return Promise.resolve({ pos: null, reason: 'unsupported' });
  return new Promise(res => {
    let done = false;
    const fin = v => { if (done) return; done = true; if (v.pos) cache = { at: Date.now(), pos: v.pos }; res(v); };
    setTimeout(() => fin({ pos: null, reason: 'timeout' }), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      p => fin({ pos: { lat: p.coords.latitude, lon: p.coords.longitude } }),
      e => fin({ pos: null, reason: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 });
  });
}
export const deviceMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
