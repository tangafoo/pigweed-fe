<script lang="ts">
	import FarmStory from '$lib/components/home/FarmStory.svelte';
	import FarmYolk from '$lib/components/home/FarmYolk.svelte';
	import FarmPromise from '$lib/components/home/FarmPromise.svelte';
	import FarmVisit from '$lib/components/home/FarmVisit.svelte';
	import FAQ from '$lib/components/home/FAQ.svelte';
	import JsonLd from '$lib/components/seo/JsonLd.svelte';
	import LatestPostsStrip from '$lib/components/home/LatestPostsStrip.svelte';
	import Parallax from '$lib/components/decor/Parallax.svelte';
	import ProduceOrderButtons from '$lib/components/home/ProduceOrderButtons.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	import { produceSections } from '$lib/data/produceSections';
	import { asset } from '$lib/config/assets';
	import {
		MANTIN_COORDS,
		SITE_DESCRIPTION,
		SITE_NAME,
		SITE_OG_DESCRIPTION,
		SITE_OG_IMAGE,
		SITE_TAGLINE,
		SITE_URL
	} from '$lib/config/seo';
	import { m } from '$lib/paraglide/messages.js';
	import { Sun, CloudRain, Wheat, Sprout, ChevronDown, ChevronUp } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { slide } from 'svelte/transition';

	let { data }: { data: PageData } = $props();

	// LocalBusiness rich result for the farm — anchors us in Mantin so Google
	// (and AI answer engines) can answer "sustainable farm near KL" with us.
	const farmJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'LocalBusiness',
		name: SITE_NAME,
		url: SITE_URL,
		image: SITE_OG_IMAGE,
		description: SITE_TAGLINE,
		address: {
			'@type': 'PostalAddress',
			addressLocality: 'Mantin',
			addressRegion: 'Negeri Sembilan',
			addressCountry: 'MY'
		},
		geo: {
			'@type': 'GeoCoordinates',
			latitude: MANTIN_COORDS.lat,
			longitude: MANTIN_COORDS.lng
		},
		areaServed: ['Kuala Lumpur', 'Negeri Sembilan', 'Selangor'],
		makesOffer: [
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Sustainable farm eggs' } },
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Seasonal vegetables' } },
			{ '@type': 'Offer', itemOffered: { '@type': 'Product', name: 'Tree-ripened fruit' } }
		]
	};

	let compostExpanded = $state(false);

	// The compost panel sliding open/closed shifts everything below it, which
	// invalidates the pixel positions ScrollTrigger measured at setup (cluck,
	// hop, Parallax). Re-measure once the slide transition settles. The dynamic
	// import is already cached by then (or a cheap no-op if GSAP never loaded).
	async function refreshScrollTriggers() {
		const { ScrollTrigger } = await import('gsap/ScrollTrigger');
		ScrollTrigger.refresh();
	}

	// Scroll-driven head-cluck: a barely-there tilt scrubbed by scroll position
	// as the hen travels through the viewport — rest → +10° → 0° → -10° → 0°.
	// Pivots near the base so it reads as a lean, not a spin. The gaps between
	// segments are "dwell" scroll where the head holds still. Async GSAP +
	// ScrollTrigger (matches Parallax.svelte), reduced-motion aware.
	function cluck(node: HTMLElement) {
		let cleanup: (() => void) | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');
			gsap.registerPlugin(ScrollTrigger);
			gsap.set(node, { transformOrigin: '50% 80%' });

			const tl = gsap
				.timeline({
					defaults: { duration: 1, ease: 'sine.inOut' },
					scrollTrigger: {
						trigger: node,
						start: 'top bottom', // hen enters from the bottom of the viewport
						end: 'bottom top', // …until it scrolls off the top
						scrub: true
					}
				})
				.to(node, { rotation: 10 })
				.to(node, { rotation: 0 }, '+=1') // dwell, then settle
				.to(node, { rotation: -10 }, '+=1')
				.to(node, { rotation: 0 }, '+=1');

			cleanup = () => {
				tl.scrollTrigger?.kill();
				tl.kill();
			};
		})();

		return { destroy: () => cleanup?.() };
	}

	// Scroll-driven hop: same idea as cluck but a tiny vertical bounce instead
	// of a tilt — rest → up → down → up → rest as the element passes through
	// the viewport. Super minimal. Async GSAP + ScrollTrigger, reduced-motion aware.
	function hop(node: HTMLElement) {
		let cleanup: (() => void) | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');
			gsap.registerPlugin(ScrollTrigger);

			const tl = gsap.timeline({
				defaults: { duration: 0.5 },
				scrollTrigger: {
					trigger: node,
					start: 'top bottom',
					end: 'bottom top',
					scrub: true
				}
			});
			// several small hops across the scroll range. Gravity-shaped easing:
			// launch decelerates toward the apex (power2.out), fall accelerates
			// back down (power2.in), with a brief dwell between hops.
			for (let i = 0; i < 6; i++) {
				tl.to(node, { y: -3, ease: 'power2.out' })
					.to(node, { y: 0, ease: 'power2.in' })
					.to(node, {}, '+=0.4');
			}

			cleanup = () => {
				tl.scrollTrigger?.kill();
				tl.kill();
			};
		})();

		return { destroy: () => cleanup?.() };
	}

	// Scroll-driven wiggle for the worm dividers: a barely-there two-cycle rock
	// (±2°) scrubbed by scroll. `flip: -1` mirrors the worm horizontally — the
	// flip must live HERE (gsap.set), not in a -scale-x-100 class: GSAP rebuilds
	// the whole transform when animating rotation, and decomposing an external
	// CSS flip is ambiguous (flip ≡ 180° rotation), which turned the worms
	// upside down. Async GSAP + ScrollTrigger, reduced-motion aware.
	function wiggle(node: HTMLElement, flip: 1 | -1 = 1) {
		let cleanup: (() => void) | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
				// No GSAP here, so apply the mirror with plain CSS.
				if (flip === -1) node.style.transform = 'scaleX(-1)';
				return;
			}
			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');
			gsap.registerPlugin(ScrollTrigger);
			gsap.set(node, { scaleX: flip });

			const tl = gsap.timeline({
				defaults: { duration: 1, ease: 'sine.inOut' },
				scrollTrigger: {
					trigger: node,
					start: 'top bottom',
					end: 'bottom top',
					scrub: true
				}
			});
			for (let i = 0; i < 2; i++) {
				tl.to(node, { rotation: 2 }).to(node, { rotation: -2 });
			}
			tl.to(node, { rotation: 0 });

			cleanup = () => {
				tl.scrollTrigger?.kill();
				tl.kill();
			};
		})();

		return { destroy: () => cleanup?.() };
	}
</script>

<Seo
	title="Our Little Farm — Sustainable farm in Mantin, Negeri Sembilan"
	description={SITE_DESCRIPTION}
	ogDescription={SITE_OG_DESCRIPTION}
/>
<JsonLd data={farmJsonLd} />

<Parallax
	src={asset('chicken-hero02.webp')}
	srcLg={asset('chicken-hero02.webp')}
	class="flex items-center lg:h-[50dvh]"
>
	<div class="pointer-events-none absolute inset-0 bg-black/35"></div>
	<div class="relative px-6 py-16">
		<div class="relative mb-5 flex">
			<p class="flex-1 font-homemade-apple text-4xl font-bold text-white/95">
				{m.home_hero_title()}
			</p>
			<div class="ml-3 flex flex-col gap-2 self-end lg:flex-row">
				<!-- Weather streams in (see +page.ts) — the pills render the
				     fallback copy while pending, then swap to live values. -->
				{#snippet weatherPills(weather: { temperature: number; humidity: number } | null)}
					<p
						class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
					>
						<Sun size={12} class="shrink-0" />
						{weather ? `${weather.temperature}°C` : m.home_weather_heat_fallback()}
					</p>
					<p
						class="flex items-center gap-1 self-start rounded-full bg-olf-beige/80 px-2 backdrop-blur-md"
					>
						<CloudRain size={12} class="shrink-0" />
						{weather
							? m.home_weather_humidity({ value: weather.humidity })
							: m.home_weather_humidity_fallback()}
					</p>
				{/snippet}
				{#await data.weather}
					{@render weatherPills(null)}
				{:then weather}
					{@render weatherPills(weather)}
				{/await}
			</div>
		</div>

		<div class="relative flex gap-4">
			<p class="flex flex-col gap-1 text-white/90">
				<span class="relative inline-flex h-14 items-center justify-center">
					<Wheat size={48} strokeWidth={1.5} class="shrink-0 p-1" />
				</span>
				{m.home_no_cruelty()}
			</p>
			<p class="flex flex-col gap-1 text-white/90">
				<span class="relative inline-flex h-14 items-center justify-center">
					<Sprout size={48} strokeWidth={1.5} class="shrink-0 p-1" />
				</span>
				{m.home_no_chemicals()}
			</p>
			<p class="flex flex-col gap-1 text-white/90">
				<span class="relative inline-flex h-14 items-center justify-center">
					<img
						use:cluck
						src={asset('henkerchief.webp')}
						alt=""
						class="h-14 w-14 shrink-0 object-contain p-1"
					/>
				</span>
				{m.home_happy_hens()}
			</p>
		</div>
	</div>
</Parallax>

<div class="bg-olf-darkgreen/95 p-2 text-center text-sm tracking-wide text-white/95">
	<p>{m.home_delivery_lead()} • <span class="font-light">{m.home_delivery_schedule()}</span></p>
</div>

<!-- Sticky releases at the parent's bottom edge, so this wrapper is what
     makes the header un-stick once the compost panel has scrolled past. -->
<div>
	<div
		role="button"
		tabindex="0"
		aria-expanded={compostExpanded}
		onclick={() => (compostExpanded = !compostExpanded)}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				compostExpanded = !compostExpanded;
			}
		}}
		class="sticky top-5 cursor-pointer sm:top-12"
	>
		<div class="flex flex-wrap items-center gap-y-1 bg-olf-darkgreen p-2">
			<div class="mr-4 bg-olf-moss">
				{#key compostExpanded}
					{#if compostExpanded}
						<ChevronUp size={24} class=" text-white/80" />
					{:else}
						<ChevronDown size={24} class=" text-white/80" />
					{/if}
				{/key}
			</div>
			<img
				use:wiggle={-1}
				src={asset('worm-divider02.webp')}
				alt=""
				class="hidden h-8 min-w-0 flex-none self-center object-contain sm:block"
			/>
			<div>
				<p class="px-3 font-smokum text-xl tracking-widest text-white uppercase sm:text-2xl">
					<span
						class="font-frijole text-2xl tracking-[0.4em] text-olf-beige sm:text-4xl sm:tracking-[2rem]"
						>Compost</span
					>
					Operations
				</p>
			</div>
			<img
				use:wiggle={-1}
				src={asset('worm-divider.webp')}
				alt=""
				class="hidden h-8 min-w-0 flex-1 self-center object-contain sm:block"
			/>
			<div
				class="mx-3 flex min-w-0 flex-wrap items-center gap-x-3 font-smokum text-lg tracking-wider text-amber-300 sm:text-2xl"
			>
				<p>Trench Composting</p>
				<p>•</p>
				<p>Hot Composting</p>
				<p>•</p>
				<p>Vermicomposting</p>
			</div>
			<img
				use:wiggle
				src={asset('worm-divider02.webp')}
				alt=""
				class="hidden h-8 min-w-0 flex-none self-center object-contain sm:block"
			/>
			<div class="ml-4 bg-olf-moss">
				{#key compostExpanded}
					{#if compostExpanded}
						<ChevronUp size={24} class=" text-white/80" />
					{:else}
						<ChevronDown size={24} class=" text-white/80" />
					{/if}
				{/key}
			</div>
		</div>
	</div>
	{#if compostExpanded}
		<div
			transition:slide
			onintroend={refreshScrollTriggers}
			onoutroend={refreshScrollTriggers}
			class="grid gap-8 bg-olf-soilbrown p-6 text-3xl text-white sm:grid-cols-2"
		>
			<div>
				<h2 class="font-smokum text-2xl tracking-wider text-olf-yolk/95">Regenerative Orchard</h2>
				<p>
					'In harmony with nature' is at the heart of how we farm. Our orchard is an ecosystem with
					trees, hens, soil, water and biodiversity feeding each other.
				</p>
			</div>
			<div>
				<h2 class="font-smokum text-2xl tracking-wider text-olf-beige/95">Soil & Compost</h2>
				<p>
					At ourlittlefarm, we return organic matter to the land through several natural composting
					methods. We aim to close the cycle — transforming organic metrials back to nutrients.
				</p>
			</div>
			<div>
				<h2
					class="mb-2 w-fit rotate-2 border-2 border-olf-lightbrown px-4 py-2 font-smokum text-2xl tracking-wider text-olf-lightgreen"
				>
					Trench Composting
				</h2>
				<p>
					Organic matter is placed directly on the soil, where it naturally breaks down and returns
					nutrients to the ground.
				</p>
			</div>
			<img
				use:wiggle
				src={asset('worm-divider02.webp')}
				alt=""
				class="mr-auto h-20 min-w-0 flex-none self-center object-contain"
			/>
			<div>
				<h2
					class="mb-2 w-fit -rotate-2 border-2 border-olf-lightbrown px-4 py-2 font-smokum text-2xl tracking-wider text-olf-rose"
				>
					Hot Composting
				</h2>
				<p>
					A carefully balanced mix of organic materials creates heat through natural decomposition,
					transforming organic matter into rich compost.
				</p>
			</div>
			<div>
				<h2
					class="mb-2 w-fit rotate-2 border-2 border-olf-lightbrown px-4 py-2 font-smokum text-2xl tracking-wider text-olf-bluey"
				>
					Vermicomposting
				</h2>
				<p>
					Our worms do the work. Transforming organic matter into nutrient-rich worm castings that
					nourish the soil
				</p>
			</div>
			<div>
				<h2 class="font-smokum text-2xl tracking-wider text-amber-300">
					From Farm to City, From City to Farm
				</h2>
				<p>
					Every week, we bring our nature-raised eggs and orchard produce from our farm in Mantin,
					Negeri Sembilan to the city.
				</p>
				<p>
					On the return journey, we bring organic materials from the city back to the farm,
					transforming would be trash into soil food. We have started collecting spent coffee
					grounds from cafés along our delivery route and turning them into compost.
				</p>
				<p>It's a two-way connection between farm and city — food goes out, resources come back.</p>
			</div>
			<div>
				<h2 class="font-smokum text-2xl tracking-wider text-olf-beige">Our Hens</h2>
				<p>
					Our hens are more than egg machines — they are part of our orchard. They live and forage
					among the trees, scratch the soil, dust bathe, explore and follow their natural
					rhythms.Their presence adds another layer to the farm ecosystem.
				</p>
				<p>
					We raise them with care, giving them space to move, natural sunlight, fresh air and a
					thoughtfully prepared diet.
				</p>
			</div>
			<img
				use:wiggle={-1}
				src={asset('worm-divider.webp')}
				alt=""
				class="ml-auto h-28 min-w-0 flex-none self-center object-contain"
			/>
			<div>
				<h2 class="font-smokum text-2xl tracking-wider text-olf-lightgreen">
					The Farm We're Growing
				</h2>
				<p>
					A little farm, a bigger cycle. Regenerative farming is an ongoing journey. We are
					learning, experimenting and finding ways to better work the natural cycles around us —
					from nurturing healthy soil and caring for our hens to regeneration.
				</p>
			</div>
		</div>
	{/if}
</div>

{#each produceSections as section (section.heading)}
	<ProduceOrderButtons {...section} />
{/each}

<FarmStory />

<FarmYolk eggNum={data.eggNum} />

<div class="bg-olf-beige px-4 py-4 text-center">
	<img
		use:hop
		src={asset('hen with chicks.webp')}
		alt=""
		class="mx-auto mb-2 w-14 object-contain"
	/>
	<p class="font-oswald text-sm font-medium tracking-wider text-olf-darkgreen uppercase">
		{m.home_latest_kicker()}
	</p>
</div>

<!-- The strip's feed data streams in (see +page.ts); hold its place with a
     same-colored section so the page doesn't jump when the posts land. -->
{#await data.strip}
	<section class="flex justify-center bg-olf-lightgreen py-16 text-olf-darkgreen">
		<Spinner />
	</section>
{:then strip}
	<LatestPostsStrip posts={strip.posts} totalCount={strip.totalCount} session={data.session} />
{/await}

<FarmPromise />

<FarmVisit />

<FAQ />
