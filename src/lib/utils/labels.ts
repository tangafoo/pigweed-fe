import { m } from '$lib/paraglide/messages.js';
import type { Animal, Gender } from '@meteorclass/pigweed-contract';

/** Animal enum → its localized display label. Add a new animal here once. */
export const ANIMAL_LABEL: Record<Animal, () => string> = {
	CHICKEN: m.animal_chicken,
	DOG: m.animal_dog,
	GOOSE: m.animal_goose,
	DUCK: m.animal_duck,
	CAT: m.animal_cat,
	LIZARD: m.animal_lizard
};

/** Gender enum → its localized display label. Add a new gender here once. */
export const GENDER_LABEL: Record<Gender, () => string> = {
	MALE: m.gender_male,
	FEMALE: m.gender_female,
	NONBINARY: m.gender_nonbinary,
	UNDISCLOSED: m.gender_undisclosed
};
