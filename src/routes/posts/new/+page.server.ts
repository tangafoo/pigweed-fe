import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Posting requires an account. Redirect strangers to /login so the form
 * never renders for someone whose POST /posts would 401.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { session } = await parent();
	if (!session) throw redirect(302, '/login');
	return {};
};
