<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { sineOut } from 'svelte/easing';
	import Parallax from '$lib/components/Parallax.svelte';
	import { orderModal } from '$lib/stores/orderModal.svelte';

	interface ProduceOrderButtonsProps {
		heading: () => string;
		description: () => string;
		// Optional price line shown under the description in the expanded panel.
		priceLine?: () => string;
		buttonLabel: () => string;
		icon: Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>;
		// Extra classes for the order-button icon — e.g. a `fill-*` to colour
		// the egg in instead of leaving it as a hollow outline.
		iconClass?: string;
		imageSrc: string;
		imageAlt: string;
		// Dims the heading + description only — never the wrapper, so the
		// expanded photo stays at full brightness while the panel reads "less available".
		brightnessClass?: string;
		disabled?: boolean;
		// Top border seam, for a brown button stacked under another one.
		seam?: boolean;
		// When set, the order button opens the shared egg-order modal (rendered
		// once in the root layout). Otherwise the button is a plain (disabled) CTA.
		whatsAppPhone?: string;
		// Gives the order-button icon a periodic little shake (used for the egg).
		iconShake?: boolean;
	}

	let {
		heading,
		description,
		priceLine,
		buttonLabel,
		icon: Icon,
		iconClass = '',
		imageSrc,
		imageAlt,
		brightnessClass = '',
		disabled = false,
		seam = false,
		whatsAppPhone,
		iconShake = false
	}: ProduceOrderButtonsProps = $props();

	let open = $state(false);
</script>

<div class="flex w-full">
	<div class="flex flex-1 flex-col">
		<button
			type="button"
			onclick={() => (open = !open)}
			aria-expanded={open}
			class="flex flex-1 items-center gap-2 bg-olf-lightgreen px-3 py-4 text-left text-3xl font-bold text-olf-darkgreen/60 {brightnessClass}"
		>
			<span class="flex-1">{heading()}</span>
			<ChevronDown
				size={28}
				class="shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}"
			/>
		</button>
		{#if open}
			<p
				transition:slide
				class="bg-olf-lightgreen px-3 pt-2 font-oswald text-sm text-olf-darkgreen/80 {priceLine
					? 'pb-1'
					: 'pb-4'} {brightnessClass}"
			>
				{description()}
			</p>
			{#if priceLine}
				<p
					transition:slide
					class="bg-olf-lightgreen px-3 pb-4 font-oswald text-sm font-light text-olf-darkgreen/70 italic {brightnessClass}"
				>
					{priceLine()}
				</p>
			{/if}
			<div transition:slide={{ delay: 100, easing: sineOut }} class="lg:hidden">
				<Parallax src={imageSrc} alt={imageAlt} class="h-56 w-full" />
			</div>
		{/if}
	</div>
	{#snippet orderContent()}
		<span class="inline-flex {iconShake ? 'egg-shake' : ''}">
			<Icon
				size={open ? 30 : 20}
				class="{open ? 'mb-1' : 'mb-0'} transition-all duration-500 ease-in {iconClass}"
			/>
		</span>
		<span class="underline decoration-white/50 decoration-double underline-offset-2">
			{buttonLabel()}
		</span>
	{/snippet}
	{#if whatsAppPhone}
		<button
			type="button"
			onclick={() => (orderModal.open = true)}
			class="flex flex-col items-center justify-center gap-0.5 bg-olf-darkbrown p-6 text-xs tracking-widest text-olf-beige uppercase lg:flex-1 {seam
				? 'border-t border-olf-beige/15'
				: ''}"
		>
			{@render orderContent()}
		</button>
	{:else}
		<button
			{disabled}
			class="flex flex-col items-center justify-center gap-0.5 bg-olf-darkbrown p-6 text-xs tracking-widest text-olf-beige uppercase disabled:cursor-not-allowed disabled:bg-olf-lightbrown lg:flex-1 {seam
				? 'border-t border-olf-beige/15'
				: ''}"
		>
			{@render orderContent()}
		</button>
	{/if}
</div>

<style>
	/* A brief wobble, then a long rest (~3.8s), on repeat. The shake lives in the
	   first ~12% of the 4.3s cycle; the rest holds still. Reduced-motion opt-out. */
	.egg-shake {
		transform-origin: 50% 80%;
		animation: egg-shake 4.3s ease-in-out infinite;
	}
	@keyframes egg-shake {
		0%,
		12%,
		100% {
			transform: rotate(0deg);
		}
		2% {
			transform: rotate(-9deg);
		}
		4% {
			transform: rotate(8deg);
		}
		6% {
			transform: rotate(-6deg);
		}
		8% {
			transform: rotate(5deg);
		}
		10% {
			transform: rotate(-2deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.egg-shake {
			animation: none;
		}
	}
</style>
