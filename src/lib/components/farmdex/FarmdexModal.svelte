<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, X } from '@lucide/svelte';
	import { parseISO } from 'date-fns';
	import { onMount, tick, untrack } from 'svelte';
	import { fly, slide, type TransitionConfig } from 'svelte/transition';
	import { cubicIn, cubicOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import CategoryIndicator from './CategoryIndicator.svelte';
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

	// Lock the document's own scroll while open — the page (Farmdex + footer)
	// is taller than the viewport, and on touch a swipe on the drawer would
	// otherwise scroll the page behind it.
	$effect(() => {
		if (!entry) return;
		const root = document.documentElement;
		const prev = root.style.overflow;
		root.style.overflow = 'hidden';
		return () => {
			root.style.overflow = prev;
		};
	});

	// What the card renders: the last non-null entry, so the content stays put
	// while the close animation plays instead of blanking instantly.
	let shown = $state.raw<FarmdexEntry | null>(null);
	// A different entry (opening, or ← / →) shows its cover with no photo
	// slide — only the in-entry arrows / thumbnails slide photos.
	$effect.pre(() => {
		if (!entry) return;
		if (entry !== untrack(() => shown)) direction = 0;
		shown = entry;
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
	// Clicking the photo cycles w-24 → w-40 → w-62 → off (normal cursor) → w-24.
	const LENS_SIZES = [96, 160, 248];
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

	// Touch swipes: on the photo (2+ photos) → previous/next photo; anywhere
	// else on the drawer → previous/next entry. Swipe left = next.
	// A big downward swipe closes the drawer — unless it started inside the
	// description while that's scrolled down (then it's just scrolling up).
	let touchStart: { x: number; y: number; scrolled: boolean } | null = null;
	function onTouchStart(e: TouchEvent) {
		const t = e.touches[0];
		const scroller = (e.target as Element).closest('[data-scroll]');
		touchStart = { x: t.clientX, y: t.clientY, scrolled: (scroller?.scrollTop ?? 0) > 0 };
	}
	function isDismissSwipe(e: TouchEvent): boolean {
		if (!touchStart || touchStart.scrolled) return false;
		const t = e.changedTouches[0];
		const dx = t.clientX - touchStart.x;
		const dy = t.clientY - touchStart.y;
		return dy > 120 && dy > Math.abs(dx) * 1.5;
	}
	/** -1 / +1 for a clear horizontal swipe, else 0. */
	function swipeDelta(e: TouchEvent): number {
		if (!touchStart) return 0;
		const t = e.changedTouches[0];
		const dx = t.clientX - touchStart.x;
		const dy = t.clientY - touchStart.y;
		return Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 ? (dx < 0 ? 1 : -1) : 0;
	}

	// The "Logged" row under the dex number can be collapsed (chevron).
	let logOpen = $state(false);

	// Fisheye for the lens: an SVG feDisplacementMap driven by a radial map
	// built once on a canvas. Each pixel samples a point pulled toward the
	// centre (k = 0.8 + 0.2·r² ≤ 1), so the middle is magnified a touch more
	// than the rim — a subtle glass-ball bulge. R/G encode x/y offsets around
	// 0.5, in units of FISHEYE_SCALE (fraction of the lens box).
	const FISHEYE_SCALE = 0.25;
	let fisheyeMap = $state('');
	onMount(() => {
		const n = 128;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = n;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const img = ctx.createImageData(n, n);
		for (let y = 0; y < n; y++) {
			for (let x = 0; x < n; x++) {
				const nx = ((x + 0.5) / n) * 2 - 1;
				const ny = ((y + 0.5) / n) * 2 - 1;
				const r2 = Math.min(nx * nx + ny * ny, 1);
				const k = 0.8 + 0.2 * r2;
				const i = (y * n + x) * 4;
				img.data[i] = Math.round(255 * (0.5 + ((nx / 2) * (k - 1)) / FISHEYE_SCALE));
				img.data[i + 1] = Math.round(255 * (0.5 + ((ny / 2) * (k - 1)) / FISHEYE_SCALE));
				img.data[i + 2] = 128;
				img.data[i + 3] = 255;
			}
		}
		ctx.putImageData(img, 0, 0);
		fisheyeMap = canvas.toDataURL();
	});

	function cycleLens(e: MouseEvent) {
		// Mouse only: a tap on touch screens shouldn't summon the lens.
		if ((e as PointerEvent).pointerType && (e as PointerEvent).pointerType !== 'mouse') return;
		// Only clicks on the photo itself (not the letterbox) cycle.
		if (!placeLens(e)) return;
		lensSizeIndex = (lensSizeIndex + 1) % (LENS_OFF + 1);
		lensVanishing = lensSizeIndex === LENS_OFF;
		placeLens(e);
	}

	let lensVanishing = false;
	// Last on-screen lens: the outro renders from this, since `lens` is already
	// null when the outro starts (reading it would drop the position).
	let lensLast = $state.raw<typeof lens>(null);
	$effect.pre(() => {
		if (lens) lensLast = lens;
	});

	// 3x → off: the lens shrinks into the cursor. Uses the `scale` property
	// (not `transform`) so it doesn't fight Tailwind's `translate` centring.
	// Any other removal (leaving the photo, switching photo) stays instant.
	const lensOut: (node: Element) => TransitionConfig = () => ({
		duration: lensVanishing ? 180 : 0,
		easing: cubicIn,
		css: (t) => `scale:${t}`
	});

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
		lensVanishing = false;
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
	class="m-0 h-full max-h-none w-full max-w-none overscroll-contain bg-transparent p-0 backdrop:bg-olf-chimera/75"
>
	{#if shown}
		<!-- Phones: a bottom drawer (card pinned to the bottom, slides up). -->
		<div data-stage class="flex h-full items-end justify-center md:items-center md:gap-4 md:p-4">
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
			<!-- Phones: arrow row above the drawer (tap = previous/next entry, and a
			     hint that the drawer swipes sideways). `md:contents` drops the
			     wrapper on desktop so the card sits in the stage as before. -->
			<div class="flex w-full flex-col md:contents">
				{#if onstep}
					<div data-stage class="flex justify-between px-3 pb-2 md:hidden">
						<button
							type="button"
							onclick={() => go(-1)}
							aria-label={m.farmdex_prev_entry()}
							class="cursor-pointer text-olf-cottoncandy/80"
						>
							<ChevronLeft size={32} strokeWidth={1.75} />
						</button>
						<button
							type="button"
							onclick={() => go(1)}
							aria-label={m.farmdex_next_entry()}
							class="cursor-pointer text-olf-cottoncandy/80"
						>
							<ChevronRight size={32} strokeWidth={1.75} />
						</button>
					</div>
				{/if}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={card}
					ontouchstart={onTouchStart}
					ontouchend={(e) => {
						if (isDismissSwipe(e)) {
							entry = null;
							return;
						}
						const d = swipeDelta(e);
						if (d) go(d);
					}}
					class="relative flex max-h-[calc(100dvh-var(--navbar-h,0px)-3rem)] w-full touch-pan-y flex-col overflow-hidden rounded-t-2xl bg-olf-cottoncandy text-olf-darkgreen md:grid md:max-h-full md:w-[min(56rem,100%)] md:grid-cols-2 md:overflow-y-auto md:rounded-xl"
				>
					<button
						type="button"
						onclick={() => (entry = null)}
						aria-label={m.farmdex_close()}
						class="absolute top-2 right-2 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full bg-olf-cottoncandy/80 text-olf-darkgreen hover:bg-olf-cottoncandy"
					>
						<X size={18} />
					</button>

					<!-- Photo + thumbnails never shrink or scroll on phones. -->
					<div class="flex shrink-0 flex-col">
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="relative aspect-square max-h-[45dvh] w-full overflow-hidden bg-black md:max-h-none"
							ontouchend={(e) => {
								if (shown && shown.imageUrls.length > 1) {
									const d = swipeDelta(e);
									if (d) {
										e.stopPropagation();
										step(d);
									}
								}
							}}
						>
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
									class="pointer-events-none absolute bottom-3 left-3 z-10 flex items-center rounded-full bg-black/30 px-2.5 py-1 font-oswald text-sm font-bold text-white backdrop-blur-sm"
								>
									<span class="relative h-5 w-8 overflow-hidden">
										{#key lensSizeIndex}
											<span
												in:fly={{ y: '100%', opacity: 1, duration: 200, easing: cubicOut }}
												out:fly={{ y: '-100%', opacity: 1, duration: 200, easing: cubicOut }}
												class="absolute inset-0 flex items-center justify-center"
											>
												{lensSizeIndex === LENS_OFF
													? m.farmdex_lens_off()
													: `${lensSizeIndex + 1}x`}
											</span>
										{/key}
									</span>
								</div>
							{/if}
							{#if lens}
								<div
									out:lensOut
									aria-hidden="true"
									class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg ring-2 ring-white/90 transition-[width,height] duration-200 ease-out"
									style:width="{lensSize}px"
									style:height="{lensSize}px"
									style:left="{lensLast?.x}px"
									style:top="{lensLast?.y}px"
								>
									<!-- Inner glass: the fisheye filter lives here, not on the outer
									     ring, so the ring/shadow aren't clipped by the filter box. -->
									<div
										class="absolute inset-0 overflow-hidden rounded-full"
										style:filter={fisheyeMap ? 'url(#farmdex-fisheye)' : undefined}
									>
										<img
											src={shown.imageUrls[imageIndex]}
											alt=""
											class="absolute top-1/2 left-1/2 max-w-none"
											style:width="{lensLast?.w}px"
											style:height="{lensLast?.h}px"
											style:margin-left="{lensLast?.dx}px"
											style:margin-top="{lensLast?.dy}px"
										/>
									</div>
									<!-- Glass sheen: top-left highlight + darker rim. -->
									<div
										class="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_25%,rgb(255_255_255/0.35),transparent_45%)] shadow-[inset_0_0_14px_rgb(0_0_0/0.35)]"
									></div>
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
										class="size-14 cursor-pointer overflow-hidden rounded-md ring-2 {i ===
										imageIndex
											? 'ring-olf-bucketblue'
											: 'opacity-70 ring-transparent hover:opacity-100'}"
									>
										<img src={url} alt="" class="size-full object-cover" />
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Phones: the drawer never scrolls (the photo is never clipped); if it
				     runs out of room only the description shrinks and scrolls. -->
					<div
						class="flex min-h-0 flex-col gap-3 p-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:pb-6"
					>
						<!-- Header band, bleeding to the column edges; its bottom border is
					     the full-width hairline divider. -->
						<div
							class="-mx-6 -mt-6 flex flex-col gap-1 border-b border-olf-darkgreen/15 bg-olf-eggshell px-6 pt-6 pb-3"
						>
							<div class="flex items-center justify-between">
								<p
									class="flex items-center gap-1.5 font-oswald text-lg font-bold tracking-wide text-olf-darkgreen/70"
								>
									<button
										type="button"
										onclick={() => (logOpen = !logOpen)}
										aria-expanded={logOpen}
										aria-label={m.farmdex_toggle_logged()}
										class="-ml-1 cursor-pointer rounded p-0.5 hover:bg-olf-darkgreen/10"
									>
										{#if logOpen}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
									</button>
									{farmdexNumber(shown)}
								</p>
								<!-- Drawer only: the category rides the dex row (desktop keeps it below). -->
								<p
									class="font-oswald text-sm tracking-wide text-olf-darkgreen/70 uppercase md:hidden"
								>
									{farmdexCategoryLabel(shown.category)}
								</p>
							</div>
							{#if logOpen}
								<p
									transition:slide={{ duration: 200 }}
									class="flex items-center gap-1.5 pt-1 font-oswald text-sm text-olf-darkgreen/70"
								>
									<Clock size={14} class="shrink-0 translate-y-[0.1em]" />
									{m.farmdex_logged()}: {formatDate(parseISO(shown.dateRegistered))}
								</p>
							{/if}
						</div>
						<p
							class="hidden font-oswald text-sm tracking-wide text-olf-darkgreen/70 uppercase md:block"
						>
							{farmdexCategoryLabel(shown.category)}
						</p>
						<div>
							<h2 class="font-oswald text-2xl font-bold">{shown.commonName}</h2>
							<p
								class="flex items-center gap-2 font-oswald text-lg text-olf-darkgreen/80 capitalize italic"
							>
								{shown.scientificName}
								<CategoryIndicator category={shown.category} shapeClass="translate-y-[0.12em]" />
							</p>
						</div>
						<p
							data-scroll
							class="min-h-0 overflow-y-auto overscroll-contain font-oswald text-base leading-relaxed"
						>
							{shown.description}
						</p>
					</div>
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
	<!-- Fisheye filter for the lens (map generated in onMount). -->
	{#if fisheyeMap}
		<svg width="0" height="0" class="absolute" aria-hidden="true">
			<filter
				id="farmdex-fisheye"
				primitiveUnits="objectBoundingBox"
				x="0"
				y="0"
				width="1"
				height="1"
				color-interpolation-filters="sRGB"
			>
				<feImage
					href={fisheyeMap}
					x="0"
					y="0"
					width="1"
					height="1"
					preserveAspectRatio="none"
					result="map"
				/>
				<feDisplacementMap
					in="SourceGraphic"
					in2="map"
					scale={FISHEYE_SCALE}
					xChannelSelector="R"
					yChannelSelector="G"
				/>
			</filter>
		</svg>
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

	/* Phones: the drawer slides up from the bottom instead of scaling in. */
	@media (max-width: 767px) {
		dialog {
			opacity: 1;
			transform: translateY(100%);
			transition-duration: 0.25s;
		}
		dialog[open] {
			transform: none;
		}
		@starting-style {
			dialog[open] {
				opacity: 1;
				transform: translateY(100%);
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog,
		dialog::backdrop {
			transition-duration: 0.01ms;
		}
	}
</style>
