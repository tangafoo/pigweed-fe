<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import {
		getUserAchievements,
		getUserAwards,
		getAchievementCatalog,
		type EarnedAchievement
	} from '$lib/api/users';
	import type { Achievement, AwardSummary } from '@meteorclass/pigweed-contract';
	import { Trophy, Lock, X } from '@lucide/svelte';
	import AwardCoin from '$lib/components/ui/AwardCoin.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	let { userId }: { userId: string } = $props();

	// Earned achievements + received awards — lazy, fetched once, together.
	let achievements = $state<EarnedAchievement[]>([]);
	let awards = $state<AwardSummary[]>([]);
	let achLoading = $state(false);
	let achError = $state(false);

	async function loadAchievements() {
		achLoading = true;
		achError = false;
		try {
			// getUserAwards never throws (returns [] on failure) — awards are a
			// bonus section, they must not take the whole panel down.
			[achievements, awards] = await Promise.all([
				getUserAchievements(userId),
				getUserAwards(userId)
			]);
		} catch {
			achError = true;
		} finally {
			achLoading = false;
		}
	}

	// "View all" modal — the full catalog (Pokédex), earned lit up, rest locked.
	let showAllModal = $state(false);
	let catalog = $state<Achievement[]>([]);
	let catalogLoaded = $state(false);
	let catalogLoading = $state(false);
	const earnedIds = $derived(new Set(achievements.map((e) => e.achievement.id)));

	async function openAllModal() {
		showAllModal = true;
		if (catalogLoaded || catalogLoading) return;
		catalogLoading = true;
		try {
			catalog = await getAchievementCatalog();
			catalogLoaded = true;
		} finally {
			catalogLoading = false;
		}
	}

	onMount(() => {
		loadAchievements();
	});
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && showAllModal && (showAllModal = false)} />

<section class="rounded-2xl bg-olf-beige p-6">
	{#if achLoading}
		<div class="flex justify-center py-8 text-olf-darkbrown/60"><Spinner /></div>
	{:else if achError}
		<p class="font-oswald text-red-700">{m.profile_achievements_error()}</p>
	{:else}
		<!-- Received awards: shimmering coins with aggregated ×n counts (never
		     one entry per grant). Hidden entirely until the first award lands;
		     shown even when achievements are still empty (they're independent). -->
		{#if awards.length > 0}
			<h3 class="mb-3 font-homemade-apple text-2xl text-olf-darkgreen">
				{m.profile_awards_heading()}
			</h3>
			<div class="mb-6 flex flex-wrap items-start gap-x-5 gap-y-3">
				{#each awards as a (a.awardTypeId)}
					<div class="flex flex-col items-center gap-1.5">
						<AwardCoin assetKey={a.assetKey} name={a.name} size={72} count={a.count} />
						<span class="font-oswald text-xs font-bold text-olf-darkbrown">{a.name}</span>
					</div>
				{/each}
			</div>
			<h3 class="mb-3 font-homemade-apple text-2xl text-olf-darkgreen">
				{m.profile_tab_achievements()}
			</h3>
		{/if}
		{#if achievements.length === 0}
			<p
				class="rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
			>
				{m.profile_achievements_empty()}
			</p>
		{:else}
			<!-- Earned achievements as little prize cards: green-to-moss shimmer, a
			     gold trophy, and a big watermark cup (same giant-emoji flavor as the
			     subscription card's 🥚) — festive without leaving the palette. -->
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each achievements as earned (earned.achievement.id)}
					<li
						class="relative flex flex-col gap-1 overflow-hidden rounded-xl bg-gradient-to-br from-olf-darkgreen via-olf-moss to-olf-darkgreen p-4 text-olf-eggshell shadow-md"
					>
						<span
							class="pointer-events-none absolute -right-3 -bottom-5 text-6xl leading-none opacity-[0.12] select-none"
							>🏆</span
						>
						<Trophy size={18} class="shrink-0 fill-olf-yolk text-olf-yolk" />
						<span class="font-oswald font-bold">{earned.achievement.name}</span>
						{#if earned.achievement.description}
							<span class="font-oswald text-xs text-olf-eggshell/75"
								>{earned.achievement.description}</span
							>
						{/if}
						<span
							class="mt-2 w-fit rounded-full bg-olf-eggshell/15 px-2.5 py-1 font-oswald text-xxs font-bold text-olf-eggshell"
						>
							{m.profile_achievement_granted({ date: formatDate(earned.grantedAt) })}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}

	{#if !achLoading && !achError}
		<button
			type="button"
			onclick={openAllModal}
			class="mt-4 inline-flex items-center gap-1.5 font-oswald text-sm font-bold text-olf-darkgreen underline underline-offset-4 hover:text-olf-moss"
		>
			<Trophy size={14} class="shrink-0" />
			{m.profile_achievements_view_all()}
		</button>
	{/if}
</section>

{#if showAllModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="presentation"
		onclick={(e) => {
			if (e.target === e.currentTarget) showAllModal = false;
		}}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={m.achievements_all_title()}
			tabindex="-1"
			class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-olf-beige p-5 shadow-xl"
		>
			<header class="mb-4 flex items-center justify-between">
				<h3 class="font-homemade-apple text-2xl font-bold text-olf-darkgreen">
					{m.achievements_all_title()}
				</h3>
				<button
					type="button"
					onclick={() => (showAllModal = false)}
					aria-label={m.achievements_close()}
					class="flex size-8 items-center justify-center rounded-full text-olf-darkbrown hover:bg-olf-darkbrown/10"
				>
					<X size={18} />
				</button>
			</header>

			{#if catalogLoading}
				<div class="flex justify-center py-10 text-olf-darkbrown/60"><Spinner /></div>
			{:else}
				<ul class="grid grid-cols-3 gap-3">
					{#each catalog as a (a.id)}
						{@const earned = earnedIds.has(a.id)}
						<li
							class="flex flex-col items-center gap-1 rounded-xl p-3 text-center {earned
								? 'bg-gradient-to-br from-olf-darkgreen via-olf-moss to-olf-darkgreen text-olf-eggshell shadow-md'
								: 'bg-olf-darkbrown/10 text-olf-darkbrown/45'}"
						>
							{#if earned}
								<Trophy size={22} class="shrink-0 fill-olf-yolk text-olf-yolk" />
							{:else}
								<Lock size={22} class="shrink-0" />
							{/if}
							<span class="font-oswald text-xs leading-tight font-bold">{a.name}</span>
							{#if a.description}
								<span class="font-oswald text-xxs leading-tight opacity-80">{a.description}</span>
							{/if}
							<span
								class="mt-1.5 rounded-full px-2.5 py-0.5 font-oswald text-xxs font-bold {earned
									? 'bg-olf-eggshell/15 text-olf-eggshell'
									: 'bg-olf-darkbrown/10 text-olf-darkbrown/45'}"
							>
								{m.achievement_reward({ coins: a.rewardCoins })}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
