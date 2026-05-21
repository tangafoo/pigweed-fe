<script lang="ts">
	interface SpinnerProps {
		/** Diameter in pixels. */
		size?: number;
		/** Accessible status label. */
		label?: string;
	}
	let { size = 24, label = 'Loading' }: SpinnerProps = $props();
</script>

<span class="spinner rounded-full" style="--spinner-size: {size}px" role="status" aria-label={label}></span>

<style>
	.spinner {
		display: inline-block;
		width: var(--spinner-size);
		height: var(--spinner-size);
		border: 3px solid color-mix(in srgb, currentColor 22%, transparent);
		border-top-color: currentColor;
		animation: spinner-rotate 0.7s linear infinite;
	}

	@keyframes spinner-rotate {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation-duration: 2s;
		}
	}
</style>
