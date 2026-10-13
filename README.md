# KINESIS – Goa bus assistant (React + Node + Gemini)

Mobile-first React app with a dependency-free Node API. Journey data comes from the real **Kadamba (KTCL) GTFS feed**.

## Run
```bash
npm install
cp .env.example .env      # then put your GEMINI_API_KEY in .env (optional)
npm start                 # API on :8787 + app on :5173
```
(or `npm run server` and `npm run dev` in two terminals)

## How it works
- `scripts/build-gtfs.mjs <gtfs-folder>` converts the GTFS feed into `src/data/routes.generated.js` (app) and `server/data/network.json` + `fares.json.gz` (server). Re-run it to load a newer feed.
- `server/search.js`: stop matching (names + GPS for places without a stop, e.g. Fort Aguada, Baga, Vagator), direct buses with real departures and segment fares, and one-change trips when no direct bus exists.
- `POST /api/plan {text}`: Gemini turns "I want to travel to Margao" into origin/destination/time (JSON schema); the server then searches the timetable. Without a key a keyword parser is used.
- `POST /api/ask`: chat assistant; Gemini calls `findRoutes`, `getBusSchedule`, `getNearbyStops`, `getFare`, `searchPlaces` and never supplies transport facts itself.

## Data notes
- The feed gives times only for each trip's first and last stop; times at intermediate stops are **estimated from distance**.
- Fares exist for ~40% of routes; otherwise the app shows "Fare n/a" (nothing is invented).
- The feed's calendar ends 2025-08-01 (all services run daily); this is timetable data, **not live tracking**. GPS, payments and sign-in are not connected.

## Current location & time
If you don't name a starting point ("I want to go to Margao", "from here to Margao"), the browser's GPS position is sent with the request and the nearest bus stops become the origin. The device clock is sent as the leave time (choose Morning/Afternoon/Evening to override). A place named in the sentence or typed in FROM always wins over GPS. Geolocation needs `localhost` or HTTPS and the user's permission.
