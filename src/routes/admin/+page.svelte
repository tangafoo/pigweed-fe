<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Egg,
		FileText,
		Star,
		Users as UsersIcon,
		Layers,
		Gift,
		Umbrella,
		Home,
		Receipt,
		Package,
		TrendingUp
	} from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import AddUserModal from '$lib/components/admin/AddUserModal.svelte';
	import HomePanel from '$lib/components/admin/HomePanel.svelte';
	import UsersPanel from '$lib/components/admin/UsersPanel.svelte';
	import EggsPanel from '$lib/components/admin/EggsPanel.svelte';
	import AnalyticsPanel from '$lib/components/admin/AnalyticsPanel.svelte';
	import TiersPanel from '$lib/components/admin/TiersPanel.svelte';
	import BenefitsPanel from '$lib/components/admin/BenefitsPanel.svelte';
	import BoxesPanel from '$lib/components/admin/BoxesPanel.svelte';
	import { adminUrlWith } from '$lib/components/admin/shared.svelte';
	import { asset } from '$lib/config/assets';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// A little friend at the foot of the sidebar — one of the farm's four hand-drawn
	// chickens, picked at random each load, with a gentle long-idle animation
	// (the admin lives here for an hour+, so nothing jittery). See memory
	// `brand-chicken-art` for the asset list.
	const CHICKEN_ART = [
		'henkerchief.webp',
		'hen with chicks.webp',
		'chicken-drawing-white.webp',
		'chicken-drawing-brown.webp'
	];
	const sidebarChicken = CHICKEN_ART[Math.floor(Math.random() * CHICKEN_ART.length)];

	// Which dashboard section is showing — driven by the ?view= URL param so it
	// survives a refresh (and is shareable). Defaults to 'home'. Each section is
	// its own panel component under lib/components/admin/; this page just owns
	// the shell (nav + stat strip) and the shared add-user modal.
	const VIEWS = ['home', 'eggs', 'users', 'analytics', 'boxes', 'tiers', 'benefits'] as const;
	type View = (typeof VIEWS)[number];
	const view = $derived(
		(VIEWS.includes(page.url.searchParams.get('view') as View)
			? page.url.searchParams.get('view')
			: 'home') as View
	);

	// Add-user modal (pre-register by email + magic link) — shared by the
	// Users and Eggs panels, so it lives here.
	let addUserOpen = $state(false);
	const openAddUser = () => (addUserOpen = true);

	// `group` opens a labelled section above the item (Eggs / Subscription).
	const NAV = [
		{ id: 'home', label: 'Home', icon: Home },
		{ id: 'eggs', label: 'Eggs', icon: Receipt },
		{ id: 'users', label: 'Users', icon: UsersIcon },
		{ id: 'analytics', label: 'Analytics', icon: TrendingUp },
		{ id: 'boxes', label: 'Boxes', icon: Package, group: 'Eggs', groupIcon: Package },
		{ id: 'tiers', label: 'Tiers', icon: Layers, group: 'Subscription', groupIcon: Umbrella },
		{ id: 'benefits', label: 'Benefits', icon: Gift }
	] as const;
</script>

<svelte:head><title>Admin · Our Little Farm</title></svelte:head>

<div class="flex flex-1 bg-olf-lightgreen">
	<!-- Sidebar — left rail on desktop, fixed bottom nav on mobile. -->
	<aside
		class="fixed inset-x-0 bottom-0 z-40 flex flex-row justify-around gap-1 bg-olf-moss px-2 py-2 text-olf-beige shadow-[0_-2px_10px_rgba(0,0,0,0.12)] sm:sticky sm:top-0 sm:h-dvh sm:w-52 sm:shrink-0 sm:flex-col sm:justify-start sm:gap-2 sm:self-start sm:overflow-y-auto sm:px-4 sm:py-6 sm:shadow-none"
	>
		<p class="hidden px-2 pb-4 font-homemade-apple text-3xl text-olf-eggshell sm:block">Admin</p>
		{#each NAV as item (item.id)}
			{@const Icon = item.icon}
			{#if 'group' in item && item.group}
				{@const GroupIcon = item.groupIcon}
				<!-- Section divider label (Eggs / Subscription). -->
				<div
					class="mt-3 hidden items-center justify-center gap-1.5 px-3 pt-2 pb-1 text-olf-beige/40 sm:flex sm:justify-start"
				>
					<GroupIcon size={12} class="shrink-0" />
					<span class="hidden font-oswald text-xxs font-bold tracking-widest uppercase sm:inline"
						>{item.group}</span
					>
				</div>
			{/if}
			<Button
				onclick={() => goto(adminUrlWith({ view: item.id, page: undefined }), { noScroll: true })}
				class="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 font-oswald text-sm font-bold tracking-wide transition-colors sm:justify-start {view ===
				item.id
					? 'bg-olf-beige text-olf-darkgreen'
					: 'text-olf-beige/70 hover:bg-olf-beige/10'}"
				title={item.label}
			>
				<Icon size={18} class="shrink-0" />
				<span class="hidden sm:inline">{item.label}</span>
			</Button>
		{/each}

		<!-- Sidebar mascot (desktop only) — a random chicken, gently idling. -->
		<img
			src={asset(sidebarChicken)}
			alt=""
			draggable="false"
			class="admin-chicken mt-auto hidden w-20 self-center opacity-90 select-none sm:block"
		/>
	</aside>

	<!-- Main -->
	<main class="min-w-0 flex-1 px-4 pt-4 pb-12 sm:px-8 sm:pt-6 sm:pb-8">
		<!-- Stat strip — tight cockpit console on every view. -->
		<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
			{#each [{ label: 'Users', value: data.stats.totalUsers, icon: UsersIcon }, { label: 'Subscribers', value: data.stats.activeSubscribers, icon: Egg }, { label: 'Posts', value: data.stats.totalPosts, icon: FileText }, { label: 'Reviews', value: data.stats.totalReviews, icon: Star }] as s (s.label)}
				{@const Icon = s.icon}
				<div
					class="flex items-center gap-2 rounded-xl bg-olf-darkgreen px-3 py-2 text-olf-eggshell shadow"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen text-olf-darkgreen"
					>
						<Icon size={18} />
					</span>
					<div class="flex flex-col">
						<span class="font-oswald text-xxs tracking-wide uppercase opacity-80">{s.label}</span>
						<span class="font-supermercado-one text-xl leading-none tabular-nums">{s.value}</span>
					</div>
				</div>
			{/each}
		</div>

		{#if view === 'home'}
			<HomePanel stats={data.stats} users={data.users} boxes={data.boxes} />
		{:else if view === 'users'}
			<UsersPanel
				users={data.users}
				plans={data.plans}
				boxes={data.boxes}
				total={data.total}
				pageNum={data.page}
				orderedOn={data.orderedOn}
				onAddUser={openAddUser}
			/>
		{:else if view === 'eggs'}
			<EggsPanel users={data.users} boxes={data.boxes} onAddUser={openAddUser} />
		{:else if view === 'analytics'}
			<AnalyticsPanel boxes={data.boxes} />
		{:else if view === 'boxes'}
			<BoxesPanel boxes={data.boxes} />
		{:else if view === 'tiers'}
			<TiersPanel plans={data.plans} benefits={data.benefits} />
		{:else if view === 'benefits'}
			<BenefitsPanel benefits={data.benefits} />
		{/if}
	</main>

	<!-- Add user modal (pre-register by email + magic link); reused across panels -->
	<AddUserModal bind:open={addUserOpen} boxes={data.boxes} oncreated={() => invalidateAll()} />
</div>

<style>
	/* Gentle, infrequent idle for the sidebar chicken — one soft peck+sway every
	   ~14s with long rests, so it never distracts an admin mid-task. */
	.admin-chicken {
		transform-origin: 50% 90%;
		animation: admin-chicken-idle 14s ease-in-out infinite;
	}
	@keyframes admin-chicken-idle {
		0%,
		68%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		74% {
			transform: translateY(3px) rotate(-4deg);
		}
		80% {
			transform: translateY(0) rotate(3deg);
		}
		86% {
			transform: translateY(0) rotate(0deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.admin-chicken {
			animation: none;
		}
	}
</style>
