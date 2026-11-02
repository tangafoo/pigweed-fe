import { m } from '$lib/paraglide/messages.js';

// The Projects page's butterfly cursors (picked in its header). Each has
// static/cursors/<id>.ico (the art; the picker shows it) and
// static/cursors/<id>-flutter/0-2.png: 34px frames, the art at 30px with a
// baked-in drop shadow and the wings squashed toward the body (0 open,
// 2 folded). Click point = the butterfly's centre (the art is centred at 16,16, a
// pixel up-left so its down-right shadow fits).
// `head`: which way its head points in the art, degrees clockwise from
// straight up (the picker turns it back upright).
export const BUTTERFLIES = [
	{ id: 'peacock', head: -45, name: () => m.butterfly_peacock() },
	{ id: 'mountain-apollo', head: -45, name: () => m.butterfly_mountain_apollo() },
	{ id: 'mourning-cloak', head: 40, name: () => m.butterfly_mourning_cloak() },
	{ id: 'garden-tiger-moth', head: 28, name: () => m.butterfly_garden_tiger_moth() }
] as const;
export type Butterfly = (typeof BUTTERFLIES)[number]['id'];

export const BUTTERFLY_HOTSPOT: [number, number] = [16, 16];

// Frame and how long it shows: a rest, then two flaps.
const FLUTTER: [frame: number, ms: number][] = [
	[0, 972],
	[1, 90],
	[2, 90],
	[1, 90],
	[0, 90],
	[1, 90],
	[2, 90],
	[1, 90]
];

/** The flutter loop as `[url, ms]` frames, for mountCursor. */
export function flutterFrames(id: Butterfly): [string, number][] {
	return FLUTTER.map(([i, ms]) => [`/cursors/${id}-flutter/${i}.png`, ms]);
}
