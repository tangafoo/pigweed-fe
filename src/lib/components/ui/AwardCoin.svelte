<script lang="ts">
	import { asset } from '$lib/config/assets';
	import { tilt } from '$lib/actions/tilt';

	// An award rendered as a fancy commemorative coin: brass ring, warm face,
	// a slow shimmer sweep, a cursor-tracked holo glare + 3D tilt (same `tilt`
	// action as the trading cards). The ×n badge carries the aggregated count.
	interface AwardCoinProps {
		assetKey: string;
		name: string;
		/** Coin diameter in px. */
		size?: number;
		/** Aggregated count — renders a ×n badge when > 1. */
		count?: number;
		/** Edge treatment. Flip the default to switch the whole app's coins:
		 * 'durian' = spiky husk edge, 'sticker' = white die-cut + hard shadow. */
		variant?: 'durian' | 'sticker';
	}
	let { assetKey, name, size = 56, count = 1, variant = 'durian' }: AwardCoinProps = $props();

	let broken = $state(false);
</script>

<span
	class="coin {variant} relative flex shrink-0 items-center justify-center rounded-full"
	style="width: {size}px; height: {size}px;"
	title={name}
	use:tilt={{ max: 16, scale: 1.08, perspective: 500 }}
>
	<!-- Inner layer owns the circular clip so the ×n badge (which pokes past
	     the rim) never gets cut off. -->
	<span
		class="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full"
	>
		{#if broken}
			<span style="font-size: {size * 0.6}px" class="leading-none">🏅</span>
		{:else}
			<img
				src={asset(`${assetKey}.webp`)}
				alt={name}
				onerror={() => (broken = true)}
				draggable="false"
				class="h-full w-full object-contain"
			/>
		{/if}
		<span class="shimmer pointer-events-none absolute inset-0 rounded-full"></span>
		<span class="glare pointer-events-none absolute inset-0 rounded-full"></span>
	</span>
	{#if count > 1}
		<span
			class="absolute -right-1.5 -bottom-1 z-10 rounded-full bg-olf-darkgreen px-1.5 py-0.5 font-oswald text-xxs leading-none font-bold text-olf-eggshell shadow ring-2 ring-olf-eggshell"
		>
			×{count}
		</span>
	{/if}
</span>

<style>
	.coin {
		background: radial-gradient(circle at 35% 30%, #fffaf0, #f3e4c9 78%, #ecd9b3);
	}
	/* Durian: 16 moss spikes poking outward from behind the coin — the husk.
	   The ::before is a bigger star-clipped layer; a radial mask hollows out
	   its middle so only the spike tips show past the coin's edge (a negative
	   z-index can't tuck it behind the face — the tilt transform makes .coin
	   its own stacking context). Flat otherwise, no shadow. */
	.coin.durian::before {
		content: '';
		position: absolute;
		inset: -12%;
		background: var(--color-olf-moss);
		clip-path: polygon(
			50% 0%,
			57.9% 10.3%,
			69.1% 3.8%,
			72.5% 16.3%,
			85.4% 14.6%,
			83.7% 27.5%,
			96.2% 30.9%,
			89.7% 42.1%,
			100% 50%,
			89.7% 57.9%,
			96.2% 69.1%,
			83.7% 72.5%,
			85.4% 85.4%,
			72.5% 83.7%,
			69.1% 96.2%,
			57.9% 89.7%,
			50% 100%,
			42.1% 89.7%,
			30.9% 96.2%,
			27.5% 83.7%,
			14.6% 85.4%,
			16.3% 72.5%,
			3.8% 69.1%,
			10.3% 57.9%,
			0% 50%,
			10.3% 42.1%,
			3.8% 30.9%,
			16.3% 27.5%,
			14.6% 14.6%,
			27.5% 16.3%,
			30.9% 3.8%,
			42.1% 10.3%
		);
		-webkit-mask: radial-gradient(circle, transparent 39%, black 39.5%);
		mask: radial-gradient(circle, transparent 39%, black 39.5%);
	}
	/* Sticker die-cut: a chunky white edge + a crisp hard offset shadow (zero
	   blur, zero glow) — cute-Pinterest, slapped-on-the-page. */
	.coin.sticker {
		border: 4px solid #fffaf0;
		box-shadow: 2px 3px 0 rgb(0 0 0 / 0.15);
	}
	/* Slow shimmer: one sweep, then rest most of the cycle. */
	.shimmer {
		background: linear-gradient(
			115deg,
			transparent 38%,
			rgb(255 255 255 / 0.75) 50%,
			transparent 62%
		);
		background-size: 260% 100%;
		background-position: 130% 0;
		animation: coin-shimmer 4.6s ease-in-out infinite;
		mix-blend-mode: soft-light;
	}
	@keyframes coin-shimmer {
		0% {
			background-position: 130% 0;
		}
		40%,
		100% {
			background-position: -130% 0;
		}
	}
	/* Cursor-tracked glare — vars come from the tilt action. */
	.glare {
		background: radial-gradient(
			circle at var(--mx, 50%) var(--my, 50%),
			rgb(255 250 240 / 0.55),
			transparent 55%
		);
		opacity: var(--glare, 0);
		transition: opacity 0.3s;
		mix-blend-mode: soft-light;
	}
	@media (prefers-reduced-motion: reduce) {
		.shimmer {
			animation: none;
		}
	}
</style>
