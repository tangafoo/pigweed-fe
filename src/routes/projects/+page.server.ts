import { PEOPLE } from '$lib/data/people';
import { shuffle } from '$lib/utils/shuffle';
import type { PageServerLoad } from './$types';

// People board order: permanent people shuffled fresh on every load, then
// helpers. A server load (runs once, result sent to the browser) so the
// hydrated order matches the server-rendered one; a universal load would
// reshuffle in the browser. Client-side visits fetch a fresh shuffle.
export const load: PageServerLoad = () => {
	const all = Object.values(PEOPLE);
	const permanent = all.filter((p) => p.role === 'PERMANENT');
	shuffle(permanent);
	return {
		peopleOrder: [...permanent, ...all.filter((p) => p.role !== 'PERMANENT')].map((p) => p.id)
	};
};
