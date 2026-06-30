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
	import { Sun, CloudRain, Wheat, Sprout } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const weather = $derived(data.weather);
	const latestPosts = $derived(data.latestPosts);

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

<LatestPostsStrip posts={latestPosts} totalCount={data.postCount} session={data.session} />

<FarmPromise />

<FarmVisit />

<FAQ />
