<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import UserFlipCard from '$lib/components/posts/UserFlipCard.svelte';
	import SubscriptionExtras from '$lib/components/subscription/SubscriptionExtras.svelte';
	import TierPicker from '$lib/components/subscription/TierPicker.svelte';
	import type {
		Session,
		SubscriptionPlanWithBenefits,
		SubscriptionSummary,
		SubscriptionStats
	} from '@meteorclass/pigweed-contract';

	interface SubscriptionPanelProps {
		plans: SubscriptionPlanWithBenefits[];
		subscription: SubscriptionSummary | null;
		stats: SubscriptionStats | null;
		/** The owner — powers the flip-to-Farm-ID side of the card. */
		user?: Session['user'] | null;
	}
	let { plans, subscription, stats, user = null }: SubscriptionPanelProps = $props();
</script>

<div class="flex flex-col gap-8">
	<!-- The two-faced user card: subscription summary up front, Farm ID on the flip. -->
	<UserFlipCard {user} {subscription} front="subscription" />

	<!-- Egg journey details (subscribers only) — too busy for the card face. -->
	{#if subscription && stats}
		<div class="w-full">
			<SubscriptionExtras {subscription} {stats} />
		</div>
	{/if}

	<!-- Tier picker (one CTA) -->
	<div class="w-full">
		{#if plans.length > 0}
			<TierPicker {plans} {subscription} />
		{:else}
			<p class="text-center font-oswald opacity-70">{m.subscribe_empty()}</p>
		{/if}
	</div>
</div>
