<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative, formatDate } from '$lib/utils/date';
	import {
		getUserAchievements,
		getAchievementCatalog,
		getUserVotes,
		type EarnedAchievement,
		type VoteTarget
	} from '$lib/api/users';
	import type {
		VoteValue,
		PostVoteEntry,
		CommentVoteEntry,
		Post,
		Achievement
	} from '@meteorclass/pigweed-contract';
	import { ArrowBigUp, ArrowBigDown, Trophy, Activity, Newspaper, Lock, X } from '@lucide/svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import { fetchFeed } from '$lib/api/posts';

	interface ProfileTabsProps {
		userId: string;
	}
	let { userId }: ProfileTabsProps = $props();

	type Tab = 'posts' | 'achievements' | 'activity';
	let activeTab = $state<Tab>('posts');

	// Authored posts — lazy, fetched once. Reuses the public feed endpoint
	// filtered by authorId (no dedicated endpoint needed).
	let authoredPosts = $state<Post[]>([]);
	let postsLoaded = $state(false);
	let postsLoading = $state(false);
	let postsError = $state(false);

	async function loadPosts() {
		if (postsLoaded || postsLoading) return;
		postsLoading = true;
		postsError = false;
		try {
			const feed = await fetchFeed({ authorId: userId, sort: 'newest', limit: 30 });
			authoredPosts = feed.posts;
			postsLoaded = true;
		} catch {
			postsError = true;
		} finally {
			postsLoading = false;
		}
	}

	// Achievements — lazy, fetched once.
	let achievements = $state<EarnedAchievement[]>([]);
	let achLoaded = $state(false);
	let achLoading = $state(false);
	let achError = $state(false);

	async function loadAchievements() {
		if (achLoaded || achLoading) return;
		achLoading = true;
		achError = false;
		try {
			achievements = await getUserAchievements(userId);
			achLoaded = true;
		} catch {
			achError = true;
		} finally {
			achLoading = false;
		}
	}

	// "View all achievements" modal — the full catalog (Pokédex grid), with the
	// user's earned ones lit up and the rest locked. Catalog fetched lazily on
	// first open. earnedIds is derived from the already-loaded earned list.
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

	// Activity (votes) — lazy, refetched per target.
	const VOTE_LIMIT = 10;
	let voteTarget = $state<VoteTarget>('posts');
	let postVotes = $state<PostVoteEntry[]>([]);
	let commentVotes = $state<CommentVoteEntry[]>([]);
	let votePage = $state(1);
	let voteLoading = $state(false);
	let voteError = $state(false);
	let voteHasMore = $state(false);
	let voteLoaded = $state(false);

	async function loadVotes(reset: boolean) {
		if (voteLoading) return;
		voteLoading = true;
		voteError = false;
		const page = reset ? 1 : votePage + 1;
		try {
			const res = await getUserVotes(userId, voteTarget, page, VOTE_LIMIT);
			if (!res) {
				voteError = true;
				return;
			}
			if (voteTarget === 'posts') {
				const rows = res.postVotes ?? [];
				postVotes = reset ? rows : [...postVotes, ...rows];
				voteHasMore = rows.length === VOTE_LIMIT;
			} else {
				const rows = res.commentVotes ?? [];
				commentVotes = reset ? rows : [...commentVotes, ...rows];
				voteHasMore = rows.length === VOTE_LIMIT;
			}
			votePage = page;
			voteLoaded = true;
		} catch {
			voteError = true;
		} finally {
			voteLoading = false;
		}
	}

	function selectTab(tab: Tab) {
		activeTab = tab;
		if (tab === 'posts') loadPosts();
		else if (tab === 'achievements') loadAchievements();
		else if (!voteLoaded) loadVotes(true);
	}

	function selectVoteTarget(target: VoteTarget) {
		if (target === voteTarget) return;
		voteTarget = target;
		postVotes = [];
		commentVotes = [];
		votePage = 1;
		voteHasMore = false;
		voteError = false;
		loadVotes(true);
	}

	onMount(() => {
		loadPosts();
	});
</script>

{#snippet voteRow(
	value: VoteValue,
	score: number,
	primary: string,
	createdAt: string,
	deleted: boolean
)}
	<li class="flex items-stretch gap-3 overflow-hidden rounded-xl bg-olf-darkbrown text-white">
		<div class="flex shrink-0 flex-col items-center justify-center gap-0.5 bg-black/25 px-2.5 py-3">
			<ArrowBigUp
				size={18}
				aria-label={m.profile_vote_up()}
				class={value === 'UP' ? 'fill-olf-lightgreen text-olf-lightgreen' : 'text-white/25'}
			/>
			<span
				class="font-oswald text-xs font-bold tabular-nums {value === 'UP'
					? 'text-olf-lightgreen'
					: 'text-red-400'}"
			>
				{score}
			</span>
			<ArrowBigDown
				size={18}
				aria-label={m.profile_vote_down()}
				class={value === 'DOWN' ? 'fill-red-400 text-red-400' : 'text-white/25'}
			/>
		</div>
		<div class="min-w-0 flex-1 self-center py-3 pr-4 font-oswald">
			<p class="truncate {deleted ? 'text-white/40 italic' : ''}">{primary}</p>
			<p class="text-xs text-white/60">{formatRelative(createdAt)}</p>
		</div>
	</li>
{/snippet}

<svelte:window onkeydown={(e) => e.key === 'Escape' && showAllModal && (showAllModal = false)} />

<div
	role="tablist"
	class="mb-2.5 flex gap-1 overflow-hidden rounded-full bg-olf-beige p-1 shadow-md"
>
	<button
		type="button"
		role="tab"
		aria-selected={activeTab === 'posts'}
		onclick={() => selectTab('posts')}
		class="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-oswald text-sm font-medium transition-colors duration-200 {activeTab ===
		'posts'
			? 'bg-olf-darkbrown text-white'
			: 'text-olf-darkbrown hover:bg-olf-darkbrown/10'}"
	>
		<Newspaper size={12} class="shrink-0" />
		<span class="truncate">{m.profile_tab_posts()}</span>
	</button>
	<button
		type="button"
		role="tab"
		aria-selected={activeTab === 'activity'}
		onclick={() => selectTab('activity')}
		class="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-oswald text-sm font-medium transition-colors duration-200 {activeTab ===
		'activity'
			? 'bg-olf-darkbrown text-white'
			: 'text-olf-darkbrown hover:bg-olf-darkbrown/10'}"
	>
		<Activity size={12} class="shrink-0" />
		<span class="truncate">{m.profile_tab_activity()}</span>
	</button>
	<button
		type="button"
		role="tab"
		aria-selected={activeTab === 'achievements'}
		onclick={() => selectTab('achievements')}
		class="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 font-oswald text-sm font-medium transition-colors duration-200 {activeTab ===
		'achievements'
			? 'bg-olf-darkbrown text-white'
			: 'text-olf-darkbrown hover:bg-olf-darkbrown/10'}"
	>
		<Trophy size={12} class="shrink-0" />
		<span class="truncate">{m.profile_tab_achievements()}</span>
	</button>
</div>

{#if activeTab === 'posts'}
	<section class="rounded-2xl bg-olf-beige p-3">
		{#if postsLoading}
			<div class="flex justify-center py-8 text-olf-darkbrown/60">
				<Spinner />
			</div>
		{:else if postsError}
			<p class="font-oswald text-red-700">{m.profile_posts_error()}</p>
		{:else if authoredPosts.length === 0}
			<p
				class="rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
			>
				{m.profile_posts_empty()}
			</p>
		{:else}
			<!-- Pinterest-style masonry (matches the /posts board): CSS columns so
			     each card keeps its natural height instead of stretching to a
			     shared grid-row height. -->
			<div class="columns-1 gap-4 sm:columns-2">
				{#each authoredPosts as post (post.id)}
					<div class="mb-4 break-inside-avoid">
						<PostCard {post} />
					</div>
				{/each}
			</div>
		{/if}
	</section>
{:else if activeTab === 'achievements'}
	<section class="rounded-2xl bg-olf-beige p-6">
		{#if achLoading}
			<div class="flex justify-center py-8 text-olf-darkbrown/60">
				<Spinner />
			</div>
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
							<span class="font-oswald text-xs text-white/70">{earned.achievement.description}</span
							>
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
				class="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full bg-olf-darkgreen py-2 font-oswald text-sm font-bold tracking-wide text-olf-eggshell transition-transform hover:scale-[1.02]"
			>
				<Trophy size={14} class="shrink-0" />
				{m.profile_achievements_view_all()}
			</button>
		{/if}
	</section>
{:else}
	<section class="rounded-2xl bg-olf-beige p-6">
		<div class="mb-4 flex gap-2">
			<button
				type="button"
				onclick={() => selectVoteTarget('posts')}
				class="rounded-full px-3 py-1 font-oswald text-sm font-bold {voteTarget === 'posts'
					? 'bg-olf-darkbrown text-white'
					: 'bg-olf-darkbrown/10 text-olf-darkbrown'}"
			>
				{m.profile_votes_tab_posts()}
			</button>
			<button
				type="button"
				onclick={() => selectVoteTarget('comments')}
				class="rounded-full px-3 py-1 font-oswald text-sm font-bold {voteTarget === 'comments'
					? 'bg-olf-darkbrown text-white'
					: 'bg-olf-darkbrown/10 text-olf-darkbrown'}"
			>
				{m.profile_votes_tab_comments()}
			</button>
		</div>

		{#if voteError}
			<p class="mb-3 font-oswald text-red-700">{m.profile_votes_error()}</p>
		{/if}

		{#if voteTarget === 'posts'}
			{#if postVotes.length > 0}
				<ul class="flex flex-col gap-2">
					{#each postVotes as v (v.postId)}
						{@render voteRow(
							v.value,
							v.post.upvoteCount - v.post.downvoteCount,
							v.post.title,
							v.createdAt,
							v.post.deletedAt !== null
						)}
					{/each}
				</ul>
			{:else if !voteLoading && !voteError}
				<p
					class="rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
				>
					{m.profile_votes_empty()}
				</p>
			{/if}
		{:else if commentVotes.length > 0}
			<ul class="flex flex-col gap-2">
				{#each commentVotes as v (v.commentId)}
					{@render voteRow(
						v.value,
						v.comment.upvoteCount - v.comment.downvoteCount,
						v.comment.body,
						v.createdAt,
						v.comment.deletedAt !== null
					)}
				{/each}
			</ul>
		{:else if !voteLoading && !voteError}
			<p
				class="rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
			>
				{m.profile_votes_empty()}
			</p>
		{/if}

		{#if voteLoading}
			<div class="mt-3 flex justify-center text-olf-darkbrown/60">
				<Spinner />
			</div>
		{:else if voteHasMore}
			<button
				type="button"
				onclick={() => loadVotes(false)}
				class="mt-3 w-full rounded-full bg-olf-darkbrown py-2 font-oswald font-bold text-white"
			>
				{m.profile_votes_load_more()}
			</button>
		{/if}
	</section>
{/if}

<!-- "All achievements" modal — Pokédex-style grid: earned tiles lit up, the
     rest locked/greyed so they read as goals. Backdrop + Esc both close. -->
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
				<div class="flex justify-center py-10 text-olf-darkbrown/60">
					<Spinner />
				</div>
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
							<span class="font-oswald text-xs font-bold leading-tight">{a.name}</span>
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
