<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import { Plus, Minus, X, MessageCircle } from '@lucide/svelte';
	import { whatsappUrlTo } from '$lib/config/contact';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import RollingNumber from '$lib/components/ui/RollingNumber.svelte';
	import UserPicker from '$lib/components/admin/UserPicker.svelte';
	import BoxPicker from '$lib/components/admin/BoxPicker.svelte';
	import { eggStats } from '$lib/data/eggFacts';
	import * as admin from '$lib/api/admin';
	import type { AdminStats, AdminUserRow, Animal, Gender } from '@meteorclass/pigweed-contract';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';

	interface HomePanelProps {
		stats: AdminStats;
		users: AdminUserRow[];
		/** Admin box denominations for the calculator's tap-to-add chips. */
		boxes: AdminBox[];
	}
	let { stats, users, boxes }: HomePanelProps = $props();

	// Total eggs gauge. Fill a ring toward the next 1,000-egg milestone — a
	// simple game-y "level" sense of the flock's appetite.
	const totalEggs = $derived(stats.totalEggs);
	const eggMilestone = $derived((Math.floor(totalEggs / 1000) + 1) * 1000);
	const eggProgress = $derived((totalEggs % 1000) / 1000);
	const eggGlobalFacts = $derived(eggStats(totalEggs));
	// SVG ring geometry.
	const RING_R = 92;
	const RING_C = 2 * Math.PI * RING_R;
	const ringOffset = $derived(RING_C * (1 - eggProgress));

	// Egg calculator: price × eggs × weeks — or the REVERSE: type ringgit,
	// get eggs ("auntie hands me RM100 — how many eggs is that?").
	// Price is a free-typed string (no stepper) — typical eggs run RM1.50 / 1.80 /
	// 2.00, so let the admin just type it; `calcPrice` is the parsed number.
	let calcPriceStr = $state('2.00');
	const calcPrice = $derived(parseFloat(calcPriceStr) || 0);
	let calcEggs = $state(30);
	let calcWeeks = $state(4);

	// Primary-input unit — what the admin is TYPING. Eggs compute money
	// (forward); RM computes eggs (reverse: floor(amount / price), a partial
	// egg isn't for sale). Box composition is the tap-to-add chips below (admin
	// denominations), so there's no fixed "1 box = 30" typing unit anymore.
	type CalcUnit = 'eggs' | 'rm';
	let unit = $state<CalcUnit>('eggs');
	const UNITS: { id: CalcUnit; label: string }[] = [
		{ id: 'eggs', label: '🥚 Eggs' },
		{ id: 'rm', label: '💵 RM' }
	];

	// RM-mode source; eggs mode keeps `calcEggs` as the source of truth.
	let calcAmountStr = $state('60.00');
	const calcAmount = $derived(Math.max(0, parseFloat(calcAmountStr) || 0));
	const effectiveEggs = $derived(
		unit === 'rm' ? (calcPrice > 0 ? Math.floor(calcAmount / calcPrice) : 0) : calcEggs
	);
	// Box-equivalent readout — expressed in the LARGEST active box (the "Tray"
	// by default), fully driven by the admin catalog. Empty when no boxes exist.
	const canonicalBox = $derived(
		[...boxes].filter((b) => b.active).sort((a, b) => b.eggs - a.eggs)[0] ?? null
	);
	const boxLabel = $derived.by(() => {
		if (!canonicalBox) return '';
		const n = effectiveEggs / canonicalBox.eggs;
		const name = canonicalBox.name.toLowerCase();
		return Number.isInteger(n) ? `${n} ${name}${n === 1 ? '' : 's'}` : `${n.toFixed(1)} ${name}s`;
	});

	const calcTotal = $derived(Math.max(0, calcPrice * (effectiveEggs || 0) * (calcWeeks || 0)));
	const calcMoney = $derived(
		`RM${calcTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
	);

	// Write the primary (eggs) field back to `calcEggs`.
	function setPrimary(v: number) {
		calcEggs = Math.max(0, Number.isFinite(v) ? Math.round(v) : 0);
	}
	// A box chip ADDS its eggs (compose the order). In RM mode, hop back to eggs
	// so the composed count is what's shown/logged.
	function addBox(eggs: number) {
		if (unit === 'rm') unit = 'eggs';
		calcEggs += eggs;
	}

	// "Add customer?" — search a user and log an egg order straight from the
	// calculator (records `effectiveEggs` against the chosen user via the order route).
	// A picked customer only needs the fields to render + record, so recents
	// restored from localStorage satisfy the same shape.
	type PickedCustomer = {
		id: string;
		username: string;
		animal: Animal;
		avatarSeed: number;
		gender: Gender;
		/** Optional — gates the WhatsApp-quote button. Old localStorage recents
		 * predate this field, so treat missing as "no phone on file". */
		phoneNumber?: string | null;
	};
	let custOpen = $state(false);
	let custSelected = $state<PickedCustomer | null>(null);
	let custSaving = $state(false);
	let custDone = $state(false);
	function resetCustomer() {
		custSelected = null;
		custDone = false;
	}

	// WhatsApp quote — a warm, readable message (not raw math), sent straight
	// to the SELECTED customer's number. The button only exists when a picked
	// customer has a phone on file (see the template).
	const custPhone = $derived(custSelected?.phoneNumber ?? null);
	const quoteMessage = $derived.by(() => {
		const hello = custSelected ? `Hello ${custSelected.username}!` : 'Hello!';
		const price = `RM${calcPrice.toFixed(2)}`;
		const boxNote = boxLabel ? ` (${boxLabel})` : '';
		if (unit === 'rm') {
			return `${hello} 🐔 Our Little Farm here.\n\nFor RM${calcAmount.toFixed(2)} you'll get ${effectiveEggs} fresh farm eggs${boxNote} at ${price} per egg.\n\nThank you! 🌱`;
		}
		const cadence = (calcWeeks || 0) > 1 ? ` every week for ${calcWeeks} weeks` : '';
		return `${hello} 🐔 Our Little Farm here.\n\nYour egg quote: ${effectiveEggs} fresh farm eggs${boxNote}${cadence} at ${price} per egg.\nTotal: ${calcMoney}.\n\nThank you! 🌱`;
	});
	async function addCalcOrder() {
		if (!custSelected || custSaving || effectiveEggs <= 0) return;
		custSaving = true;
		const ok = await admin.recordOrder(custSelected.id, {
			eggs: effectiveEggs,
			unitPriceCents: Math.max(1, Math.round(calcPrice * 100))
		});
		custSaving = false;
		if (ok) {
			rememberCustomer(custSelected);
			rememberPrice(calcPrice);
			custDone = true;
			await invalidateAll();
		}
	}

	// Last 3 logged customers, persisted to localStorage → quick "hotkey" chips.
	const RECENTS_KEY = 'olf:admin:recentCustomers';
	let recentCustomers = $state<PickedCustomer[]>([]);
	onMount(() => {
		try {
			const raw = localStorage.getItem(RECENTS_KEY);
			if (raw) recentCustomers = JSON.parse(raw);
		} catch {
			recentCustomers = [];
		}
	});
	function rememberCustomer(u: PickedCustomer) {
		const slim: PickedCustomer = {
			id: u.id,
			username: u.username,
			animal: u.animal,
			avatarSeed: u.avatarSeed,
			gender: u.gender,
			phoneNumber: u.phoneNumber ?? null
		};
		recentCustomers = [slim, ...recentCustomers.filter((c) => c.id !== u.id)].slice(0, 3);
		try {
			localStorage.setItem(RECENTS_KEY, JSON.stringify(recentCustomers));
		} catch {
			/* ignore quota / unavailable */
		}
	}

	// Last few prices logged, persisted to localStorage → quick-pick pills under
	// the price field. Remembered only on a successful order (real, used prices).
	const PRICES_KEY = 'olf:admin:recentPrices';
	let recentPrices = $state<number[]>([]);
	onMount(() => {
		try {
			const raw = localStorage.getItem(PRICES_KEY);
			if (raw) recentPrices = JSON.parse(raw);
		} catch {
			recentPrices = [];
		}
	});
	function rememberPrice(p: number) {
		if (!(p > 0)) return;
		recentPrices = [p, ...recentPrices.filter((x) => x !== p)].slice(0, 4);
		try {
			localStorage.setItem(PRICES_KEY, JSON.stringify(recentPrices));
		} catch {
			/* ignore quota / unavailable */
		}
	}
	const priceLabel = (p: number) => `RM${p.toFixed(2)}`;
</script>

<section class="mt-8 flex flex-col items-start gap-4">
	<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Home</h2>

	<div class="flex w-full flex-col items-start gap-8 lg:flex-row lg:gap-16">
		<!-- EGG-O-MATIC — the sales console. Brass-edged espresso cockpit,
		     DELIBERATELY not the green holo of the user-facing subscription
		     card: this is a staff instrument, and it should look like one. -->
		<div
			class="w-full max-w-sm rounded-[1.4rem] p-0.75 shadow-xl"
			style="background: linear-gradient(135deg, #b8923a 0%, #e9cf7a 28%, #8a6a2a 52%, #e9cf7a 76%, #96762e 100%);"
		>
			<div
				class="relative flex flex-col gap-4 overflow-hidden rounded-[1.25rem] p-5 text-olf-beige"
				style="background: linear-gradient(160deg, #33241a 0%, #46301f 48%, #2b1e14 100%);"
			>
				<span
					class="pointer-events-none absolute -top-14 -right-10 text-[12rem] leading-none opacity-[0.07] select-none"
					>🥚</span
				>

				<!-- Header -->
				<div class="flex items-end justify-between gap-2">
					<div class="flex flex-col">
						<span
							class="font-oswald text-xl font-bold tracking-[0.15em] text-olf-eggshell uppercase"
							>EGG-O-MATIC</span
						>
						<span class="mt-1 font-oswald text-xxs tracking-[0.3em] uppercase opacity-60"
							>Farm sales console</span
						>
					</div>
					<span class="text-xl">🧮</span>
				</div>

				<!-- Mode selector: what you're TYPING (RM = reverse, cash → eggs) -->
				<div
					class="grid grid-cols-2 gap-1 rounded-full bg-olf-eggshell/10 p-1 font-oswald text-xs font-bold"
				>
					{#each UNITS as u (u.id)}
						<button
							type="button"
							onclick={() => (unit = u.id)}
							aria-pressed={unit === u.id}
							class="cursor-pointer rounded-full px-2 py-1.5 tracking-wide transition-colors {unit ===
							u.id
								? 'bg-olf-yolk text-olf-darkgreen shadow'
								: 'text-olf-beige/70 hover:bg-olf-eggshell/10'}"
						>
							{u.label}
						</button>
					{/each}
				</div>

				<!-- Primary readout: the number being typed -->
				<label
					class="flex items-center justify-between gap-3 rounded-xl border border-olf-beige/15 bg-black/20 px-4 py-2.5"
				>
					<span class="font-oswald text-xxs tracking-[0.25em] uppercase opacity-60">
						{unit === 'rm' ? 'Cash in hand' : 'Eggs'}
					</span>
					<span class="flex items-baseline gap-1.5">
						{#if unit === 'rm'}
							<span class="font-oswald text-sm opacity-60">RM</span>
							<input
								type="text"
								inputmode="decimal"
								bind:value={calcAmountStr}
								placeholder="60.00"
								class="w-28 bg-transparent text-right font-oswald text-3xl font-bold text-olf-eggshell tabular-nums outline-none placeholder:text-olf-beige/30"
							/>
						{:else}
							<input
								type="text"
								inputmode="decimal"
								value={calcEggs}
								oninput={(e) => setPrimary(parseFloat(e.currentTarget.value))}
								class="w-28 bg-transparent text-right font-oswald text-3xl font-bold text-olf-eggshell tabular-nums outline-none"
							/>
						{/if}
					</span>
				</label>
				{#if unit !== 'eggs' && effectiveEggs > 0}
					<span class="-mt-3 text-right font-oswald text-xs text-olf-beige/70">
						= {effectiveEggs} eggs
					</span>
				{/if}

				<!-- Tap-to-add box composer (admin denominations). Adds eggs; typing an
				     exact count in the field above still works for odd orders. -->
				{#if boxes.length}
					<div class="-mt-1 flex flex-wrap items-center gap-1.5">
						<BoxPicker {boxes} variant="dark" onadd={addBox} />
						{#if unit === 'eggs' && calcEggs > 0}
							<button
								type="button"
								onclick={() => (calcEggs = 0)}
								class="cursor-pointer font-oswald text-xxs font-bold text-olf-beige/50 hover:text-olf-yolk"
							>
								clear
							</button>
						{/if}
					</div>
				{/if}

				<!-- Dials: price (+ recent-price hotkeys) and weeks -->
				<div class="grid grid-cols-2 gap-2 font-oswald text-sm">
					<label
						class="flex flex-col gap-1 rounded-xl border border-olf-beige/15 bg-black/20 px-3 py-2 {unit ===
						'rm'
							? 'col-span-2'
							: ''}"
					>
						<span class="text-xxs tracking-[0.25em] uppercase opacity-60">Price / egg</span>
						<span class="flex items-baseline justify-end gap-1">
							<span class="text-xs opacity-60">RM</span>
							<input
								type="text"
								inputmode="decimal"
								bind:value={calcPriceStr}
								placeholder="2.00"
								class="w-full bg-transparent text-right font-bold text-olf-eggshell tabular-nums outline-none placeholder:text-olf-beige/30"
							/>
						</span>
					</label>
					<!-- Weeks only multiply forward; a cash amount is one sale. -->
					{#if unit !== 'rm'}
						<label
							class="flex flex-col gap-1 rounded-xl border border-olf-beige/15 bg-black/20 px-3 py-2"
						>
							<span class="text-xxs tracking-[0.25em] uppercase opacity-60">Weeks</span>
							<!-- Plain text input — no number-stepper arrows, ever. -->
							<input
								type="text"
								inputmode="numeric"
								value={calcWeeks}
								oninput={(e) =>
									(calcWeeks = Math.max(0, Math.round(parseFloat(e.currentTarget.value) || 0)))}
								class="w-full bg-transparent text-right font-bold text-olf-eggshell tabular-nums outline-none"
							/>
						</label>
					{/if}
				</div>
				<!-- Recent prices (from successful orders) → quick-pick pills -->
				{#if recentPrices.length}
					<div class="-mt-2 flex flex-wrap gap-1.5">
						{#each recentPrices as p (p)}
							<button
								type="button"
								onclick={() => (calcPriceStr = p.toFixed(2))}
								class="cursor-pointer rounded-full px-2.5 py-1 font-oswald text-xxs font-bold tracking-wide transition-colors {calcPrice ===
								p
									? 'bg-olf-yolk text-olf-darkgreen'
									: 'bg-olf-eggshell/10 text-olf-beige/80 hover:bg-olf-eggshell/20'}"
							>
								{priceLabel(p)}
							</button>
						{/each}
					</div>
				{/if}

				<!-- THE READOUT — hero result, odometer-rolled -->
				<div
					class="flex flex-col items-center gap-0.5 rounded-xl border border-olf-yolk/30 bg-black/25 px-4 py-3 text-center"
				>
					<span class="font-oswald text-xxs tracking-[0.3em] uppercase opacity-60">
						{unit === 'rm' ? 'You get' : 'Total'}
					</span>
					<span
						class="font-oswald text-4xl leading-tight font-bold text-olf-yolk tabular-nums"
						style="text-shadow: 0 0 18px rgba(240, 165, 0, 0.35);"
					>
						{#if unit === 'rm'}
							<RollingNumber text={`${effectiveEggs}`} /> 🥚
						{:else}
							<RollingNumber text={calcMoney} />
						{/if}
					</span>
					{#if unit === 'rm' && boxLabel}
						<span class="font-oswald text-xs text-olf-beige/70">({boxLabel})</span>
					{/if}
				</div>

				<!-- Customer dock: pick who's buying, log it, WhatsApp them the quote.
				     A light inset so Avatar/UserPicker read as they do elsewhere. -->
				<div class="rounded-xl bg-olf-eggshell p-3 text-olf-darkgreen">
					<button
						type="button"
						onclick={() => (custOpen = !custOpen)}
						class="flex w-full cursor-pointer items-center gap-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
					>
						{#if custOpen}<Minus size={13} class="shrink-0" />{:else}<Plus
								size={13}
								class="shrink-0"
							/>{/if}
						Add customer?
					</button>

					{#if custOpen}
						<div transition:slide={{ duration: 180 }} class="mt-3 flex flex-col gap-2">
							{#if custDone && custSelected}
								<p
									class="rounded-lg bg-olf-moss/15 px-3 py-2 text-center font-oswald text-xs font-bold text-olf-darkgreen"
								>
									Logged {effectiveEggs} 🥚 to {custSelected.username}
								</p>
								<button
									type="button"
									onclick={resetCustomer}
									class="cursor-pointer font-oswald text-xxs text-olf-darkgreen/60 underline hover:text-olf-darkgreen"
								>
									Add another
								</button>
							{:else if custSelected}
								<div
									class="flex items-center justify-between gap-2 rounded-lg bg-olf-darkgreen/10 px-2 py-1.5"
								>
									<span class="flex min-w-0 items-center gap-2">
										<Avatar
											animal={custSelected.animal}
											avatarSeed={custSelected.avatarSeed}
											gender={custSelected.gender}
											size="sm"
										/>
										<span class="truncate font-oswald text-xs font-bold text-olf-darkgreen"
											>{custSelected.username}</span
										>
									</span>
									<button
										type="button"
										onclick={resetCustomer}
										aria-label="Clear"
										class="shrink-0 cursor-pointer text-olf-darkgreen/50 hover:text-olf-darkgreen"
									>
										<X size={14} />
									</button>
								</div>
								<Button
									onclick={addCalcOrder}
									disabled={custSaving || effectiveEggs <= 0}
									class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-olf-darkgreen px-3 py-2 font-oswald text-xs font-bold text-olf-beige disabled:opacity-50"
								>
									Log {effectiveEggs} 🥚 order
								</Button>
							{:else}
								<!-- Recent customers (hotkeys) — last 3 logged, from localStorage -->
								{#if recentCustomers.length}
									<div class="flex flex-wrap gap-1.5">
										{#each recentCustomers as c (c.id)}
											<button
												type="button"
												onclick={() => (custSelected = c)}
												class="flex cursor-pointer items-center gap-1.5 rounded-full bg-olf-darkgreen/10 py-1 pr-2.5 pl-1 hover:bg-olf-darkgreen/20"
											>
												<Avatar
													animal={c.animal}
													avatarSeed={c.avatarSeed}
													gender={c.gender}
													size="sm"
												/>
												<span
													class="max-w-20 truncate font-oswald text-xxs font-bold text-olf-darkgreen"
													>{c.username}</span
												>
											</button>
										{/each}
									</div>
								{/if}
								<UserPicker {users} clearOnSelect onselect={(u) => (custSelected = u)} />
							{/if}

							<!-- WhatsApp the quote — only to a picked customer WITH a phone
						     on file (the farm is the sender, so we need their number). -->
							{#if custSelected && custPhone && effectiveEggs > 0 && calcPrice > 0}
								<a
									href={whatsappUrlTo(custPhone, quoteMessage)}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center justify-center gap-1.5 rounded-lg bg-olf-moss px-3 py-2 font-oswald text-xs font-bold text-olf-beige transition-transform hover:scale-[1.02]"
								>
									<MessageCircle size={14} class="shrink-0" />
									WhatsApp quote to {custSelected.username}
								</a>
							{:else if custSelected && !custPhone}
								<p class="text-center font-oswald text-xxs text-olf-darkgreen/50">
									No phone on file — can't WhatsApp the quote.
								</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Gauge + milestone (right column) -->
		<div class="flex flex-col items-center gap-4">
			<!-- Total eggs gauge -->
			<div class="relative flex size-64 shrink-0 items-center justify-center">
				<svg viewBox="0 0 220 220" class="size-full -rotate-90">
					<circle
						cx="110"
						cy="110"
						r={RING_R}
						fill="none"
						stroke="currentColor"
						stroke-width="16"
						class="text-olf-darkgreen/10"
					/>
					<circle
						cx="110"
						cy="110"
						r={RING_R}
						fill="none"
						stroke="currentColor"
						stroke-width="16"
						stroke-linecap="round"
						stroke-dasharray={RING_C}
						stroke-dashoffset={ringOffset}
						class="text-olf-yolk transition-[stroke-dashoffset] duration-1000 ease-out"
					/>
				</svg>
				<div class="absolute flex flex-col items-center text-center">
					<span class="text-3xl">🥚</span>
					<span class="font-supermercado-one text-5xl leading-none text-olf-darkgreen tabular-nums">
						<RollingNumber text={String(totalEggs)} />
					</span>
					<span class="mt-1 font-oswald text-xs tracking-widest text-olf-darkgreen/60 uppercase">
						eggs eaten
					</span>
				</div>
			</div>

			<p class="font-oswald text-sm text-olf-darkgreen/70">
				<span class="font-bold text-olf-darkgreen tabular-nums">{eggMilestone - totalEggs}</span>
				to {eggMilestone.toLocaleString()} 🥚
			</p>
		</div>
	</div>

	<!-- Fun global breakdown -->
	<div class="flex max-w-2xl flex-wrap gap-2">
		{#each eggGlobalFacts as f (f.text)}
			<span
				class="flex items-center gap-1.5 rounded-full bg-olf-beige px-4 py-2 font-oswald text-sm text-olf-darkgreen shadow-sm"
			>
				<span>{f.icon}</span>{f.text}
			</span>
		{/each}
	</div>
</section>
