<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Heart, Sprout, Recycle } from '@lucide/svelte';

	// A single lucide-style heart path, redrawn at growing sizes and stacked
	// concentrically behind the content as a soft rose echo. Innermost is the
	// most visible (50%) and each larger ring fades further out. Stroke stays a
	// constant 2px regardless of size via `vector-effect: non-scaling-stroke`.
	const HEART_PATH =
		'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
	const heartRings = [110, 200, 300, 410, 530, 660].map((size, i, arr) => ({
		size,
		opacity: 0.5 * (1 - i / arr.length)
	}));

	// The rings emanate from the rose "Happy hens" heart, not the section
	// centre. `cx`/`cy` place the layer on that icon (measured below); the layer
	// stays `opacity: 0` until `ready` flips, so the one-time measure-and-reposition
	// happens while invisible — no flicker, even when the section is already in
	// view on a refresh (and even for reduced-motion users, who get no GSAP pass
	// to mask it). 50% is only an SSR placeholder; it's never painted visibly.
	let cx = $state('50%');
	let cy = $state('50%');
	let ready = $state(false);

	// One action owns the whole lifecycle so reveal is coordinated with both the
	// measurement and the GSAP collapse: measure → position → (collapse) → reveal
	// → animate. Deferred to rAF so the heart anchor (later in the DOM than this
	// layer) exists by the time we query it. Async GSAP + ScrollTrigger matches
	// Parallax/FarmStory; reduced-motion aware. Scaling about `center` leaves the
	// CSS-`translate` centering untouched (separate property).
	const hearts = (node: HTMLElement) => {
		let ro: ResizeObserver | undefined;
		let cleanup: (() => void) | undefined;

		const init = async () => {
			const section = node.closest('section');
			const heart = section?.querySelector<HTMLElement>('[data-heart-anchor]');
			const rings = node.querySelectorAll('svg');
			if (!section || !heart || !rings.length) return;

			const measure = () => {
				const s = section.getBoundingClientRect();
				const a = heart.getBoundingClientRect();
				cx = `${a.left - s.left + a.width / 2}px`;
				cy = `${a.top - s.top + a.height / 2}px`;
			};
			measure();
			ro = new ResizeObserver(measure);
			ro.observe(section);

			// Reduced motion: reveal in place at full size, no animation.
			if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
				ready = true;
				return;
			}

			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');
			gsap.registerPlugin(ScrollTrigger);

			// Collapse first, then reveal — so the layer fades in already at scale 0
			// (invisible) and the only motion anyone sees is the emanate itself.
			gsap.set(rings, { scale: 0, transformOrigin: 'center center' });
			ready = true;

			// A soft heartbeat: overshoot out, settle back, rippling from the centre.
			const pulse = (tl: gsap.core.Timeline) =>
				tl
					.to(rings, { scale: 1.06, duration: 0.45, ease: 'sine.inOut', stagger: 0.05 })
					.to(rings, { scale: 1, duration: 0.6, ease: 'sine.inOut', stagger: 0.05 });

			// A self-rescheduling heartbeat (not a fixed GSAP loop) so a click on the
			// heart can cut the wait short: fire a pulse now, then restart the 8s
			// countdown from its completion. Overlapping clicks are ignored mid-beat.
			let timer: ReturnType<typeof setTimeout> | undefined;
			let pulsing = false;

			const scheduleNext = () => {
				clearTimeout(timer);
				timer = setTimeout(firePulse, 8000);
			};
			function firePulse() {
				clearTimeout(timer);
				if (pulsing) return;
				pulsing = true;
				pulse(
					gsap.timeline({
						onComplete: () => {
							pulsing = false;
							scheduleNext();
						}
					})
				);
			}
			const onHeartClick = () => firePulse();

			const intro = gsap.timeline({
				scrollTrigger: { trigger: heart, start: 'top 85%', once: true },
				onComplete: () => {
					scheduleNext();
					heart.style.cursor = 'pointer';
					heart.addEventListener('click', onHeartClick);
				}
			});
			// Emanate outward — inner first, each larger ring overshooting behind it —
			// then the "now they're all full" pulse, before the 8s heartbeat takes over.
			intro.to(rings, { scale: 1, duration: 0.9, ease: 'back.out(1.7)', stagger: 0.09 });
			pulse(intro);

			cleanup = () => {
				intro.scrollTrigger?.kill();
				intro.kill();
				clearTimeout(timer);
				heart.removeEventListener('click', onHeartClick);
			};
		};

		const raf = requestAnimationFrame(init);

		return {
			destroy: () => {
				cancelAnimationFrame(raf);
				ro?.disconnect();
				cleanup?.();
			}
		};
	};

	const promises = [
		// The heart is the one pop of a complementary colour on the whole home
		// page — a soft rose against all the greens and browns.
		{
			icon: Heart,
			title: m.home_promise_1_title,
			body: m.home_promise_1_body,
			iconClass: 'fill-olf-rose text-olf-rose'
		},
		{
			icon: Sprout,
			title: m.home_promise_2_title,
			body: m.home_promise_2_body,
			iconClass: 'text-olf-lightgreen'
		},
		{
			icon: Recycle,
			title: m.home_promise_3_title,
			body: m.home_promise_3_body,
			iconClass: 'text-olf-lightgreen'
		}
	];
</script>

<section class="relative overflow-hidden bg-olf-darkgreen px-6 py-12 text-olf-beige">
	<!-- Decorative concentric hearts, behind everything and non-interactive.
	     Hidden until `ready` so the one-time reposition never flickers. -->
	<div
		use:hearts
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 {ready
			? 'opacity-100'
			: 'opacity-0'}"
	>
		{#each heartRings as ring (ring.size)}
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="absolute -translate-x-1/2 -translate-y-1/2 text-olf-rose"
				style="left: {cx}; top: {cy}; width: {ring.size}px; height: {ring.size}px; opacity: {ring.opacity};"
			>
				<path d={HEART_PATH} vector-effect="non-scaling-stroke" />
			</svg>
		{/each}
	</div>

	<p class="relative z-10 text-center font-oswald text-xs tracking-[0.25em] text-olf-lightgreen uppercase">
		{m.home_promise_kicker()}
	</p>
	<h2 class="relative z-10 mt-1 text-center font-homemade-apple text-3xl">
		{m.home_promise_heading()}
	</h2>
	<div class="relative z-10 mt-8 flex flex-col gap-8 lg:flex-row lg:gap-6">
		{#each promises as p, i (i)}
			{@const Icon = p.icon}
			<div class="flex flex-1 flex-col items-center gap-2 text-center">
				<span class="inline-flex" data-heart-anchor={i === 0 ? '' : undefined}>
					<Icon size={36} strokeWidth={1.5} class={p.iconClass} />
				</span>
				<p class="font-supermercado-one text-lg">{p.title()}</p>
				<p class="max-w-xs font-oswald text-sm text-olf-beige/75">{p.body()}</p>
			</div>
		{/each}
	</div>
</section>
