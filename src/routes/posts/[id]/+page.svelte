<script lang="ts">
	import { tick } from 'svelte';
	import type { PageData } from './$types';
	import type { Comment, Post } from '@meteorclass/pigweed-contract';
	import { slide, fade } from 'svelte/transition';
	import { buildCommentTree } from '$lib/utils/comments-tree';
	import { m } from '$lib/paraglide/messages.js';
	import { goto, invalidateAll } from '$app/navigation';
	import { deletePost } from '$lib/api/posts';
	import PostCard from '$lib/components/posts/PostCard.svelte';
	import PostEditor from '$lib/components/posts/PostEditor.svelte';
	import CommentComposer from '$lib/components/posts/CommentComposer.svelte';
	import CommentCard from '$lib/components/posts/CommentCard.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { ArrowLeft } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();
	const signedIn = $derived(!!data.session?.user);

	// Writable $derived: tracks the loader's post, but an in-place edit can
	// overwrite it (the override holds until `data.post` changes again — e.g.
	// navigating to another post re-seeds it automatically).
	let post = $derived(data.post);

	// Author-only controls. `isFarmOwner`/geo never gate this — pure id match.
	const isAuthor = $derived(data.session?.user?.id === post.author.id);
	let editing = $state(false);
	let confirmingDelete = $state(false);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);

	function onSaved(updated: Post) {
		post = updated;
		editing = false;
	}

	async function confirmDelete() {
		if (deleting) return;
		deleting = true;
		deleteError = null;
		try {
			await deletePost(post.id);
			// Refresh feed/profile counts, then leave the now-gone post.
			await invalidateAll();
			await goto('/posts');
		} catch (err) {
			deleteError = err instanceof Error ? err.message : m.posts_delete_failed();
			deleting = false;
		}
	}

	// The flat comment list. `data.comments` is a STREAMED promise (see
	// +page.server.ts) so the post paints before the thread arrives; this
	// effect resolves it into local state (null = still loading), which stays
	// locally appendable and re-seeds itself when navigating between posts.
	let comments = $state<Comment[] | null>(null);
	$effect(() => {
		let stale = false;
		comments = null;
		Promise.resolve(data.comments).then((list) => {
			if (stale) return;
			comments = list;
			// Deep link (/posts/x#comment-y from the profile's vote history):
			// the thread streams in AFTER the browser's native fragment jump
			// already ran and found nothing — so once the tree renders, do the
			// jump ourselves (:target then flashes the comment).
			void tick().then(() => {
				const hash = window.location.hash;
				if (!stale && hash.startsWith('#comment-')) {
					document
						.getElementById(hash.slice(1))
						?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			});
		});
		return () => {
			stale = true;
		};
	});

	// Flat list (parentCommentId + depth) → nested tree, assembled client-side.
	const tree = $derived(comments ? buildCommentTree(comments) : []);

	// A new comment/reply lands here; appending re-derives the tree + count.
	function addComment(c: Comment) {
		comments = [...(comments ?? []), c];
	}

	const seoDescription = $derived(
		post.body.slice(0, 160) || `A post by ${post.author.username} on Our Little Farm.`
	);
</script>

<Seo title="{post.title} — Our Little Farm" description={seoDescription} type="article" />

<div class="flex-1 bg-olf-lightgreen px-4 py-8 sm:px-6">
	<div class="mx-auto flex max-w-2xl flex-col gap-6">
		<a
			href="/posts"
			class="flex w-fit items-center gap-1.5 font-oswald text-sm font-bold tracking-wide text-olf-darkgreen uppercase hover:underline"
		>
			<ArrowLeft size={16} class="shrink-0" />
			{m.posts_back_to_feed()}
		</a>

		{#if editing}
			<!-- `in:` only (not `transition:`): the outgoing block is removed
			     immediately, so the two never share layout and there's no slide
			     flicker on the card before the form appears. -->
			<div in:slide={{ duration: 200 }}>
				<PostEditor {post} {onSaved} onCancel={() => (editing = false)} />
			</div>
		{:else}
			<div in:fade={{ duration: 150 }}>
				<PostCard
					{post}
					liveCommentCount={comments?.length}
					expandImage
					canManage={isAuthor}
					onEdit={() => (editing = true)}
					onDelete={() => {
						deleteError = null;
						confirmingDelete = true;
					}}
				/>
			</div>
		{/if}

		{#if isAuthor}
			<ConfirmDialog
				bind:open={confirmingDelete}
				title={m.posts_delete_confirm()}
				confirmLabel={deleting ? m.posts_deleting() : m.posts_delete_confirm_yes()}
				cancelLabel={m.posts_delete_cancel()}
				danger
				busy={deleting}
				onConfirm={confirmDelete}
			>
				{m.posts_delete_body()}
				{#if deleteError}
					<span class="mt-2 block font-bold text-olf-red">{deleteError}</span>
				{/if}
			</ConfirmDialog>
		{/if}

		<section class="flex flex-col gap-4 rounded-xl bg-olf-eggshell p-4 shadow-md">
			<h2 class="font-homemade-apple text-2xl font-bold text-olf-darkgreen">
				{m.posts_comments_heading()}{#if comments}&nbsp;({comments.length}){/if}
			</h2>

			<CommentComposer
				postId={data.post.id}
				{signedIn}
				placeholder={m.posts_comment_placeholder()}
				onPosted={addComment}
			/>

			{#if comments === null}
				<div class="flex justify-center py-6 text-olf-darkgreen"><Spinner /></div>
			{:else if tree.length === 0}
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
