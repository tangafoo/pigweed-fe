import { env } from '$env/dynamic/public';
import { asset } from '$lib/assets';

/**
 * Public, canonical origin used to build absolute URLs for `<link rel="canonical">`,
 * `og:url`, JSON-LD, and the sitemap. Defaults to the production domain; override
 * via `PUBLIC_SITE_URL` in any non-prod environment that should advertise itself
 * (e.g. a preview deployment) — leave it unset to keep SEO pointed at production.
 */
export const SITE_URL = (env.PUBLIC_SITE_URL ?? 'https://ourlittlefarm.club').replace(/\/$/, '');

export const SITE_NAME = 'Our Little Farm';

export const SITE_TAGLINE =
	'Sustainable farm in Mantin, Negeri Sembilan. Hand-gathered eggs, peak-picked fruit, and seasonal greens — delivered fresh to KL every Thursday.';

// Drop a 1200×630 og-cover.jpg into the R2 assets bucket and this picks it up.
export const SITE_OG_IMAGE = asset('og-cover.jpg');

export const MANTIN_COORDS = { lat: 2.7, lng: 101.93 } as const;

export const absoluteUrl = (path: string): string => {
	if (/^https?:\/\//.test(path)) return path;
	const normalized = path.startsWith('/') ? path : `/${path}`;
	return `${SITE_URL}${normalized}`;
};
