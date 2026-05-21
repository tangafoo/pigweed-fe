import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserProfile } from '$lib/api/users';

/**
 * Public profile loader. Achievements + votes are NOT fetched here — each
 * profile tab lazy-loads its own endpoint client-side. The BE is a different
 * origin, so the request cookie is forwarded explicitly.
 */
export const load: PageServerLoad = async ({ params, parent, request }) => {
	const { session } = await parent();
	const cookie = request.headers.get('cookie') ?? undefined;

	const profile = await getUserProfile(params.id, cookie);
	if (!profile) throw error(404, 'No such user');

	return {
		profile,
		isOwner: session?.user.id === params.id
	};
};
