import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { fetchPlans } from '$lib/api/subscriptions';

/**
 * Subscriptions is just a tab on the user dashboard. Logged-in visitors are
 * sent to their own tab (which has the side menu); this flat route stays as a
 * public tier-browse entry (used by the subscribe modal / footer) for
 * logged-out visitors.
 */
export const load: PageServerLoad = async ({ parent, fetch }) => {
	const { session } = await parent();
	if (session) throw redirect(302, `/users/${session.user.id}?tab=subscription`);

	const plans = await fetchPlans(fetch);
	return { plans, subscription: null, stats: null };
};
