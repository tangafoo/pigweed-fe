/**
 * Reddit-style random username generator for the signup form.
 *
 * There is no backend/contract endpoint for name generation — we mint
 * one client-side and then verify it with `isUsernameAvailable`. Shape:
 * `Adjective_Noun_<digits>`.
 *
 * Adjectives are tonal nods to the user's favourite authors — Peter
 * Ustinov (urbane wit), Chuck Palahniuk (raw/transgressive), Kazuo
 * Ishiguro (restrained melancholy), Robert Drewe (sun-bleached coastal).
 * Nouns are hyperlocal to Mantin, Negeri Sembilan: kampung poultry,
 * the Telomian dog, Rajah Brooke's birdwing, worms, and Malaysian
 * weeds/plants (including the project namesake, pigweed/bayam).
 *
 * All words are single ASCII tokens; the longest pair
 * (`Mischievous_Swallowtail_NNNN`, 28 chars) stays inside the contract's
 * 3–30 `username` bound, but output is still clamped defensively.
 */

const ADJECTIVES = [
	// Ustinov — urbane, ironic, theatrical
	'Urbane',
	'Wry',
	'Droll',
	'Affable',
	'Genial',
	'Mischievous',
	'Theatrical',
	'Erudite',
	'Voluble',
	'Sardonic',
	'Debonair',
	'Gregarious',
	'Whimsical',
	'Sly',
	// Palahniuk — raw, transgressive, volatile
	'Feral',
	'Raw',
	'Bruised',
	'Gutted',
	'Hollow',
	'Rabid',
	'Twitchy',
	'Reckless',
	'Numb',
	'Frantic',
	'Combustible',
	'Unhinged',
	'Volatile',
	'Snarling',
	'Ragged',
	'Jagged',
	'Scrappy',
	'Brash',
	// Ishiguro — restrained, wistful, dignified
	'Wistful',
	'Faded',
	'Quiet',
	'Forlorn',
	'Reticent',
	'Demure',
	'Solemn',
	'Muted',
	'Stoic',
	'Tender',
	'Weary',
	'Hushed',
	'Dignified',
	'Bittersweet',
	'Lingering',
	'Composed',
	// Drewe — sun-bleached, coastal, salt-air
	'Salty',
	'Windswept',
	'Briny',
	'Sunburnt',
	'Tidal',
	'Brackish',
	'Weathered',
	'Bleached',
	'Sunlit',
	'Windburnt',
	'Restless',
	'Wily'
];

const NOUNS = [
	// Poultry — kampung Mantin
	'Ayam',
	'Serama',
	'Kampung',
	'Quail',
	'Goose',
	'Gander',
	// Dogs
	'Telomian',
	'Mongrel',
	'Pye',
	// Butterflies / moths
	'Birdwing',
	'Lacewing',
	'Skipper',
	'Swallowtail',
	// Worms
	'Earthworm',
	'Glowworm',
	// Plants & weeds of Negeri Sembilan
	'Pigweed',
	'Lalang',
	'Bayam',
	'Rambutan',
	'Pandan'
];

function pick<T>(list: readonly T[]): T {
	return list[Math.floor(Math.random() * list.length)];
}

/** A fresh `Adjective_Noun_NNNN` username, guaranteed 3–30 chars. */
export function randomUsername(): string {
	const digits = Math.floor(1000 + Math.random() * 9000); // always 4 digits
	const name = `${pick(ADJECTIVES)}_${pick(NOUNS)}_${digits}`;
	return name.slice(0, 30);
}
