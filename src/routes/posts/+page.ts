import { browser } from '$app/environment';
import type { PageLoad } from './$types';
import { fetchFeed } from '$lib/api/posts';

/**
 * Initial feed for the farm page — newest, all categories, unbounded (no
 * geo). Filtering by category/rating happens client-side from here on
 * (re-calls fetchFeed). The feed endpoint is public, so this renders for
 * signed-out visitors too.
 *
 * In the browser the promise is returned UN-awaited so client-side
 * navigation ("See all" from the home strip) completes instantly and the
 * posts stream into the page via {#await}. On the server we still await,
 * so a direct visit SSRs the full feed (SEO + no content flash).
 */
export const load: PageLoad = async ({ fetch }) => {
	const feed = fetchFeed({ sort: 'newest', limit: 30 }, fetch);
	return { feed: browser ? feed : await feed };
};
