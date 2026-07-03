<script lang="ts">
	import type { PostCategory, MediaInput } from '@meteorclass/pigweed-contract';
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { createPost, uploadMedia, ContentFlaggedError } from '$lib/api/posts';
	import { loadingScreen } from '$lib/stores/loadingScreen.svelte';
	import { MANTIN_COORDS } from '$lib/config/seo';
	import { CATEGORY_COLOR } from '$lib/config/categories';

	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { Star, ImagePlus, X, MapPin, Mail } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	const CATEGORIES: PostCategory[] = ['EGGS', 'VEGGIES', 'FRUITS', 'ANIMALS'];
	const categoryLabel = (c: PostCategory) =>
		c === 'EGGS'
			? m.posts_cat_eggs()
			: c === 'VEGGIES'
				? m.posts_cat_veggies()
				: c === 'FRUITS'
					? m.posts_cat_fruits()
					: m.posts_cat_animals();

	let title = $state('');
	let body = $state('');
	let category = $state<PostCategory | ''>('');
	let rating = $state<number | null>(null);
	// A rating turns this post into a "review" — the heading's noun swaps to match.
	const isReview = $derived(rating != null);
	let files = $state<File[]>([]);

	let submitting = $state(false);
	let stage = $state<'' | 'uploading' | 'posting'>('');
	let error = $state<string | null>(null);

	// Location is resolved up front (on mount), not at submit — desktop
	// geolocation is flaky even when fully permitted (kCLErrorLocationUnknown
	// etc.), so we never block posting on it. Precise fix when we can get it;
	// otherwise the farm's coords as an honest, adjustable approximation.
	let coords = $state<{ lat: number; lng: number } | null>(null);
	let usingApprox = $state(false);
	let locating = $state(true);

	async function resolveLocation() {
		locating = true;
		try {
			const pos = await getPosition();
			coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
			usingApprox = false;
		} catch {
			// GPS denied/unavailable/timed out — fall back to the farm. The
			// post still lands somewhere real; the banner tells the user it's
			// approximate and offers to retry for a precise pin.
			coords = { lat: MANTIN_COORDS.lat, lng: MANTIN_COORDS.lng };
			usingApprox = true;
		} finally {
			locating = false;
		}
	}

	onMount(resolveLocation);

	const previews = $derived(files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		if (!input.files) return;
		// Cap at the contract's MAX_MEDIA_PER_POST (10), append to any existing.
		files = [...files, ...Array.from(input.files)].slice(0, 10);
		input.value = '';
	}

	function removeFile(i: number) {
		files = files.filter((_, idx) => idx !== i);
	}

	function getPosition(): Promise<GeolocationPosition> {
		return new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error(m.posts_new_geo_unsupported()));
				return;
			}
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: false,
				// Short — on hotspots/ethernet/VPN CoreLocation just errors or
				// hangs; we'd rather drop to the farm fallback fast than spin.
				timeout: 8000,
				maximumAge: 300000
			});
		});
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		error = null;

		if (title.trim().length === 0) {
			error = m.posts_new_title_required();
			return;
		}

		// Location resolved on mount (precise or farm-default). If it's still
		// resolving, finish that first — but never block the post on it.
		if (!coords) await resolveLocation();
		const position = coords ?? { lat: MANTIN_COORDS.lat, lng: MANTIN_COORDS.lng };

		submitting = true;
		// Publishing is the app's biggest task (uploads + moderation + redirect)
		// — block the whole screen with the global chicken loader, staged copy.
		loadingScreen.show(m.posts_new_stage_uploading());
		try {
			// Upload media to our R2 proxy, preserving order.
			stage = 'uploading';
			const media: MediaInput[] = [];
			for (let i = 0; i < files.length; i++) {
				const up = await uploadMedia(files[i], category || undefined);
				media.push({ url: up.url, kind: up.kind, order: i, width: up.width, height: up.height });
			}

			// Create the post.
			stage = 'posting';
			loadingScreen.update(m.posts_new_stage_posting());
			await createPost({
				title: title.trim(),
				body: body.trim(),
				latitude: position.lat,
				longitude: position.lng,
				...(category ? { category } : {}),
				...(rating != null ? { rating } : {}),
				...(media.length > 0 ? { media } : {})
			});

			// Refresh layout/profile data (post counts, etc.) then go to the farm.
			await invalidateAll();
			await goto('/posts');
		} catch (err) {
			error =
				err instanceof ContentFlaggedError
					? m.posts_new_flagged({ reason: err.message })
					: err instanceof Error
						? err.message
						: m.posts_new_failed();
		} finally {
			loadingScreen.hide();
			submitting = false;
			stage = '';
		}
	}
</script>

<Seo title="New post — Our Little Farm" description="Share an update or review with the farm." />

<div class="flex-1 bg-olf-lightgreen px-4 py-8 sm:px-6">
	<form onsubmit={submit} class="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl bg-olf-beige p-6">
		<h1 class="font-homemade-apple text-3xl font-bold text-olf-darkgreen">
			{m.posts_new_title_prefix()}<!--
			Only the noun crossfades. The keyed spans share one grid cell so they
			overlap during the fade instead of shoving the layout. -->
			<span class="inline-grid">
				{#key isReview}
					<span style="grid-area: 1 / 1" in:fade={{ duration: 250 }} out:fade={{ duration: 150 }}>
						{isReview ? m.posts_new_noun_review() : m.posts_new_noun_post()}
					</span>
				{/key}
			</span>{m.posts_new_title_suffix()}
		</h1>

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

		<!-- Media -->
		<div class="flex flex-col gap-2 font-oswald font-bold text-olf-darkbrown">
			{m.posts_new_field_media()}
			<label
				class="flex w-fit cursor-pointer items-center gap-2 rounded-full bg-olf-darkbrown px-4 py-2 text-sm font-bold text-olf-beige"
			>
				<ImagePlus size={16} />
				{m.posts_new_add_photos()}
				<input type="file" accept="image/*" multiple onchange={onPick} class="hidden" />
			</label>
			{#if previews.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each previews as p, i (p.url)}
						<div class="relative h-20 w-20 overflow-hidden rounded-lg bg-olf-lightbrown">
							<img src={p.url} alt={p.name} class="h-full w-full object-cover" />
							<button
								type="button"
								onclick={() => removeFile(i)}
								aria-label={m.posts_new_remove_photo()}
								class="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
							>
								<X size={12} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<button
			type="submit"
			disabled={submitting}
			class="mt-2 flex items-center justify-center gap-2 rounded-full bg-olf-darkgreen py-3 font-oswald font-bold tracking-wider text-white uppercase disabled:opacity-60"
		>
			{#if submitting}
				<Spinner size={16} />
				{stage === 'uploading' ? m.posts_new_stage_uploading() : m.posts_new_stage_posting()}
			{:else}
				<Mail size={18} class="shrink-0" />
				{isReview ? m.posts_new_submit_review() : m.posts_new_submit_post()}
			{/if}
		</button>

		<!-- Location status sits AFTER the submit CTA on purpose: posting is the
		     point, location is a quiet footnote — not something we lead with. -->
		<div
			class="flex items-center gap-2 rounded-xl px-3 py-2 font-oswald text-xs {usingApprox
				? 'bg-olf-lightbrown/40 text-olf-darkbrown'
				: 'bg-olf-lightgreen text-olf-darkgreen'}"
		>
			{#if locating}
				<Spinner size={12} />
				<span>{m.posts_new_loc_finding()}</span>
			{:else if usingApprox}
				<MapPin size={14} class="shrink-0" />
				<span class="flex-1">{m.posts_new_loc_approx()}</span>
				<button type="button" onclick={resolveLocation} class="shrink-0 font-bold underline">
					{m.posts_new_loc_retry()}
				</button>
			{:else}
				<MapPin size={14} class="shrink-0" />
				<span>{m.posts_new_loc_precise()}</span>
			{/if}
		</div>
	</form>
</div>
