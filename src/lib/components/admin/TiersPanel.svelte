<script lang="ts">
	import { goto } from '$app/navigation';
	import { Plus, Save, X, Pencil, Gift } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		adminUrlWith,
		createBusyRunner,
		type AdminBenefit,
		type AdminPlan
	} from '$lib/components/admin/shared.svelte';
	import * as admin from '$lib/api/admin';

	interface TiersPanelProps {
		plans: AdminPlan[];
		benefits: AdminBenefit[];
	}
	let { plans, benefits }: TiersPanelProps = $props();

	const runner = createBusyRunner();
	const busy = $derived(runner.busy);
	const run = (fn: () => Promise<unknown>) => runner.run(fn);

	// ─── Per-tier benefit checklist (local checked sets) ────────────
	let checklist = $state<Record<string, string[]>>({});
	$effect(() => {
		const next: Record<string, string[]> = {};
		for (const p of plans) next[p.id] = [...p.benefitIds];
		checklist = next;
	});
	function toggleBenefit(planId: string, benefitId: string) {
		const arr = checklist[planId] ?? [];
		checklist[planId] = arr.includes(benefitId)
			? arr.filter((id) => id !== benefitId)
			: [...arr, benefitId];
	}
	// Save every tier's checklist in one go (run() handles the refetch after).
	async function saveAllChecklists() {
		for (const p of plans) await admin.setPlanBenefits(p.id, checklist[p.id] ?? []);
	}

	// ─── Tier metadata edit (name / eggs / cadence) ─────────────────
	const PRICE_PER_EGG_CENTS = 200; // RM2 / egg
	let editingPlanId = $state<string | null>(null);
	let planName = $state('');
	let planEggs = $state(0);
	let planCadence = $state(1);
	function openPlanEdit(p: {
		id: string;
		name: string;
		eggsPerDelivery: number;
		cadenceWeeks: number;
	}) {
		editingPlanId = p.id;
		planName = p.name;
		planEggs = p.eggsPerDelivery;
		planCadence = p.cadenceWeeks;
	}

	// Create a new tier.
	let creatingPlan = $state(false);
	let newPlanName = $state('');
	let newPlanEggs = $state(60);
	let newPlanCadence = $state(1);
	function openCreatePlan() {
		creatingPlan = true;
		newPlanName = '';
		newPlanEggs = 60;
		newPlanCadence = 1;
	}
	let createDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!createDialog) return;
		if (creatingPlan && !createDialog.open) createDialog.showModal();
		else if (!creatingPlan && createDialog.open) createDialog.close();
	});

	// Clicking a disabled perk pill explains why + offers to open Benefits.
	let disabledPerk = $state<string | null>(null);
	let disabledDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!disabledDialog) return;
		if (disabledPerk && !disabledDialog.open) disabledDialog.showModal();
		else if (!disabledPerk && disabledDialog.open) disabledDialog.close();
	});
	function pillClick(planId: string, b: { id: string; label: string; active: boolean }) {
		if (!b.active) {
			disabledPerk = b.label;
			return;
		}
		toggleBenefit(planId, b.id);
	}
</script>

<section class="mt-8 flex flex-col gap-4">
	<div class="flex items-center justify-between gap-3">
		<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Tier benefits</h2>
		<Button
			onclick={openCreatePlan}
			class="flex items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
		>
			<Plus size={14} /> Add tier
		</Button>
	</div>
	<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each plans as p (p.id)}
			{@const selectedIds = checklist[p.id] ?? []}
			{@const selected = benefits.filter((b) => selectedIds.includes(b.id))}
			{@const unselected = benefits.filter((b) => !selectedIds.includes(b.id))}
			<div class="flex flex-col gap-4 rounded-2xl bg-olf-beige p-5 text-olf-darkgreen shadow">
				{#if editingPlanId === p.id}
					<!-- Edit tier metadata -->
					<div class="flex flex-col gap-3">
						<label
							class="flex flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
						>
							Name
							<input
								bind:value={planName}
								class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
							/>
						</label>
						<div class="flex gap-2">
							<label
								class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
							>
								Eggs
								<input
									type="number"
									min="1"
									bind:value={planEggs}
									class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm tabular-nums"
								/>
							</label>
							<label
								class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
							>
								Cadence
								<select
									bind:value={planCadence}
									class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
								>
									<option value={1}>Weekly</option>
									<option value={2}>Biweekly</option>
								</select>
							</label>
						</div>
						<p class="font-oswald text-xs opacity-60">
							Price: RM{planEggs * 2}
							{planCadence === 1 ? 'weekly' : 'biweekly'} · RM2 per egg
						</p>
						<div class="flex gap-2">
							<Button
								disabled={busy || !planName.trim() || planEggs < 1}
								onclick={() =>
									run(() =>
										admin.updatePlan(p.id, {
											name: planName.trim(),
											eggsPerDelivery: planEggs,
											cadenceWeeks: planCadence,
											priceCents: planEggs * PRICE_PER_EGG_CENTS
										})
									).then(() => (editingPlanId = null))}
								class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
							>
								<Save size={14} /> Save
							</Button>
							<Button
								onclick={() => (editingPlanId = null)}
								class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
							>
								Cancel
							</Button>
						</div>
					</div>
				{:else}
					<div class="flex items-start justify-between gap-2">
						<h3 class="font-oswald text-xl font-light tracking-wide">{p.name}</h3>
						<Button
							onclick={() => openPlanEdit(p)}
							class="flex size-8 shrink-0 items-center justify-center rounded-md text-olf-darkgreen/50 transition-colors hover:bg-olf-darkgreen/10 hover:text-olf-darkgreen"
							aria-label="Edit tier"
						>
							<Pencil size={15} />
						</Button>
					</div>

					<!-- Perk pills: selected (filled) first, the rest faded. Tap to toggle. -->
					<div class="flex flex-wrap gap-x-1 gap-y-2">
						{#each selected as b (b.id)}
							<button
								type="button"
								onclick={() => pillClick(p.id, b)}
								class="rounded-full bg-olf-blue px-3 py-1.5 font-oswald text-xs font-medium text-white transition-transform hover:scale-[1.03] {b.active
									? ''
									: 'line-through opacity-60'}"
							>
								{b.label}
							</button>
						{/each}
						{#each unselected as b (b.id)}
							<button
								type="button"
								onclick={() => pillClick(p.id, b)}
								class="rounded-full border border-olf-darkgreen/30 px-3 py-1 font-oswald text-xs font-bold text-olf-darkgreen/60 opacity-70 transition-all hover:opacity-100 {b.active
									? ''
									: 'border-dashed line-through'}"
							>
								{b.label}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
	<Button
		disabled={busy}
		onclick={() => run(saveAllChecklists)}
		class="flex items-center justify-center gap-1.5 self-start rounded-lg bg-olf-darkgreen px-6 py-2.5 font-oswald text-sm font-bold tracking-wide text-white uppercase disabled:opacity-50"
	>
		<Save size={14} /> Save all tiers
	</Button>
</section>

<!-- New tier modal (opened by "Add tier") -->
<dialog
	bind:this={createDialog}
	onclose={() => (creatingPlan = false)}
	onclick={(e) => {
		if (e.target === createDialog) creatingPlan = false;
	}}
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-start justify-between gap-4">
			<h2 class="font-supermercado-one text-xl">New tier</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={() => (creatingPlan = false)}
				class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
			>
				<X size={22} />
			</button>
		</div>
		<label
			class="flex flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
		>
			Name
			<input
				bind:value={newPlanName}
				placeholder="e.g. 90 Eggs / week"
				class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
			/>
		</label>
		<div class="flex gap-2">
			<label
				class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
			>
				Eggs
				<input
					type="number"
					min="1"
					bind:value={newPlanEggs}
					class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm tabular-nums"
				/>
			</label>
			<label
				class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
			>
				Cadence
				<select
					bind:value={newPlanCadence}
					class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
				>
					<option value={1}>Weekly</option>
					<option value={2}>Biweekly</option>
				</select>
			</label>
		</div>
		<p class="font-oswald text-xs opacity-60">
			Price: RM{newPlanEggs * 2}
			{newPlanCadence === 1 ? 'weekly' : 'biweekly'} · RM2 per egg
		</p>
		<div class="flex justify-end gap-2">
			<Button
				onclick={() => (creatingPlan = false)}
				class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
			>
				Cancel
			</Button>
			<Button
				disabled={busy || !newPlanName.trim() || newPlanEggs < 1}
				onclick={() =>
					run(() =>
						admin.createPlan({
							name: newPlanName.trim(),
							eggsPerDelivery: newPlanEggs,
							cadenceWeeks: newPlanCadence,
							priceCents: newPlanEggs * PRICE_PER_EGG_CENTS
						})
					).then(() => (creatingPlan = false))}
				class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
			>
				<Plus size={14} /> Create
			</Button>
		</div>
	</div>
</dialog>

<!-- Disabled-perk modal (clicking a faded/inactive perk pill) -->
<dialog
	bind:this={disabledDialog}
	onclose={() => (disabledPerk = null)}
	onclick={(e) => {
		if (e.target === disabledDialog) disabledPerk = null;
	}}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	{#if disabledPerk}
		<div class="flex flex-col gap-4 p-6">
			<h2 class="font-supermercado-one text-xl">This perk is off 🥚</h2>
			<p class="font-oswald text-sm">
				“{disabledPerk}” is disabled in the benefit catalog, so subscribers won't see it. Turn it
				back on in Benefits first.
			</p>
			<div class="flex justify-end gap-2">
				<Button
					onclick={() => (disabledPerk = null)}
					class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
				>
					Close
				</Button>
				<Button
					onclick={() => {
						disabledPerk = null;
						goto(adminUrlWith({ view: 'benefits' }), { noScroll: true });
					}}
					class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white"
				>
					<Gift size={14} /> Open benefits
				</Button>
			</div>
		</div>
	{/if}
</dialog>
