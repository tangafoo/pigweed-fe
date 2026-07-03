import { env } from '$env/dynamic/public';
import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import type { Post, PostCount } from '@meteorclass/pigweed-contract';
import { fetchFeed } from '$lib/api/posts';

const MANTIN_LAT = 2.7;
const MANTIN_LNG = 101.93;
const API_BASE = env.PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

async function fetchWeather(fetch: typeof globalThis.fetch) {
	try {
		const url = `https://api.open-meteo.com/v1/forecast?latitude=${MANTIN_LAT}&longitude=${MANTIN_LNG}&current=temperature_2m,relative_humidity_2m`;
		const res = await fetch(url);
		if (!res.ok) return null;
		const json = (await res.json()) as {
			current: { temperature_2m: number; relative_humidity_2m: number };
		};
		return {
			temperature: Math.round(json.current.temperature_2m),
			humidity: Math.round(json.current.relative_humidity_2m)
		};
	} catch {
		return null;
	}
}

async function fetchLatestPosts(fetch: typeof globalThis.fetch): Promise<Post[]> {
	// Route through the shared feed seam so the auth cookie rides along
	// (fetchFeed sets credentials: 'include'). A bare fetch here dropped the
	// cookie on client-side navigation after login — the cross-origin
	// :5173→:3000 request went out anonymous, so every post came back with
	// myVote: null and the vote buttons rendered un-voted until a full
	// refresh (SSR's fetch forwards the cookie). fetchFeed never throws.
	const feed = await fetchFeed({ sort: 'newest', page: 1, limit: 10 }, fetch);
	return feed.posts;
}

// Total post count for the "See All (x)" link — a cheap COUNT(*) via the
// dedicated /posts/count endpoint (mirrors /users/count). Replaces the old
// hack that pulled a 200-row page just to read its length.
async function fetchPostCount(fetch: typeof globalThis.fetch): Promise<number> {
	try {
		const res = await fetch(`${API_BASE}/posts/count`);
		if (!res.ok) return 0;
		const json = (await res.json()) as PostCount;
		return json.count;
	} catch {
		return 0;
	}
}

export const load: PageLoad = async ({ fetch, setHeaders, parent }) => {
	const { session } = await parent();
	// The latest-posts strip now carries the viewer's per-user myVote when
	// signed in, so the signed-in response must NOT be shared-cached — a CDN
	// would otherwise serve one user's vote highlights (or a stale anonymous
	// render) to the next visitor. Anonymous landing stays publicly cacheable.
	setHeaders({ 'cache-control': session ? 'private, no-store' : 'public, max-age=600' });

	// Kick everything off in parallel. In the browser the promises are returned
	// UN-awaited so client-side navigation to the landing page is instant — the
	// hero/produce sections paint immediately, and the weather pills + latest
	// posts strip stream in via {#await}. On the server we still await, so a
	// direct visit SSRs the complete page (SEO, cache header above).
	const weather = fetchWeather(fetch);
	const strip = Promise.all([fetchLatestPosts(fetch), fetchPostCount(fetch)]).then(
		([posts, totalCount]) => ({ posts, totalCount })
	);

	// Random egg photo (1–4) for the "why pay more" section. Chosen in load so
	// SSR renders the final image — no onMount glimpse, no hydration mismatch.
	const eggNum = 1 + Math.floor(Math.random() * 4);

	if (browser) return { weather, strip, eggNum };
	return { weather: await weather, strip: await strip, eggNum };
};
