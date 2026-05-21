<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { sineOut } from 'svelte/easing';

	interface ProduceOrderButtonsProps {
		heading: () => string;
		description: () => string;
		buttonLabel: () => string;
		icon: Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>;
		imageSrc: string;
		imageAlt: string;
		// Dims the heading + description only — never the wrapper, so the
		// expanded photo stays at full brightness while the panel reads "less available".
		brightnessClass?: string;
		disabled?: boolean;
		// Top border seam, for a brown button stacked under another one.
		seam?: boolean;
	}

	let {
		heading,
		description,
		buttonLabel,
		icon: Icon,
		imageSrc,
		imageAlt,
		brightnessClass = '',
		disabled = false,
		seam = false
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
				class="bg-olf-lightgreen px-3 pt-2 pb-4 font-oswald text-sm text-olf-darkgreen/80 {brightnessClass}"
			>
				{description()}
			</p>
			<img
				transition:slide={{ delay: 100, easing: sineOut }}
				src={imageSrc}
				alt={imageAlt}
				class="w-full object-cover lg:hidden"
			/>
		{/if}
	</div>
	<button
		{disabled}
		class="flex flex-col items-center justify-center gap-0.5 bg-olf-darkbrown p-6 text-xs tracking-widest text-olf-beige uppercase disabled:cursor-not-allowed disabled:bg-olf-lightbrown lg:flex-1 {seam
			? 'border-t border-olf-beige/15'
			: ''}"
	>
		<Icon
			size={open ? 30 : 20}
			class="{open ? 'mb-1' : 'mb-0'} transition-all duration-500 ease-in"
		/>
		<span class="underline decoration-white/50 decoration-double underline-offset-2">
			{buttonLabel()}
		</span>
	</button>
</div>
