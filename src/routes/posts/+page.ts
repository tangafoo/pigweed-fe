import type { PageLoad } from './$types';
import { fetchFeed } from '$lib/api/posts';

/**
 * Initial feed for the farm page — newest, all categories, unbounded (no
 * geo). Filtering by category/rating happens client-side from here on
 * (re-calls fetchFeed). The feed endpoint is public, so this renders for
 * signed-out visitors too.
 */
export const load: PageLoad = async ({ fetch }) => {
	const feed = await fetchFeed({ sort: 'newest', limit: 30 }, fetch);
	return { feed };
};
