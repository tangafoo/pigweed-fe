<script lang="ts">
	import type { Component } from 'svelte';
	import { ChevronDown, Minus, Plus, X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { sineOut } from 'svelte/easing';
	import { m } from '$lib/paraglide/messages.js';

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
		// When set, the order button opens a quantity-confirm modal whose
		// "Order on WhatsApp" link opens a chat with this number (digits only,
		// incl. country code) and a message prefilled from whatsAppMessage(quantity).
		whatsAppPhone?: string;
		whatsAppMessage?: (quantity: number) => string;
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
		seam = false,
		whatsAppPhone,
		whatsAppMessage
	}: ProduceOrderButtonsProps = $props();

	let open = $state(false);
	let quantity = $state(1);
	let dialog = $state<HTMLDialogElement>();

	const whatsAppUrl = $derived(
		whatsAppPhone
			? `https://wa.me/${whatsAppPhone}?text=${encodeURIComponent(whatsAppMessage?.(quantity) ?? '')}`
			: undefined
	);
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
	{#snippet orderContent()}
		<Icon
			size={open ? 30 : 20}
			class="{open ? 'mb-1' : 'mb-0'} transition-all duration-500 ease-in"
		/>
		<span class="underline decoration-white/50 decoration-double underline-offset-2">
			{buttonLabel()}
		</span>
	{/snippet}
	{#if whatsAppPhone}
		<button
			type="button"
			onclick={() => dialog?.showModal()}
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

{#if whatsAppPhone}
	<dialog
		bind:this={dialog}
		class="m-auto w-[min(22rem,calc(100vw-2rem))] bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		<div class="flex flex-col gap-5 p-6">
			<div class="flex items-start justify-between gap-4">
				<h2 class="text-2xl font-bold">{heading()}</h2>
				<button
					type="button"
					aria-label={m.home_order_close()}
					onclick={() => dialog?.close()}
					class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
				>
					<X size={22} />
				</button>
			</div>

			<div class="flex items-center justify-between gap-3">
				<span class="font-oswald text-sm tracking-wide text-olf-darkgreen/80 uppercase"
					>{m.home_order_trays_label()}</span
				>
				<div class="flex items-center gap-3">
					<button
						type="button"
						aria-label="Decrease quantity"
						onclick={() => (quantity = Math.max(1, quantity - 1))}
						disabled={quantity <= 1}
						class="flex size-9 items-center justify-center bg-olf-darkgreen text-olf-beige disabled:opacity-40"
					>
						<Minus size={18} />
					</button>
					<span class="w-10 text-center text-2xl font-bold tabular-nums">{quantity}</span>
					<button
						type="button"
						aria-label="Increase quantity"
						onclick={() => (quantity += 1)}
						class="flex size-9 items-center justify-center bg-olf-darkgreen text-olf-beige"
					>
						<Plus size={18} />
					</button>
				</div>
			</div>

			<a
				href={whatsAppUrl}
				target="_blank"
				rel="noopener noreferrer"
				onclick={() => dialog?.close()}
				class="bg-olf-darkbrown py-4 text-center text-sm font-bold tracking-widest text-olf-beige uppercase"
			>
				{m.home_order_whatsapp_cta()}
			</a>
		</div>
	</dialog>
{/if}
