<script lang="ts">
	import type {
		Comment,
		VoteValue,
		VoteResponse,
		AwardSummary
	} from '@meteorclass/pigweed-contract';
	import type { CommentNode } from '$lib/utils/comments-tree';
	import { m } from '$lib/paraglide/messages.js';
	import { formatRelative } from '$lib/utils/date';
	import { goto } from '$app/navigation';
	import { setCommentVote, clearCommentVote } from '$lib/api/votes';
	import { asset } from '$lib/config/assets';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import AwardModal from '$lib/components/posts/AwardModal.svelte';
	import AwardGrantersModal from '$lib/components/posts/AwardGrantersModal.svelte';
	import CommentComposer from '$lib/components/posts/CommentComposer.svelte';
	import Self from '$lib/components/posts/CommentCard.svelte';
	import { ArrowBigUp, ArrowBigDown, Gift, MessageSquare } from '@lucide/svelte';

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

	// Gift-an-award flow — same optimistic pattern as PostCard (no reset
	// effect needed: the tree keys each card by comment id). Received awards
	// render Reddit-style as tiny icons next to the gift button.
	let giftOpen = $state(false);
	let awardsOverride = $state<AwardSummary[] | null>(null);
	const awards = $derived(awardsOverride ?? node.awards);
	const topAwards = $derived(awards.slice(0, 3));
	const totalAwards = $derived(awards.reduce((n, a) => n + a.count, 0));
	const awardsTitle = $derived(awards.map((a) => `${a.name} ×${a.count}`).join(' · '));
	let brokenArt = $state<Record<string, boolean>>({});

	function openGift() {
		if (!signedIn) return void goto('/login');
		giftOpen = true;
	}
	// Clicking the received-awards stack opens the who-gifted-this modal
	// (auth-gated on the BE, so signed-out viewers bounce to login).
	let grantersOpen = $state(false);
	function openGranters() {
		if (!signedIn) return void goto('/login');
		grantersOpen = true;
	}
	function onGranted(a: { id: string; assetKey: string; name: string }) {
		const next = awards.map((s) => (s.awardTypeId === a.id ? { ...s, count: s.count + 1 } : s));
		if (!next.some((s) => s.awardTypeId === a.id)) {
			next.push({ awardTypeId: a.id, assetKey: a.assetKey, name: a.name, count: 1 });
		}
		awardsOverride = next.sort((x, y) => y.count - x.count);
	}
</script>

<!-- id anchors deep links from the profile's vote history
     (/posts/x#comment-y); scroll-mt clears the sticky navbar and :target
     flashes the landing spot (see the style block). -->
<div id="comment-{node.id}" class="comment-anchor flex scroll-mt-24 flex-col gap-1.5">
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
						class="shrink-0 rounded bg-olf-yolk px-1.5 font-oswald text-xxs font-bold tracking-wider text-olf-eggshell"
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

		<!-- Actions: vote + reply + gift (suppressed on deleted stubs) -->
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
				<!-- Signed-out viewers get NO gift icon — just received awards, read-only. -->
				{#snippet awardIcons()}
					<span class="flex items-center -space-x-2">
						{#each topAwards as a (a.awardTypeId)}
							{#if brokenArt[a.assetKey]}
								<span class="text-[11px] leading-none">🏅</span>
							{:else}
								<img
									src={asset(`${a.assetKey}.webp`)}
									alt={a.name}
									onerror={() => (brokenArt[a.assetKey] = true)}
									class="h-4 w-4 shrink-0 rounded-full bg-olf-lightgreen object-contain p-px"
								/>
							{/if}
						{/each}
					</span>
					<span class="tabular-nums">{totalAwards}</span>
				{/snippet}
				{#if signedIn}
					<button
						type="button"
						onclick={openGift}
						aria-label={m.award_modal_title()}
						title={m.award_modal_title()}
						class="flex items-center hover:text-olf-darkgreen"
					>
						<Gift size={15} class="shrink-0" />
					</button>
				{/if}
				{#if totalAwards > 0}
					<!-- The stack itself opens "who gifted this?" -->
					<button
						type="button"
						onclick={openGranters}
						aria-label={m.granters_title()}
						title={awardsTitle}
						class="flex items-center gap-1 font-oswald text-xs hover:text-olf-darkgreen"
					>
						{@render awardIcons()}
					</button>
				{/if}
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

	{#if giftOpen}
		<AwardModal bind:open={giftOpen} targetType="comment" targetId={node.id} {onGranted} />
	{/if}
	{#if grantersOpen}
		<AwardGrantersModal
			bind:open={grantersOpen}
			targetType="comment"
			targetId={node.id}
			{awards}
			recipientUsername={node.author?.username ?? ''}
		/>
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

<style>
	/* Deep-link landing flash: :target matches once the streamed thread has
	   rendered and the page scrolls here — a soft yolk wash that fades out. */
	.comment-anchor:target {
		animation: comment-flash 2.2s ease-out 1;
		border-radius: 0.75rem;
	}
	@keyframes comment-flash {
		0%,
		25% {
			background-color: color-mix(in srgb, var(--color-olf-yolk) 22%, transparent);
			box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-olf-yolk) 22%, transparent);
		}
		100% {
			background-color: transparent;
			box-shadow: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.comment-anchor:target {
			animation: none;
		}
	}
</style>
