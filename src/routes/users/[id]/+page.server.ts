import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserProfile } from '$lib/api/users';
import { fetchPlans, fetchMySubscription } from '$lib/api/subscriptions';

/**
 * Public profile loader. Posts/activity/achievements lazy-load their own
 * endpoints client-side. For the OWNER we also load the subscription dashboard
 * data so the "Subscription" side-menu tab renders. The BE is a different
 * origin, so the request cookie is forwarded explicitly.
 */
export const load: PageServerLoad = async ({ params, parent, request, fetch }) => {
	const { session } = await parent();
	const cookie = request.headers.get('cookie') ?? undefined;

	const profile = await getUserProfile(params.id, cookie);
	if (!profile) throw error(404, 'No such user');

	const isOwner = session?.user.id === params.id;

	const [plans, mine] = isOwner
		? await Promise.all([fetchPlans(fetch), fetchMySubscription(fetch, cookie)])
		: [[], { subscription: null, stats: null }];

	return {
		profile,
		isOwner,
		coinBalance: isOwner ? (session?.user.coinBalance ?? null) : null,
		plans,
		subscription: mine.subscription,
		stats: mine.stats
	};
};
