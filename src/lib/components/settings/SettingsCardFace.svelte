<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { rerollAvatar, updateGender, updatePhone, fetchMyEggStats } from '$lib/api/auth';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import { RefreshCw, Lock, HelpCircle, Pencil, Sparkles, Crown, Trophy } from '@lucide/svelte';
	import { getUserAchievements } from '$lib/api/users';
	import { ANIMAL_LABEL, GENDER_LABEL } from '$lib/utils/labels';
	import { asset } from '$lib/config/assets';
	import { invalidateAll } from '$app/navigation';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import type { Session, Gender } from '@meteorclass/pigweed-contract';

	// The "Farm ID" face of the user flip card: identity + the egg/coins ledger,
	// laid out as three side-by-side columns (details · egg stats · coins) so the
	// card stays landscape. Colours match the original trainer card; editing
	// autosaves inline (no Save button).
	interface SettingsCardFaceProps {
		user: Session['user'];
	}
	let { user }: SettingsCardFaceProps = $props();

	const GENDERS: Gender[] = ['MALE', 'FEMALE', 'NONBINARY', 'UNDISCLOSED'];
	const canReroll = $derived((user.avatarRerolls ?? 0) < 1);

	let editingGender = $state(false);
	let savingGender = $state(false);
	async function changeGender(e: Event) {
		const next = (e.currentTarget as HTMLSelectElement).value as Gender;
		if (next === user.gender) {
			editingGender = false;
			return;
		}
		savingGender = true;
		if (await updateGender(next)) await invalidateAll();
		savingGender = false;
		editingGender = false;
	}

	let editingPhone = $state(false);
	let savingPhone = $state(false);
	let phoneDraft = $state('');
	function startEditPhone() {
		phoneDraft = user.phoneNumber ?? '';
		editingPhone = true;
	}
	async function savePhone() {
		if (savingPhone) return;
		if (phoneDraft.trim() === (user.phoneNumber ?? '')) {
			editingPhone = false;
			return;
		}
		savingPhone = true;
		if (await updatePhone(phoneDraft.trim())) await invalidateAll();
		savingPhone = false;
		editingPhone = false;
	}

	let rerolling = $state(false);
	let rerollMsg = $state('');
	let rerollMsgTimer: ReturnType<typeof setTimeout>;
	function flashReroll(msg: string) {
		rerollMsg = msg;
		clearTimeout(rerollMsgTimer);
		rerollMsgTimer = setTimeout(() => (rerollMsg = ''), 2600);
	}
	async function rerollOnce() {
		if (rerolling) return;
		if (!canReroll) {
			flashReroll(m.account_reroll_none());
			return;
		}
		rerolling = true;
		const res = await rerollAvatar(true);
		rerolling = false;
		if (res && 'animal' in res) {
			await invalidateAll();
		} else if (res && 'error' in res) {
			flashReroll(m.account_reroll_none());
		} else {
			flashReroll(m.account_reroll_failed());
		}
	}

	// Egg ledger rollup + achievement count — lazy, fetched once.
	let eggsEaten = $state<number | null>(null);
	let lastOrderAt = $state<string | null>(null);
	let achCount = $state<number | null>(null);
	onMount(async () => {
		const [stats, achs] = await Promise.all([
			fetchMyEggStats(),
			getUserAchievements(user.id).catch(() => [])
		]);
		if (stats) {
			eggsEaten = stats.eggsEaten;
			lastOrderAt = stats.lastOrderAt;
		}
		achCount = achs.length;
	});

	// Decorative passport machine-readable strip — pure flavor.
	const mrz = $derived(
		`OLF<<${user.username}<<${user.animal}<<${user.gender}`
			.toUpperCase()
			.replace(/[^A-Z0-9<]/g, '<')
			.padEnd(44, '<')
			.slice(0, 44)
	);
</script>

<div
	class="h-full min-h-64 w-full rounded-[1.4rem] p-0.75 shadow-xl"
	style="background: linear-gradient(135deg, #2f4a22 0%, #cfe09a 22%, #6b8746 50%, #cfe09a 78%, #2c4420 100%);"
>
	<div
		class="relative flex h-full flex-col overflow-hidden rounded-[1.25rem]"
		style="background: linear-gradient(135deg, #f7f3e8 0%, #e7efc6 26%, #d6e6a4 50%, #e7efc6 74%, #f7f3e8 100%);"
	>
		<!-- Cover strip -->
		<div
			class="flex items-center justify-between gap-2 bg-gradient-to-r from-olf-darkgreen to-olf-moss px-4 py-2 text-olf-eggshell"
		>
			<span
				class="flex items-center gap-1.5 font-oswald text-xs font-bold tracking-[0.2em] uppercase"
			>
				<Sparkles size={14} class="shrink-0" /> Farm ID
			</span>
			<span class="font-oswald text-xxs tracking-[0.25em] uppercase opacity-70">ourlittlefarm</span>
		</div>

		<!-- Header: avatar + name + animal (one-time reroll) + flair badges -->
		<div class="flex items-center gap-3.5 px-5 py-3">
			<div class="shrink-0 rounded-full shadow-lg ring-2 ring-olf-darkbrown/15">
				<Avatar animal={user.animal} avatarSeed={user.avatarSeed} gender={user.gender} size="md" />
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-2">
					<p class="truncate font-supermercado-one text-xl text-olf-darkbrown">{user.username}</p>
					<span class="flex items-center gap-1 font-oswald text-sm text-olf-darkbrown/60">
						{ANIMAL_LABEL[user.animal]()}
						<button
							type="button"
							onclick={rerollOnce}
							disabled={rerolling}
							title={canReroll ? m.account_reroll_left() : m.account_reroll_none()}
							aria-label={m.signup_meet_reroll()}
							class="inline-flex cursor-pointer hover:text-olf-moss disabled:opacity-50 {canReroll
								? 'text-olf-darkgreen'
								: 'text-olf-darkbrown/30'}"
						>
							<RefreshCw size={13} class="shrink-0 {rerolling ? 'animate-spin' : ''}" />
						</button>
						{#if rerollMsg}
							<span
								in:fade={{ duration: 150 }}
								class="font-oswald text-xxs font-bold text-olf-yolk"
							>
								{rerollMsg}
							</span>
						{/if}
					</span>
				</div>
				<div class="mt-1 flex flex-wrap items-center gap-1.5">
					{#if user.isFoundingFlock}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-olf-yolk/15 px-2 py-0.5 font-oswald text-xxs font-bold text-olf-yolk"
						>
							<Sparkles size={11} class="shrink-0" />
							{m.account_founding_flock()}
						</span>
					{/if}
					{#if user.isFarmOwner}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-olf-darkgreen/15 px-2 py-0.5 font-oswald text-xxs font-bold text-olf-darkgreen"
						>
							<Crown size={11} class="shrink-0" />
							{m.account_farm_owner()}
						</span>
					{/if}
					<a
						href="/users/{user.id}?tab=achievements"
						aria-label={m.account_achievements()}
						class="inline-flex items-center gap-1 rounded-full bg-olf-darkbrown/10 px-2 py-0.5 font-oswald text-xxs font-bold text-olf-darkbrown transition-colors hover:bg-olf-darkbrown/20"
					>
						<Trophy size={11} class="shrink-0" />
						{achCount ?? '…'}
					</a>
				</div>
			</div>
		</div>

		<!-- Three side-by-side sections -->
		<div class="grid flex-1 grid-cols-3 gap-3 px-5 pb-2 font-oswald">
			<!-- Details -->
			<section class="flex flex-col gap-2">
				<p class="text-xxs font-bold tracking-[0.2em] text-olf-darkbrown/50 uppercase">
					{m.card_section_details()}
				</p>
				<!-- Email (locked) -->
				<div class="flex flex-col">
					<span
						class="flex items-center gap-1 text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase"
					>
						{m.account_field_email()}
						<span class="group relative inline-flex">
							<button
								type="button"
								aria-label={m.account_locked_hint()}
								class="inline-flex cursor-help text-olf-darkbrown/45 hover:text-olf-darkbrown"
							>
								<Lock size={10} class="shrink-0" />
							</button>
							<span
								role="tooltip"
								class="absolute top-5 left-0 z-20 hidden w-52 rounded-xl border border-olf-darkbrown/15 bg-white p-3 text-xs leading-snug font-medium normal-case shadow-xl group-focus-within:block group-hover:block"
							>
								{m.account_email_change_info()}
								<a
									href="/feedback?topic=EMAIL_CHANGE"
									class="mt-1.5 block font-bold text-olf-darkgreen underline underline-offset-2 hover:text-olf-moss"
								>
									{m.account_contact_link()}
								</a>
							</span>
						</span>
					</span>
					<span class="truncate text-sm font-bold text-olf-darkbrown">{user.email}</span>
				</div>
				<!-- Phone -->
				<div class="flex flex-col">
					<span class="text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase">
						{m.account_field_phone()}
					</span>
					{#if editingPhone}
						<span class="flex items-center gap-1">
							{#if savingPhone}<Spinner size={12} />{/if}
							<input
								type="tel"
								bind:value={phoneDraft}
								onblur={savePhone}
								onkeydown={(e) => {
									if (e.key === 'Enter') savePhone();
									else if (e.key === 'Escape') editingPhone = false;
								}}
								placeholder={m.account_phone_hint()}
								class="w-full min-w-0 rounded-lg border border-olf-darkbrown/20 bg-white px-2 py-0.5 text-sm font-bold text-olf-darkbrown"
							/>
						</span>
					{:else}
						<span class="flex items-center gap-1 text-sm font-bold text-olf-darkbrown">
							<span class="truncate">{user.phoneNumber || '—'}</span>
							<button
								type="button"
								onclick={startEditPhone}
								aria-label={m.account_field_phone()}
								class="inline-flex shrink-0 cursor-pointer text-olf-darkbrown/40 hover:text-olf-darkgreen"
							>
								<Pencil size={12} class="shrink-0" />
							</button>
						</span>
					{/if}
				</div>
				<!-- Gender -->
				<div class="flex flex-col">
					<span class="text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase">
						{m.account_field_gender()}
					</span>
					{#if editingGender}
						<span class="flex items-center gap-1">
							{#if savingGender}<Spinner size={12} />{/if}
							<select
								value={user.gender}
								onchange={changeGender}
								disabled={savingGender}
								class="w-full min-w-0 cursor-pointer rounded-lg border border-olf-darkbrown/20 bg-white px-1 py-0.5 text-sm font-bold text-olf-darkbrown disabled:opacity-50"
							>
								{#each GENDERS as g (g)}
									<option value={g}>{GENDER_LABEL[g]()}</option>
								{/each}
							</select>
						</span>
					{:else}
						<span class="flex items-center gap-1 text-sm font-bold text-olf-darkbrown">
							<span class="truncate">{GENDER_LABEL[user.gender]()}</span>
							<button
								type="button"
								onclick={() => (editingGender = true)}
								aria-label={m.account_field_gender()}
								class="inline-flex shrink-0 cursor-pointer text-olf-darkbrown/40 hover:text-olf-darkgreen"
							>
								<Pencil size={12} class="shrink-0" />
							</button>
						</span>
					{/if}
				</div>
			</section>

			<!-- Stats -->
			<section class="flex flex-col gap-2 border-l border-olf-darkbrown/10 pl-3">
				<p class="text-xxs font-bold tracking-[0.2em] text-olf-darkbrown/50 uppercase">
					{m.card_section_egg_stats()}
				</p>
				<div class="flex flex-col">
					<span class="text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase">
						{m.account_field_eggs_eaten()}
					</span>
					<span class="text-sm font-bold text-olf-darkbrown">🥚 {eggsEaten ?? '…'}</span>
				</div>
				<div class="flex flex-col">
					<span class="text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase">
						{m.account_field_last_order()}
					</span>
					<span class="text-sm font-bold text-olf-darkbrown">
						{lastOrderAt ? formatDate(lastOrderAt) : m.account_no_orders()}
					</span>
				</div>
			</section>

			<!-- Coins -->
			<section class="flex flex-col gap-2 border-l border-olf-darkbrown/10 pl-3">
				<p class="text-xxs font-bold tracking-[0.2em] text-olf-darkbrown/50 uppercase">
					{m.card_section_coins()}
				</p>
				<div class="flex flex-col">
					<span class="text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase">
						{m.account_field_coin_balance()}
					</span>
					<span class="flex items-center gap-1.5 text-sm font-bold text-olf-darkbrown">
						<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
						{user.coinBalance}
					</span>
				</div>
				<div class="flex flex-col">
					<span
						class="flex items-center gap-1 text-[9px] tracking-[0.15em] text-olf-darkbrown/55 uppercase"
					>
						{m.account_field_unlock_coins()}
						<span class="group relative inline-flex">
							<button
								type="button"
								aria-label={m.account_field_unlock_coins()}
								class="inline-flex cursor-help text-olf-darkbrown/45 hover:text-olf-darkbrown"
							>
								<HelpCircle size={11} class="shrink-0" />
							</button>
							<span
								role="tooltip"
								class="pointer-events-none absolute right-0 bottom-5 z-20 hidden w-52 rounded-xl border border-olf-darkbrown/15 bg-white p-3 text-xs leading-snug font-medium normal-case shadow-xl group-focus-within:block group-hover:block"
							>
								{m.account_unlock_info()}
							</span>
						</span>
					</span>
					<span class="text-sm font-bold text-olf-darkbrown">{user.unlockCoins}</span>
				</div>
			</section>
		</div>

		<!-- Machine-readable strip (decorative trainer-card flair) -->
		<div
			class="mt-auto overflow-hidden border-t border-olf-darkbrown/10 bg-olf-darkbrown/5 px-5 py-1.5 font-mono text-xxs tracking-[0.15em] whitespace-nowrap text-olf-darkbrown/40"
		>
			{mrz}
		</div>

		<!-- Metal sheen + cursor-tracked holo glare (vars inherited from the FlipCard stage). -->
		<div
			class="pointer-events-none absolute inset-0"
			style="background: linear-gradient(112deg, transparent 44%, rgba(247,243,232,0.28) 50%, transparent 56%); mix-blend-mode: soft-light;"
		></div>
		<div
			class="pointer-events-none absolute inset-0"
			style="background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(247,243,232,0.4), transparent 45%); opacity: var(--glare, 0); transition: opacity 0.35s; mix-blend-mode: soft-light;"
		></div>
	</div>
</div>
