<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Plus, Save, Trash2 } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { createAutosave } from '$lib/stores/autosave.svelte';
	import { createBusyRunner, type AdminBenefit } from '$lib/components/admin/shared.svelte';
	import * as admin from '$lib/api/admin';

	interface BenefitsPanelProps {
		benefits: AdminBenefit[];
	}
	let { benefits }: BenefitsPanelProps = $props();

	const runner = createBusyRunner();
	const busy = $derived(runner.busy);
	const run = (fn: () => Promise<unknown>) => runner.run(fn);

	// ─── Benefits CRM (editable copies) ─────────────────────────────
	// Auto-grow a textarea to its content height so long benefit copy wraps and
	// reveals downward (no truncation) — used on the mobile-cramped label field.
	function autosize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		const ro = new ResizeObserver(resize);
		ro.observe(node);
		return {
			destroy() {
				node.removeEventListener('input', resize);
				ro.disconnect();
			}
		};
	}
	let benefitEdits = $state<Record<string, { label: string; sortOrder: number; active: boolean }>>(
		{}
	);
	let newBenefit = $state('');
	$effect(() => {
		const next: Record<string, { label: string; sortOrder: number; active: boolean }> = {};
		// Display order 1-indexed for humans (stored 0-indexed in the DB).
		for (const b of benefits)
			next[b.id] = { label: b.label, sortOrder: b.sortOrder + 1, active: b.active };
		benefitEdits = next;
	});

	// True when any row differs from the server (drives the single Save button).
	const benefitsDirty = $derived(
		benefits.some((b) => {
			const e = benefitEdits[b.id];
			return (
				!!e && (e.label !== b.label || e.sortOrder - 1 !== b.sortOrder || e.active !== b.active)
			);
		})
	);
	// Persist every changed row in one go (run() refetches after).
	async function saveAllBenefits() {
		for (const b of benefits) {
			const e = benefitEdits[b.id];
			if (!e) continue;
			if (e.label === b.label && e.sortOrder - 1 === b.sortOrder && e.active === b.active) continue;
			await admin.updateBenefit(b.id, {
				label: e.label,
				sortOrder: e.sortOrder - 1,
				active: e.active
			});
		}
	}
	// Debounced 5s auto-save: any edit/toggle calls .touch() to (re)start the
	// countdown; it saves when it hits zero. Cancelable from the UI.
	const benefitsAutosave = createAutosave(() => run(saveAllBenefits));
	onDestroy(() => benefitsAutosave.cancel());

	async function addBenefit() {
		const ok = await admin.createBenefit(newBenefit.trim(), benefits.length);
		if (ok) newBenefit = '';
		return ok;
	}
</script>

<section class="mt-8 flex max-w-4xl flex-col gap-4">
	<div class="flex items-end justify-between gap-3">
		<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Benefits</h2>
		{#if benefitsAutosave.active}
			<span class="flex items-center gap-2 font-oswald text-xs text-olf-darkgreen">
				<span class="tabular-nums">Saving in {benefitsAutosave.secondsLeft}…</span>
				<button
					type="button"
					onclick={() => benefitsAutosave.cancel()}
					class="font-bold text-olf-darkbrown underline-offset-2 hover:underline"
				>
					Cancel
				</button>
			</span>
		{:else}
			<span class="font-oswald text-xs text-olf-darkgreen/50">{benefits.length} perks</span>
		{/if}
	</div>

	<!-- One panel, header + divided rows + add footer (SaaS settings table). -->
	<div class="overflow-hidden rounded-2xl bg-olf-beige shadow">
		<!-- Column headers -->
		<div
			class="grid grid-cols-[3rem_1fr_5.5rem_auto] items-center gap-3 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
		>
			<span class="text-center">#</span>
			<span>Benefit</span>
			<span class="text-center">Active</span>
			<span class="sr-only">Actions</span>
		</div>

		<div class="divide-y divide-olf-darkgreen/10">
			{#each benefits as b (b.id)}
				{#if benefitEdits[b.id]}
					<div
						class="grid grid-cols-[3rem_1fr_5.5rem_auto] items-center gap-3 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/3"
					>
						<input
							type="number"
							min="1"
							bind:value={benefitEdits[b.id].sortOrder}
							oninput={() => benefitsAutosave.touch()}
							title="Order"
							class="w-12 rounded-md border border-transparent bg-transparent py-1 text-center font-oswald text-sm tabular-nums hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
						/>
						<textarea
							bind:value={benefitEdits[b.id].label}
							oninput={() => benefitsAutosave.touch()}
							use:autosize
							rows="1"
							class="min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm leading-snug hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
						></textarea>
						<!-- Active toggle switch (peer-driven, no JS). -->
						<label class="relative mx-auto inline-flex cursor-pointer items-center">
							<input
								type="checkbox"
								bind:checked={benefitEdits[b.id].active}
								onchange={() => benefitsAutosave.touch()}
								class="peer sr-only"
							/>
							<span
								class="h-5 w-9 rounded-full bg-olf-darkgreen/25 transition-colors peer-checked:bg-olf-moss after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
							></span>
						</label>
						<Button
							disabled={busy}
							onclick={() => run(() => admin.deleteBenefit(b.id))}
							class="mx-auto flex size-8 items-center justify-center rounded-md text-olf-darkbrown/50 transition-colors hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown disabled:opacity-50"
							aria-label="Delete benefit"
						>
							<Trash2 size={15} />
						</Button>
					</div>
				{/if}
			{/each}

			<!-- Add row — stacks on mobile so the input gets full width -->
			<div class="flex flex-col gap-2 bg-olf-darkgreen/3 px-4 py-3 sm:flex-row sm:items-center">
				<div class="flex flex-1 items-center gap-2">
					<Plus size={16} class="shrink-0 text-olf-darkgreen/40" />
					<input
						bind:value={newBenefit}
						placeholder="Add a benefit…"
						onkeydown={(e) => {
							if (e.key === 'Enter' && newBenefit.trim() && !busy) run(addBenefit);
						}}
						class="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm text-olf-darkgreen hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
					/>
				</div>
				<div class="flex shrink-0 gap-2">
					<Button
						disabled={busy || !newBenefit.trim()}
						onclick={() => run(addBenefit)}
						class="flex items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
					>
						<Plus size={14} /> Add
					</Button>
					<Button
						disabled={busy || !benefitsDirty}
						onclick={() => {
							benefitsAutosave.cancel();
							return run(saveAllBenefits);
						}}
						class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-40"
					>
						<Save size={14} /> Save changes
					</Button>
				</div>
			</div>
		</div>
	</div>
</section>
