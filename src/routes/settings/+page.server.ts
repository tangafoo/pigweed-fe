import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * Settings is signed-in only. Redirect strangers to /login so the UI
 * never flashes a passkey list it can't fetch.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const { session } = await parent();
	if (!session) throw redirect(302, '/login');
	return {};
};
