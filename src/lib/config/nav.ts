import { m } from '$lib/paraglide/messages.js';

// Top-bar items, shared by the desktop bar and the mobile drawer. No `href` =
// label only (not wired yet). Labels are thunks so they re-read the active
// locale.
export type NavItem = { label: () => string; href?: string };

export const NAV_ITEMS: NavItem[] = [
	{ label: () => m.nav_buy() },
	{ label: () => m.nav_projects() },
	{ label: () => m.nav_farmdex(), href: '/farmdex' },
	{ label: () => m.nav_volunteer(), href: '/volunteer' }
];
