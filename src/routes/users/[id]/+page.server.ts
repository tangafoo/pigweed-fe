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

	const isOwner = session?.user.id === params.id;

	// The subscription data doesn't depend on the profile — fetch everything
	// in one parallel round instead of profile-then-subscription.
	const [profile, [plans, mine]] = await Promise.all([
		getUserProfile(params.id, cookie),
		isOwner
			? Promise.all([fetchPlans(fetch), fetchMySubscription(fetch, cookie)])
			: Promise.resolve([[], { subscription: null, stats: null }] as [
					never[],
					{ subscription: null; stats: null }
				])
	]);
	if (!profile) throw error(404, 'No such user');

	return {
		profile,
		isOwner,
		coinBalance: isOwner ? (session?.user.coinBalance ?? null) : null,
		plans,
		subscription: mine.subscription,
		stats: mine.stats
	};
};
