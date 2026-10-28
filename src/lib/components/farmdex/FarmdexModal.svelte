<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { parseISO } from 'date-fns';
	import { tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import { farmdexCategoryLabel, farmdexNumber, type FarmdexEntry } from '$lib/data/farmdex';

	/**
	 * Farmdex entry detail — a native <dialog> (free focus-trap + Esc), photo
	 * on the left, details on the right (stacked on mobile). Open = `entry`
	 * is non-null. ← / → call `onstep` so the parent can move to the
	 * previous / next entry.
	 */
	let {
		entry = $bindable(),
		onstep
	}: { entry: FarmdexEntry | null; onstep?: (delta: number) => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let imageIndex = $state(0);
	// +1 = moving forward (new photo slides in from the right), -1 = back.
	let direction = $state(1);

	// Drive the native <dialog> from `entry`, both directions. A new entry
	// starts on its cover photo.
	$effect(() => {
		if (!dialog) return;
		if (entry) {
			imageIndex = 0;
			// pointerleave never fires when the dialog closes under the mouse.
			lens = null;
			overPhoto = false;
			if (!dialog.open) dialog.showModal();
		} else if (dialog.open) dialog.close();
	});

	// What the card renders: the last non-null entry, so the content stays put
	// while the close animation plays instead of blanking instantly.
	let shown = $state.raw<FarmdexEntry | null>(null);
	$effect.pre(() => {
		if (entry) shown = entry;
	});

	// Step through the photos, wrapping at both ends.
	function step(delta: number) {
		if (!entry) return;
		const n = entry.imageUrls.length;
		direction = Math.sign(delta);
		lens = null;
		imageIndex = (imageIndex + delta + n) % n;
	}

	// Entry navigation (← / → keys and the big side buttons). The card scales
	// down + fades a little, swaps entry, then comes back in from the side
	// you're heading — it never fully vanishes, so the overlay is never empty.
	// The photo swaps instantly underneath (direction 0) so it doesn't
	// double-slide. Presses mid-swap are ignored.
	let card = $state<HTMLDivElement>();
	let swapping = false;

	async function go(delta: number) {
		if (!entry || !onstep || !card || swapping) return;
		swapping = true;
		lens = null;
		direction = 0;
		const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
		// `fill: forwards` holds the shrunk state while the entry swaps.
		const out = still
			? null
			: card.animate([{ transform: 'scale(0.9)', opacity: 0.35 }], {
					duration: 110,
					easing: 'ease-in',
					fill: 'forwards'
				});
		await out?.finished;
		onstep(delta);
		await tick();
		if (out) {
			const back = card.animate(
				[
					{ transform: `translateX(${delta * 12}%) scale(0.9)`, opacity: 0.35 },
					{ transform: 'none', opacity: 1 }
				],
				{ duration: 170, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
			);
			out.cancel();
			await back.finished;
		}
		swapping = false;
	}

	function onkeydown(e: KeyboardEvent) {
		const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
		if (!delta || !entry) return;
		e.preventDefault();
		go(delta);
	}

	const SIDE =
		'hidden shrink-0 text-olf-cottoncandy/80 transition-transform hover:scale-110 hover:text-olf-cottoncandy md:block';

	// Hover magnifier: a small circle that follows the mouse and shows the
	// photo under it at LENS_ZOOM×. Maths runs against the photo's *rendered*
	// rect (object-contain letterboxes it), so the black bars show no lens.
	// Clicking the photo cycles w-16 → w-24 → w-36 → off (normal cursor) → w-16.
	const LENS_SIZES = [64, 96, 144];
	const LENS_OFF = LENS_SIZES.length;
	const LENS_ZOOM = 3;
	let lensSizeIndex = $state(0);
	const lensSize = $derived(LENS_SIZES[Math.min(lensSizeIndex, LENS_OFF - 1)]);
	// x/y = cursor (the lens centre); dx/dy = zoomed photo offset so the point
	// under the cursor sits at the lens centre; w/h = zoomed photo size. None of
	// these depend on lensSize, so a size change only animates width/height.
	let lens = $state<{
		x: number;
		y: number;
		dx: number;
		dy: number;
		w: number;
		h: number;
	} | null>(null);

	// Mouse is over the photo itself (not letterbox) — shows the size label
	// even when the lens is off.
	let overPhoto = $state(false);

	function moveLens(e: PointerEvent) {
		if (e.pointerType !== 'mouse') return;
		placeLens(e);
	}

	function cycleLens(e: MouseEvent) {
		// Only clicks on the photo itself (not the letterbox) cycle.
		if (!placeLens(e)) return;
		lensSizeIndex = (lensSizeIndex + 1) % (LENS_OFF + 1);
		placeLens(e);
	}

	/** Positions the lens; returns whether the cursor is over the photo. */
	function placeLens(e: MouseEvent): boolean {
		const img = e.currentTarget as HTMLImageElement;
		const { naturalWidth: nw, naturalHeight: nh } = img;
		if (!nw || !nh) return false;
		const box = img.getBoundingClientRect();
		const fit = Math.min(box.width / nw, box.height / nh);
		const w = nw * fit;
		const h = nh * fit;
		const left = (box.width - w) / 2;
		const top = (box.height - h) / 2;
		const x = e.clientX - box.left;
		const y = e.clientY - box.top;
		overPhoto = !(x < left || x > left + w || y < top || y > top + h);
		if (!overPhoto) {
			lens = null;
			return false;
		}
		if (lensSizeIndex === LENS_OFF) {
			lens = null;
			return true;
		}
		lens = {
			x,
			y,
			dx: -(x - left) * LENS_ZOOM,
			dy: -(y - top) * LENS_ZOOM,
			w: w * LENS_ZOOM,
			h: h * LENS_ZOOM
		};
		return true;
	}

	const ARROW =
		'absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/45';
</script>

<!-- The dialog is a transparent full-screen stage (so the big side buttons
     can sit on the overlay); the card inside is the visible modal. -->
<dialog
	bind:this={dialog}
	{onkeydown}
	onclose={() => (entry = null)}
	onclick={(e) => {
		// Click on the empty overlay (not the card or buttons) closes.
		if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.stage != null)
			entry = null;
	}}
	class="m-0 h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-olf-chimera/75"
>
	{#if shown}
		<div data-stage class="flex h-full items-center justify-center gap-4 p-4">
			{#if onstep}
				<button
					type="button"
					onclick={() => go(-1)}
					aria-label={m.farmdex_prev_entry()}
					class={SIDE}
				>
					<ChevronLeft size={56} strokeWidth={1.5} />
				</button>
			{/if}
			<div
				bind:this={card}
				class="relative grid max-h-full w-[min(56rem,100%)] overflow-y-auto rounded-xl bg-olf-cottoncandy text-olf-darkgreen md:grid-cols-2"
			>
				<button
					type="button"
					onclick={() => (entry = null)}
					aria-label={m.farmdex_close()}
					class="absolute top-2 right-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-olf-cottoncandy/80 text-olf-darkgreen hover:bg-olf-cottoncandy"
				>
					<X size={18} />
				</button>

				<div class="flex flex-col">
					<div class="relative aspect-square w-full overflow-hidden bg-black">
						<!-- Keyed on the URL so old and new photos overlap (both absolute)
					     and slide (no fade) like a carousel in the direction of travel. -->
						{#key shown.imageUrls[imageIndex]}
							<!-- The lens is a mouse-only enhancement; keyboard users lose nothing. -->
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
							<img
								src={shown.imageUrls[imageIndex]}
								alt={shown.commonName}
								in:fly={{
									x: `${100 * direction}%`,
									opacity: 1,
									duration: direction ? 320 : 0,
									easing: cubicOut
								}}
								out:fly={{
									x: `${-100 * direction}%`,
									opacity: 1,
									duration: direction ? 320 : 0,
									easing: cubicOut
								}}
								onpointermove={moveLens}
								onclick={cycleLens}
								onpointerleave={() => {
									lens = null;
									overPhoto = false;
								}}
								class="absolute inset-0 size-full object-contain {lensSizeIndex === LENS_OFF
									? 'cursor-pointer'
									: lens
										? 'cursor-none'
										: ''}"
							/>
						{/key}
						{#if overPhoto}
							<!-- Lens size indicator (1x/2x/3x/OFF). Slides up from below the
						     photo's edge on enter and back down on leave (clipped by the
						     photo box, no fade); the label slides vertically on change. -->
							<div
								aria-hidden="true"
								transition:fly={{ y: 56, opacity: 1, duration: 200, easing: cubicOut }}
								class="pointer-events-none absolute bottom-3 left-3 flex items-center rounded-full bg-black/30 px-2.5 py-1 font-oswald text-sm font-bold text-white backdrop-blur-sm"
							>
								<span class="relative h-5 w-8 overflow-hidden">
									{#key lensSizeIndex}
										<span
											in:fly={{ y: '100%', opacity: 1, duration: 200, easing: cubicOut }}
											out:fly={{ y: '-100%', opacity: 1, duration: 200, easing: cubicOut }}
											class="absolute inset-0 flex items-center justify-center"
										>
											{lensSizeIndex === LENS_OFF ? m.farmdex_lens_off() : `${lensSizeIndex + 1}x`}
										</span>
									{/key}
								</span>
							</div>
						{/if}
						{#if lens}
							<div
								aria-hidden="true"
								class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-lg ring-2 ring-white/90 transition-[width,height] duration-200 ease-out"
								style:width="{lensSize}px"
								style:height="{lensSize}px"
								style:left="{lens.x}px"
								style:top="{lens.y}px"
							>
								<img
									src={shown.imageUrls[imageIndex]}
									alt=""
									class="absolute top-1/2 left-1/2 max-w-none"
									style:width="{lens.w}px"
									style:height="{lens.h}px"
									style:margin-left="{lens.dx}px"
									style:margin-top="{lens.dy}px"
								/>
							</div>
						{/if}
						{#if shown.imageUrls.length > 1}
							<button
								type="button"
								onclick={() => step(-1)}
								aria-label={m.farmdex_prev_image()}
								class="{ARROW} left-3"
							>
								<ChevronLeft size={22} />
							</button>
							<button
								type="button"
								onclick={() => step(1)}
								aria-label={m.farmdex_next_image()}
								class="{ARROW} right-3"
							>
								<ChevronRight size={22} />
							</button>
						{/if}
					</div>
					{#if shown.imageUrls.length > 1}
						<div class="flex gap-3 bg-black p-2">
							{#each shown.imageUrls as url, i (url)}
								<button
									type="button"
									onclick={() => {
										direction = i > imageIndex ? 1 : -1;
										imageIndex = i;
									}}
									aria-label="{shown.commonName} {i + 1}"
									class="size-14 cursor-pointer overflow-hidden rounded-md ring-2 {i === imageIndex
										? 'ring-olf-bucketblue'
										: 'opacity-70 ring-transparent hover:opacity-100'}"
								>
									<img src={url} alt="" class="size-full object-cover" />
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-3 p-6">
					<!-- Header band, bleeding to the column edges; its bottom border is
					     the full-width hairline divider. -->
					<div
						class="-mx-6 -mt-6 flex flex-col gap-1 border-b border-olf-darkgreen/15 bg-olf-eggshell px-6 pt-6 pb-3"
					>
						<p class="font-oswald text-lg font-bold tracking-wide text-olf-darkgreen/70">
							{farmdexNumber(shown)}
						</p>
						<p class="font-oswald text-sm text-olf-darkgreen/70">
							{m.farmdex_logged()}: {formatDate(parseISO(shown.dateRegistered))}
						</p>
					</div>
					<p class="font-oswald text-sm tracking-wide text-olf-darkgreen/70 uppercase">
						{farmdexCategoryLabel(shown.category)}
					</p>
					<div>
						<h2 class="font-oswald text-2xl font-bold">{shown.commonName}</h2>
						<p class="font-oswald text-lg text-olf-darkgreen/80 italic">{shown.scientificName}</p>
					</div>
					<p class="font-oswald text-base leading-relaxed">{shown.description}</p>
				</div>
			</div>
			{#if onstep}
				<button
					type="button"
					onclick={() => go(1)}
					aria-label={m.farmdex_next_entry()}
					class={SIDE}
				>
					<ChevronRight size={56} strokeWidth={1.5} />
				</button>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	/* Fade + scale the dialog and its overlay. @starting-style + allow-discrete
	   is the native-<dialog> transition pattern (no JS). */
	dialog {
		opacity: 0;
		transform: scale(0.96) translateY(8px);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open] {
		opacity: 1;
		transform: scale(1) translateY(0);
	}
	@starting-style {
		dialog[open] {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
	}

	dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		dialog[open]::backdrop {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog,
		dialog::backdrop {
			transition-duration: 0.01ms;
		}
	}
</style>
