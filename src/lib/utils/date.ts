import { format, formatDistanceToNowStrict } from 'date-fns';
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
