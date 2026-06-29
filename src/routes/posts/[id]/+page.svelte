<script lang="ts">
	import type { PageData } from './$types';
	import type { Comment } from '@meteorclass/pigweed-contract';
	import { buildCommentTree } from '$lib/utils/comments-tree';
	import { m } from '$lib/paraglide/messages.js';
	import PostCard from '$lib/components/posts/PostCard.svelte';
	import CommentComposer from '$lib/components/posts/CommentComposer.svelte';
	import CommentCard from '$lib/components/posts/CommentCard.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { ArrowLeft } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
	const signedIn = $derived(!!data.session?.user);

	// The flat comment list is owned here; the tree and live count derive from
	// it. Re-seed when navigating between posts (same route, param change).
	let comments = $state<Comment[]>([]);
	$effect(() => {
		if (data.post.id) comments = data.comments;
	});

	// Flat list (parentCommentId + depth) → nested tree, assembled client-side.
	const tree = $derived(buildCommentTree(comments));

	// A new comment/reply lands here; appending re-derives the tree + count.
	function addComment(c: Comment) {
		comments = [...comments, c];
	}

	const seoDescription = $derived(
		data.post.body.slice(0, 160) || `A post by ${data.post.author.username} on Our Little Farm.`
	);
</script>

<Seo title="{data.post.title} — Our Little Farm" description={seoDescription} type="article" />

<div class="flex-1 bg-olf-lightgreen px-4 py-8 sm:px-6">
	<div class="mx-auto flex max-w-2xl flex-col gap-6">
		<a
			href="/posts"
			class="flex w-fit items-center gap-1.5 font-oswald text-sm font-bold tracking-wide text-olf-darkgreen uppercase hover:underline"
		>
			<ArrowLeft size={16} class="shrink-0" />
			{m.posts_back_to_feed()}
		</a>

		<PostCard post={data.post} liveCommentCount={comments.length} expandImage />

		<section class="flex flex-col gap-4 rounded-xl bg-olf-eggshell p-4 shadow-md">
			<h2 class="font-homemade-apple text-2xl font-bold text-olf-darkgreen">
				{m.posts_comments_heading()} ({comments.length})
			</h2>

			<CommentComposer
				postId={data.post.id}
				{signedIn}
				placeholder={m.posts_comment_placeholder()}
				onPosted={addComment}
			/>

			{#if tree.length === 0}
				<p class="py-6 text-center font-oswald text-olf-darkbrown/60">
					{m.posts_comments_empty()}
				</p>
			{:else}
				<div class="flex flex-col gap-4">
					{#each tree as node (node.id)}
						<CommentCard {node} postId={data.post.id} {signedIn} onReplyPosted={addComment} />
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
