<script lang="ts">
	import { Egg } from '@lucide/svelte';

	interface DeliveryCalendarProps {
		/** Weekly delivery weekday, 0=Sun … 6=Sat. */
		deliveryDay: number;
	}
	let { deliveryDay }: DeliveryCalendarProps = $props();

	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();
	const today = now.getDate();

	const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
		month: 'long',
		year: 'numeric'
	});

	// Localized short weekday headers, Sun..Sat (2024-01-07 is a Sunday).
	const headers = [0, 1, 2, 3, 4, 5, 6].map((d) =>
		new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'narrow' })
	);

	const firstWeekday = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	// Leading blanks to align day 1 under its weekday, then the month's days.
	const cells: (number | null)[] = [
		...Array(firstWeekday).fill(null),
		...Array.from({ length: daysInMonth }, (_, i) => i + 1)
	];

	const isDelivery = (day: number) => new Date(year, month, day).getDay() === deliveryDay;
</script>

<div class="rounded-xl bg-olf-beige/10 p-4">
	<p class="mb-2 text-center font-oswald text-xs tracking-widest uppercase opacity-70">
		{monthLabel}
	</p>
	<div class="grid grid-cols-7 gap-1 text-center">
		{#each headers as h, i (i)}
			<span class="font-oswald text-xxs uppercase opacity-50">{h}</span>
		{/each}
		{#each cells as day, i (i)}
			{#if day === null}
				<span></span>
			{:else}
				<span
					class="relative flex aspect-square items-center justify-center rounded-md font-oswald text-xs tabular-nums {isDelivery(
						day
					)
						? 'bg-olf-yolk/20 font-bold text-olf-yolk'
						: 'text-olf-beige/70'} {day === today ? 'ring-1 ring-olf-beige/60' : ''}"
				>
					{#if isDelivery(day)}
						<Egg size={13} class="absolute -top-0.5 -right-0.5 text-olf-yolk" />
					{/if}
					{day}
				</span>
			{/if}
		{/each}
	</div>
</div>
