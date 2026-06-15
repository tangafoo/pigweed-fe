<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative, formatDate } from '$lib/utils/date';
	import {
		getUserAchievements,
		getUserVotes,
		type EarnedAchievement,
		type VoteTarget
	} from '$lib/api/users';
	import type {
		VoteValue,
		PostVoteEntry,
		CommentVoteEntry,
		Post
	} from '@meteorclass/pigweed-contract';
	import { ArrowBigUp, ArrowBigDown, Trophy, Activity, Newspaper } from '@lucide/svelte';
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
			<p class="truncate {deleted ? 'italic text-white/40' : ''}">{primary}</p>
			<p class="text-xs text-white/60">{formatRelative(createdAt)}</p>
		</div>
	</li>
{/snippet}

<div class="mb-4 flex gap-2">
	<button
		type="button"
		onclick={() => selectTab('posts')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-oswald font-bold {activeTab ===
		'posts'
			? 'bg-olf-darkbrown text-white'
			: 'bg-olf-beige text-olf-darkbrown'}"
	>
		<Newspaper size={16} />
		{m.profile_tab_posts()}
	</button>
	<button
		type="button"
		onclick={() => selectTab('achievements')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-oswald font-bold {activeTab ===
		'achievements'
			? 'bg-olf-darkbrown text-white'
			: 'bg-olf-beige text-olf-darkbrown'}"
	>
		<Trophy size={16} />
		{m.profile_tab_achievements()}
	</button>
	<button
		type="button"
		onclick={() => selectTab('activity')}
		class="flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-oswald font-bold {activeTab ===
		'activity'
			? 'bg-olf-darkbrown text-white'
			: 'bg-olf-beige text-olf-darkbrown'}"
	>
		<Activity size={16} />
		{m.profile_tab_activity()}
	</button>
</div>

{#if activeTab === 'posts'}
	<section class="rounded-2xl bg-olf-beige p-6">
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
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each authoredPosts as post (post.id)}
					<PostCard {post} />
				{/each}
			</div>
		{/if}
	</section>
{:else if activeTab === 'achievements'}
	<section class="rounded-2xl bg-olf-beige p-6">
		{#if achLoading}
			<p class="font-oswald text-olf-darkbrown/60">{m.profile_achievements_loading()}</p>
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
