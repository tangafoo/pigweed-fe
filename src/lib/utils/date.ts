import { format, formatDistanceToNowStrict, formatDuration } from 'date-fns';
import { enUS, ko, zhTW, ja } from 'date-fns/locale';
import { getLocale } from '$lib/paraglide/runtime.js';

type DateLike = Date | string | number;

function toDate(d: DateLike): Date {
	return d instanceof Date ? d : new Date(d);
}

// Map paraglide locale → date-fns locale. Add new entries here whenever
// `messages/<locale>.json` gains a sibling.
function localeFor(code: string) {
	switch (code) {
		case 'ko':
			return ko;
		case 'zh':
			return zhTW;
		case 'ja':
			return ja;
		default:
			return enUS;
	}
}

/**
 * Compact relative time — "2 days ago", "2일 전". Reads the current
 * paraglide locale, so call from inside a `$derived` or template
 * expression if you need it to re-render on locale change.
 */
export function formatRelative(d: DateLike): string {
	return formatDistanceToNowStrict(toDate(d), {
		addSuffix: true,
		locale: localeFor(getLocale())
	});
}

/**
 * Absolute calendar date — "May 20, 2026", "2026년 5월 20일". Used for
 * archival surfaces (passkey added on, profile joined on) where the
 * exact day matters more than recency.
 */
export function formatDate(d: DateLike): string {
	return format(toDate(d), 'PP', { locale: localeFor(getLocale()) });
}

/** The farm's timezone (Mantin, Malaysia: UTC+8, no DST). */
export const FARM_TZ = 'Asia/Kuala_Lumpur';

/** Today on the farm as `YYYY-MM-DD`, wherever this runs (server or browser). */
export function farmToday(now = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: FARM_TZ }).format(now);
}

/**
 * Today's farm date for display — "1 Nov 2026", "2026년 11월 1일". Pinned to
 * the farm's timezone so the server render and the browser agree.
 */
export function formatFarmDate(now = new Date()): string {
	const locale = getLocale();
	return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
		timeZone: FARM_TZ,
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(now);
}

/** A `YYYY-MM-DD` as a UTC-midnight Date, for calendar maths free of timezones. */
export function ymdToUtc(ymd: string): Date {
	const [y, m, d] = ymd.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

/** A UTC-midnight Date back to `YYYY-MM-DD`. */
export function utcToYmd(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** `ymd` plus `months` calendar months, clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsYmd(ymd: string, months: number): string {
	const [y, m, d] = ymd.split('-').map(Number);
	const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
	return utcToYmd(new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))));
}

/** A `YYYY-MM-DD` for display, in the current locale ("Sat, 14 Nov 2026"). */
export function formatYmd(ymd: string, options: Intl.DateTimeFormatOptions): string {
	const locale = getLocale();
	return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
		...options,
		timeZone: 'UTC'
	}).format(ymdToUtc(ymd));
}

/** `Project.duration` sentinels — every other value is a length in days. */
export const DURATION_NOT_STARTED = 0;
export const DURATION_ONGOING = 999;

/**
 * Days → readable length — 7 → "1 week", 10 → "1 week 3 days", 45 → "1 month
 * 2 weeks 1 day" (a month is 30 days). Returns null for the sentinels so the
 * caller picks its own label for them.
 */
export function formatDays(days: number): string | null {
	if (days === DURATION_NOT_STARTED || days === DURATION_ONGOING) return null;
	return formatDuration(
		{ months: Math.floor(days / 30), weeks: Math.floor((days % 30) / 7), days: (days % 30) % 7 },
		{ locale: localeFor(getLocale()) }
	);
}
