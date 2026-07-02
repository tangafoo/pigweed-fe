<script lang="ts">
	import type { Post, PostCategory, PostPatchInput } from '@meteorclass/pigweed-contract';
	import { untrack } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { updatePost, ContentFlaggedError } from '$lib/api/posts';
	import { CATEGORY_COLOR } from '$lib/config/categories';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { Star } from '@lucide/svelte';

	interface PostEditorProps {
		post: Post;
		/** Called with the updated post after a successful save. */
		onSaved: (post: Post) => void;
		/** Called when the author backs out without saving. */
		onCancel: () => void;
	}
	let { post, onSaved, onCancel }: PostEditorProps = $props();

	const CATEGORIES: PostCategory[] = ['EGGS', 'VEGGIES', 'FRUITS', 'ANIMALS'];
	const categoryLabel = (c: PostCategory) =>
		c === 'EGGS'
			? m.posts_cat_eggs()
			: c === 'VEGGIES'
				? m.posts_cat_veggies()
				: c === 'FRUITS'
					? m.posts_cat_fruits()
					: m.posts_cat_animals();

	// Seeded once from the post — the same fields the create form exposes.
	// untrack: the initial value is the seed; the form owns the state after.
	let title = $state(untrack(() => post.title));
	let body = $state(untrack(() => post.body));
	let category = $state<PostCategory | ''>(untrack(() => post.category ?? ''));
	let rating = $state<number | null>(untrack(() => post.rating ?? null));

	let saving = $state(false);
	let error = $state<string | null>(null);

	async function save(e: SubmitEvent) {
		e.preventDefault();
		if (saving) return;
		error = null;

		if (title.trim().length === 0) {
			error = m.posts_new_title_required();
			return;
		}

		// `null` clears category/rating, a value sets it. Body is only sent when
		// non-empty — the BE's PATCH rejects an empty body (unlike create).
		const patch: PostPatchInput = {
			title: title.trim(),
			category: category || null,
			rating: rating
		};
		if (body.trim().length > 0) patch.body = body.trim();

		saving = true;
		try {
			onSaved(await updatePost(post.id, patch));
		} catch (err) {
			error =
				err instanceof ContentFlaggedError
					? m.posts_edit_flagged({ reason: err.message })
					: err instanceof Error
						? err.message
						: m.posts_edit_failed();
		} finally {
			saving = false;
		}
	}
</script>

<form
	onsubmit={save}
	class="flex flex-col gap-4 rounded-xl border-2 border-olf-darkgreen bg-olf-beige p-4 shadow-md"
>
	<h2 class="font-homemade-apple text-2xl font-bold text-olf-darkgreen">
		{m.posts_edit_heading()}
	</h2>

	{#if error}
		<p class="rounded-xl bg-red-700 px-4 py-3 font-oswald text-sm text-white">{error}</p>
	{/if}

	<label class="flex flex-col gap-1 font-oswald font-bold text-olf-darkbrown">
		{m.posts_new_field_title()}
		<input
			type="text"
			bind:value={title}
			maxlength="200"
			required
			placeholder={m.posts_new_title_placeholder()}
			class="rounded-lg border-2 border-olf-darkgreen/30 bg-white/60 px-3 py-2 font-normal text-olf-darkbrown"
		/>
	</label>

	<label class="flex flex-col gap-1 font-oswald font-bold text-olf-darkbrown">
		{m.posts_new_field_body()}
		<textarea
			bind:value={body}
			maxlength="10000"
			rows="5"
			placeholder={m.posts_new_body_placeholder()}
			class="resize-y rounded-lg border-2 border-olf-darkgreen/30 bg-white/60 px-3 py-2 font-normal text-olf-darkbrown"
		></textarea>
	</label>

	<!-- Category -->
	<div class="flex flex-col gap-1 font-oswald font-bold text-olf-darkbrown">
		{m.posts_new_field_category()}
		<div class="flex flex-wrap gap-2 font-normal">
			<button
				type="button"
				onclick={() => (category = '')}
				class="rounded-full px-3 py-1 text-sm font-bold transition-colors duration-200 {category ===
				''
					? 'bg-olf-darkgreen text-white'
					: 'bg-olf-darkbrown/10 text-olf-darkbrown'}"
			>
				{m.posts_new_category_none()}
			</button>
			{#each CATEGORIES as c (c)}
				<button
					type="button"
					onclick={() => (category = c)}
					class="rounded-full px-3 py-1 text-sm font-bold transition-colors duration-200 {category ===
					c
						? CATEGORY_COLOR[c]
						: 'bg-olf-darkbrown/10 text-olf-darkbrown'}"
				>
					{categoryLabel(c)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Rating (optional, for reviews) -->
	<div class="flex flex-col gap-1 font-oswald font-bold text-olf-darkbrown">
		{m.posts_new_field_rating()}
		<div class="flex items-center gap-1">
			{#each [1, 2, 3, 4, 5] as r (r)}
				<button
					type="button"
					aria-label={m.posts_rating_min({ rating: r })}
					onclick={() => (rating = rating === r ? null : r)}
				>
					<Star
						size={26}
						class="transition-colors duration-200 {rating != null && r <= rating
							? 'fill-olf-yolk text-olf-yolk'
							: 'text-olf-darkbrown/30'}"
					/>
				</button>
			{/each}
			{#if rating != null}
				<button
					type="button"
					onclick={() => (rating = null)}
					class="ml-2 text-sm font-normal text-olf-darkbrown/60 underline"
				>
					{m.posts_new_rating_clear()}
				</button>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2">
		<button
			type="submit"
			disabled={saving}
			class="flex items-center justify-center gap-1.5 rounded-full bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold tracking-wider text-white uppercase disabled:opacity-60"
		>
			{#if saving}<Spinner size={14} />{/if}
			{saving ? m.posts_edit_saving() : m.posts_edit_save()}
		</button>
		<button
			type="button"
			onclick={onCancel}
			disabled={saving}
			class="rounded-full border-2 border-olf-darkbrown px-4 py-1.5 font-oswald text-xs font-bold tracking-wider text-olf-darkbrown uppercase disabled:opacity-60"
		>
			{m.posts_edit_cancel()}
		</button>
	</div>
</form>
