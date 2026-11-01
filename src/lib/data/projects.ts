import { asset } from '$lib/config/assets';
import type { RichText } from '$lib/utils/richText';
import { assignNumbers, formatNumber } from '$lib/utils/numbering';
import { PEOPLE, type Person } from '$lib/data/people';

export type Tool = { name: string };

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
	/** Optional fixed number; otherwise the next free one in PROJECTS order (like Farmdex). */
	number?: number;
};

export const PROJECTS: Project[] = [
	{
		title: ['b', { text: 'R', marks: ['yolk'] }, 'ick n ', { text: 'M', marks: ['yolk'] }, 'orty'],
		subtitle: 'concrete and brick garden beds for bendi, watermelons, and other crops.',
		duration: 999,
		imageUrls: [asset('rubs-gy-mkaing-gardenbed.webp'), asset('gardenbed-done.webp')],
		description: [
			[
				'Before we got a mixer drill. Totally do-able by hand ',
				{ text: 'and bangla power', marks: ['italic'] },
				', completed 4/10 so far'
			],
			'Placeholder paragraph two.'
		],
		toolsUsed: [{ name: 'Bricks' }],
		people: [PEOPLE.rubz, PEOPLE.gaia]
	},
	{
		title: ['Natural ', { text: 'Pond', marks: ['blue'] }],
		subtitle: [
			'create a ',
			{ text: 'working', marks: ['underline'] },
			' ecosystem to filtrate duck & geese poop, while.. allowing aquatic plants to thrive'
		],
		duration: 999,
		imageUrls: [
			asset('natural-pond-proj.webp'),
			asset('naturalPond-04.webp'),
			asset('rubel-making-duck-pond.webp'),
			asset('natural-pondProj02.webp'),
			asset('naturalPondproj03.webp')
		],
		description: ['Placeholder paragraph.'],
		toolsUsed: [],
		people: [PEOPLE.rubz]
	},
	{
		title: [{ text: 'little people', marks: ['handwriting'] }],
		subtitle: [
			'decorate the many ',
			{ text: 'portable water barrels', marks: ['italic'] },
			' and ',
			{ text: 'empty walls', marks: ['italic', 'underline'] },
			' around the farm. Practice graffiti.'
		],
		duration: 999,
		imageUrls: [
			asset('little-people-bucket.webp'),
			asset('graffiti-proj.webp'),
			asset('graff-proj02.webp'),
			asset('graff-proj03.webp')
		],
		description: ['Placeholder paragraph.'],
		toolsUsed: [],
		people: [PEOPLE.gaf]
	}
];

// Pinned entries keep their `number`; the rest are numbered around them.
const PROJECT_NUMBERS = assignNumbers('Projects', PROJECTS, (p) => p.number);

/** Project number as `#001`. */
export function projectNumber(project: Project): string {
	return formatNumber(PROJECT_NUMBERS.get(project));
}

/** Plain project id for URLs (`/projects/3`): the same number, unpadded. */
export function projectId(project: Project): number {
	return PROJECT_NUMBERS.get(project)!;
}

export function projectById(id: number): Project | null {
	return PROJECTS.find((p) => PROJECT_NUMBERS.get(p) === id) ?? null;
}

/** How many projects a person is on. */
export function projectCount(person: Person): number {
	return PROJECTS.filter((p) => p.people.includes(person)).length;
}
