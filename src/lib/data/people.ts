import { asset } from '$lib/config/assets';

// Farm people, site-wide rather than owned by one page: projects tag them
// today, other pages can later. Moves to the BE eventually.

export const PERSON_ROLES = ['PERMANENT', 'HELPER'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** `id` is stable so people can be @-tagged later. No `imageUrl` = generic avatar icon. */
export type Person = {
	id: string;
	name: string;
	role?: PersonRole;
	imageUrl?: string;
	/** What they're good at, e.g. `['Masonry', 'Fabricator']`. */
	specializations?: string[];
};

export const PEOPLE = {
	rubz: {
		id: 'rubz',
		name: 'Rubz',
		role: 'HELPER',
		imageUrl: asset('rubz-avatar.webp'),
		specializations: ['Masonry', 'Fabricator']
	},
	gaf: {
		id: 'gaf',
		name: 'Gaf',
		role: 'PERMANENT',
		imageUrl: asset('gf-avatar.webp'),
		specializations: ['Arborist', 'Graffiti']
	},
	gaia: {
		id: 'gaia',
		name: 'Gaia',
		role: 'PERMANENT',
		imageUrl: asset('gaia-avatar.webp'),
		specializations: ['Horticulture', 'Soil Science']
	},
	kh: { id: 'kh', name: 'KH', role: 'PERMANENT', imageUrl: asset('kh-avatar.webp') },
	lm: {
		id: 'lm',
		name: 'LM',
		role: 'PERMANENT',
		imageUrl: asset('klm-avatar.webp'),
		specializations: ['Aviculturist', 'Poultryist']
	},
	cwaka: { id: 'cwaka', name: 'Cwaka', role: 'PERMANENT', imageUrl: asset('cwaka-avatar.webp') }
} satisfies Record<string, Person>;
