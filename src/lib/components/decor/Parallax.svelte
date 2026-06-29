<script lang="ts">
	import type { Snippet } from 'svelte';

	interface ParallaxProps {
		src: string;
		srcLg?: string;
		class?: string;
		/** Describes the image for a11y. Omit for a purely decorative backdrop. */
		alt?: string;
		children?: Snippet;
	}

	let { src, srcLg, class: className = '', alt, children }: ParallaxProps = $props();

	const parallax = (node: HTMLElement) => {
		let cleanup: (() => void) | undefined;

		(async () => {
			const { gsap } = await import('gsap');
			const { ScrollTrigger } = await import('gsap/ScrollTrigger');
			gsap.registerPlugin(ScrollTrigger);

			const tween = gsap.to(node, {
				yPercent: 20,
				ease: 'none',
				scrollTrigger: {
					trigger: node.parentElement!,
					start: 'top bottom',
					end: 'bottom top',
					scrub: true
				}
			});
			cleanup = () => {
				tween.scrollTrigger?.kill();
				tween.kill();
			};
		})();

		return { destroy: () => cleanup?.() };
	};
</script>

<div class="relative overflow-hidden {className}">
	<div
		use:parallax
		role={alt ? 'img' : undefined}
		aria-label={alt || undefined}
		class="parallax-image absolute inset-x-0 top-[-40%] bottom-0 bg-cover bg-center"
		style="--src: url('{src}'); --src-lg: url('{srcLg ?? src}');"
	></div>
	{@render children?.()}
</div>

<style>
	.parallax-image {
		background-image: var(--src);
	}
	@media (min-width: 1024px) {
		.parallax-image {
			background-image: var(--src-lg);
		}
	}
</style>
