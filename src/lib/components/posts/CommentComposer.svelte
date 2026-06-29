<script lang="ts">
	import type { Comment } from '@meteorclass/pigweed-contract';
	import { m } from '$lib/paraglide/messages.js';
	import { createComment } from '$lib/api/comments';
	import { ContentFlaggedError } from '$lib/api/posts';
	import { SendHorizontal } from '@lucide/svelte';

	interface Props {
		postId: string;
		signedIn: boolean;
		/** Set for a reply composer; omit for the top-level box. */
		parentCommentId?: string;
		/** Reply composers render tighter and auto-focus. */
		compact?: boolean;
		placeholder?: string;
		submitLabel?: string;
		/** Bubble the created comment up so the page can splice it into the tree. */
		onPosted: (comment: Comment) => void;
		/** Reply composers show a Cancel that calls this. */
		oncancel?: () => void;
	}
	let {
		postId,
		signedIn,
		parentCommentId,
		compact = false,
		placeholder,
		submitLabel,
		onPosted,
		oncancel
	}: Props = $props();

	let body = $state('');
	let submitting = $state(false);
	let errorMsg = $state<string | null>(null);

	const canSubmit = $derived(body.trim().length > 0 && !submitting);

	async function submit() {
		if (!canSubmit) return;
		submitting = true;
		errorMsg = null;
		try {
			const comment = await createComment(postId, body.trim(), parentCommentId);
			body = '';
			onPosted(comment);
			oncancel?.(); // a reply composer closes itself once the reply lands
		} catch (e) {
			errorMsg = e instanceof ContentFlaggedError ? e.message : m.posts_comment_failed();
		} finally {
			submitting = false;
		}
	}

	// Cmd/Ctrl+Enter submits — the expected shortcut in a comment box.
	function onKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}
</script>

{#if signedIn}
	<form
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
		class="flex flex-col gap-2"
	>
		<textarea
			bind:value={body}
			onkeydown={onKeydown}
			{placeholder}
			rows={compact ? 2 : 3}
			disabled={submitting}
			class="w-full resize-y rounded-lg border-2 border-olf-darkgreen/30 bg-olf-eggshell px-3 py-2 font-oswald text-olf-darkbrown placeholder:text-olf-darkbrown/40 focus:border-olf-darkgreen focus:outline-none disabled:opacity-60"
		></textarea>
		{#if errorMsg}
			<p class="font-oswald text-sm text-red-700">{errorMsg}</p>
		{/if}
		<div class="flex items-center justify-end gap-2">
			{#if oncancel}
				<button
					type="button"
					onclick={oncancel}
					class="rounded-full px-3 py-1.5 font-oswald text-sm text-olf-darkbrown/70 hover:text-olf-darkbrown"
				>
					{m.posts_comment_cancel()}
				</button>
			{/if}
			<button
				type="submit"
				disabled={!canSubmit}
				class="flex shrink-0 items-center gap-1.5 rounded-full bg-olf-darkgreen px-4 py-1.5 font-oswald text-sm font-bold tracking-wider text-olf-eggshell uppercase transition-opacity disabled:opacity-50"
			>
				<SendHorizontal size={15} class="shrink-0" />
				{submitting ? m.posts_comment_posting() : (submitLabel ?? m.posts_comment_submit())}
			</button>
		</div>
	</form>
{:else}
	<a
		href="/login"
		class="inline-block rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-sm font-bold tracking-wider text-olf-beige uppercase"
	>
		{m.posts_comment_signin()}
	</a>
{/if}
