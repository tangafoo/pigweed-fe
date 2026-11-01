import { m } from '$lib/paraglide/messages.js';

// The farm's current season (Mantin, Peninsular Malaysia). There's no API
// for it: MetMalaysia announces each monsoon phase's start a few days ahead
// in a press statement, and the dates shift by weeks from year to year (the
// Northeast Monsoon began 13 Nov 2025 but 27 Oct 2026). So the announced
// dates live here; when they run out, the usual months take over. Haze is
// live on top of this (see lib/server/airQuality.ts).

export type Season = 'NE_MONSOON' | 'INTER_MONSOON' | 'SW_MONSOON' | 'HAZE';

/** DOE's Air Pollutant Index scale: 101+ is "Unhealthy", what haze reports call haze. */
export const HAZE_API = 101;

/** The monsoon season, unless the live API reading near the farm says haze. */
export function currentSeason(ymd: string, api: number | null): Season {
	return api !== null && api >= HAZE_API ? 'HAZE' : seasonOn(ymd);
}

/**
 * MetMalaysia-announced phase starts, oldest first, farm-local `YYYY-MM-DD`.
 * `until` is the announced expected end; past it with no newer entry, the
 * month fallback below is used. Add each new announcement (~4 a year).
 */
const ANNOUNCED: { from: string; until: string; season: Season }[] = [
	{ from: '2025-11-13', until: '2026-03-31', season: 'NE_MONSOON' },
	{ from: '2026-03-29', until: '2026-05-13', season: 'INTER_MONSOON' },
	{ from: '2026-05-14', until: '2026-10-08', season: 'SW_MONSOON' },
	{ from: '2026-10-09', until: '2026-10-26', season: 'INTER_MONSOON' },
	{ from: '2026-10-27', until: '2027-03-31', season: 'NE_MONSOON' }
];

/**
 * MetMalaysia's usual calendar, for dates no announcement covers: Northeast
 * Monsoon Nov–Mar, inter-monsoon April to mid-May, Southwest Monsoon mid-May
 * to September, inter-monsoon October.
 */
function usualSeason(ymd: string): Season {
	const md = ymd.slice(5);
	if (md >= '11-01' || md < '04-01') return 'NE_MONSOON';
	if (md < '05-15' || md >= '10-01') return 'INTER_MONSOON';
	return 'SW_MONSOON';
}

/** Season for a farm-local `YYYY-MM-DD` date (string compare is date order). */
export function seasonOn(ymd: string): Season {
	const phase = ANNOUNCED.findLast((p) => p.from <= ymd);
	if (phase && ymd <= phase.until) return phase.season;
	return usualSeason(ymd);
}

/** Localized badge label. Call from a template/`$derived` so it re-reads the locale. */
export function seasonLabel(s: Season): string {
	switch (s) {
		case 'NE_MONSOON':
			return m.season_ne_monsoon();
		case 'INTER_MONSOON':
			return m.season_inter_monsoon();
		case 'SW_MONSOON':
			return m.season_sw_monsoon();
		case 'HAZE':
			return m.season_haze();
	}
}

/** Badge colour per season (full class strings so Tailwind picks them up). */
export const SEASON_BADGE: Record<Season, string> = {
	NE_MONSOON: 'bg-olf-blue',
	INTER_MONSOON: 'bg-olf-sunfadedblue',
	SW_MONSOON: 'bg-olf-yolk',
	HAZE: 'bg-olf-lightbrown'
};
