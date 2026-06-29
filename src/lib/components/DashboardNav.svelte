<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { UserRound, Egg, Trophy, Settings } from '@lucide/svelte';

	// Shared "your account" side menu. Each section is a real route, so it shows
	// up identically on /users/[id] and /subscriptions (a sub belongs to a user).
	let {
		userId,
		active
	}: {
		userId: string;
		active: 'profile' | 'subscription' | 'achievements' | 'settings';
	} = $props();

	const items = $derived([
		{ id: 'profile', label: m.home_profile_link(), icon: UserRound, href: `/users/${userId}` },
		{
			id: 'subscription',
			label: m.subscribe_your_plan(),
			icon: Egg,
			href: `/users/${userId}?tab=subscription`
		},
		{
			id: 'achievements',
			label: m.profile_tab_achievements(),
			icon: Trophy,
			href: `/users/${userId}?tab=achievements`
		},
		{
			id: 'settings',
			label: m.profile_settings_button(),
			icon: Settings,
			href: `/users/${userId}?tab=settings`
		}
	] as const);
</script>

<aside
	class="flex flex-wrap gap-2 sm:sticky sm:top-16 sm:w-44 sm:shrink-0 sm:flex-col sm:self-start"
>
	{#each items as it (it.id)}
		{@const Icon = it.icon}
		<a
			href={it.href}
			data-sveltekit-noscroll
			class="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 font-oswald text-sm font-bold tracking-wide transition-colors sm:flex-none sm:justify-start {active ===
			it.id
				? 'bg-olf-darkgreen text-olf-beige'
				: 'bg-olf-eggshell text-olf-darkgreen hover:bg-olf-eggshell/70'}"
		>
			<Icon size={18} class="shrink-0" />
			{it.label}
		</a>
	{/each}
</aside>
