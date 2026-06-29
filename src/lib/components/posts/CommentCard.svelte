<script lang="ts">
	import type { Comment, VoteValue, VoteResponse } from '@meteorclass/pigweed-contract';
	import type { CommentNode } from '$lib/utils/comments-tree';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative } from '$lib/utils/date';
	import { goto } from '$app/navigation';
	import { setCommentVote, clearCommentVote } from '$lib/api/votes';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import CommentComposer from '$lib/components/posts/CommentComposer.svelte';
	import Self from '$lib/components/posts/CommentCard.svelte';
	import { ArrowBigUp, ArrowBigDown, MessageSquare } from '@lucide/svelte';

	interface Props {
		node: CommentNode;
		postId: string;
		signedIn: boolean;
		/** Bubble a freshly-posted reply up to the page (it owns the flat list). */
		onReplyPosted: (comment: Comment) => void;
	}
	let { node, postId, signedIn, onReplyPosted }: Props = $props();

	const isDeleted = $derived(node.author === null);

	// Optimistic vote override, reconciled to the server's authoritative counts
	// — same pattern as PostCard. No reset effect needed: the page keys each
	// card by comment id, so an instance always represents one stable comment.
	let override = $state<VoteResponse | null>(null);
	let voting = $state(false);
	const myVote = $derived(override ? override.myVote : node.myVote);
	const upvotes = $derived(override ? override.upvoteCount : node.upvoteCount);
	const downvotes = $derived(override ? override.downvoteCount : node.downvoteCount);
	const net = $derived(upvotes - downvotes);

	async function vote(value: VoteValue) {
		if (!signedIn) return void goto('/login');
		if (voting) return;
		voting = true;
		const removing = myVote === value;
		const rollback = override;
		let up = upvotes;
		let down = downvotes;
		if (myVote === 'UP') up--;
		else if (myVote === 'DOWN') down--;
		if (!removing) {
			if (value === 'UP') up++;
			else down++;
		}
		override = { upvoteCount: up, downvoteCount: down, myVote: removing ? null : value };
		const res = removing ? await clearCommentVote(node.id) : await setCommentVote(node.id, value);
		override = res ?? rollback;
		voting = false;
	}

	let replying = $state(false);
	// Hidden (community net-score < -5): collapse Reddit-style; body already
	// shipped, so reveal needs no extra fetch.
	let revealed = $state(false);
	const collapsed = $derived(node.hidden && !revealed);

	const topAwards = $derived(node.awards.slice(0, 3));
</script>

<div class="flex flex-col gap-1.5">
	{#if collapsed}
		<button
			type="button"
			onclick={() => (revealed = true)}
			class="self-start rounded-full bg-olf-darkbrown/10 px-3 py-1 font-oswald text-xs text-olf-darkbrown/60 hover:bg-olf-darkbrown/20"
		>
			{m.posts_comment_hidden_show()}
		</button>
	{:else}
		<!-- Author row -->
		<div class="flex items-center gap-2">
			{#if isDeleted || !node.author}
				<span class="size-6 shrink-0 rounded-full bg-olf-darkbrown/20"></span>
				<span class="font-supermercado-one text-sm text-olf-darkbrown/50">
					{m.posts_comment_deleted()}
				</span>
			{:else}
				<a href="/users/{node.author.id}" class="shrink-0" aria-label={node.author.username}>
					<Avatar
						animal={node.author.animal}
						avatarSeed={node.author.avatarSeed}
						gender={node.author.gender}
						size="sm"
					/>
				</a>
				<a
					href="/users/{node.author.id}"
					class="truncate font-supermercado-one text-sm text-olf-darkbrown"
				>
					{node.author.username}
				</a>
				{#if node.author.isFarmOwner}
					<span
						class="shrink-0 rounded bg-olf-darkgreen px-1.5 font-oswald text-xxs font-bold tracking-wider text-white"
						title={m.posts_op_tooltip()}
					>
						{m.posts_op_badge()}
					</span>
				{/if}
				{#if node.author.isFoundingFlock}
					<span
						class="shrink-0 rounded bg-olf-yolk px-1.5 font-oswald text-xxs font-bold tracking-wider text-olf-darkgreen"
						title={m.subscribe_founder_tooltip()}
					>
						{m.subscribe_founder_badge()}
					</span>
				{/if}
			{/if}
			<time
				datetime={String(node.createdAt)}
				class="ml-auto shrink-0 font-oswald text-xxs text-olf-darkbrown/45"
			>
				{formatRelative(node.createdAt)}
			</time>
		</div>

		<!-- Body -->
		<p
			class="font-oswald text-[0.95rem] whitespace-pre-wrap text-olf-darkbrown/90 {isDeleted
				? 'italic opacity-60'
				: ''}"
		>
			{node.body}
		</p>

		<!-- Award stack -->
		{#if topAwards.length > 0}
			<div class="flex flex-wrap gap-1">
				{#each topAwards as a (a.awardTypeId)}
					<span
						class="flex items-center gap-1 rounded-full bg-olf-lightgreen px-2 py-0.5 font-oswald text-xxs font-bold text-olf-darkgreen"
						title={a.name}
					>
						🏅 {a.count}
					</span>
				{/each}
			</div>
		{/if}

		<!-- Actions: vote + reply (suppressed on deleted stubs) -->
		{#if !isDeleted}
			<div class="flex items-center gap-3 text-olf-darkbrown/70">
				<span class="flex items-center gap-1 font-oswald text-xs">
					<button
						type="button"
						onclick={() => vote('UP')}
						disabled={voting}
						aria-pressed={myVote === 'UP'}
						aria-label={m.posts_upvote()}
						class="transition-transform hover:scale-115 disabled:opacity-60"
					>
						<ArrowBigUp
							size={18}
							class={myVote === 'UP' ? 'fill-olf-moss text-olf-moss' : 'text-olf-darkgreen'}
						/>
					</button>
					<span class="tabular-nums">{net}</span>
					<button
						type="button"
						onclick={() => vote('DOWN')}
						disabled={voting}
						aria-pressed={myVote === 'DOWN'}
						aria-label={m.posts_downvote()}
						class="transition-transform hover:scale-115 disabled:opacity-60"
					>
						<ArrowBigDown
							size={18}
							class={myVote === 'DOWN' ? 'fill-olf-yolk text-olf-yolk' : 'text-olf-darkgreen'}
						/>
					</button>
				</span>
				<button
					type="button"
					onclick={() => (replying = !replying)}
					class="flex items-center gap-1 font-oswald text-xs font-bold tracking-wide uppercase hover:text-olf-darkgreen"
				>
					<MessageSquare size={14} class="shrink-0" />
					{m.posts_comment_reply()}
				</button>
			</div>
		{/if}

		{#if replying}
			<div class="pt-1">
				<CommentComposer
					{postId}
					{signedIn}
					parentCommentId={node.id}
					compact
					placeholder={m.posts_comment_reply_placeholder()}
					submitLabel={m.posts_comment_reply()}
					onPosted={onReplyPosted}
					oncancel={() => (replying = false)}
				/>
			</div>
		{/if}
	{/if}

	<!-- Replies (kept even under a deleted/collapsed parent unless collapsed) -->
	{#if !collapsed && node.children.length > 0}
		<div class="mt-1.5 flex flex-col gap-3 border-l-2 border-olf-darkgreen/15 pl-3">
			{#each node.children as child (child.id)}
				<Self node={child} {postId} {signedIn} {onReplyPosted} />
			{/each}
		</div>
	{/if}
</div>
