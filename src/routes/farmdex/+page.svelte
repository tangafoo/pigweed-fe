<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import {
		FARMDEX,
		FARMDEX_CATEGORIES,
		FARMDEX_CATEGORY_DOT,
		farmdexBySlug,
		farmdexCategoryLabel,
		farmdexNumber,
		farmdexSlug,
		type FarmdexCategory,
		type FarmdexEntry
	} from '$lib/data/farmdex';
	import FarmdexModal from '$lib/components/farmdex/FarmdexModal.svelte';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicInOut } from 'svelte/easing';
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Seo from '$lib/components/seo/Seo.svelte';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import { SITE_NAME, absoluteUrl } from '$lib/config/seo';

	// Animated starfish cursor while on Farmdex — page, modal and overlay alike.
	// Browsers can't play .ani natively, so ani-cursor turns its frames into a
	// CSS @keyframes that steps `cursor: url(...)` (still the native cursor, so
	// no lag). It runs once on <html> and everything inherits it; running it
	// per-element would restart the loop on every hover change (flicker).
	// The inherit rule sits in the `components` layer: above layout.css's
	// `@layer base` hand pointer on buttons, below utilities like the lens's
	// `cursor-none`. Injected on mount / removed on leave, so it's Farmdex-only.
	// Imported inside onMount (browser only): ani-cursor's `riff-file` dep is
	// CommonJS and breaks Node's SSR import, which 500s the page.
	onMount(() => {
		let style: HTMLStyleElement | undefined;
		let left = false; // navigated away before the fetch finished
		Promise.all([import('ani-cursor'), fetch('/cursors/starfish.ani').then((r) => r.arrayBuffer())])
			.then(([{ convertAniBinaryToCSS }, buf]) => {
				if (left) return;
				style = document.createElement('style');
				const bytes = new Uint8Array(buf);
				// Also on <dialog>: a modal dialog makes the page (incl. <html>)
				// inert, and inert elements stop matching :hover, so the html
				// animation pauses while the overlay is open.
				style.textContent =
					convertAniBinaryToCSS('html', bytes) +
					convertAniBinaryToCSS('dialog', bytes) +
					'@layer components { html * { cursor: inherit; } }';
				document.head.appendChild(style);
			})
			.catch(() => {}); // cosmetic — fall back to the normal cursor
		return () => {
			left = true;
			style?.remove();
		};
	});

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
	const PAGE_TITLE = `${m.nav_farmdex()} — ${SITE_NAME}`;
	const PAGE_DESCRIPTION =
		'Every plant and critter we’ve met at Our Little Farm in Mantin, Negeri Sembilan — photographed, identified and logged in the Farmdéx.';
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
	// Structured data: the Farmdéx as a collection of taxa, one per entry.
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

	// Category indicator shape; anything unlisted is an 8px circle.
	const DOT_SHAPE: Partial<Record<FarmdexCategory, string>> = {
		MAMMAL: 'dot-heart size-2.5',
		REPTILE: 'dot-diamond h-2.5 w-2',
		AMPHIBIAN: 'dot-wavy h-2.5 w-3',
		PLANT: 'dot-ring size-3'
	};

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

<!-- Fixed to the viewport below the sticky navbar; each column scrolls on its own.
     The header floats (frosted) over the top of both columns, which pad their
     tops by its measured height so content starts below it but scrolls under. -->
<div
	class="relative flex h-[calc(100dvh-var(--navbar-h))] flex-col bg-olf-cottoncandy"
	style:--farmdex-header-h="{headerHeight}px"
>
	<div
		bind:clientHeight={headerHeight}
		class="absolute inset-x-0 top-0 z-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-olf-cottoncandy/80 px-4 pt-2 pb-4 shadow-md backdrop-blur-md lg:px-6 lg:pt-3"
	>
		<!-- The FARMDEX badge doubles as a "show all" reset. It bleeds to the bar's
		     left, top and bottom edges (negative margins = the bar's padding, added
		     back as its own padding so the text doesn't move) and ends in a "/" slant. -->
		<button
			type="button"
			onclick={() => (filter = 'ALL')}
			class="-mt-2 -mb-4 -ml-4 inline-flex cursor-pointer items-center gap-2 self-stretch bg-olf-coral pt-3 pr-8 pb-5 pl-7 font-oswald text-lg font-bold tracking-wide text-white uppercase lg:-mt-3 lg:-ml-6 lg:pt-4 lg:pl-9"
			style:clip-path="polygon(0 0, 100% 0, calc(100% - 1.25rem) 100%, 0 100%)"
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

		<!-- Category filter + total count. -->
		<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
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
				<button
					type="button"
					onclick={() => (filter = c)}
					aria-pressed={filter === c}
					class={FILTER}
				>
					{farmdexCategoryLabel(c)}
				</button>
			{/each}
			<span class="h-px w-12 bg-olf-darkgreen/30" aria-hidden="true"></span>
			<span class="font-oswald text-base text-olf-darkgreen/60">
				{m.farmdex_entries({ count: FARMDEX.length })}
			</span>
		</div>
	</div>

	<div class="flex min-h-0 flex-1 gap-6">
		<!-- Left: compact index of every entry. Hidden on phones, where the
		     grid alone is enough. -->
		{#key filter}
			<ul
				class="hidden w-52 shrink-0 flex-col gap-1 overflow-y-auto pt-[calc(var(--farmdex-header-h)+1.5rem)] pb-4 pl-4 md:flex lg:pb-6 lg:pl-6"
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
								class="relative min-w-0 truncate pr-1 font-oswald text-sm text-olf-darkgreen italic"
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
				class="grid flex-1 grid-cols-2 content-start gap-x-5 gap-y-4 overflow-y-auto px-4 pt-[calc(var(--farmdex-header-h)+1.5rem)] pb-4 sm:grid-cols-3 md:pl-0 lg:grid-cols-4 lg:pr-6 lg:pb-6 xl:grid-cols-5"
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
							</span>
							<span
								class="mt-2 flex items-center gap-2 font-oswald text-base text-olf-darkgreen italic"
							>
								{entry.scientificName}
								<span
									title={farmdexCategoryLabel(entry.category)}
									class="shrink-0 translate-y-[0.12em] opacity-50 transition-opacity duration-200 group-hover:opacity-100 {DOT_SHAPE[
										entry.category
									] ?? 'size-2 rounded-full'} {FARMDEX_CATEGORY_DOT[entry.category]}"
								></span>
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

<style>
	/* Heart-shaped category dot (mammals): the bg colour shows through a heart
	   mask, so it still uses the same FARMDEX_CATEGORY_DOT colour class. */
	.dot-heart {
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 21.6S1 15 1 8.2C1 4.9 3.5 2.4 6.6 2.4c2.2 0 4.2 1.2 5.4 3 1.2-1.8 3.2-3 5.4-3 3.1 0 5.6 2.5 5.6 5.8C23 15 12 21.6 12 21.6z'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}
	/* Playing-card diamond (reptiles): taller than wide, slightly pinched sides. */
	.dot-diamond {
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 24'%3E%3Cpath d='M10 0Q13.5 7 20 12Q13.5 17 10 24Q6.5 17 0 12Q6.5 7 10 0z'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}
	/* Curvy equals ≈ (amphibians): two rounded wavy strokes. */
	.dot-wavy {
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 20' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round'%3E%3Cpath d='M2 6.5Q7 2 12 6.5T22 6.5M2 14.5Q7 10 12 14.5T22 14.5'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}
	/* ◉ (plants): solid centre dot, a gap, then an outline ring. */
	.dot-ring {
		mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10.25' fill='none' stroke='black' stroke-width='3.5'/%3E%3Ccircle cx='12' cy='12' r='4.5'/%3E%3C/svg%3E")
			center / contain no-repeat;
	}
</style>
