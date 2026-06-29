<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { SubscriptionPlanWithBenefits } from '@meteorclass/pigweed-contract';

	interface TierCardProps {
		plan: SubscriptionPlanWithBenefits;
		/** Tighter card for the modal grid — trims the benefit list to a preview. */
		compact?: boolean;
		/** Highlight as the tier the viewer is already on. */
		current?: boolean;
	}
	let { plan, compact = false, current = false }: TierCardProps = $props();

	// Manual subscribe = a pre-filled WhatsApp message, same number as the egg
	// order modal. Payment + confirmation happen off-platform; the admin then
	// flips the subscription on from the panel.
	const PHONE = '60172332992';

	const price = $derived(`RM${(plan.priceCents / 100).toFixed(0)}`);
	const period = $derived(
		plan.cadenceWeeks === 1 ? m.subscribe_per_week() : m.subscribe_per_fortnight()
	);
	const priceLabel = $derived(`${price} ${period}`);

	const whatsAppUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(
			m.subscribe_whatsapp_message({ name: plan.name, price: priceLabel })
		)}`
	);

	// Compact (modal) shows a 3-perk preview + "and N more"; full shows them all.
	const shown = $derived(compact ? plan.benefits.slice(0, 3) : plan.benefits);
	const moreCount = $derived(plan.benefits.length - shown.length);
</script>

<div
	class="flex flex-col gap-4 rounded-xl bg-olf-eggshell p-5 text-olf-darkgreen shadow-md"
	style="border: {current ? 3 : 2}px solid var(--color-olf-{current ? 'yolk' : 'darkgreen'})"
>
	<div class="flex flex-col gap-1">
		<div class="flex items-center justify-between gap-2">
			<h3 class="font-supermercado-one text-xl">{plan.name}</h3>
			{#if current}
				<span
					class="shrink-0 rounded bg-olf-yolk px-2 py-0.5 font-oswald text-xxs font-bold tracking-wider text-olf-darkgreen uppercase"
				>
					{m.subscribe_current_tier()}
				</span>
			{/if}
		</div>
		<p class="font-oswald">
			<span class="text-3xl font-bold tabular-nums">{price}</span>
			<span class="text-sm tracking-wide uppercase opacity-70">{period}</span>
		</p>
		<p class="font-oswald text-xs tracking-wide uppercase opacity-60">
			{m.subscribe_price_per_egg()}
		</p>
	</div>

	{#if shown.length > 0}
		<ul class="flex flex-col gap-2">
			{#each shown as b (b.id)}
				<li class="flex items-start gap-2 font-oswald text-sm">
					<Check size={16} class="mt-0.5 shrink-0 text-olf-moss" />
					<span>{b.label}</span>
				</li>
			{/each}
			{#if moreCount > 0}
				<li class="font-oswald text-xs tracking-wide text-olf-darkgreen/60">
					{m.subscribe_more_benefits({ count: moreCount })}
				</li>
			{/if}
		</ul>
	{/if}

	<a
		href={whatsAppUrl}
		target="_blank"
		rel="noopener noreferrer"
		class="mt-auto rounded-xl bg-olf-darkbrown py-3 text-center text-sm font-bold tracking-widest text-olf-beige uppercase"
	>
		{m.subscribe_cta()}
	</a>
</div>
