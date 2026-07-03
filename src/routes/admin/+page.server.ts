import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	fetchAdminUsers,
	fetchAdminStats,
	fetchAdminPlans,
	fetchAdminBenefits,
	fetchAdminBoxes
} from '$lib/api/admin';

/**
 * Admin panel loader. Admin-ness lives on the BE (User.isAdmin) and isn't in
 * the session, so we probe an admin endpoint with the forwarded cookie:
 *  - signed out → bounce to /login
 *  - signed in but not admin (403) → 404 (don't reveal the panel exists)
 * Then load the table + catalogs server-side for a populated first paint.
 */
export const load: PageServerLoad = async ({ parent, request, fetch, url }) => {
	const { session } = await parent();
	if (!session) throw redirect(302, '/login');

	const cookie = request.headers.get('cookie') ?? undefined;
	const q = url.searchParams.get('q') ?? '';
	const orderedOn = url.searchParams.get('orderedOn') ?? '';
	const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));

	// Fire all four together — the users call still acts as the admin probe
	// (the others just 403 harmlessly alongside it if the viewer isn't admin),
	// but a real admin saves a full sequential round-trip.
	const [usersRes, stats, plans, benefits, boxes] = await Promise.all([
		fetchAdminUsers(q, page, orderedOn, fetch, cookie),
		fetchAdminStats(fetch, cookie),
		fetchAdminPlans(fetch, cookie),
		fetchAdminBenefits(fetch, cookie),
		fetchAdminBoxes(fetch, cookie)
	]);
	if (!usersRes.ok && (usersRes.status === 401 || usersRes.status === 403)) {
		throw error(404, 'Not found');
	}

	return {
		q,
		orderedOn,
		page,
		users: usersRes.data.users,
		total: usersRes.data.total,
		stats: stats.data,
		plans: plans.data.plans,
		benefits: benefits.data.benefits,
		boxes: boxes.data.boxes
	};
};
