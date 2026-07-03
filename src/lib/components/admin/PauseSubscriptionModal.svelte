<script lang="ts">
	import { slide } from 'svelte/transition';
	import { PauseCircle, CalendarClock, ArrowLeft } from '@lucide/svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import { orderDateLabel } from '$lib/components/admin/shared.svelte';

	/**
	 * Configure a subscription pause. Two paths, like the app's other
	 * confirm-then-expand modals: "Pause today" is an immediate open-ended pause;
	 * "Set a date" expands downward to pick a start date + a length (days, with
	 * week shortcuts). Owns no data/authority — the caller passes `username` for
	 * copy and receives the chosen `{ pausedAt?, pauseDays? }` via `onConfirm`.
	 */
	let {
		open = $bindable(false),
		username = '',
		busy = false,
		onConfirm,
		onCancel
	}: {
		open?: boolean;
		username?: string;
		busy?: boolean;
		onConfirm: (opts: { pausedAt?: string; pauseDays?: number }) => void;
		onCancel?: () => void;
	} = $props();

	const todayISO = () => new Date().toISOString().slice(0, 10);

	// 'root' = the two-choice confirm; 'date' = the expanded config.
	let mode = $state<'root' | 'date'>('root');
	let startDate = $state(todayISO());
	// Pause length in days; null = open-ended ("until I resume").
	let lengthDays = $state<number | null>(7);

	const WEEK_SHORTCUTS = [1, 2, 3, 4];

	// Reset to a clean slate every time the modal opens.
	$effect(() => {
		if (open) {
			mode = 'root';
			startDate = todayISO();
			lengthDays = 7;
		}
	});

	// The computed resume date (start + length), for the "Resumes …" hint.
	const resumeISO = $derived.by(() => {
		if (lengthDays == null || !startDate) return null;
		const d = new Date(startDate + 'T00:00:00');
		d.setDate(d.getDate() + lengthDays);
		return d.toISOString();
	});

	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	function cancel() {
		if (busy) return;
		open = false;
		onCancel?.();
	}
	function pauseToday() {
		onConfirm({});
	}
	function pauseScheduled() {
		onConfirm({
			pausedAt: startDate ? new Date(startDate + 'T00:00:00').toISOString() : undefined,
			pauseDays: lengthDays ?? undefined
		});
	}
</script>

<dialog
	bind:this={dialog}
	oncancel={(e) => {
		e.preventDefault();
		cancel();
	}}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) cancel();
	}}
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-center gap-2">
			<PauseCircle size={22} class="shrink-0 text-olf-yolk" />
			<h2 class="font-homemade-apple text-xl text-olf-darkbrown">
				Pause {username ? `${username}’s` : 'this'} subscription?
			</h2>
		</div>

		<!-- Root choices -->
		<div class="flex flex-col gap-2">
			<button
				type="button"
				onclick={pauseToday}
				disabled={busy}
				class="flex items-center justify-center gap-2 rounded-lg bg-olf-yolk px-4 py-2.5 font-oswald text-sm font-bold text-olf-darkgreen disabled:opacity-50"
			>
				{#if busy && mode === 'root'}<Spinner size={14} />{/if}
				Pause today
			</button>
			<button
				type="button"
				onclick={() => (mode = mode === 'date' ? 'root' : 'date')}
				disabled={busy}
				aria-expanded={mode === 'date'}
				class="flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-2 font-oswald text-sm font-bold transition-colors disabled:opacity-50 {mode ===
				'date'
					? 'border-olf-darkgreen bg-olf-darkgreen/5 text-olf-darkgreen'
					: 'border-olf-darkgreen/30 text-olf-darkgreen hover:border-olf-darkgreen'}"
			>
				<CalendarClock size={16} class="shrink-0" />
				Set a date
			</button>
		</div>

		<!-- Expanded config -->
		{#if mode === 'date'}
			<div
				transition:slide={{ duration: 180 }}
				class="flex flex-col gap-4 rounded-lg border border-olf-darkgreen/15 bg-olf-eggshell/60 p-4"
			>
				<label
					class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase"
				>
					Pause from
					<DatePicker bind:value={startDate} placeholder="Today" />
				</label>

				<div class="flex flex-col gap-2">
					<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/70 uppercase">
						For how long
					</span>
					<div class="flex flex-wrap gap-1.5">
						{#each WEEK_SHORTCUTS as w (w)}
							<button
								type="button"
								onclick={() => (lengthDays = w * 7)}
								class="cursor-pointer rounded-full px-3 py-1 font-oswald text-xs font-bold tracking-wide transition-colors {lengthDays ===
								w * 7
									? 'bg-olf-darkgreen text-olf-beige'
									: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
							>
								{w} week{w === 1 ? '' : 's'}
							</button>
						{/each}
						<button
							type="button"
							onclick={() => (lengthDays = null)}
							class="cursor-pointer rounded-full px-3 py-1 font-oswald text-xs font-bold tracking-wide transition-colors {lengthDays ===
							null
								? 'bg-olf-darkbrown text-olf-beige'
								: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
						>
							Until I resume
						</button>
					</div>
					<!-- Exact day count (weeks are just shortcuts for this). -->
					<label class="flex items-center gap-2 font-oswald text-xs text-olf-darkgreen/70">
						<span class="tracking-wide uppercase">or exact days</span>
						<input
							type="text"
							inputmode="numeric"
							value={lengthDays ?? ''}
							oninput={(e) => {
								const n = parseInt(e.currentTarget.value, 10);
								lengthDays = Number.isFinite(n) && n > 0 ? n : null;
							}}
							placeholder="—"
							class="w-20 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-right font-bold text-olf-darkgreen tabular-nums"
						/>
					</label>
				</div>

				<p class="font-oswald text-xs text-olf-darkgreen/70">
					{#if resumeISO}
						Resumes <b class="text-olf-darkgreen">{orderDateLabel(resumeISO)}</b>.
					{:else}
						Open-ended — you’ll resume it manually.
					{/if}
				</p>

				<div class="flex justify-end gap-2">
					<button
						type="button"
						onclick={() => (mode = 'root')}
						disabled={busy}
						class="flex items-center gap-1.5 rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen disabled:opacity-50"
					>
						<ArrowLeft size={14} /> Back
					</button>
					<button
						type="button"
						onclick={pauseScheduled}
						disabled={busy}
						class="flex items-center gap-1.5 rounded-md bg-olf-yolk px-4 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-60"
					>
						{#if busy}<Spinner size={14} />{/if}
						Pause
					</button>
				</div>
			</div>
		{/if}

		<div class="flex justify-end">
			<button
				type="button"
				onclick={cancel}
				disabled={busy}
				class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen disabled:opacity-50"
			>
				Cancel
			</button>
		</div>
	</div>
</dialog>

<style>
	/* Fade + scale the dialog and its backdrop on open/close (matches the app's
	   other native-<dialog> modals). */
	dialog {
		opacity: 0;
		transform: scale(0.96) translateY(8px);
		transition:
			opacity 0.18s ease,
			transform 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open] {
		opacity: 1;
		transform: scale(1) translateY(0);
	}
	@starting-style {
		dialog[open] {
			opacity: 0;
			transform: scale(0.96) translateY(8px);
		}
	}

	dialog::backdrop {
		opacity: 0;
		transition:
			opacity 0.18s ease,
			overlay 0.18s ease allow-discrete,
			display 0.18s ease allow-discrete;
	}
	dialog[open]::backdrop {
		opacity: 1;
	}
	@starting-style {
		dialog[open]::backdrop {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		dialog,
		dialog::backdrop {
			transition-duration: 0.01ms;
		}
	}
</style>
