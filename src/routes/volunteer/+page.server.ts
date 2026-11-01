import { PEOPLE, type Person } from '$lib/data/people';
import { shuffle } from '$lib/utils/shuffle';
import type { PageServerLoad } from './$types';

// People list order, shuffled fresh on every load. A server load (like
// Projects' board) so the hydrated order matches the server-rendered one.
// Only people with a specialization are listed (the rest stay hidden).
export const load: PageServerLoad = () => ({
	peopleOrder: shuffle(
		(Object.values(PEOPLE) as Person[]).filter((p) => p.specializations?.length)
	).map((p) => p.id)
});
