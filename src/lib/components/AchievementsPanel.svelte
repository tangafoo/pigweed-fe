<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import {
		getUserAchievements,
		getAchievementCatalog,
		type EarnedAchievement
	} from '$lib/api/users';
	import type { Achievement } from '@meteorclass/pigweed-contract';
	import { Trophy, Lock, X } from '@lucide/svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	let { userId }: { userId: string } = $props();

	// Earned achievements — lazy, fetched once.
	let achievements = $state<EarnedAchievement[]>([]);
	let achLoading = $state(false);
	let achError = $state(false);

	async function loadAchievements() {
		achLoading = true;
		achError = false;
		try {
			achievements = await getUserAchievements(userId);
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
	{:else if achievements.length === 0}
		<p
			class="rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
		>
			{m.profile_achievements_empty()}
		</p>
	{:else}
		<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{#each achievements as earned (earned.achievement.id)}
				<li class="flex flex-col gap-1 rounded-xl bg-olf-darkbrown p-4 text-white">
					<span class="font-oswald font-bold">{earned.achievement.name}</span>
					{#if earned.achievement.description}
						<span class="font-oswald text-xs text-white/70">{earned.achievement.description}</span>
					{/if}
					<span class="mt-1 font-oswald text-xs text-white/50">
						{m.profile_achievement_granted({ date: formatDate(earned.grantedAt) })}
					</span>
				</li>
			{/each}
		</ul>
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
								? 'bg-olf-darkbrown text-white'
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
							<span class="mt-0.5 font-oswald text-xxs font-bold {earned ? 'text-olf-yolk' : ''}">
								{m.achievement_reward({ coins: a.rewardCoins })}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}
