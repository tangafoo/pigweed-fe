<script lang="ts">
	import { Pause, Play } from '@lucide/svelte';
	import { m } from '$lib/paraglide/messages.js';
	import type { SubscriptionSummary } from '@meteorclass/pigweed-contract';

	interface SubscriptionCardFaceProps {
		subscription: SubscriptionSummary | null;
		/** Cardholder name shown embossed at the bottom; falls back to the plan name. */
		username?: string | null;
	}
	let { subscription: sub, username = null }: SubscriptionCardFaceProps = $props();

	const cardholder = $derived(username || sub?.plan.name || '');

	const PHONE = '60172332992';
	const period = (cw: number) => (cw === 1 ? m.subscribe_per_week() : m.subscribe_per_fortnight());

	const memberSince = $derived(
		sub
			? new Date(sub.startedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
			: ''
	);
	const deliveryDayName = $derived(
		sub
			? new Date(2024, 0, 7 + sub.deliveryDay).toLocaleDateString(undefined, { weekday: 'long' })
			: ''
	);
	const statusLabel = $derived(
		sub?.status === 'ACTIVE'
			? m.subscribe_status_active()
			: sub?.status === 'PAUSED'
				? m.subscribe_status_paused()
				: m.subscribe_status_canceled()
	);
	const statusDot = $derived(
		sub?.status === 'ACTIVE'
			? 'bg-olf-yolk'
			: sub?.status === 'PAUSED'
				? 'bg-olf-eggshell'
				: 'bg-olf-rose'
	);
	// Pause / resume is a manual WhatsApp request (no Stripe automation yet).
	const pauseUrl = $derived(
		`https://wa.me/${PHONE}?text=${encodeURIComponent(
			sub?.status === 'PAUSED' ? m.subscribe_resume_message() : m.subscribe_pause_message()
		)}`
	);
</script>

<!-- Metal-leaf border → dark holo card body. AMEX-flat, landscape. -->
<div
	class="h-full min-h-64 rounded-[1.4rem] p-0.75 shadow-xl"
	style="background: linear-gradient(135deg, #6b8746 0%, #cfe09a 22%, #3f5e2e 50%, #cfe09a 78%, #2c4420 100%);"
>
	<div
		class="relative flex h-full flex-col justify-between overflow-hidden rounded-[1.25rem] p-5 text-olf-beige"
		style="background: linear-gradient(135deg, #2c4420 0%, #3f5e2e 45%, #4a6d36 50%, #3f5e2e 55%, #2c4420 100%);"
	>
		<span
			class="pointer-events-none absolute -top-16 -right-12 text-[14rem] leading-none opacity-[0.08] select-none"
			>🥚</span
		>

		<!-- Brand row + status + pause/resume -->
		<div class="flex items-start justify-between gap-2">
			<div class="flex flex-col">
				<span class="font-oswald text-xs font-bold tracking-[0.25em] uppercase"
					>Our Little Farm</span
				>
				<span class="font-oswald text-xxs tracking-[0.3em] uppercase opacity-70"
					>{m.subscribe_your_plan()}</span
				>
			</div>
			{#if sub}
				<div class="flex shrink-0 flex-col items-end gap-1.5">
					<span
						class="flex items-center gap-1.5 rounded-full bg-olf-beige/10 px-2.5 py-1 font-oswald text-xxs font-bold tracking-wider uppercase"
					>
						<span class="size-1.5 rounded-full {statusDot}"></span>{statusLabel}
					</span>
					{#if sub.status === 'ACTIVE' || sub.status === 'PAUSED'}
						<a
							href={pauseUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 rounded-full bg-olf-beige/15 px-2.5 py-1 font-oswald text-xxs font-bold tracking-wider uppercase transition-colors hover:bg-olf-beige/25"
						>
							{#if sub.status === 'PAUSED'}
								<Play size={11} class="shrink-0" /> {m.subscribe_resume()}
							{:else}
								<Pause size={11} class="shrink-0" /> {m.subscribe_pause()}
							{/if}
						</a>
					{/if}
				</div>
			{/if}
		</div>

		{#if sub}
			<!-- Chip + hero + valid-thru row, laid out across the card -->
			<div class="flex items-end justify-between gap-4">
				<div class="flex flex-col gap-3">
					<!-- EMV chip (decorative) -->
					<div
						class="relative h-8 w-11 overflow-hidden rounded-md"
						style="background: linear-gradient(135deg, #e9cf7a, #b8923a 55%, #f0dd9a);"
					>
						<div
							class="absolute inset-0"
							style="background-image: linear-gradient(0deg, rgba(0,0,0,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.25) 1px, transparent 1px); background-size: 100% 33%, 50% 100%;"
						></div>
					</div>
					<!-- Hero: eggs per delivery -->
					<div class="flex items-baseline gap-2">
						<span class="font-supermercado-one text-6xl leading-none text-olf-beige"
							>{sub.plan.eggsPerDelivery}</span
						>
						<span class="font-oswald text-sm tracking-widest uppercase opacity-80"
							>🥚 / {period(sub.plan.cadenceWeeks)}</span
						>
					</div>
				</div>

				<div class="flex flex-col items-end gap-2 text-right">
					<div class="flex flex-col">
						<span class="font-oswald text-[9px] tracking-[0.25em] uppercase opacity-55"
							>{m.subscribe_card_member_since()}</span
						>
						<span class="font-oswald text-sm font-bold tracking-wide">{memberSince}</span>
					</div>
					<div class="flex flex-col">
						<span class="font-oswald text-[9px] tracking-[0.25em] uppercase opacity-55"
							>{m.subscribe_card_delivery_label()}</span
						>
						<span class="font-oswald text-sm font-bold tracking-wide">{deliveryDayName}</span>
					</div>
				</div>
			</div>

			<!-- Embossed cardholder = username + link to the full subscription page -->
			<div class="flex items-end justify-between gap-3 border-t border-olf-beige/15 pt-3">
				<span
					class="font-homemade-apple text-xl text-olf-eggshell drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]"
					>{cardholder}</span
				>
				<div class="flex shrink-0 flex-col items-end gap-0.5 text-right">
					<span class="font-oswald text-xxs tracking-[0.3em] uppercase opacity-50"
						>Egg Subscription</span
					>
					<a
						href="/subscriptions"
						class="font-oswald text-xxs tracking-[0.2em] text-olf-yolk uppercase underline underline-offset-2 transition-opacity hover:opacity-80"
						>{m.subscribe_card_see_page()} →</a
					>
				</div>
			</div>
		{:else}
			<!-- Empty face: never-subscribed / no active plan -->
			<div class="flex flex-1 flex-col items-center justify-center gap-3 py-4 text-center">
				<div
					class="h-8 w-11 rounded-md opacity-60"
					style="background: linear-gradient(135deg, #e9cf7a, #b8923a 55%, #f0dd9a);"
				></div>
				<p class="font-supermercado-one text-xl text-olf-eggshell">{m.subscribe_card_no_plan()}</p>
				<a
					href="/subscriptions"
					class="rounded-full bg-olf-yolk px-4 py-1.5 font-oswald text-xs font-bold tracking-wider text-olf-darkgreen uppercase transition-transform hover:scale-105"
				>
					{m.subscribe_modal_browse()}
				</a>
			</div>
		{/if}

		<!-- Static metal sheen + cursor-tracked holo glare (vars inherited from the FlipCard stage). -->
		<span
			class="pointer-events-none absolute inset-0"
			style="background: linear-gradient(112deg, transparent 44%, rgba(247,243,232,0.22) 50%, transparent 56%); mix-blend-mode: soft-light;"
		></span>
		<span
			class="pointer-events-none absolute inset-0"
			style="background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(247,243,232,0.18), transparent 34%); opacity: var(--glare, 0); transition: opacity 0.3s; mix-blend-mode: soft-light;"
		></span>
	</div>
</div>
