<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		FARMDEX,
		FARMDEX_CATEGORIES,
		farmdexBySlug,
		farmdexCategoryLabel,
		farmdexNumber,
		farmdexSlug,
		type FarmdexCategory,
		type FarmdexEntry
	} from '$lib/data/farmdex';
	import FarmdexModal from '$lib/components/farmdex/FarmdexModal.svelte';
	import CategoryIndicator from '$lib/components/farmdex/CategoryIndicator.svelte';
	import { fade, fly, scale, slide } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Seo from '$lib/components/seo/Seo.svelte';
	import { canScrollY, createWheelLatch } from '$lib/utils/wheelLatch';
	import { mountAniCursor } from '$lib/utils/aniCursor';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import { SITE_NAME, absoluteUrl } from '$lib/config/seo';

	// Animated starfish cursor while on Farmdex — page, modal and overlay alike.
	// Its own hotspot is an arm tip, so clicks land on the body instead.
	onMount(() => mountAniCursor('/cursors/starfish.ani', { centerHotspot: true }));

	// Raw (no deep proxy) so `selected === entry` identity checks hold.
	// Seeded from `?entry=<slug>` so a shared / crawled entry URL opens (and
	// SSRs the meta for) that entry.
	let selected = $state.raw<FarmdexEntry | null>(farmdexBySlug(page.url.searchParams.get('entry')));

	// Keep `?entry=` in sync with the open entry (replaceState: no history spam,
	// Back leaves the page rather than stepping through entries).
	$effect(() => {
		const want = selected ? farmdexSlug(selected) : null;
		const url = untrack(() => new URL(page.url));
		if (url.searchParams.get('entry') === want) return;
		if (want) url.searchParams.set('entry', want);
		else url.searchParams.delete('entry');
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	});

	// SEO: the page as a whole, or the open entry when `?entry=` is set.
	// "Farmdéx" (with the é) only in the page title; everywhere else is "Farmdex".
	const PAGE_TITLE = `Farmdéx — ${SITE_NAME}`;
	const PAGE_DESCRIPTION =
		'Every plant and critter we’ve met at Our Little Farm in Mantin, Negeri Sembilan — photographed, identified and logged in the Farmdex.';
	const seo = $derived(
		selected
			? {
					title: `${selected.commonName} (${selected.scientificName}) — ${PAGE_TITLE}`,
					description: selected.description,
					image: selected.imageUrls[0],
					path: `/farmdex?entry=${farmdexSlug(selected)}`
				}
			: {
					title: PAGE_TITLE,
					description: PAGE_DESCRIPTION,
					image: FARMDEX[0].imageUrls[0],
					path: '/farmdex'
				}
	);
	// Structured data: the Farmdex as a collection of taxa, one per entry.
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: PAGE_TITLE,
		description: PAGE_DESCRIPTION,
		url: absoluteUrl('/farmdex'),
		mainEntity: {
			'@type': 'ItemList',
			numberOfItems: FARMDEX.length,
			itemListElement: FARMDEX.map((e, i) => ({
				'@type': 'ListItem',
				position: i + 1,
				item: {
					'@type': 'Taxon',
					name: e.scientificName,
					alternateName: e.commonName,
					description: e.description,
					image: e.imageUrls,
					url: absoluteUrl(`/farmdex?entry=${farmdexSlug(e)}`)
				}
			}))
		}
	};
	// Measured; the default is a close guess so SSR / first paint barely shifts.
	let headerHeight = $state(72);
	// Once either column has scrolled a fair way, the header shortens ~20% (like
	// the Projects header when a card opens). The columns keep padding for the
	// full-height header (only re-measured while full), so the shrink never
	// moves the grid. The left index follows the live height instead, so its
	// entries ride up with the header. A filter change rebuilds both columns at the top.
	const COMPACT_AFTER_PX = 120;
	let scrollTops = $state({ list: 0, grid: 0 });
	const compact = $derived(Math.max(scrollTops.list, scrollTops.grid) > COMPACT_AFTER_PX);
	let fullHeaderHeight = $state(72);
	$effect(() => {
		if (!compact) fullHeaderHeight = headerHeight;
	});
	// Badge's "/" end, and the matching parallelogram for the trailing stripes.
	const SLANT = 'polygon(0 0, 100% 0, calc(100% - 1.25rem) 100%, 0 100%)';
	// Afterburner (disabled; see the commented-out markup after the badge).
	// Slashes left → right: gap before each, band width at rest, band width
	// when the badge area is hovered.
	// const STRIPE = 'polygon(1.25rem 0, 100% 0, calc(100% - 1.25rem) 100%, 0 100%)';
	// const AFTERBURNER = [
	// 	{ gap: 12, band: 12, bandHot: 20 },
	// 	{ gap: 12, band: 7, bandHot: 14 }
	// ];
	// While an entry is open, the page's scroll areas stop scrolling, so
	// wheel / swipe over the overlay or drawer doesn't move the grid behind.
	const scrollLock = $derived(selected ? 'overflow-y-hidden' : 'overflow-y-auto');
	// Highlighted left-list row tilts a hair left or right, picked at random
	// on each selection.
	let tilt = $state<'left' | 'right'>('left');

	function select(entry: FarmdexEntry) {
		tilt = Math.random() < 0.5 ? 'left' : 'right';
		selected = entry;
	}

	// ← / → in the modal: previous / next entry in the current filter, wrapping.
	function stepEntry(delta: number) {
		if (!selected) return;
		const n = visible.length;
		const i = visible.indexOf(selected);
		select(visible[(i + delta + n) % n]);
	}
	let filter = $state<FarmdexCategory | 'ALL'>('ALL');
	// The left index doesn't chain into the page when a flick hits its end
	// (same edge latch as a zoomed Projects photo).
	const listLatch = createWheelLatch();
	$effect(() => {
		void filter;
		untrack(() => (scrollTops = { list: 0, grid: 0 }));
	});

	// Only offer categories that actually have entries, in enum order.
	const categories = FARMDEX_CATEGORIES.filter((c) => FARMDEX.some((e) => e.category === c));
	const visible = $derived(
		filter === 'ALL' ? FARMDEX : FARMDEX.filter((e) => e.category === filter)
	);

	// Filter change re-renders both lists from scratch (keyed on `filter`), so
	// nothing animates from its old grid slot. Items pop in (pure scale, no
	// fade) staggered top-to-bottom. Quick + ease-in-out.
	const POP_MS = 220;
	const STAGGER_MS = 25;
	const pop = (i: number) => ({
		duration: POP_MS,
		delay: Math.min(i, 12) * STAGGER_MS,
		easing: cubicInOut,
		start: 0,
		opacity: 1
	});
	// Left list: same timing, but rows slide up into place (vertical, no fade).
	const rise = (i: number) => ({
		duration: POP_MS,
		delay: Math.min(i, 12) * STAGGER_MS,
		easing: cubicInOut,
		y: 24,
		opacity: 1
	});

	const FILTER =
		'-mx-1 cursor-pointer px-1 py-1 font-oswald text-base tracking-wide text-olf-darkgreen/60 hover:text-olf-darkgreen aria-pressed:font-bold aria-pressed:text-olf-darkgreen';
</script>

<Seo
	title={seo.title}
	description={seo.description}
	image={seo.image}
	path={seo.path}
	type={selected ? 'article' : 'website'}
/>
<JsonLd data={jsonLd} />

<!-- Category filter buttons: "All" as text, the rest as indicators. -->
{#snippet filters()}
	<button
		type="button"
		onclick={() => (filter = 'ALL')}
		aria-pressed={filter === 'ALL'}
		class={FILTER}
	>
		{m.farmdex_all()}
	</button>
	{#each categories as c (c)}
		<span class="text-olf-darkgreen/30" aria-hidden="true">|</span>
		<!-- Categories show their indicator; the active one's name slides
		     in from the right beside it. -->
		<button
			type="button"
			onclick={() => (filter = c)}
			aria-pressed={filter === c}
			aria-label={farmdexCategoryLabel(c)}
			title={farmdexCategoryLabel(c)}
			class="group/f {FILTER} flex items-center"
		>
			<CategoryIndicator
				category={c}
				class="opacity-60 transition-opacity group-hover/f:opacity-100 group-aria-pressed/f:opacity-100"
			/>
			{#if filter === c}
				<span
					transition:slide={{ axis: 'x', duration: 200, easing: cubicInOut }}
					class="overflow-hidden whitespace-nowrap"
				>
					<span
						in:fly={{ x: '100%', opacity: 1, duration: 200, easing: cubicInOut }}
						class="block pl-1.5"
					>
						{farmdexCategoryLabel(c)}
					</span>
				</span>
			{/if}
		</button>
	{/each}
{/snippet}

<!-- Fixed to the viewport below the sticky navbar; each column scrolls on its own.
     The header floats (frosted) over the top of both columns, which pad their
     tops by its measured height so content starts below it but scrolls under. -->
<div
	class="relative flex h-[calc(100dvh-var(--navbar-h))] flex-col bg-olf-cottoncandy"
	style:--farmdex-header-h="{fullHeaderHeight}px"
	style:--farmdex-header-live="{headerHeight}px"
>
	<div
		bind:clientHeight={headerHeight}
		class="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-olf-cottoncandy/80 px-4 pt-1 pb-2 shadow-md backdrop-blur-md transition-[padding] duration-350 ease-in lg:px-6 {compact
			? 'md:pt-1 md:pb-2 lg:pt-1.5'
			: 'md:pt-2 md:pb-4 lg:pt-3'}"
	>
		<!-- The FARMDEX badge doubles as a "show all" reset. It bleeds to the bar's
		     left, top and bottom edges (negative margins = the bar's padding, added
		     back as its own padding so the text doesn't move) and ends in a "/" slant.
		     The wrapper carries the bleed so the stripes stretch with it. -->
		<!-- Compact: the bar's padding shrinks, so the bleed shrinks with it. -->
		<div
			class="group/ab -mt-1 -mb-2 -ml-4 flex self-stretch transition-[margin] duration-350 ease-in lg:-ml-6 {compact
				? 'md:-mt-1 md:-mb-2 lg:-mt-1.5'
				: 'md:-mt-2 md:-mb-4 lg:-mt-3'}"
		>
			<button
				type="button"
				onclick={() => (filter = 'ALL')}
				class="inline-flex cursor-pointer items-center gap-2 bg-olf-coral pr-8 pl-7 font-oswald text-base font-bold tracking-wide text-white uppercase transition-[padding] duration-350 ease-in md:text-lg lg:pl-9 {compact
					? 'pt-1 pb-2 md:pt-1.5 md:pb-3.5 lg:pt-2'
					: 'pt-2 pb-3 md:pt-3 md:pb-5 lg:pt-4'}"
				style:clip-path={SLANT}
			>
				{m.nav_farmdex()}
				<!-- Glyphs come from mismatched fallback fonts, so each gets its own
		     vertical nudge (em, so it scales with text size) to sit centered on
		     the cap height like one line of text. -->
				<span class="flex items-center gap-1.5 leading-none" aria-hidden="true">
					<span>✿</span>
					<span class="-translate-y-[0.06em]">𓆣</span>
					<span class="-translate-y-[0.18em]">𓆌</span>
				</span>
			</button>
			<!-- AFTERBURNER (disabled — uncomment this block + AFTERBURNER/STRIPE in
			     the script to revive): coral slashes trailing the badge, thinning out
			     to the right so they read as building up into FARMDEX. Hovering the
			     badge area (`group/ab` on the wrapper) fires them — each widens and
			     drifts right.
			<div class="flex" aria-hidden="true">
				{#each AFTERBURNER as flame, i (i)}
					<span
						class="w-[calc(1.25rem+var(--band))] bg-olf-coral transition-[width,margin] duration-300 ease-out group-hover/ab:w-[calc(1.25rem+var(--band-hot))]"
						style:--band="{flame.band}px"
						style:--band-hot="{flame.bandHot}px"
						style:margin-left="calc({flame.gap}px - 1.25rem)"
						style:clip-path={STRIPE}
					></span>
				{/each}
			</div>
			-->
		</div>

		<!-- Desktop: filters + count on the right. Phones: just the count here;
		     the filters live in a sticky bar at the bottom (below). -->
		<div class="hidden flex-wrap items-center gap-x-3 gap-y-1 md:flex">
			{@render filters()}
			<span class="h-px w-12 bg-olf-darkgreen/30" aria-hidden="true"></span>
			<span class="font-oswald text-base text-olf-darkgreen/60">
				{m.farmdex_entries({ count: FARMDEX.length })}
			</span>
		</div>
		<span class="font-oswald text-base text-olf-darkgreen/60 md:hidden">
			{m.farmdex_entries({ count: FARMDEX.length })}
		</span>
	</div>

	<!-- Phones: frosted filter bar pinned to the bottom of the page. One row
	     that scrolls sideways once there are too many categories to fit;
	     `w-max mx-auto` keeps it centred while it fits (justify-center would
	     clip the start of an overflowing row). -->
	<div
		class="absolute inset-x-0 bottom-0 z-10 [scrollbar-width:none] overflow-x-auto bg-olf-cottoncandy/80 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgb(0_0_0/0.1)] backdrop-blur-md md:hidden [&::-webkit-scrollbar]:hidden"
	>
		<div class="mx-auto flex w-max items-center gap-x-3 px-4 whitespace-nowrap">
			{@render filters()}
		</div>
	</div>

	<div class="flex min-h-0 flex-1 gap-6">
		<!-- Left: compact index of every entry. Hidden on phones, where the
		     grid alone is enough. -->
		{#key filter}
			<ul
				onscroll={(e) => (scrollTops.list = e.currentTarget.scrollTop)}
				onwheel={(e) => listLatch(canScrollY(e.currentTarget, e)) && e.preventDefault()}
				class="hidden w-52 shrink-0 flex-col gap-1 bg-olf-eggshell {scrollLock} pt-[calc(var(--farmdex-header-live)+1.5rem)] pb-4 pl-4 md:flex lg:pb-6 lg:pl-6"
			>
				{#each visible as entry, i (entry.scientificName)}
					<li in:fly|global={rise(i)}>
						<button
							type="button"
							onclick={() => select(entry)}
							aria-current={selected === entry ? 'true' : undefined}
							class="group relative flex w-full items-center gap-2 p-1 pr-3 text-left"
						>
							<!-- Background layer only — tilts on select; the photo + name stay level. -->
							<span
								aria-hidden="true"
								class="absolute inset-0 rounded-xl transition-transform duration-200 ease-out group-hover:bg-olf-darkgreen/10 group-aria-[current=true]:bg-olf-cementblue {selected ===
								entry
									? tilt === 'left'
										? '-rotate-2'
										: 'rotate-2'
									: ''}"
							></span>
							<img
								src={entry.imageUrls[0]}
								alt=""
								loading="lazy"
								class="relative size-8 shrink-0 rounded-full object-cover transition-transform duration-200 ease-out group-aria-[current=true]:scale-110"
							/>
							<span
								class="relative min-w-0 truncate pr-1 font-oswald text-sm text-olf-darkgreen capitalize italic"
							>
								{entry.scientificName}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/key}

		<!-- Right: photo grid. -->
		{#key filter}
			<ul
				onscroll={(e) => (scrollTops.grid = e.currentTarget.scrollTop)}
				class="grid flex-1 grid-cols-2 content-start gap-x-5 gap-y-4 {scrollLock} px-4 pt-[calc(var(--farmdex-header-h)+1.5rem)] pb-20 sm:grid-cols-3 md:pb-4 md:pl-0 lg:grid-cols-4 lg:pr-6 lg:pb-6 xl:grid-cols-5"
			>
				{#each visible as entry, i (entry.scientificName)}
					<li in:scale|global={pop(i)}>
						<button
							type="button"
							onclick={() => select(entry)}
							class="group flex w-full flex-col text-left"
						>
							<span
								class="relative block transition-transform duration-200 ease-out group-hover:-translate-y-1"
							>
								<img
									src={entry.imageUrls[0]}
									alt={entry.commonName}
									loading="lazy"
									class="aspect-square w-full rounded-lg object-cover transition-shadow duration-200 ease-out group-hover:shadow-lg"
								/>
								<span
									class="absolute top-0 right-0 rounded-tr-lg rounded-bl-md bg-black/50 px-1.5 py-0.5 font-oswald text-sm font-bold tracking-wide text-white backdrop-blur-sm transition-colors duration-200 group-hover:bg-black/80"
								>
									{farmdexNumber(entry)}
								</span>
								<!-- "1/3" photo count, only when the entry has more than one. -->
								{#if entry.imageUrls.length > 1}
									<span
										class="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs text-white tabular-nums backdrop-blur-sm"
									>
										1/{entry.imageUrls.length}
									</span>
								{/if}
							</span>
							<span
								class="mt-2 flex items-center gap-2 font-oswald text-base text-olf-darkgreen capitalize italic"
							>
								{entry.scientificName}
								<span title={farmdexCategoryLabel(entry.category)} class="flex">
									<CategoryIndicator
										category={entry.category}
										class="opacity-50 transition-opacity duration-200 group-hover:opacity-100"
										shapeClass="translate-y-[0.12em]"
									/>
								</span>
							</span>
							<span class="font-oswald text-sm text-olf-darkgreen/60">{entry.commonName}</span>
						</button>
					</li>
				{/each}
				<!-- End-of-list anchor, spanning the full grid width. Quietly fades
				     back in after the last tile on every filter change. -->
				<li
					in:fade|global={{
						duration: 400,
						delay: Math.min(visible.length, 12) * STAGGER_MS + POP_MS
					}}
					class="col-span-full mt-16 mb-8 flex items-center justify-center gap-3 font-oswald text-sm tracking-wide text-olf-darkgreen/50"
				>
					<span class="h-px w-12 bg-olf-darkgreen/25" aria-hidden="true"></span>
					{m.farmdex_end()}
					<span class="h-px w-12 bg-olf-darkgreen/25" aria-hidden="true"></span>
				</li>
			</ul>
		{/key}
	</div>
</div>

<FarmdexModal bind:entry={selected} onstep={stepEntry} />
