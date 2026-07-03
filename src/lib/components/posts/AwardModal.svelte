<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import { slide } from 'svelte/transition';
	import { fetchAwardTypes, grantAward, type AwardTarget } from '$lib/api/awards';
	import { toasts } from '$lib/realtime/toasts.svelte';
	import { asset } from '$lib/config/assets';
	import AwardCoin from '$lib/components/ui/AwardCoin.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import type { AwardType, Session } from '@meteorclass/pigweed-contract';
	import { Gift, X } from '@lucide/svelte';

	interface AwardModalProps {
		/** Two-way bindable open state — the card just flips this. */
		open?: boolean;
		/** What's being gifted to — a post or a comment. */
		targetType?: AwardTarget;
		targetId: string;
		/** Fired after a successful grant so the card can bump its award stack. */
		onGranted?: (award: Pick<AwardType, 'id' | 'assetKey' | 'name'>) => void;
	}
	let {
		open = $bindable(false),
		targetType = 'post',
		targetId,
		onGranted
	}: AwardModalProps = $props();

	const sessionUser = $derived((page.data as { session?: Session | null }).session?.user ?? null);

	// Coin balance shown in the header. Seeded from the session; decremented
	// optimistically after a grant (invalidateAll refreshes the real number in
	// the background). Re-synced every time the modal opens.
	let balance = $state(0);

	let types = $state<AwardType[]>([]);
	let loading = $state(false);
	let selectedId = $state<string | null>(null);
	let granting = $state(false);
	let error = $state<'insufficient' | 'generic' | null>(null);
	// "How do I earn coins?" inline reveal.
	let helpOpen = $state(false);

	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			balance = sessionUser?.coinBalance ?? 0;
			selectedId = null;
			error = null;
			dialog.showModal();
			if (types.length === 0 && !loading) {
				loading = true;
				fetchAwardTypes().then((t) => {
					types = t;
					loading = false;
				});
			}
		} else if (!open && dialog.open) dialog.close();
	});

	const selected = $derived(types.find((t) => t.id === selectedId) ?? null);
	const affordable = $derived(selected != null && selected.priceCoins <= balance);

	async function gift() {
		if (!selected || granting) return;
		if (!affordable) {
			error = 'insufficient';
			return;
		}
		granting = true;
		error = null;
		const res = await grantAward(targetType, targetId, selected.id);
		granting = false;
		if (res.ok) {
			balance -= selected.priceCoins;
			toasts.push({ title: m.award_success_toast({ name: selected.name }) });
			onGranted?.({ id: selected.id, assetKey: selected.assetKey, name: selected.name });
			open = false;
			// Refresh the session's coinBalance everywhere (nav, farm ID card).
			void invalidateAll();
		} else {
			error = res.code === 'insufficient' ? 'insufficient' : 'generic';
		}
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl bg-olf-beige text-olf-darkbrown backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 class="flex items-center gap-2 font-homemade-apple text-2xl text-olf-darkgreen">
					<Gift size={20} class="shrink-0" />
					{m.award_modal_title()}
				</h2>
				<p class="mt-1 font-oswald text-xs text-olf-darkbrown/70">{m.award_modal_subtitle()}</p>
			</div>
			<button
				type="button"
				aria-label={m.achievements_close()}
				onclick={() => (open = false)}
				class="shrink-0 text-olf-darkbrown/60 hover:text-olf-darkbrown"
			>
				<X size={20} />
			</button>
		</div>

		<!-- Balance pill -->
		<div
			class="flex w-fit items-center gap-1.5 rounded-full bg-olf-darkbrown px-3 py-1 font-oswald text-sm font-bold text-olf-beige"
		>
			<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
			<span class="tabular-nums">{balance}</span>
			<span class="font-normal opacity-70">{m.award_balance()}</span>
		</div>

		{#if loading}
			<div class="flex justify-center py-8 text-olf-darkgreen"><Spinner /></div>
		{:else if types.length === 0}
			<p class="py-6 text-center font-oswald text-sm text-olf-darkbrown/60">
				{m.award_error()}
			</p>
		{:else}
			<div class="grid grid-cols-3 gap-2">
				{#each types as t (t.id)}
					{@const canAfford = t.priceCoins <= balance}
					<button
						type="button"
						onclick={() => {
							selectedId = t.id;
							error = null;
						}}
						aria-pressed={selectedId === t.id}
						class="flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-colors {selectedId ===
						t.id
							? 'border-olf-darkgreen bg-olf-lightgreen/60'
							: 'border-olf-darkbrown/15 bg-olf-eggshell hover:border-olf-darkgreen/40'} {canAfford
							? ''
							: 'opacity-55'}"
					>
						<!-- The award as a big shiny coin — it's the star of the picker. -->
						<AwardCoin assetKey={t.assetKey} name={t.name} size={72} />
						<span class="mt-1 font-oswald text-xs leading-tight font-bold">{t.name}</span>
						<span
							class="flex items-center gap-1 rounded-full bg-olf-darkbrown/10 px-2 py-0.5 font-oswald text-xxs font-bold tabular-nums"
						>
							<img src={asset('egg05.webp')} alt="" class="h-3 w-3 shrink-0 object-contain" />
							{t.priceCoins}
						</span>
					</button>
				{/each}
			</div>

			{#if error}
				<p class="rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">
					{error === 'insufficient' ? m.award_insufficient() : m.award_error()}
				</p>
			{/if}

			<button
				type="button"
				onclick={gift}
				disabled={!selected || granting || !affordable}
				class="flex items-center justify-center gap-2 rounded-full bg-olf-darkgreen px-4 py-2.5 font-oswald font-bold tracking-wider text-olf-eggshell uppercase disabled:opacity-50"
			>
				{#if granting}
					<Spinner size={15} />
				{:else}
					<Gift size={16} class="shrink-0" />
				{/if}
				{#if selected && !affordable}
					{m.award_insufficient()}
				{:else}
					{m.award_gift_button()}
				{/if}
			</button>

			<!-- "How do I earn coins?" — plain underlined text (no pill); tapping
			     reveals the answer inline (a toast would hide behind the dialog's
			     top layer, same as the unlock-coins help). -->
			<button
				type="button"
				onclick={() => (helpOpen = !helpOpen)}
				aria-expanded={helpOpen}
				class="self-center font-oswald text-xs text-olf-darkbrown/60 underline underline-offset-2 hover:text-olf-darkgreen"
			>
				{m.award_coins_help_link()}
			</button>
			{#if helpOpen}
				<div
					transition:slide={{ duration: 150 }}
					class="flex flex-col items-center gap-1.5 text-center font-oswald text-sm leading-relaxed text-olf-darkbrown"
				>
					<p>
						<span class="font-bold">{m.award_coins_help_title()}</span><br />
						{m.award_coins_help_body()}
					</p>
					{#if sessionUser}
						<a
							href="/users/{sessionUser.id}?tab=achievements"
							onclick={() => (open = false)}
							class="font-bold text-olf-darkgreen underline underline-offset-2 hover:text-olf-moss"
						>
							🏆 {m.profile_achievements_view_all()}
						</a>
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</dialog>
