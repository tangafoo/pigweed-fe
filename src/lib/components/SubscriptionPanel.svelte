<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import SubscriptionCard from '$lib/components/SubscriptionCard.svelte';
	import TierPicker from '$lib/components/TierPicker.svelte';
	import type {
		SubscriptionPlanWithBenefits,
		SubscriptionSummary,
		SubscriptionStats
	} from '@meteorclass/pigweed-contract';

	interface SubscriptionPanelProps {
		plans: SubscriptionPlanWithBenefits[];
		subscription: SubscriptionSummary | null;
		stats: SubscriptionStats | null;
	}
	let { plans, subscription, stats }: SubscriptionPanelProps = $props();
</script>

<div class="flex flex-col gap-8">
	<!-- Your egg journey (subscribers) -->
	{#if subscription && stats}
		<SubscriptionCard {subscription} {stats} />
	{/if}

	<!-- Tier picker (one CTA) -->
	{#if plans.length > 0}
		<TierPicker {plans} {subscription} />
	{:else}
		<p class="text-center font-oswald opacity-70">{m.subscribe_empty()}</p>
	{/if}
</div>
