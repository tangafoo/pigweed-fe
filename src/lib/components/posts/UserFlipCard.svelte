<script lang="ts">
	import FlipCard from '$lib/components/ui/FlipCard.svelte';
	import SubscriptionCardFace from '$lib/components/subscription/SubscriptionCardFace.svelte';
	import SettingsCardFace from '$lib/components/settings/SettingsCardFace.svelte';
	import type { Session, SubscriptionSummary } from '@meteorclass/pigweed-contract';

	// The shared two-faced user card: an AMEX-style subscription summary on one
	// side, the "Farm ID" settings card on the other. `front` picks the default
	// face per context (subscription tab vs settings tab vs modal). The settings
	// face needs the session user; without it the card is sub-only (no flip).
	interface UserFlipCardProps {
		user?: Session['user'] | null;
		subscription?: SubscriptionSummary | null;
		front?: 'subscription' | 'settings';
	}
	let { user = null, subscription = null, front = 'subscription' }: UserFlipCardProps = $props();
</script>

{#snippet subFace()}
	<SubscriptionCardFace {subscription} username={user?.username} />
{/snippet}
{#snippet settingsFace()}
	{#if user}<SettingsCardFace {user} />{/if}
{/snippet}

<FlipCard
	front={front === 'settings' && user ? settingsFace : subFace}
	back={user ? (front === 'settings' ? subFace : settingsFace) : undefined}
/>
