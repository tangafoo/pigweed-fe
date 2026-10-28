import { asset } from '$lib/config/assets';
import { m } from '$lib/paraglide/messages.js';

export const FARMDEX_CATEGORIES = [
	'PLANT',
	'FUNGI',
	'INSECT',
	'ARACHNID',
	'MOLLUSC',
	'AMPHIBIAN',
	'REPTILE',
	'BIRD',
	'MAMMAL'
] as const;
export type FarmdexCategory = (typeof FARMDEX_CATEGORIES)[number];

/**
 * Category colour (theme tokens), shown as a dot next to entry names. Full
 * class strings so Tailwind picks them up. Placeholder picks — tune freely.
 */
export const FARMDEX_CATEGORY_DOT: Record<FarmdexCategory, string> = {
	PLANT: 'bg-olf-sage',
	FUNGI: 'bg-olf-darkbrown',
	INSECT: 'bg-olf-chimera',
	ARACHNID: 'bg-olf-soilbrown',
	MOLLUSC: 'bg-olf-sunfadedblue',
	AMPHIBIAN: 'bg-olf-bluey',
	REPTILE: 'bg-olf-darkgreen',
	BIRD: 'bg-olf-bluey',
	MAMMAL: 'bg-olf-rose'
};

/** Localized category name. Call from a template/`$derived` so it re-reads the locale. */
export function farmdexCategoryLabel(c: FarmdexCategory): string {
	switch (c) {
		case 'PLANT':
			return m.farmdex_category_plant();
		case 'FUNGI':
			return m.farmdex_category_fungi();
		case 'INSECT':
			return m.farmdex_category_insect();
		case 'ARACHNID':
			return m.farmdex_category_arachnid();
		case 'MOLLUSC':
			return m.farmdex_category_mollusc();
		case 'AMPHIBIAN':
			return m.farmdex_category_amphibian();
		case 'REPTILE':
			return m.farmdex_category_reptile();
		case 'BIRD':
			return m.farmdex_category_bird();
		case 'MAMMAL':
			return m.farmdex_category_mammal();
	}
}

export type FarmdexEntry = {
	category: FarmdexCategory;
	commonName: string;
	scientificName: string;
	/** First image is the cover shown in the grid. */
	imageUrls: string[];
	description: string;
	/** Farm-local calendar date, `YYYY-MM-DD` (never a UTC timestamp). */
	dateRegistered: string;
	/** Optional fixed dex number; otherwise it's the entry's position in FARMDEX. */
	dexNumber?: number;
};

export const FARMDEX: FarmdexEntry[] = [
	{
		category: 'INSECT',
		commonName: 'Great Eggfly',
		scientificName: 'Hypolimnas bolina',
		imageUrls: [asset('bolina-butterfly.webp')],
		description:
			'Polka dot butterfly. Wonderful bolina bolina name. Yet to hold one - seen a few flying around.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Buddha Belly Plant',
		scientificName: 'Jatropha podagrica',
		imageUrls: [asset('buddha-belly-plant.webp')],
		description:
			'Random plant growing in the shell of a pillar rebar that looked alien. All parts of the plant are toxic apparently. Need to find out more...',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'AMPHIBIAN',
		commonName: 'Asian Painted Bullfrog',
		scientificName: 'Kaloula pulchra',
		imageUrls: [asset('bullfrog.webp')],
		description:
			'Calls like a loud, cow bellow. There are so many tadpoles now, they love making babies. A neat beige stripe on its head for identification, and likes to hide under lilypads.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'REPTILE',
		commonName: 'Equatorial Spitting Cobra',
		scientificName: 'Naja sumatrana',
		imageUrls: [asset('cobra-water.webp'), asset('snake-outta-bucket.webp')],
		description:
			"A baby one. Common in farms, but flee from humans. Shelters near man-made structures when it rains heavily - probably cause cold. Haven't seen one spit, hopefully not anytime soon. Venomous.",
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MAMMAL',
		commonName: 'Goat',
		scientificName: 'Capra hircus',
		imageUrls: [asset('triplet-goats.webp')],
		description:
			"Still don't know how to hold or pet one.. but seen friends do it like a cat, so am hopeful for a future good relation with one someday. Makes good milk.",
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MAMMAL',
		commonName: 'Sheep',
		scientificName: 'Ovis aries',
		imageUrls: [asset('cute-brown-goat-baby.webp')],
		description: 'A cute baby brown one !',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Lantana',
		scientificName: 'Lantana camara',
		imageUrls: [asset('evil-lantanas.webp')],
		description: 'I hate this plant. Thorny, rude, and grows everywhere. So toxic.',
		dateRegistered: '2026-10-28',
		dexNumber: 404
	},
	{
		category: 'MAMMAL',
		commonName: 'Cat',
		scientificName: 'Felis catus',
		imageUrls: [asset('freya-and-frangi.webp')],
		description:
			'Arrived on a wet Wednesday morning. She had flu, our resident ratcatcher (and treeshrew devourer)',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'INSECT',
		commonName: 'Ladybird',
		scientificName: 'Coccinellidae',
		imageUrls: [asset('ladybug-starburst.webp')],
		description:
			'Friendly fellas, such a delight to see every time. Crusaders that destroy annoying soft-bodied pests. Looks like my cute friend.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'BIRD',
		commonName: 'Chinese Goose',
		scientificName: 'Anser cygnoides domesticus',
		imageUrls: [asset('lilo-bamboo-geese.webp')],
		description:
			'Lilo and Bamboo. Not a fan (noisy and so aggressive). Have nice blue eyes though.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Mussaenda',
		scientificName: 'Mussaenda philippica',
		imageUrls: [asset('mussaenda-phillipa-plant.webp')],
		description:
			'My healthiest plant so far ! A leafhopper hiding under a sepal. Flowers are yellow, tiny, and star-shaped (yet to bloom) with huge pink sepals surrounding it. Soft fuzzy leaves, that turn brown quickly once cut.',
		dateRegistered: '2026-10-28',
		dexNumber: 16
	},
	{
		category: 'INSECT',
		commonName: 'Red Cotton Stainer',
		scientificName: 'Dysdercus cingulatus',
		imageUrls: [asset('red-cotton-stainer.webp')],
		description:
			'Cute markings, and so jittery when on-the-move. Not so pleasant to have when growing and maintaining Okra - Bendi (which we are).',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'INSECT',
		commonName: 'Shield Bug',
		scientificName: 'Pentatomoidea',
		imageUrls: [asset('shield-bug-hiding.webp')],
		description:
			"Shy guy. Also aptly known as ..the 'stink' bug. It releases a gross smell when threatened. Cool strong body shape tho.",
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MOLLUSC',
		commonName: 'Giant African Land Snail',
		scientificName: 'Lissachatina fulica',
		imageUrls: [asset('snail-in-pail.webp')],
		description:
			'Touched its head unclogging a pail, and definitely stepped on a few unwillingly. rip. Groovy to see its eyes retract and extend. ',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Starburst Bush',
		scientificName: 'Clerodendrum quadriloculare',
		imageUrls: [asset('starburst-in-shade.webp')],
		description:
			"Purple leaves ! Mainly lives in its roots and can absolutely shoot up from the ground more versions of itself. To propagate - cut green stems (not brown) with multiple nodes (they'll turn into roots) and place in water. Here she is taking a shady rest.",
		dateRegistered: '2026-10-28'
	},
	{
		category: 'REPTILE',
		commonName: 'Asian Water Monitor',
		scientificName: 'Varanus salvator',
		imageUrls: [asset('water-monitor-lounging-baby.webp')],
		description:
			'Baby one too. Startly fellas with an awesome aura. Great at climbing trees, and attracted to our livestock birds (including their eggs). Can grow HUGE, and should be treated more kindly.',
		dateRegistered: '2026-10-28'
	}
];

// Pinned entries keep their `dexNumber`; the rest take the lowest free
// numbers in FARMDEX order, skipping every pinned one.
const DEX_NUMBERS = (() => {
	const pinned = new Set(FARMDEX.flatMap((e) => (e.dexNumber == null ? [] : [e.dexNumber])));
	const numbers = new Map<FarmdexEntry, number>();
	let next = 1;
	for (const e of FARMDEX) {
		if (e.dexNumber != null) {
			numbers.set(e, e.dexNumber);
			continue;
		}
		while (pinned.has(next)) next++;
		numbers.set(e, next++);
	}
	return numbers;
})();

/** Dex number as `#001` — the entry's `dexNumber`, else the next free number (see DEX_NUMBERS). */
export function farmdexNumber(entry: FarmdexEntry): string {
	return `#${String(DEX_NUMBERS.get(entry)).padStart(3, '0')}`;
}

/** URL-safe id for `/farmdex?entry=…`, from the scientific name (e.g. `varanus-salvator`). */
export function farmdexSlug(entry: FarmdexEntry): string {
	return entry.scientificName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

export function farmdexBySlug(slug: string | null): FarmdexEntry | null {
	return (slug && FARMDEX.find((e) => farmdexSlug(e) === slug)) || null;
}

// Fail loudly at module load (dev, check and build all import this) so a
// duplicate dex number or slug can never ship.
function assertUnique(label: string, key: (e: FarmdexEntry) => string) {
	const seen = new Map<string, string>();
	for (const e of FARMDEX) {
		const k = key(e);
		const prev = seen.get(k);
		if (prev) throw new Error(`Farmdex: duplicate ${label} ${k} (${prev} and ${e.commonName})`);
		seen.set(k, e.commonName);
	}
}
assertUnique('dex number', farmdexNumber);
assertUnique('slug', farmdexSlug);
