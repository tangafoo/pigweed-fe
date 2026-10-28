import { asset } from '$lib/config/assets';
import { m } from '$lib/paraglide/messages.js';

export const FARMDEX_CATEGORIES = [
	'PLANT',
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
	INSECT: 'bg-olf-yolk',
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
			'A velvety black butterfly with white, purple-glinting spots on each wing. Males are fiercely territorial and will chase off rivals from a favourite perch.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Buddha Belly Plant',
		scientificName: 'Jatropha podagrica',
		imageUrls: [asset('buddha-belly-plant.webp')],
		description:
			'Named for its swollen, bottle-shaped trunk. Sends up clusters of coral-red flowers on long stalks almost all year. All parts of the plant are toxic.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'AMPHIBIAN',
		commonName: 'Asian Painted Bullfrog',
		scientificName: 'Kaloula pulchra',
		imageUrls: [asset('bullfrog.webp')],
		description:
			'A round, chunky frog with a pale band down each side. Spends the day buried or hidden and comes out after rain, calling with a loud, cow-like bellow.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'REPTILE',
		commonName: 'Equatorial Spitting Cobra',
		scientificName: 'Naja sumatrana',
		imageUrls: [asset('cobra-water.webp'), asset('snake-outta-bucket.webp')],
		description:
			'A glossy black cobra that can spit venom toward the eyes of a threat. Venomous — keep your distance and let it move along on its own.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MAMMAL',
		commonName: 'Goat',
		scientificName: 'Capra hircus',
		imageUrls: [asset('cute-brown-goat-baby.webp'), asset('triplet-goats.webp')],
		description:
			'The farm herd. Curious, clever, and always looking for something to nibble — including things that are not food.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Lantana',
		scientificName: 'Lantana camara',
		imageUrls: [asset('evil-lantanas.webp')],
		description:
			'Bright orange-and-yellow flower clusters that butterflies love. Also an aggressive invasive weed, and its leaves and berries are toxic to livestock.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MAMMAL',
		commonName: 'Cat',
		scientificName: 'Felis catus',
		imageUrls: [asset('freya-and-frangi.webp')],
		description: 'The farm cat. Head scratches accepted.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'INSECT',
		commonName: 'Ladybird Beetle',
		scientificName: 'Coccinellidae',
		imageUrls: [asset('ladybug-starburst.webp')],
		description:
			'A small, shiny red beetle with black spots. A gardener’s friend — most ladybirds eat aphids and other soft pests.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'BIRD',
		commonName: 'Chinese Goose',
		scientificName: 'Anser cygnoides domesticus',
		imageUrls: [asset('lilo-bamboo-geese.webp')],
		description: 'The farm geese. Loud, nosy, and excellent guards — nobody arrives unannounced.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Philippine Mussaenda',
		scientificName: 'Mussaenda philippica',
		imageUrls: [asset('mussaenda-phillipa-plant.webp')],
		description:
			'A tropical shrub whose showy colour comes from enlarged leaf-like sepals, not the tiny true flowers tucked between them.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'INSECT',
		commonName: 'Red Cotton Stainer',
		scientificName: 'Dysdercus cingulatus',
		imageUrls: [asset('red-cotton-stainer.webp')],
		description:
			'A slim red-and-black true bug that feeds on seeds of the hibiscus family. Named for the stains it leaves on cotton fibre.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'INSECT',
		commonName: 'Shield Bug',
		scientificName: 'Pentatomoidea',
		imageUrls: [asset('shield-bug-hiding.webp')],
		description:
			'A shield-shaped true bug with a banded orange-and-black edge. Releases a strong smell when disturbed, hence its other name: stink bug.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'MOLLUSC',
		commonName: 'Giant African Land Snail',
		scientificName: 'Lissachatina fulica',
		imageUrls: [asset('snail-in-pail.webp')],
		description:
			'A large land snail that comes out in damp weather. Invasive and a hungry garden pest — wash your hands after handling one.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'PLANT',
		commonName: 'Starburst Bush',
		scientificName: 'Clerodendrum quadriloculare',
		imageUrls: [asset('starburst-in-shade.webp')],
		description:
			'Dark green leaves with purple undersides. When mature it bursts into firework-like clusters of long, pink-and-white tubular flowers.',
		dateRegistered: '2026-10-28'
	},
	{
		category: 'REPTILE',
		commonName: 'Asian Water Monitor',
		scientificName: 'Varanus salvator',
		imageUrls: [asset('water-monitor-lounging-baby.webp')],
		description:
			'A young water monitor sunning itself. Strong swimmers that can grow over two metres long — and they have their eye on the eggs.',
		dateRegistered: '2026-10-28'
	}
];

/** Dex number as `#001` — the entry's `dexNumber`, else its 1-based position in FARMDEX. */
export function farmdexNumber(entry: FarmdexEntry): string {
	const n = entry.dexNumber ?? FARMDEX.indexOf(entry) + 1;
	return `#${String(n).padStart(3, '0')}`;
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
