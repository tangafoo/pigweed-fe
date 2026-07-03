<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { m } from '$lib/paraglide/messages.js';
	import { fetchGranters, unlockGranters, type AwardTarget, type Granter } from '$lib/api/awards';
	import type { AwardSummary } from '@meteorclass/pigweed-contract';
	import AwardCoin from '$lib/components/ui/AwardCoin.svelte';
	import { formatRelative } from '$lib/utils/date';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { slide } from 'svelte/transition';
	import { Gift, Lock, LockOpen, X } from '@lucide/svelte';

	interface AwardGrantersModalProps {
		/** Two-way bindable open state. */
		open?: boolean;
		targetType?: AwardTarget;
		targetId: string;
		/** The target's award stack (passed by the card) — teased big above the
		 * unlock gate, since the 402 response carries no award info. */
		awards?: AwardSummary[];
		/** The post/comment author — named in the unlock copy ("…who gifted X"). */
		recipientUsername?: string;
	}
	let {
		open = $bindable(false),
		targetType = 'post',
		targetId,
		awards = [],
		recipientUsername = ''
	}: AwardGrantersModalProps = $props();

	const topAwards = $derived(awards.slice(0, 3));

	// Same person + same award more than once → ONE row with a ×n coin badge,
	// not duplicate rows. Rows arrive newest-first, so the first occurrence's
	// timestamp is the most recent grant of that pair.
	type GranterGroup = {
		key: string;
		granter: Granter['granter'];
		awardType: Granter['awardType'];
		count: number;
		latestAt: string;
	};
	const grouped = $derived.by<GranterGroup[]>(() => {
		if (view.kind !== 'list') return [];
		const out: GranterGroup[] = [];
		// Plain object index (not a Map) to satisfy svelte/prefer-svelte-reactivity;
		// this is a transient computation, not reactive state.
		const index: Record<string, GranterGroup> = {};
		for (const g of view.granters) {
			const key = `${g.granter.id}:${g.awardType.id}`;
			const existing = index[key];
			if (existing) {
				existing.count++;
			} else {
				const group = {
					key,
					granter: g.granter,
					awardType: g.awardType,
					count: 1,
					latestAt: g.createdAt
				};
				index[key] = group;
				out.push(group);
			}
		}
		return out;
	});

	// The list is pay-gated on the BE: the target's author reads it free,
	// anyone else spends 1 unlockCoin (permanent per target). This modal just
	// mirrors those states — `locked` carries the viewer's unlockCoin wallet.
	type View =
		| { kind: 'loading' }
		| { kind: 'list'; granters: Granter[] }
		| { kind: 'locked'; unlockCoins: number; noCoins: boolean }
		| { kind: 'error' };
	let view = $state<View>({ kind: 'loading' });
	let unlocking = $state(false);

	async function load() {
		view = { kind: 'loading' };
		const res = await fetchGranters(targetType, targetId);
		view =
			res.status === 'ok'
				? { kind: 'list', granters: res.granters }
				: res.status === 'locked'
					? { kind: 'locked', unlockCoins: res.unlockCoins, noCoins: false }
					: { kind: 'error' };
	}

	async function unlock() {
		if (unlocking) return;
		unlocking = true;
		const res = await unlockGranters(targetType, targetId);
		unlocking = false;
		if (res.ok) {
			await load();
			// Refresh the session's unlockCoins balance everywhere.
			void invalidateAll();
		} else if (res.code === 'nocoins' && view.kind === 'locked') {
			view = { ...view, noCoins: true };
		} else {
			view = { kind: 'error' };
		}
	}

	// "What are unlock coins?" inline reveal. A toast won't do here: the
	// native <dialog> sits in the browser top layer, ABOVE the toast stack,
	// so a toast fired from inside the modal would be invisible behind it.
	let helpOpen = $state(false);

	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			void load();
		} else if (!open && dialog.open) dialog.close();
	});
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
			<h2 class="flex items-center gap-2 font-homemade-apple text-2xl text-olf-darkgreen">
				<Gift size={20} class="shrink-0" />
				{m.granters_title()}
			</h2>
			<button
				type="button"
				aria-label={m.achievements_close()}
				onclick={() => (open = false)}
				class="shrink-0 text-olf-darkbrown/60 hover:text-olf-darkbrown"
			>
				<X size={20} />
			</button>
		</div>

		{#if view.kind === 'loading'}
			<div class="flex justify-center py-8 text-olf-darkgreen"><Spinner /></div>
		{:else if view.kind === 'error'}
			<p class="py-4 text-center font-oswald text-sm text-red-700">{m.granters_error()}</p>
		{:else if view.kind === 'locked'}
			<!-- Pay-gate: 1 unlockCoin, permanent for this post/comment. -->
			<div
				class="flex flex-col items-center gap-3 rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center"
			>
				{#if topAwards.length > 0}
					<!-- The prize on display: the target's awards as big shimmering
					     coins, ×n aggregated, each named — this is what you're
					     unlocking the story behind. Multiple awards sit as columns
					     and wrap on narrow screens. -->
					<div class="flex flex-wrap items-start justify-center gap-x-7 gap-y-3 py-1">
						{#each topAwards as a (a.awardTypeId)}
							<div class="flex flex-col items-center gap-1.5">
								<AwardCoin assetKey={a.assetKey} name={a.name} size={64} count={a.count} />
								<span class="font-oswald text-xs font-bold text-olf-darkgreen">{a.name}</span>
							</div>
						{/each}
					</div>
				{:else}
					<Lock size={26} class="text-olf-darkbrown/60" />
				{/if}
				<p class="font-oswald text-sm text-olf-darkbrown/80">
					{m.granters_locked_body({ count: view.unlockCoins, username: recipientUsername })}
				</p>
				{#if view.noCoins}
					<p class="rounded-lg bg-red-700 px-3 py-2 font-oswald text-xs text-white">
						{m.granters_no_coins()}
					</p>
				{:else if view.unlockCoins === 0}
					<p class="font-oswald text-xs text-olf-darkbrown/60">{m.granters_no_coins()}</p>
				{/if}
				<button
					type="button"
					onclick={unlock}
					disabled={unlocking || view.unlockCoins === 0}
					class="flex items-center gap-2 rounded-full bg-olf-darkgreen px-5 py-2 font-oswald text-sm font-bold tracking-wider text-olf-eggshell uppercase disabled:opacity-50"
				>
					{#if unlocking}<Spinner size={14} />{:else}<LockOpen size={14} class="shrink-0" />{/if}
					{m.granters_unlock_button()}
				</button>
				<!-- "What are unlock coins?" — plain underlined text (no pill); tapping
				     reveals the earn threshold inline. -->
				<button
					type="button"
					onclick={() => (helpOpen = !helpOpen)}
					aria-expanded={helpOpen}
					class="font-oswald text-xs text-olf-darkbrown/60 underline underline-offset-2 hover:text-olf-darkgreen"
				>
					{m.granters_help_link()}
				</button>
				{#if helpOpen}
					<p
						transition:slide={{ duration: 150 }}
						class="font-oswald text-xs leading-relaxed text-olf-darkbrown/70"
					>
						<span class="font-bold">{m.granters_help_title()}</span><br />
						{m.granters_help_body()}
					</p>
				{/if}
			</div>
		{:else if view.granters.length === 0}
			<p class="py-4 text-center font-oswald text-sm text-olf-darkbrown/60">
				{m.granters_empty()}
			</p>
		{:else}
			<ul class="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
				{#each grouped as g (g.key)}
					<li class="flex items-center gap-3 rounded-xl bg-olf-eggshell px-3 py-2">
						<a href="/users/{g.granter.id}" class="shrink-0" aria-label={g.granter.username}>
							<Avatar
								animal={g.granter.animal}
								avatarSeed={g.granter.avatarSeed}
								gender={g.granter.gender}
								size="sm"
							/>
						</a>
						<div class="flex min-w-0 flex-1 flex-col leading-tight">
							<a
								href="/users/{g.granter.id}"
								class="truncate font-supermercado-one text-sm text-olf-darkbrown hover:underline"
							>
								{g.granter.username}
							</a>
							<span class="font-oswald text-xxs text-olf-darkbrown/50">
								{formatRelative(g.latestAt)}
							</span>
						</div>
						<!-- The award IS the point of this modal — coin-sized, ×n when the
						     same person gifted the same award more than once. -->
						<span class="flex shrink-0 flex-col items-center gap-1 py-1">
							<AwardCoin
								assetKey={g.awardType.assetKey}
								name={g.awardType.name}
								size={48}
								count={g.count}
							/>
							<span class="font-oswald text-xxs font-bold text-olf-darkgreen"
								>{g.awardType.name}</span
							>
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</dialog>
