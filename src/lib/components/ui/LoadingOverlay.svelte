<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { loadingScreen } from '$lib/stores/loadingScreen.svelte';
	import { asset } from '$lib/config/assets';
	import { m } from '$lib/paraglide/messages.js';
</script>

<!-- Full-screen blocking loader (iOS style): a deliberate dark-green scrim
     with one of the farm's chicken drawings gently pecking away — no spinner.
     Mounted once in the root layout; driven by the loadingScreen store. -->
{#if loadingScreen.visible}
	<div
		transition:fade={{ duration: 150 }}
		role="status"
		aria-live="polite"
		class="fixed inset-0 z-[100] flex cursor-wait flex-col items-center justify-center gap-4 bg-olf-darkgreen/80 backdrop-blur-sm"
	>
		<div
			in:scale={{ duration: 200, start: 0.85 }}
			class="flex size-32 items-center justify-center rounded-full bg-olf-beige shadow-xl"
		>
			<img
				src={asset(loadingScreen.artKey)}
				alt=""
				class="chicken h-20 w-20 object-contain"
				draggable="false"
			/>
		</div>
		<p class="font-oswald text-sm font-bold tracking-widest text-olf-eggshell uppercase">
			{loadingScreen.message ?? m.loading_generic()}
		</p>
	</div>
{/if}

<style>
	/* A tiny "peck": bob down-and-tilt, dwell, repeat. Deliberately homespun —
	   this is the farm's loading spinner. */
	.chicken {
		transform-origin: 50% 85%;
		animation: chicken-peck 1.1s ease-in-out infinite;
	}
	@keyframes chicken-peck {
		0%,
		55%,
		100% {
			transform: translateY(0) rotate(0deg);
		}
		20% {
			transform: translateY(4px) rotate(-6deg);
		}
		38% {
			transform: translateY(1px) rotate(3deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chicken {
			animation: none;
		}
	}
</style>
