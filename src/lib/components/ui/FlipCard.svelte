<script lang="ts">
	import type { Snippet } from 'svelte';
	import { FlipHorizontal2 } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { tilt } from '$lib/actions/tilt';

	interface FlipCardProps {
		/** The default-facing side. */
		front: Snippet;
		/** The reverse side. Omit to render a non-flippable card (no flip button). */
		back?: Snippet;
		/** Two-way bindable flip state. */
		flipped?: boolean;
		/** Card width (CSS length). Both faces share it; height grows to the taller face. */
		width?: string;
	}
	let { front, back, flipped = $bindable(false), width = '31rem' }: FlipCardProps = $props();

	const toggle = () => (flipped = !flipped);
</script>

<!-- A 3D "trading card" that flips between two faces. The pointer-tilt + holo
     glare (the `tilt` action, shared with both card faces) plays on the outer
     stage; the inner flipper does the 180° turn. The two faces are grid-stacked
     so the card sizes to whichever face is taller — no clipping on flip. -->
<div class="flip" style="--card-w: {width}">
	<div class="stage" use:tilt={{ max: 7, scale: 1.015, perspective: 1600 }}>
		<div class="flipper" class:flipped>
			<div class="face front">{@render front()}</div>
			{#if back}
				<div class="face back">{@render back()}</div>
			{/if}
		</div>
	</div>

	{#if back}
		<button type="button" class="flip-btn" onclick={toggle} aria-pressed={flipped}>
			<FlipHorizontal2 size={14} class="shrink-0" />
			{m.card_flip()}
		</button>
	{/if}
</div>

<style>
	.flip {
		display: flex;
		width: var(--card-w);
		max-width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
	}

	.stage {
		width: 100%;
		/* Perspective for the child flip + preserve-3d so the tilt action's own
		   rotation doesn't flatten the flipper. */
		perspective: 1600px;
		transform-style: preserve-3d;
		will-change: transform;
	}

	.flipper {
		display: grid;
		width: 100%;
		transform-style: preserve-3d;
		transition: transform 0.7s cubic-bezier(0.2, 0.75, 0.2, 1);
	}
	.flipper.flipped {
		transform: rotateY(180deg);
	}

	/* Both faces occupy the same grid cell → flipper height = the taller face.
	   min-width: 0 kills the grid item's auto minimum — without it a face with
	   unshrinkable content (the Farm ID's nowrap machine-readable strip) forces
	   the whole card wider than small phone viewports; with it the face takes
	   the track width and the strip clips (it's decorative flavor anyway). */
	.face {
		grid-area: 1 / 1;
		min-width: 0;
		backface-visibility: hidden;
		-webkit-backface-visibility: hidden;
	}
	.face.back {
		transform: rotateY(180deg);
	}

	@media (prefers-reduced-motion: reduce) {
		.flipper {
			transition: none;
		}
	}

	.flip-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--color-olf-darkbrown) 88%, transparent);
		padding: 0.4rem 1rem;
		font-family: var(--font-oswald, inherit);
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-olf-beige);
		box-shadow: 0 4px 12px rgb(0 0 0 / 0.18);
		transition:
			transform 0.15s,
			background 0.15s;
	}
	.flip-btn:hover {
		transform: translateY(-1px);
		background: var(--color-olf-darkbrown);
	}
</style>
