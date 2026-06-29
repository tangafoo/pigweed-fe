<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '$lib/paraglide/messages.js';
	import Parallax from '$lib/components/decor/Parallax.svelte';
	import { asset } from '$lib/config/assets';
	import { orderModal } from '$lib/stores/orderModal.svelte';

	interface FarmStoryProps {
		// Rendered at the top of the story column, above the copy. The home
		// page slots its account bar here so the photo fills the band's full
		// height instead of leaving the bar stranded in a row above it.
		children?: Snippet;
	}
	let { children }: FarmStoryProps = $props();

	// Scroll-driven walk-off: the little hen drawing strolls to the right as the
	// section scrolls past, with a gentle waddle (bob + tilt) to sell the steps,
	// and slips off the right edge — behind the parallax photo on desktop, since
	// the Parallax root is positioned and paints above this static image. Async
	// GSAP + ScrollTrigger (matches Parallax.svelte), reduced-motion aware.
	const walk = (node: HTMLElement) => {
		let cleanup: (() => void) | undefined;

		(async () => {
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');

			gsap.registerPlugin(ScrollTrigger);
			gsap.set(node, { transformOrigin: '50% 100%' }); // pivot at the feet

			// distance the hen walks before it's gone. On desktop the parallax photo
			// covers the right ~40%, so it only needs to reach (and tuck behind) the
			// photo's left edge — using the full viewport width there makes it cover
			// too much ground per scroll and "float/run". On mobile the photo sits
			// below, so it walks all the way off the right edge.
			const henRect = node.getBoundingClientRect();
			const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
			const photo = node.closest('section')?.lastElementChild;
			const exit =
				isDesktop && photo
					? photo.getBoundingClientRect().left - henRect.left + henRect.width + 20
					: window.innerWidth - henRect.left + 40;
			const steps = 16;
			const stepX = exit / steps;
			// where the mid-walk stop happens, as a step index — independent of
			// `steps`, so the waddle stays smooth while you place the pause by eye.
			const pauseAfter = 5;

			const tl = gsap.timeline({
				scrollTrigger: {
					trigger: node.closest('section'),
					start: isDesktop ? 'top 82%' : 'top 80%',
					end: 'bottom top',
					scrub: true
				}
			});
			// desktop: hold still for a stretch of scroll before setting off, so it's
			// (wait) → start → mid-stop → finish rather than walking immediately.
			if (isDesktop) tl.to(node, {}, '+=2');
			// startle: a tiny anticipation crouch, then a quick hop, as if something
			// spooked it into walking — smooths the otherwise cold start.
			tl.to(node, { y: 2, duration: 0.15, ease: 'power1.in' })
				.to(node, { y: -8, rotation: 3, duration: 0.35, ease: 'power2.out' })
				.to(node, { y: 0, rotation: 0, duration: 0.3, ease: 'power2.in' })
				.to(node, {}, '+=1'); // beat after the startle before it walks off
			// each step advances right while waddling — tilt one way, then settle —
			// with a longer dwell at the midpoint where the hen stops and looks around
			// before carrying on (so it only slips behind the parallax late on).
			for (let i = 0; i < steps; i++) {
				const dir = i % 2 ? 8 : -8;
				tl.to(node, { x: `+=${stepX}`, duration: 1, ease: 'none' })
					.to(node, { rotation: dir, y: -3, duration: 0.5, ease: 'sine.out' }, '<')
					.to(node, { rotation: 0, y: 0, duration: 0.5, ease: 'sine.in' }, '<0.5');
				if (i === pauseAfter) tl.to(node, {}, '+=2'); // mid-walk pause
			}

			cleanup = () => {
				tl.scrollTrigger?.kill();
				tl.kill();
			};
		})();

		return { destroy: () => cleanup?.() };
	};
</script>

<section class="flex flex-col overflow-hidden bg-olf-beige lg:flex-row">
	<div class="flex flex-1 flex-col">
		{@render children?.()}
		<div class="flex flex-1 flex-col justify-center gap-3 px-6 py-8 pb-12">
			<img
				use:walk
				src={asset('chicken-drawing-white.webp')}
				alt=""
				class="mr-auto mb-2 w-18 lg:w-24"
			/>
			<p class="font-oswald text-xs tracking-[0.25em] text-olf-darkgreen uppercase">
				{m.home_story_kicker()}
			</p>
			<h2 class="font-homemade-apple text-3xl leading-snug text-olf-darkbrown">
				{m.home_story_heading()}
			</h2>
			<p class="font-oswald text-[0.95rem] leading-relaxed tracking-wide text-olf-darkbrown/85">
				{m.home_story_body_1()}
			</p>
			<p class="font-oswald text-[0.95rem] leading-relaxed tracking-wide text-olf-darkbrown/85">
				{m.home_story_body_2()}
			</p>
			<p class="font-oswald text-[0.95rem] leading-relaxed tracking-wide text-olf-darkbrown/85">
				{m.home_story_body_3()}
			</p>
			<p
				class="mt-1 font-oswald text-[0.95rem] font-light tracking-wide text-olf-darkbrown/70 italic"
			>
				{m.home_story_egg_prices_label()}
				{m.home_eggs_price()}
			</p>
			<button
				type="button"
				onclick={() => (orderModal.open = true)}
				class="mr-auto font-oswald text-sm font-bold text-olf-darkbrown underline underline-offset-4 hover:text-olf-darkgreen"
			>
				{m.home_order_eggs()}
			</button>
		</div>
	</div>
	<Parallax
		src={asset('chickens-eating-cucumber02.webp')}
		class="h-64 w-full lg:h-auto lg:w-[46%]"
	/>
</section>
