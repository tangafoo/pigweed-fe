import type { PageServerLoad } from './$types';
import { fetchPlans, fetchMySubscription } from '$lib/api/subscriptions';

/**
 * Subscriptions page loader. Tiers are public (always loaded); the viewer's
 * own subscription + egg stats are loaded only when signed in. The BE is a
 * different origin, so the request cookie is forwarded explicitly.
 */
export const load: PageServerLoad = async ({ parent, request, fetch }) => {
	const { session } = await parent();
	const cookie = request.headers.get('cookie') ?? undefined;

	const [plans, mine] = await Promise.all([
		fetchPlans(fetch),
		session
			? fetchMySubscription(fetch, cookie)
			: Promise.resolve({ subscription: null, stats: null })
	]);

	return { plans, subscription: mine.subscription, stats: mine.stats };
};
