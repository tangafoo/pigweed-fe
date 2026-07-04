// Cute egg-fact corpus — curated + client-side. No RAG needed for static fun
// facts: instant, free, offline. If you ever want endless AI-varied facts,
// swap eggStats()/eggTrivia() to call a RAG endpoint; the page just renders
// whatever these return.

export type EggFact = { icon: string; text: string };

/** Playful "what your eggs add up to" chips, derived from the total eaten. */
export function eggStats(totalEggs: number): EggFact[] {
	const protein = totalEggs * 6; // ~6 g protein per egg
	const calories = totalEggs * 78; // ~78 kcal per egg
	const henYears = Math.round((totalEggs / 280) * 10) / 10; // ~280 eggs/hen/year
	const omelettes = Math.floor(totalEggs / 3); // ~3 eggs / omelette
	const towerCm = Math.round(totalEggs * 5.7); // ~5.7 cm per egg, end to end
	const tower = towerCm >= 100 ? `${(towerCm / 100).toFixed(1)} m` : `${towerCm} cm`;

	return [
		{ icon: '💪', text: `${protein.toLocaleString()} g of protein` },
		{ icon: '🔥', text: `${calories.toLocaleString()} kcal of farm sunshine` },
		{ icon: '🐔', text: `≈ one hen laying non-stop for ${henYears} years` },
		{ icon: '🍳', text: `${omelettes.toLocaleString()} omelettes` },
		{ icon: '🗼', text: `a ${tower}-tall egg tower` }
	];
}

const TRIVIA = [
	'A hen needs about 24–26 hours to lay a single egg.',
	'An eggshell has up to 17,000 tiny pores it breathes through.',
	'Hens gently turn their eggs around 50 times a day.',
	"A hen's earlobe colour hints at the colour of her eggs!",
	'Pasture-raised hens lay deeper-yolked, tastier eggs.',
	'A fresh egg sinks — a floaty one is past its prime.'
];

/** A stable "did you know" pick (seed it with the egg count so it's steady). */
export function eggTrivia(seed: number): string {
	return TRIVIA[Math.abs(Math.floor(seed)) % TRIVIA.length];
}
