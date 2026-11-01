<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { untrack } from 'svelte';
	import { getLocale } from '$lib/paraglide/runtime.js';
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { addMonthsYmd, formatYmd, utcToYmd } from '$lib/utils/date';

	/**
	 * Custom month calendar for picking a volunteer day. Bookable: today up to
	 * three months out; everything else is shown but disabled. Browsable: this
	 * year and next only. Weeks start Monday (Malaysia). All dates are
	 * farm-local `YYYY-MM-DD` strings (string order = date order).
	 */
	let { value = $bindable(null), today }: { value?: string | null; today: string } = $props();

	const max = $derived(addMonthsYmd(today, 3));
	const firstYear = $derived(Number(today.slice(0, 4)));
	const lastYear = $derived(firstYear + 1);

	// The month on screen as [year, monthIndex]; opens on the picked month or today's.
	const start = untrack(() => (value ?? today).split('-').map(Number));
	let view = $state<[number, number]>([start[0], start[1] - 1]);
	let direction = $state(1); // which way the month slides

	const canPrev = $derived(view[0] > firstYear || view[1] > 0);
	const canNext = $derived(view[0] < lastYear || view[1] < 11);

	function step(by: number) {
		direction = by;
		const d = new Date(Date.UTC(view[0], view[1] + by, 1));
		view = [d.getUTCFullYear(), d.getUTCMonth()];
	}

	type Cell = { ymd: string; day: number; disabled: boolean; weekend: boolean };
	// Leading blanks (Monday-first), then each day of the month.
	const cells = $derived.by(() => {
		const [y, mo] = view;
		const lead = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7;
		const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
		const out: (Cell | null)[] = Array(lead).fill(null);
		for (let day = 1; day <= days; day++) {
			const ymd = utcToYmd(new Date(Date.UTC(y, mo, day)));
			const dow = (lead + day - 1) % 7;
			out.push({ ymd, day, disabled: ymd < today || ymd > max, weekend: dow >= 5 });
		}
		return out;
	});

	const monthLabel = $derived(
		formatYmd(`${view[0]}-${String(view[1] + 1).padStart(2, '0')}-01`, {
			month: 'long',
			year: 'numeric'
		})
	);
	// Mon..Sun initials in the current locale (5–11 Jan 2026 is a Mon–Sun week).
	const weekdays = $derived.by(() => {
		getLocale();
		return [5, 6, 7, 8, 9, 10, 11].map((d) =>
			formatYmd(`2026-01-${String(d).padStart(2, '0')}`, { weekday: 'narrow' })
		);
	});

	// The picked day's highlight tilts a hair left or right, fresh per pick
	// (same as the Projects / Farmdex index highlights).
	let tilt = $state('-rotate-3');
	function pick(ymd: string) {
		if (value === ymd) {
			value = null;
			return;
		}
		tilt = Math.random() < 0.5 ? '-rotate-3' : 'rotate-3';
		value = ymd;
	}

	const NAV =
		'flex size-8 items-center justify-center rounded-full text-olf-eggshell transition-colors duration-200 hover:bg-olf-eggshell/15 disabled:pointer-events-none disabled:opacity-25';
</script>

<div class="font-oswald text-olf-darkgreen">
	<!-- Dark green header band, edge to edge (cancels the card's p-4). -->
	<div
		class="-mx-4 -mt-4 flex items-center justify-between rounded-t-xl bg-olf-darkgreen px-3 py-2 text-olf-eggshell"
	>
		<button
			type="button"
			onclick={() => step(-1)}
			disabled={!canPrev}
			aria-label={m.volunteer_prev_month()}
			class={NAV}
		>
			<ChevronLeft size={18} />
		</button>
		<!-- The month name slides with the grid. -->
		<div class="relative h-7 flex-1 overflow-hidden text-center">
			{#key monthLabel}
				<p
					in:fly={{ x: 24 * direction, duration: 200, easing: cubicOut }}
					out:fly={{ x: -24 * direction, duration: 200, easing: cubicOut }}
					class="absolute inset-0 text-lg leading-7 font-bold"
				>
					{monthLabel}
				</p>
			{/key}
		</div>
		<button
			type="button"
			onclick={() => step(1)}
			disabled={!canNext}
			aria-label={m.volunteer_next_month()}
			class={NAV}
		>
			<ChevronRight size={18} />
		</button>
	</div>

	<div class="mt-2 grid grid-cols-7 font-mono text-xs text-olf-darkgreen/50">
		{#each weekdays as w, i (i)}
			<span class="py-1 text-center {i >= 5 ? 'text-olf-red/60' : ''}">{w}</span>
		{/each}
	</div>

	<!-- Grid slides sideways per month; fixed 6-row height so the panel never jumps. -->
	<div class="relative h-[calc(6*2.5rem)] overflow-hidden">
		{#key `${view[0]}-${view[1]}`}
			<div
				in:fly={{ x: 40 * direction, duration: 220, easing: cubicOut }}
				out:fly={{ x: -40 * direction, duration: 220, easing: cubicOut }}
				class="absolute inset-x-0 top-0 grid grid-cols-7"
			>
				{#each cells as c, i (c?.ymd ?? `blank-${i}`)}
					{#if c}
						{@const picked = c.ymd === value}
						<div class="flex h-10 items-center justify-center">
							<button
								type="button"
								disabled={c.disabled}
								onclick={() => pick(c.ymd)}
								aria-pressed={picked}
								aria-label={formatYmd(c.ymd, { weekday: 'long', day: 'numeric', month: 'long' })}
								class="relative flex size-9 items-center justify-center rounded-full text-base transition-colors duration-200 disabled:cursor-not-allowed disabled:text-olf-darkgreen/25 {picked
									? 'text-olf-eggshell'
									: c.weekend
										? 'text-olf-red hover:bg-olf-darkgreen/10'
										: 'hover:bg-olf-darkgreen/10'} {c.ymd === today && !picked
									? 'ring-2 ring-olf-yolk ring-inset'
									: ''}"
							>
								{#if picked}
									<span
										in:scale={{ start: 0.4, duration: 220, easing: cubicOut }}
										aria-hidden="true"
										class="absolute inset-0 rounded-xl bg-olf-coral shadow-md {tilt}"
									></span>
								{/if}
								<span class="relative {picked ? 'font-bold' : ''}">{c.day}</span>
							</button>
						</div>
					{:else}
						<span></span>
					{/if}
				{/each}
			</div>
		{/key}
	</div>

	<!-- Picked day, or a nudge to pick one. -->
	<div class="mt-2 flex h-9 items-center">
		{#key value}
			<p in:fly={{ y: 8, duration: 200, easing: cubicOut }} class="flex items-center gap-2">
				{#if value}
					<span class="rounded-full bg-olf-coral px-3 py-1 font-bold text-olf-eggshell shadow-md">
						{formatYmd(value, {
							weekday: 'long',
							day: 'numeric',
							month: 'short',
							year: 'numeric'
						})}
					</span>
					<button
						type="button"
						onclick={() => (value = null)}
						aria-label={m.volunteer_clear_date()}
						class="flex size-7 items-center justify-center rounded-full bg-olf-darkgreen/10 transition-colors duration-200 hover:bg-olf-darkgreen/20"
					>
						<X size={14} />
					</button>
				{:else}
					<span class="font-mono text-sm text-olf-darkgreen/60">{m.volunteer_pick_date()}</span>
				{/if}
			</p>
		{/key}
	</div>
</div>
