// Shared browser-geolocation helper. The hyperlocal feed and the new-post
// form both need "where is the viewer right now" with the same caveats:
// desktop CoreLocation is flaky (hangs / kCLErrorLocationUnknown even when
// permitted), so we use a short timeout and let callers decide the fallback
// (both fall back to the farm coords). User geo is NEVER persisted — it's
// passed per-request only. See pigweed-be/CLAUDE.md geo model.

export type LatLng = { lat: number; lng: number };

export function getViewerPosition(): Promise<LatLng> {
	return new Promise((resolve, reject) => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			reject(new Error('geolocation unavailable'));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			(pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
			reject,
			// Short timeout — we'd rather drop to the caller's fallback fast than
			// spin on a hotspot/VPN where CoreLocation just stalls.
			{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
		);
	});
}

// Great-circle (Haversine) distance in km between two points. Used to show
// "~N km away" on a card relative to the viewer — purely client-side, the
// post's coords are already in the payload.
export function distanceKm(a: LatLng, b: LatLng): number {
	const R = 6371; // earth radius, km
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}
