<script lang="ts">
	import { FARMDEX_CATEGORY_DOT, type FarmdexCategory } from '$lib/data/farmdex';

	/**
	 * Category indicator: a text glyph (GLYPH) or a masked shape (SHAPE,
	 * default 8px circle), coloured by FARMDEX_CATEGORY_DOT. Glyphs clip the bg
	 * colour to their text so both kinds use the same colour class.
	 * `class` applies to both kinds; `shapeClass` only to shapes (e.g. a nudge
	 * that glyphs don't need).
	 */
	let {
		category,
		class: extra = '',
		shapeClass = ''
	}: { category: FarmdexCategory; class?: string; shapeClass?: string } = $props();

	// Drawn as a text glyph instead of a shape.
	const GLYPH: Partial<Record<FarmdexCategory, string>> = {
		INSECT: '𓆣',
		FUNGI: '𓍊𓋼𓍊',
		MOLLUSC: '𖦹',
		// U+0F7C is a combining mark; it rides on a no-break space so it doesn't
		// render with a dotted-circle placeholder.
		BIRD: '\u00a0\u0f7c'
	};
	// Per-glyph fit (replaces the default `text-sm`, so its size actually
	// applies): fallback-font glyphs sit at different heights/sizes.
	// The bird mark is an above-the-line vowel sign, so it's small and high.
	const GLYPH_FIT: Partial<Record<FarmdexCategory, string>> = {
		BIRD: 'text-3xl translate-y-[0.34em]',
		// Bigger so the spiral reads.
		MOLLUSC: 'text-lg'
	};
	// Masked shape; anything unlisted (and not a glyph) is an 8px circle.
	const SHAPE: Partial<Record<FarmdexCategory, string>> = {
		MAMMAL: 'dot-heart size-2.5',
		REPTILE: 'dot-diamond h-2.5 w-2',
		AMPHIBIAN: 'dot-wavy h-2.5 w-3',
		PLANT: 'dot-ring size-3'
	};
</script>

{#if GLYPH[category]}
	<span
		class="shrink-0 bg-clip-text leading-none text-transparent not-italic {GLYPH_FIT[category] ??
			'text-sm'} {extra} {FARMDEX_CATEGORY_DOT[category]}">{GLYPH[category]}</span
	>
{:else}
	<span
		class="shrink-0 {SHAPE[category] ??
			'size-2 rounded-full'} {shapeClass} {extra} {FARMDEX_CATEGORY_DOT[category]}"
	></span>
{/if}

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
