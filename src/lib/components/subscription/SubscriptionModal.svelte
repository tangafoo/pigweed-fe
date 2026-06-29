<script lang="ts">
	import { X, Egg } from '@lucide/svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages.js';
	import { subscriptionModal } from '$lib/stores/subscriptionModal.svelte';
	import { fetchMySubscription } from '$lib/api/subscriptions';
	import UserFlipCard from '$lib/components/posts/UserFlipCard.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import type { Session, SubscriptionSummary } from '@meteorclass/pigweed-contract';

	let dialog = $state<HTMLDialogElement>();
	let subscription = $state<SubscriptionSummary | null>(null);
	let loaded = $state(false);
	let loading = $state(false);

	const user = $derived((page.data as { session?: Session | null }).session?.user ?? null);
	const subscribed = $derived(!!subscription);

	// Lazy-load the viewer's own subscription the first time the modal opens.
	// Subscribers see their card (flippable to Farm ID); everyone else gets a
	// tidy empty state that points at the full subscriptions page.
	async function ensureData() {
		if (loaded || loading) return;
		loading = true;
		const mine = await fetchMySubscription();
		subscription = mine.subscription;
		loaded = true;
		loading = false;
	}

	// Drive the native <dialog> from the shared store, both directions.
	$effect(() => {
		if (!dialog) return;
		if (subscriptionModal.open && !dialog.open) {
			dialog.showModal();
			ensureData();
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
	class="m-auto w-[min(35rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
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
		{:else if subscribed}
			<div class="flex flex-col items-center py-2">
				<UserFlipCard {user} {subscription} front="subscription" />
			</div>
		{:else}
			<!-- Empty state: never-subscribed (or signed out). No tier cards here —
			     just a nudge to the full subscriptions page. -->
			<div class="flex flex-col items-center gap-4 py-8 text-center">
				<span
					class="flex size-14 items-center justify-center rounded-full bg-olf-darkgreen/10 text-olf-darkgreen"
				>
					<Egg size={28} />
				</span>
				<p class="font-supermercado-one text-lg text-olf-darkbrown">{m.subscribe_modal_no_sub()}</p>
				<a
					href="/subscriptions"
					onclick={close}
					class="rounded-full bg-olf-darkbrown px-6 py-3 font-oswald text-sm font-bold tracking-widest text-olf-beige uppercase shadow-lg transition-transform hover:scale-105"
				>
					🥚 {m.subscribe_modal_browse()}
				</a>
			</div>
		{/if}
	</div>
</dialog>
