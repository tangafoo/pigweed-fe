import type { LayoutServerLoad } from './$types';
import { getSessionFromCookie } from '$lib/api/auth';

/**
 * Resolve the session once, server-side, before any page renders — so
 * routes get `data.session` with no client-side flash. Cookie is
 * forwarded manually because the backend is a different origin.
 */
export const load: LayoutServerLoad = async ({ request }) => {
	const session = await getSessionFromCookie(request.headers.get('cookie') ?? '');
	return { session };
};
