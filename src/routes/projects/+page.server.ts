import { PEOPLE } from '$lib/data/projects';
import type { PageServerLoad } from './$types';

// People board order: permanent people shuffled fresh on every load, then
// helpers. A server load (runs once, result sent to the browser) so the
// hydrated order matches the server-rendered one; a universal load would
// reshuffle in the browser. Client-side visits fetch a fresh shuffle.
export const load: PageServerLoad = () => {
	const all = Object.values(PEOPLE);
	const permanent = all.filter((p) => p.role === 'PERMANENT');
	for (let i = permanent.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[permanent[i], permanent[j]] = [permanent[j], permanent[i]];
	}
	return {
		peopleOrder: [...permanent, ...all.filter((p) => p.role !== 'PERMANENT')].map((p) => p.id)
	};
};
