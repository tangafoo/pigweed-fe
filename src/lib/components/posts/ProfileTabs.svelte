<script lang="ts">
	import { onMount } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative } from '$lib/utils/date';
	import { getUserVotes, type VoteTarget } from '$lib/api/users';
	import type {
		VoteValue,
		PostVoteEntry,
		CommentVoteEntry,
		Post
	} from '@meteorclass/pigweed-contract';
	import { ArrowBigUp, ArrowBigDown, Activity, Newspaper } from '@lucide/svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import PostCard from '$lib/components/posts/PostCard.svelte';
	import { fetchFeed } from '$lib/api/posts';

	interface ProfileTabsProps {
		userId: string;
		/** Authoritative totals (from SSR) for the tab badges — not the capped
		 *  loaded lists. Activity shows the sum of the two vote counts. */
		postCount: number;
		postVoteCount: number;
		commentVoteCount: number;
	}
	let { userId, postCount, postVoteCount, commentVoteCount }: ProfileTabsProps = $props();

	// `?? 0` guards against an older BE response that predates these fields
	// (otherwise undefined + undefined renders "NaN").
	const postVoteTotal = $derived(postVoteCount ?? 0);
	const commentVoteTotal = $derived(commentVoteCount ?? 0);
	const voteCount = $derived(postVoteTotal + commentVoteTotal);

	// Posts + Activity — a tidy duo. (Achievements is now its own profile section.)
	type Tab = 'posts' | 'activity';
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
	deleted: boolean,
	href: string | null
)}
	<!-- `href` (skipped for deleted targets) makes the whole row a link — post
	     votes open the post, comment votes deep-link to #comment-<id>. -->
	<li
		class="group relative flex items-stretch gap-3 overflow-hidden rounded-xl bg-olf-darkbrown text-white"
	>
		{#if href}
			<a {href} aria-label={primary} class="absolute inset-0 z-10"></a>
		{/if}
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
			<p
				class="truncate {deleted ? 'text-white/40 italic' : ''} {href
					? 'group-hover:underline'
					: ''}"
			>
				{primary}
			</p>
			<p class="text-xs text-white/60">{formatRelative(createdAt)}</p>
		</div>
	</li>
{/snippet}

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
		<span class="tabular-nums opacity-70">({postCount})</span>
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
		<span class="tabular-nums opacity-70">({voteCount})</span>
	</button>
</div>

{#if activeTab === 'posts'}
	<section class="rounded-2xl bg-olf-beige p-3">
		{#if postsLoading}
			<div class="flex justify-center py-8 text-olf-darkbrown/60"><Spinner /></div>
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
			     each card keeps its natural height. -->
			<div class="columns-1 gap-4 sm:columns-2">
				{#each authoredPosts as post (post.id)}
					<div class="mb-4 break-inside-avoid">
						<PostCard {post} />
					</div>
				{/each}
			</div>
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
				<span class="tabular-nums opacity-70">({postVoteTotal})</span>
			</button>
			<button
				type="button"
				onclick={() => selectVoteTarget('comments')}
				class="rounded-full px-3 py-1 font-oswald text-sm font-bold {voteTarget === 'comments'
					? 'bg-olf-darkbrown text-white'
					: 'bg-olf-darkbrown/10 text-olf-darkbrown'}"
			>
				{m.profile_votes_tab_comments()}
				<span class="tabular-nums opacity-70">({commentVoteTotal})</span>
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
							v.post.deletedAt !== null,
							v.post.deletedAt === null ? `/posts/${v.postId}` : null
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
						v.comment.deletedAt !== null,
						v.comment.deletedAt === null
							? `/posts/${v.comment.post.id}#comment-${v.commentId}`
							: null
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
			<div class="mt-3 flex justify-center text-olf-darkbrown/60"><Spinner /></div>
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
