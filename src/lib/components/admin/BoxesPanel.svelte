<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Plus, Save, Trash2, Package } from '@lucide/svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { createAutosave } from '$lib/stores/autosave.svelte';
	import { createBusyRunner, type AdminBox } from '$lib/components/admin/shared.svelte';
	import * as admin from '$lib/api/admin';

	interface BoxesPanelProps {
		boxes: AdminBox[];
	}
	let { boxes }: BoxesPanelProps = $props();

	const runner = createBusyRunner();
	const busy = $derived(runner.busy);
	const run = (fn: () => Promise<unknown>) => runner.run(fn);

	// ─── Box catalog (editable rows) ────────────────────────────────
	// Mirrors BenefitsPanel: local edit buffer per row, one debounced Save.
	// A box is just a name + egg count; orders still store a raw egg count, so
	// these are pure data-entry shortcuts (the 30 box is the "Tray").
	let boxEdits = $state<
		Record<string, { name: string; eggs: number; sortOrder: number; active: boolean }>
	>({});
	let newName = $state('');
	let newEggs = $state(30);
	$effect(() => {
		const next: Record<string, { name: string; eggs: number; sortOrder: number; active: boolean }> =
			{};
		// Display order 1-indexed for humans (stored 0-indexed in the DB).
		for (const b of boxes)
			next[b.id] = { name: b.name, eggs: b.eggs, sortOrder: b.sortOrder + 1, active: b.active };
		boxEdits = next;
	});

	// True when any row differs from the server (drives the Save button).
	const boxesDirty = $derived(
		boxes.some((b) => {
			const e = boxEdits[b.id];
			return (
				!!e &&
				(e.name !== b.name ||
					e.eggs !== b.eggs ||
					e.sortOrder - 1 !== b.sortOrder ||
					e.active !== b.active)
			);
		})
	);
	async function saveAllBoxes() {
		for (const b of boxes) {
			const e = boxEdits[b.id];
			if (!e) continue;
			if (
				e.name === b.name &&
				e.eggs === b.eggs &&
				e.sortOrder - 1 === b.sortOrder &&
				e.active === b.active
			)
				continue;
			await admin.updateBox(b.id, {
				name: e.name.trim() || b.name,
				eggs: Math.max(1, Math.round(e.eggs) || b.eggs),
				sortOrder: e.sortOrder - 1,
				active: e.active
			});
		}
	}
	// Debounced 5s auto-save (same UX as Benefits).
	const boxesAutosave = createAutosave(() => run(saveAllBoxes));
	onDestroy(() => boxesAutosave.cancel());

	async function addBox() {
		if (!newName.trim() || !(newEggs > 0)) return false;
		const ok = await admin.createBox({
			name: newName.trim(),
			eggs: Math.round(newEggs),
			sortOrder: boxes.length
		});
		if (ok) {
			newName = '';
			newEggs = 30;
		}
		return ok;
	}
</script>

<section class="mt-8 flex max-w-4xl flex-col gap-4">
	<div class="flex items-end justify-between gap-3">
		<div class="flex items-center gap-2">
			<Package size={22} class="text-olf-darkbrown" />
			<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Boxes</h2>
		</div>
		{#if boxesAutosave.active}
			<span class="flex items-center gap-2 font-oswald text-xs text-olf-darkgreen">
				<span class="tabular-nums">Saving in {boxesAutosave.secondsLeft}…</span>
				<button
					type="button"
					onclick={() => boxesAutosave.cancel()}
					class="font-bold text-olf-darkbrown underline-offset-2 hover:underline"
				>
					Cancel
				</button>
			</span>
		{:else}
			<span class="font-oswald text-xs text-olf-darkgreen/50">{boxes.length} denominations</span>
		{/if}
	</div>

	<p class="max-w-prose font-oswald text-sm text-olf-darkgreen/70">
		The box shortcuts on every egg-order screen. Tapping a box adds its eggs to the order — odd
		counts are always still typeable. The 30 box is the “Tray”.
	</p>

	<div class="overflow-hidden rounded-2xl bg-olf-beige shadow">
		<!-- Column headers -->
		<div
			class="grid grid-cols-[3rem_1fr_5rem_5.5rem_auto] items-center gap-3 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
		>
			<span class="text-center">#</span>
			<span>Name</span>
			<span class="text-center">Eggs</span>
			<span class="text-center">Active</span>
			<span class="sr-only">Actions</span>
		</div>

		<div class="divide-y divide-olf-darkgreen/10">
			{#each boxes as b (b.id)}
				{#if boxEdits[b.id]}
					<div
						class="grid grid-cols-[3rem_1fr_5rem_5.5rem_auto] items-center gap-3 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/3"
					>
						<input
							type="number"
							min="1"
							bind:value={boxEdits[b.id].sortOrder}
							oninput={() => boxesAutosave.touch()}
							title="Order"
							class="w-12 rounded-md border border-transparent bg-transparent py-1 text-center font-oswald text-sm tabular-nums hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
						/>
						<input
							bind:value={boxEdits[b.id].name}
							oninput={() => boxesAutosave.touch()}
							class="min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
						/>
						<input
							type="number"
							min="1"
							bind:value={boxEdits[b.id].eggs}
							oninput={() => boxesAutosave.touch()}
							title="Eggs per box"
							class="w-16 rounded-md border border-transparent bg-transparent py-1 text-center font-oswald text-sm tabular-nums hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
						/>
						<!-- Active toggle switch (peer-driven, no JS). -->
						<label class="relative mx-auto inline-flex cursor-pointer items-center">
							<input
								type="checkbox"
								bind:checked={boxEdits[b.id].active}
								onchange={() => boxesAutosave.touch()}
								class="peer sr-only"
							/>
							<span
								class="h-5 w-9 rounded-full bg-olf-darkgreen/25 transition-colors peer-checked:bg-olf-moss after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
							></span>
						</label>
						<Button
							disabled={busy}
							onclick={() => run(() => admin.deleteBox(b.id))}
							class="mx-auto flex size-8 items-center justify-center rounded-md text-olf-darkbrown/50 transition-colors hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown disabled:opacity-50"
							aria-label="Delete box"
						>
							<Trash2 size={15} />
						</Button>
					</div>
				{/if}
			{/each}

			<!-- Add row -->
			<div class="flex flex-col gap-2 bg-olf-darkgreen/3 px-4 py-3 sm:flex-row sm:items-center">
				<div class="flex flex-1 items-center gap-2">
					<Plus size={16} class="shrink-0 text-olf-darkgreen/40" />
					<input
						bind:value={newName}
						placeholder="Box name (e.g. Tray)"
						onkeydown={(e) => {
							if (e.key === 'Enter' && newName.trim() && newEggs > 0 && !busy) run(addBox);
						}}
						class="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm text-olf-darkgreen hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
					/>
					<label class="flex items-center gap-1.5 font-oswald text-xxs text-olf-darkgreen/60">
						<span class="tracking-wide uppercase">Eggs</span>
						<input
							type="number"
							min="1"
							bind:value={newEggs}
							class="w-16 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-center font-oswald text-sm tabular-nums"
						/>
					</label>
				</div>
				<div class="flex shrink-0 gap-2">
					<Button
						disabled={busy || !newName.trim() || !(newEggs > 0)}
						onclick={() => run(addBox)}
						class="flex items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
					>
						<Plus size={14} /> Add
					</Button>
					<Button
						disabled={busy || !boxesDirty}
						onclick={() => {
							boxesAutosave.cancel();
							return run(saveAllBoxes);
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
