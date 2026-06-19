import { Egg, LeafyGreen, Apple } from '@lucide/svelte';
import { m } from '$lib/paraglide/messages.js';
import { asset } from '$lib/assets';

// Each entry maps 1:1 to <ProduceSection> props. brightnessClass steps down
// (none -> 90 -> 75) so the stack reads as a freshness/availability gradient.
export const produceSections = [
	{
		heading: m.home_eggs_heading,
		description: m.home_eggs_description,
		priceLine: m.home_eggs_price,
		buttonLabel: m.home_eggs_preorder,
		icon: Egg,
		iconClass: 'fill-olf-eggshell',
		iconShake: true,
		imageSrc: asset('chickens-eating-cantaloupe.webp'),
		imageAlt: 'Chicken house',
		brightnessClass: '',
		disabled: false,
		seam: false,
		whatsAppPhone: '60172332992'
	},
	{
		heading: m.home_veggies_heading,
		description: m.home_veggies_description,
		buttonLabel: m.home_next_batch,
		icon: LeafyGreen,
		imageSrc: asset('kangkung.webp'),
		imageAlt: 'Papaya tree',
		brightnessClass: 'brightness-90',
		disabled: true,
		seam: true
	},
	{
		heading: m.home_fruits_heading,
		description: m.home_fruits_description,
		buttonLabel: m.home_next_batch,
		icon: Apple,
		imageSrc: asset('papaya tree juvenile.webp'),
		imageAlt: 'Papaya tree',
		brightnessClass: 'brightness-75',
		disabled: true,
		seam: true
	}
];
