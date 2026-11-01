// Live air quality near the farm, from the Department of Environment's
// APIMS (the official Air Pollutant Index, hourly). It's the ArcGIS layer
// behind eqms.doe.gov.my/APIMS/main; its CORS only allows DOE's own sites,
// so it's fetched here on the server. The haze threshold is HAZE_API in
// lib/data/seasons.ts. Nilai is the closest station to
// Mantin (~10 km; Seremban ~12 km).
const APIMS_URL =
	'https://eqms.doe.gov.my/api3/publicmapproxy/PUBLIC_DISPLAY/CAQM_MCAQM_Current_Reading/MapServer/0/query' +
	"?where=STATION_LOCATION%20LIKE%20'Nilai%25'&outFields=API&f=json";

// One reading per isolate for 15 min: it only changes hourly, and this
// keeps page loads from hammering a government server.
const TTL_MS = 15 * 60 * 1000;
let cached: { at: number; api: number | null } | undefined;

/** Nilai's current API, or null if APIMS is down/slow (cosmetic: never throws). */
export async function nearbyApi(fetch: typeof globalThis.fetch): Promise<number | null> {
	if (cached && Date.now() - cached.at < TTL_MS) return cached.api;
	let api: number | null = null;
	try {
		const res = await fetch(APIMS_URL, { signal: AbortSignal.timeout(3000) });
		if (res.ok) {
			const body = (await res.json()) as { features?: { attributes: { API: number } }[] };
			const value = body.features?.[0]?.attributes.API;
			api = typeof value === 'number' && value >= 0 ? value : null;
		}
	} catch {
		// Down or slow: no haze badge this time.
	}
	cached = { at: Date.now(), api };
	return api;
}
