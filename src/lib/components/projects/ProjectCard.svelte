<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import RichText from '$lib/components/ui/RichText.svelte';
	import { tick } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		Check,
		ChevronLeft,
		ChevronRight,
		ExternalLink,
		Maximize2,
		Minimize2,
		UserRound
	} from '@lucide/svelte';
	import { DURATION_NOT_STARTED, DURATION_ONGOING, formatDays } from '$lib/utils/date';
	import { trackPeopleBoard } from '$lib/utils/peopleBoard';
	import { createWheelLatch } from '$lib/utils/wheelLatch';
	import { projectId, projectNumber, type Project } from '$lib/data/projects';
	import type { Person } from '$lib/data/people';

	// Desktop: a small succinct card that expands into the full card. The page
	// owns which cards are expanded: they span the whole row and stack at the
	// top, latest first (`order`). Phones always show the full card in data order.
	let {
		project,
		expanded,
		solo = false,
		order = 0,
		deal = null,
		filterRole = null,
		onexpandedchange,
		onpersonclick
	}: {
		project: Project;
		expanded: boolean;
		/** The only expanded card: a click outside every card collapses it. */
		solo?: boolean;
		order?: number;
		/** Position in the page-load deal-in; null = no intro (later mounts, e.g. filtering). */
		deal?: number | null;
		/** During a filter view transition: this card is arriving or leaving (page CSS animates it). */
		filterRole?: 'entering' | 'leaving' | null;
		onexpandedchange: (value: boolean) => void;
		/** Avatar click: filter the page to that person. */
		onpersonclick?: (person: Person) => void;
	} = $props();

	let expandButton = $state<HTMLButtonElement>();
	let expandedCard = $state<HTMLDivElement>();
	let moving = $state(false);
	const titleId = $props.id();

	// Animated with a view transition: every card is named, so each one slides
	// and resizes to its new spot. `data-project-transition` lets the CSS give
	// collapse its own hang-then-drop curve. Keyboard focus follows the card
	// (the thing you pressed disappears); expanding scrolls up to it.
	async function setExpanded(value: boolean) {
		const swap = async () => {
			onexpandedchange(value);
			await tick();
			// Both views stay on the same photo across expand / collapse (the
			// succinct strip is rebuilt on collapse, so it's set every time).
			if (value && scroller) scroller.scrollLeft = coverIndex * scroller.clientWidth;
			if (!value && coverScroller) {
				coverIndex = imageIndex;
				coverScroller.scrollLeft = imageIndex * coverScroller.clientWidth;
			}
		};
		const root = document.documentElement;
		let settled: Promise<unknown> = Promise.resolve();
		if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
			await swap();
		} else {
			root.dataset.projectTransition = value ? 'expand' : 'collapse';
			// Mark the clicked card before the "old" snapshot is taken, so the CSS
			// can animate it apart from the cards that are just repositioning.
			moving = true;
			await tick();
			// Let the numbers fade out first, so they're gone from the snapshots.
			await new Promise((r) => setTimeout(r, NUMBER_FADE_MS));
			const boardMoved = trackPeopleBoard();
			const t = document.startViewTransition(async () => {
				await swap();
				boardMoved();
			});
			settled = t.finished.finally(() => {
				delete root.dataset.projectTransition;
				delete root.dataset.peopleBoard;
				// No loot glow on whatever card the cards slid under the cursor: it
				// waits until the mouse actually moves.
				root.dataset.projectGlowOff = '';
				document.addEventListener('pointermove', () => delete root.dataset.projectGlowOff, {
					once: true
				});
				moving = false;
			});
			await t.updateCallbackDone;
		}
		(value ? expandedCard : expandButton)?.focus({ preventScroll: true });
		// Scroll once the cards have settled (scrolling mid-transition drags the snapshots).
		if (value) settled.then(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
	}

	// Clicking the expanded card collapses it, but only on empty areas: text
	// stays selectable and controls (arrows, photos, people) keep working.
	const KEEP_OPEN = 'button, a, img, p, h2, h3, li, input, [data-keep-open]';
	function collapseOnClick(e: MouseEvent) {
		if (!expanded || (e.target as Element).closest(KEEP_OPEN)) return;
		if (window.getSelection()?.toString()) return;
		setExpanded(false);
	}

	function collapseOnOutsideClick(e: MouseEvent) {
		if (!solo || (e.target as Element).closest('article')) return;
		if (window.getSelection()?.toString()) return;
		setExpanded(false);
	}

	const duration = $derived(
		formatDays(project.duration) ??
			(project.duration === DURATION_ONGOING ? m.projects_ongoing() : m.projects_not_started())
	);

	// Status indicator: done = green check, ongoing = yolk pulsing dot,
	// not started = blue diamond (same mask as Farmdex reptiles).
	const done = $derived(
		project.duration !== DURATION_ONGOING && project.duration !== DURATION_NOT_STARTED
	);
	const dot = $derived(
		project.duration === DURATION_ONGOING
			? 'size-2.5 rounded-full bg-olf-yolk motion-safe:animate-pulse'
			: 'dot-diamond h-3 w-2.5 bg-olf-sunfadedblue'
	);

	// Photos are a native scroll-snap strip (swipe / trackpad work for free);
	// the arrows just scroll it, and the scroll position tracks the current
	// photo. Wraps at both ends like the Farmdex modal.
	let scroller = $state<HTMLDivElement>();
	let imageIndex = $state(0);
	// The succinct card's cover is the same kind of strip, arrows only.
	let coverScroller = $state<HTMLDivElement>();
	let coverIndex = $state(0);

	function goTo(i: number, strip = scroller) {
		if (!strip) return;
		const n = project.imageUrls.length;
		strip.scrollTo({ left: ((i + n) % n) * strip.clientWidth, behavior: 'smooth' });
	}

	// Click a photo to fill the frame, zoomed toward the click point; click
	// again to see it whole. Resets when you move to another photo. object-fit
	// can't animate, so the photo stays `contain` and a transform scales it up
	// to exactly what `cover` + `object-position: <click%>` would show.
	// While zoomed, the wheel / trackpad pans around the photo (clamped so it
	// always fills the frame), with an iOS-style indicator showing how far.
	// Edge latch (utils/wheelLatch): a gesture that was panning the photo
	// doesn't carry on into the page once it hits the edge.
	type Zoom = {
		i: number;
		s: number;
		tx: number;
		ty: number;
		x: [number, number];
		y: [number, number];
		/** Visible share of the scaled photo per axis (indicator thumb size). */
		seen: [number, number];
	};
	let zoom = $state<Zoom | null>(null);
	let panning = $state(false);
	let panTimer: ReturnType<typeof setTimeout> | undefined;
	const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v));
	const wheelLatch = createWheelLatch();

	// Indicator thumb per axis: [size, offset] in % of the track, or null when
	// that axis can't pan.
	function thumb(z: Zoom, axis: 0 | 1): [number, number] | null {
		const [lo, hi] = axis ? z.y : z.x;
		if (hi - lo < 1) return null;
		const size = z.seen[axis] * 100;
		const at = (hi - (axis ? z.ty : z.tx)) / (hi - lo);
		return [size, at * (100 - size)];
	}

	function toggleZoom(e: MouseEvent, i: number) {
		if (zoom?.i === i) {
			zoom = null;
			return;
		}
		const img = e.currentTarget as HTMLImageElement;
		const [bw, bh] = [img.clientWidth, img.clientHeight];
		const fit = Math.min(bw / img.naturalWidth, bh / img.naturalHeight);
		const [dw, dh] = [img.naturalWidth * fit, img.naturalHeight * fit]; // contained size
		const s = Math.max(bw / dw, bh / dh); // contain → cover
		const [l, t] = [(bw - dw) / 2, (bh - dh) / 2]; // contained photo's offset
		// Pan limits: the scaled photo's edges never come inside the frame.
		const x: [number, number] = [bw - s * (l + dw), -s * l];
		const y: [number, number] = [bh - s * (t + dh), -s * t];
		const tx = (bw - s * dw) * (e.offsetX / bw) - s * l;
		const ty = (bh - s * dh) * (e.offsetY / bh) - s * t;
		const seen: [number, number] = [bw / (s * dw), bh / (s * dh)];
		zoom = { i, s, tx: clamp(tx, x), ty: clamp(ty, y), x, y, seen };
	}

	function pan(e: WheelEvent, i: number) {
		if (zoom?.i !== i) return;
		const tx = clamp(zoom.tx - e.deltaX, zoom.x);
		const ty = clamp(zoom.ty - e.deltaY, zoom.y);
		const moves = tx !== zoom.tx || ty !== zoom.ty;
		// At the edge: swallow the rest of a gesture that was panning; a fresh
		// one falls through to the page.
		if (wheelLatch(moves) || moves) e.preventDefault();
		if (!moves) return;
		zoom = { ...zoom, tx, ty };
		// Follow the wheel tightly while panning; the slower ease is for clicks.
		panning = true;
		clearTimeout(panTimer);
		panTimer = setTimeout(() => (panning = false), 150);
	}

	// Numbers fade out before cards expand/collapse and back in once the grid
	// has landed (the `.number` CSS below; keep NUMBER_FADE_MS in sync with it).
	const NUMBER_FADE_MS = 120;

	const ACTION =
		'flex size-8 cursor-pointer items-center justify-center rounded-full bg-olf-eggshell text-olf-darkgreen shadow-md hover:bg-olf-darkgreen hover:text-olf-eggshell';

	// "2/3" photo counter, top-left of the succinct cover (the Farmdex modal
	// centres it along the bottom).
	const PHOTO_COUNT =
		'pointer-events-none absolute top-2 left-2 z-10 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs text-white tabular-nums backdrop-blur-sm';

	// Smaller ARROW for the succinct cover; fades in with the card's hover.
	const COVER_ARROW =
		'pointer-events-auto absolute top-1/2 z-10 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100 hover:bg-black/45 focus-visible:opacity-100';

	// Same style as the Farmdex modal's photo arrows.
	const ARROW =
		'absolute top-1/2 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/45';
</script>

<svelte:document onclick={collapseOnOutsideClick} />

{#snippet tab(cls: string)}
	<span class="flex items-center justify-between bg-olf-darkgreen px-3 py-1 {cls}">
		<span
			class="bg-linear-to-r from-olf-eggshell via-olf-lightgreen to-olf-eggshell bg-size-[200%] bg-clip-text text-transparent uppercase motion-safe:animate-gradient-x motion-safe:[animation-duration:6s]"
		>
			{duration}
		</span>
		{#if done}
			<Check size={16} strokeWidth={3} class="shrink-0 text-olf-sage" aria-hidden="true" />
		{:else}
			<span class="shrink-0 {dot}" aria-hidden="true"></span>
		{/if}
	</span>
{/snippet}

{#snippet eyebrow()}
	<p class="font-mono text-xs font-light tracking-widest uppercase">Project</p>
{/snippet}

<!-- drop-shadow (not box-shadow) so the shadow follows the tab's shape
     instead of drawing a box around the empty space beside it. -->
<article
	style:--deal={deal}
	style:--deal-tilt={deal === null ? null : deal % 2 ? '4deg' : '-4deg'}
	style:view-transition-name="project-{titleId}"
	style:view-transition-class="project{moving ? ' moving' : ''}{filterRole ? ` ${filterRole}` : ''}"
	style:--order={order}
	class="drop-shadow-md {deal === null ? '' : 'deal'} {expanded
		? 'md:order-(--order) md:col-span-full'
		: ''}"
>
	{#if !expanded}
		<!-- Succinct (desktop only): cover photo with the details box overlapping
		     its bottom-right corner. One line each, so every card is the same size. -->
		<div class="group/card relative hidden md:block">
			<!-- Loot glow: a yolk circle hidden behind the card (centred, 10% low) that
			     glows out from behind it on hover / focus. -->
			<div
				aria-hidden="true"
				class="glow pointer-events-none absolute top-[60%] left-1/2 -z-10 aspect-square w-[90%] -translate-1/2 rounded-full bg-olf-yolk/60 opacity-0 blur-2xl transition-opacity duration-200 ease-out group-hover/card:opacity-100 group-has-focus-visible/card:opacity-100"
			></div>
			<!-- Number hangs in the gutter left of the photo (the page pads for it). -->
			<span
				class="number absolute top-0 right-full mr-2 font-mono text-base font-light tracking-wide text-olf-darkgreen/70"
			>
				{projectNumber(project)}
			</span>
			<div
				bind:this={coverScroller}
				onscroll={() => {
					if (coverScroller)
						coverIndex = Math.round(coverScroller.scrollLeft / coverScroller.clientWidth);
				}}
				class="flex aspect-square w-[80%] snap-x snap-mandatory scrollbar-none overflow-x-auto rounded-2xl bg-black"
			>
				{#each project.imageUrls as url, i (url)}
					<img
						src={url}
						alt=""
						loading={i === 0 ? 'eager' : 'lazy'}
						class="size-full shrink-0 snap-start object-contain"
					/>
				{/each}
			</div>
			<div class="relative -mt-16 ml-auto w-[70%]">
				{@render tab('w-full rounded-t-lg')}
				<div class="rounded-b-2xl bg-olf-eggshell px-4 py-3 font-oswald text-olf-darkgreen">
					{@render eyebrow()}
					<h2 id={titleId} class="h-8 truncate text-xl leading-8 font-bold text-olf-darkbrown">
						<RichText text={project.title} />
					</h2>
					<p class="truncate font-mono text-sm text-olf-darkbrown/80">
						<RichText text={project.subtitle} />
					</p>
				</div>
			</div>
			<!-- Stretched over the whole card so anywhere expands it. -->
			<button
				bind:this={expandButton}
				type="button"
				onclick={() => setExpanded(true)}
				aria-expanded="false"
				aria-labelledby={titleId}
				class="absolute inset-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-olf-darkgreen"
			></button>
			<!-- Round actions beside the photo, bottom-aligned just above the details box
			     (a photo-sized frame, so bottom-16 = the box's -mt-16 overlap). Above the
			     stretched button. They fade out with the numbers, back 0.5s after them. -->
			<div class="pointer-events-none absolute top-0 left-0 aspect-square w-[80%]">
				<!-- Photo arrows, over the stretched button; shown on hover / focus. -->
				{#if project.imageUrls.length > 1}
					<span class="{PHOTO_COUNT} number">
						{coverIndex + 1}/{project.imageUrls.length}
					</span>
					<button
						type="button"
						onclick={() => goTo(coverIndex - 1, coverScroller)}
						aria-label={m.farmdex_prev_image()}
						class="{COVER_ARROW} left-2"
					>
						<ChevronLeft size={18} />
					</button>
					<button
						type="button"
						onclick={() => goTo(coverIndex + 1, coverScroller)}
						aria-label={m.farmdex_next_image()}
						class="{COVER_ARROW} right-2"
					>
						<ChevronRight size={18} />
					</button>
				{/if}
				<div
					class="actions pointer-events-auto absolute bottom-16 left-full z-10 mb-3 ml-3 flex flex-col gap-2"
				>
					<a
						href="/projects/{projectId(project)}"
						target="_blank"
						rel="noopener"
						aria-label={m.projects_open_page()}
						class={ACTION}
					>
						<ExternalLink size={14} />
					</a>
					<button
						type="button"
						onclick={() => setExpanded(true)}
						aria-label={m.projects_expand()}
						class={ACTION}
					>
						<Maximize2 size={14} />
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Expanded: phones always; desktop once the succinct card is clicked.
	     Escape or a click on an empty area collapses it (desktop). -->
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
	<div
		bind:this={expandedCard}
		tabindex="-1"
		onclick={collapseOnClick}
		onkeydown={(e) => expanded && e.key === 'Escape' && setExpanded(false)}
		class="relative outline-none md:pl-[40%] {expanded ? '' : 'md:hidden'}"
	>
		{@render tab('w-1/2 rounded-t-lg md:rounded-tl-none')}
		{#if expanded}
			<!-- Minimize (desktop): in the empty strip right of the duration tab, a
			     little gap above the people box. Same as Escape / clicking empty space. -->
			<button
				type="button"
				onclick={() => setExpanded(false)}
				aria-expanded="true"
				aria-label={m.projects_collapse()}
				class="absolute -top-2 right-3 z-10 hidden md:flex {ACTION}"
			>
				<Minimize2 size={14} />
			</button>
		{/if}

		<div
			class="flex flex-col overflow-hidden rounded-tr-xl md:absolute md:inset-y-0 md:left-0 md:w-2/5 md:rounded-l-2xl md:rounded-tr-none"
		>
			<div class="relative bg-black md:min-h-0 md:flex-1">
				{#if zoom?.i === imageIndex}
					{@const v = thumb(zoom, 1)}
					{@const h = thumb(zoom, 0)}
					<!-- iOS-style scroll indicators while zoomed: dark track, white thumb.
					     Vertical on the right centre, horizontal on the bottom centre. -->
					{#if v}
						<span
							aria-hidden="true"
							transition:fade={{ duration: 150 }}
							class="pointer-events-none absolute top-1/2 right-1.5 z-10 h-1/3 w-1 -translate-y-1/2 rounded-full bg-black/50"
						>
							<span
								class="absolute inset-x-0 rounded-full bg-white"
								style:height="{v[0]}%"
								style:top="{v[1]}%"
							></span>
						</span>
					{/if}
					{#if h}
						<span
							aria-hidden="true"
							transition:fade={{ duration: 150 }}
							class="pointer-events-none absolute bottom-1.5 left-1/2 z-10 h-1 w-1/3 -translate-x-1/2 rounded-full bg-black/50"
						>
							<span
								class="absolute inset-y-0 rounded-full bg-white"
								style:width="{h[0]}%"
								style:left="{h[1]}%"
							></span>
						</span>
					{/if}
				{/if}
				<!-- Number over the photo. Clicking it does nothing: it blocks the photo
				     zoom underneath, and data-keep-open stops it collapsing the card. -->
				<span
					data-keep-open
					class="number absolute top-3 left-4 z-10 font-mono text-sm font-light tracking-wide text-white select-none"
				>
					{projectNumber(project)}
				</span>
				<div
					bind:this={scroller}
					onscroll={() => {
						if (!scroller) return;
						const i = Math.round(scroller.scrollLeft / scroller.clientWidth);
						if (i !== imageIndex) zoom = null;
						imageIndex = i;
					}}
					class="flex size-full snap-x snap-mandatory scrollbar-none overflow-x-auto"
				>
					{#each project.imageUrls as url, i (url)}
						<!-- The frame clips the scaled photo (a transform would otherwise
					     grow the strip's scroll width). -->
						<div
							class="aspect-2/1 w-full shrink-0 snap-start overflow-hidden md:aspect-auto md:h-full"
						>
							<!-- Zoom is a mouse/tap enhancement; keyboard users lose nothing. -->
							<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
							<img
								src={url}
								alt=""
								loading={i === 0 ? 'eager' : 'lazy'}
								onclick={(e) => toggleZoom(e, i)}
								onwheel={(e) => pan(e, i)}
								style:transform={zoom?.i === i
									? `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.s})`
									: undefined}
								class="size-full origin-top-left object-contain ease-out motion-safe:transition-transform {panning
									? 'duration-75'
									: 'duration-200'} {zoom?.i === i ? 'cursor-zoom-out' : 'cursor-zoom-in'}"
							/>
						</div>
					{/each}
				</div>
				{#if project.imageUrls.length > 1}
					<button
						type="button"
						onclick={() => goTo(imageIndex - 1)}
						aria-label={m.farmdex_prev_image()}
						class="{ARROW} left-3"
					>
						<ChevronLeft size={22} />
					</button>
					<button
						type="button"
						onclick={() => goTo(imageIndex + 1)}
						aria-label={m.farmdex_next_image()}
						class="{ARROW} right-3"
					>
						<ChevronRight size={22} />
					</button>
				{/if}
			</div>
		</div>

		<!-- Phones: one column, people under a full-width hairline. Desktop: people
	     move to their own column on the right, behind a vertical hairline. -->
		<div
			class="flex flex-col rounded-b-2xl bg-olf-eggshell font-oswald text-olf-darkgreen md:min-h-64 md:flex-row md:rounded-tr-2xl md:rounded-bl-none"
		>
			<div class="flex flex-1 flex-col gap-4 p-6">
				<header>
					{@render eyebrow()}
					<h2 class="text-2xl font-bold text-olf-darkbrown"><RichText text={project.title} /></h2>
					<p class="font-mono text-olf-darkbrown/80"><RichText text={project.subtitle} /></p>
				</header>

				{#each project.description as paragraph, i (i)}
					<p class="text-base leading-relaxed"><RichText text={paragraph} /></p>
				{/each}

				{#if project.toolsUsed.length}
					<div>
						<h3 class="mb-1 text-sm tracking-wide text-olf-darkgreen/60 uppercase">
							{m.projects_tools()}
						</h3>
						<ul class="flex flex-wrap gap-2">
							{#each project.toolsUsed as tool (tool.name)}
								<li class="rounded-full bg-olf-sage px-3 py-0.5 text-sm">{tool.name}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>

			{#if project.people.length}
				<div
					class="rounded-b-2xl border-t border-olf-darkgreen/20 bg-olf-cottoncandy px-6 pt-4 pb-6 md:shrink-0 md:rounded-l-none md:rounded-r-2xl md:border-t-0 md:border-l md:pt-6"
				>
					<h3 class="mb-1 text-sm tracking-wide text-olf-darkgreen/60 uppercase md:mb-2">
						{m.projects_people()}
					</h3>
					<ul class="flex flex-wrap gap-2 md:flex-col md:items-end">
						{#each project.people as person (person.id)}
							<!-- Name shows on hover only (clicking does nothing); keyboard focus shows it too. -->
							<li class="group relative">
								<button
									type="button"
									onclick={() => onpersonclick?.(person)}
									aria-label={person.name}
									class="flex size-9.25 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-olf-lightcoral text-olf-darkbrown transition-transform duration-200 ease-out outline-none hover:scale-120 focus-visible:ring-2 focus-visible:ring-olf-darkgreen"
								>
									{#if person.imageUrl}
										<img src={person.imageUrl} alt="" class="size-full object-cover" />
									{:else}
										<UserRound size={21} />
									{/if}
								</button>
								<span
									role="tooltip"
									class="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 hidden -translate-x-1/2 rounded-lg bg-olf-darkgreen px-2 py-0.5 text-sm whitespace-nowrap text-olf-eggshell shadow-md group-hover:block group-has-focus-visible:block"
								>
									{person.name}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	</div>
</article>

<style>
	/* Expand/collapse (see setExpanded). No crossfade and no stretched
	   snapshots: only the new state is drawn, at its real size, inside a box
	   that slides/grows from the old size, so it reads as a reveal.
	   Expand is a solitaire-style deal: cards fly to their spot, overshoot a
	   touch and settle (ease-out-back). */
	:global(::view-transition-group(*.project)) {
		animation-duration: 350ms;
		animation-timing-function: cubic-bezier(0.34, 1.4, 0.64, 1);
	}
	/* The rest of the page (footer etc.) just jumps instead of crossfading.
	   This is the only view transition in the app, so it's safe to set here. */
	:global(::view-transition-old(root)),
	:global(::view-transition-new(root)) {
		animation: none;
	}
	/* Collapse: the clicked card does a looney-tunes hang (winds back a touch),
	   then drops into place; the rest of the grid repositions a little slower
	   on a smooth S-curve. */
	:global(:root[data-project-transition='collapse']::view-transition-group(*.project)) {
		animation-duration: 800ms;
		animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
	}
	:global(:root[data-project-transition='collapse']::view-transition-group(*.moving)) {
		animation-duration: 675ms;
		animation-timing-function: cubic-bezier(0.6, -0.28, 0.735, 0.045);
	}
	/* Page-load intro: cards are dealt in like solitaire, rising from below
	   with an alternating tilt and a little overshoot, staggered by --deal.
	   CSS, not a Svelte transition, so it also plays on the SSR'd page. */
	@media (prefers-reduced-motion: no-preference) {
		.deal {
			animation: deal-in 450ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
			animation-delay: calc(var(--deal) * 80ms);
		}
	}
	@keyframes deal-in {
		from {
			transform: translateY(64px) rotate(var(--deal-tilt));
		}
	}
	.number {
		transition: opacity 120ms ease-out;
	}
	/* Glow stays off while cards move and until the mouse moves again. */
	:global(:root[data-project-transition]) .glow,
	:global(:root[data-project-glow-off]) .glow {
		opacity: 0;
		transition: none;
	}
	:global(:root[data-project-transition]) .number {
		opacity: 0;
	}
	/* Same fade + a small slide, but they return 0.5s after the numbers. */
	.actions {
		transition:
			opacity 120ms ease-out 620ms,
			translate 120ms ease-out 620ms;
	}
	:global(:root[data-project-transition]) .actions {
		opacity: 0;
		translate: -6px 0;
		transition-delay: 0ms;
	}
	:global(::view-transition-image-pair(*.project)) {
		overflow: clip;
	}
	:global(::view-transition-old(*.project)) {
		display: none;
	}
	:global(::view-transition-new(*.project)) {
		animation: none;
		width: 100%;
		height: 100%;
		object-fit: none;
		object-position: left top;
	}
</style>
