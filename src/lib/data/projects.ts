import { asset } from '$lib/config/assets';
import type { RichText } from '$lib/utils/richText';

export type Tool = { name: string };

export const PERSON_ROLES = ['PERMANENT', 'HELPER'] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];

/** `id` is stable so people can be @-tagged later. No `imageUrl` = generic avatar icon. */
export type Person = { id: string; name: string; role?: PersonRole; imageUrl?: string };

export type Project = {
	title: RichText;
	subtitle: RichText;
	/** Days. 0 = not started yet, 999 = ongoing (see DURATION_* in utils/date). */
	duration: number;
	/** First image is the cover. */
	imageUrls: string[];
	/** One entry per paragraph. */
	description: RichText[];
	toolsUsed: Tool[];
	people: Person[];
};

export const PEOPLE = {
	rubel: { id: 'rubel', name: 'Rubel' },
	gaf: { id: 'gaf', name: 'Gaf' },
	gaia: { id: 'gaia', name: 'Gaia' }
} satisfies Record<string, Person>;

export const PROJECTS: Project[] = [
	{
		title: ['b', { text: 'R', marks: ['yolk'] }, 'ick n ', { text: 'M', marks: ['yolk'] }, 'orty'],
		subtitle: 'concrete and brick garden beds for bendi, watermelons, and other crops.',
		duration: 999,
		imageUrls: [asset('rubs-gy-mkaing-gardenbed.webp'), asset('gardenbed-done.webp')],
		description: ['Placeholder paragraph one.', 'Placeholder paragraph two.'],
		toolsUsed: [{ name: 'Bricks' }],
		people: [PEOPLE.rubel, PEOPLE.gaia]
	},
	{
		title: ['Natural ', { text: 'Pond', marks: ['blue'] }],
		subtitle: [
			'create a ',
			{ text: 'working', marks: ['underline'] },
			' ecosystem to filtrate duck & geese poop, while.. allowing aquatic plants to thrive'
		],
		duration: 999,
		imageUrls: [asset('rubel-making-duck-pond.webp')],
		description: ['Placeholder paragraph.'],
		toolsUsed: [],
		people: [PEOPLE.rubel]
	},
	{
		title: [{ text: 'little people', marks: ['handwriting'] }],
		subtitle: [
			'decorate the many ',
			{ text: 'portable water barrels', marks: ['italic'] },
			' around the farm. Practice graffitti.'
		],
		duration: 999,
		imageUrls: [asset('little-people-bucket.webp')],
		description: ['Placeholder paragraph.'],
		toolsUsed: [],
		people: [PEOPLE.gaf]
	}
];
