<script lang="ts">
	import { X } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { subscriptionModal } from '$lib/stores/subscriptionModal.svelte';
	import { fetchPlans } from '$lib/api/subscriptions';
	import TierCard from '$lib/components/TierCard.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { SubscriptionPlanWithBenefits } from '@meteorclass/pigweed-contract';

	let dialog = $state<HTMLDialogElement>();
	let plans = $state<SubscriptionPlanWithBenefits[]>([]);
	let loaded = $state(false);
	let loading = $state(false);

	// Lazy-load the tiers the first time the modal is opened (public endpoint).
	async function ensurePlans() {
		if (loaded || loading) return;
		loading = true;
		plans = await fetchPlans();
		loaded = true;
		loading = false;
	}

	// Drive the native <dialog> from the shared store, both directions.
	$effect(() => {
		if (!dialog) return;
		if (subscriptionModal.open && !dialog.open) {
			dialog.showModal();
			ensurePlans();
		} else if (!subscriptionModal.open && dialog.open) {
			dialog.close();
		}
	});

	const close = () => (subscriptionModal.open = false);
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) close();
	}}
	class="m-auto w-[min(52rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-5 p-6">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="text-2xl font-bold">{m.subscribe_modal_title()}</h2>
				<p class="font-oswald text-sm opacity-70">{m.subscribe_modal_subtitle()}</p>
			</div>
			<button
				type="button"
				aria-label={m.subscribe_close()}
				onclick={close}
				class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
			>
				<X size={22} />
			</button>
		</div>

		{#if loading}
			<div class="flex justify-center py-12 text-olf-darkgreen"><Spinner size={32} /></div>
		{:else if plans.length === 0}
			<p class="py-10 text-center font-oswald opacity-70">{m.subscribe_empty()}</p>
		{:else}
			<div class="grid gap-4 sm:grid-cols-3">
				{#each plans as plan (plan.id)}
					<TierCard {plan} compact />
				{/each}
			</div>
		{/if}

		<a
			href="/subscriptions"
			onclick={close}
			class="text-center font-oswald text-sm underline opacity-80 hover:opacity-100"
		>
			{m.subscribe_see_all()}
		</a>
	</div>
</dialog>
