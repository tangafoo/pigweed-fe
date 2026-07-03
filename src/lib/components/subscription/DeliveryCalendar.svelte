<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Egg, ChevronLeft, ChevronRight } from '@lucide/svelte';

	interface DeliveryCalendarProps {
		/** Weekly delivery weekday, 0=Sun … 6=Sat. */
		deliveryDay: number;
		/** Subscription start — deliveries are anchored here (none before it). */
		startedAt: string;
		/** 1 = weekly, 2 = biweekly. Drives which matching weekdays actually deliver. */
		cadenceWeeks?: number;
	}
	let { deliveryDay, startedAt, cadenceWeeks = 1 }: DeliveryCalendarProps = $props();

	const MS_PER_DAY = 86_400_000;
	// Local-midnight date, so day diffs are exact integers (no TZ drift).
	const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

	const today = dayStart(new Date());

	// The FIRST real delivery: the delivery weekday on/after the start date.
	// Every delivery after that is anchor + k × (7 × cadence) days — so a
	// biweekly plan marks every OTHER matching weekday, not all of them.
	const anchor = $derived.by(() => {
		const start = dayStart(new Date(startedAt));
		const offset = (deliveryDay - start.getDay() + 7) % 7;
		return new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
	});
	const stepDays = $derived(7 * Math.max(1, cadenceWeeks));

	function isDelivery(date: Date): boolean {
		const diff = Math.round((date.getTime() - anchor.getTime()) / MS_PER_DAY);
		return diff >= 0 && diff % stepDays === 0;
	}

	// Next delivery from today — drives the caption + the loudest cell.
	const nextDelivery = $derived.by(() => {
		const diff = Math.ceil((today.getTime() - anchor.getTime()) / MS_PER_DAY);
		const k = Math.max(0, Math.ceil(diff / stepDays));
		return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + k * stepDays);
	});
	const nextDeliveryLabel = $derived(
		nextDelivery.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
	);

	// Month being viewed — starts on the current month, ‹ › to browse.
	let viewYear = $state(today.getFullYear());
	let viewMonth = $state(today.getMonth());
	function shiftMonth(by: number) {
		const d = new Date(viewYear, viewMonth + by, 1);
		viewYear = d.getFullYear();
		viewMonth = d.getMonth();
	}

	const monthLabel = $derived(
		new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
			month: 'long',
			year: 'numeric'
		})
	);

	// Localized short weekday headers, Sun..Sat (2024-01-07 is a Sunday).
	const headers = [0, 1, 2, 3, 4, 5, 6].map((d) =>
		new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'narrow' })
	);

	// Leading blanks to align day 1 under its weekday, then the month's days.
	const cells = $derived.by(() => {
		const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
		const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
		return [
			...(Array(firstWeekday).fill(null) as null[]),
			...Array.from({ length: daysInMonth }, (_, i) => i + 1)
		];
	});

	const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
</script>

<div class="rounded-xl bg-olf-beige/10 p-4">
	<div class="mb-2 flex items-center justify-between">
		<button
			type="button"
			onclick={() => shiftMonth(-1)}
			aria-label={m.cal_prev_month()}
			class="flex size-6 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-olf-beige/10 hover:opacity-100"
		>
			<ChevronLeft size={15} />
		</button>
		<p class="text-center font-oswald text-xs tracking-widest uppercase opacity-70">
			{monthLabel}
		</p>
		<button
			type="button"
			onclick={() => shiftMonth(1)}
			aria-label={m.cal_next_month()}
			class="flex size-6 items-center justify-center rounded-full opacity-60 transition-opacity hover:bg-olf-beige/10 hover:opacity-100"
		>
			<ChevronRight size={15} />
		</button>
	</div>
	<div class="grid grid-cols-7 gap-1 text-center">
		{#each headers as h, i (i)}
			<span class="font-oswald text-xxs uppercase opacity-50">{h}</span>
		{/each}
		{#each cells as day, i (i)}
			{#if day === null}
				<span></span>
			{:else}
				{@const date = new Date(viewYear, viewMonth, day)}
				{@const delivery = isDelivery(date)}
				{@const isNext = delivery && sameDay(date, nextDelivery)}
				{@const isPast = date.getTime() < today.getTime()}
				<span
					class="relative flex aspect-square items-center justify-center rounded-md font-oswald text-xs tabular-nums {isNext
						? 'bg-olf-yolk font-bold text-olf-darkgreen shadow-sm'
						: delivery
							? isPast
								? 'bg-olf-yolk/10 text-olf-beige/45'
								: 'bg-olf-yolk/20 font-bold text-olf-yolk'
							: 'text-olf-beige/70'} {sameDay(date, today) && !isNext
						? 'ring-1 ring-olf-beige/60'
						: ''}"
				>
					{#if delivery && !isPast}
						<Egg
							size={13}
							class="absolute -top-0.5 -right-0.5 {isNext ? 'text-olf-darkgreen' : 'text-olf-yolk'}"
						/>
					{/if}
					{day}
				</span>
			{/if}
		{/each}
	</div>
	<p class="mt-3 text-center font-oswald text-xs tracking-wide text-olf-eggshell">
		🥚 {m.subscribe_next_delivery({ date: nextDeliveryLabel })}
	</p>
</div>
