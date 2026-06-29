<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import {
		authClient,
		rerollAvatar,
		updateGender,
		updatePhone,
		fetchMyEggStats
	} from '$lib/api/auth';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import {
		Fingerprint,
		KeyRound,
		Trash2,
		Plus,
		LogOut,
		RefreshCw,
		Lock,
		HelpCircle,
		Pencil,
		Sparkles,
		Crown,
		Trophy
	} from '@lucide/svelte';
	import { getUserAchievements } from '$lib/api/users';
	import { ANIMAL_LABEL, GENDER_LABEL } from '$lib/utils/labels';
	import { asset } from '$lib/assets';
	import { goto, invalidateAll } from '$app/navigation';
	import { tilt } from '$lib/actions/tilt';
	import Avatar from '$lib/components/Avatar.svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { Session, Gender } from '@meteorclass/pigweed-contract';

	// The full account/settings UI, rendered inline as the profile dashboard's
	// "settings" tab (/users/[id]?tab=settings). The owner's session user is
	// passed in by the host page.
	let { user }: { user: Session['user'] } = $props();

	// ─── Identity card: gender edit, one-time animal reroll, egg ledger ──
	const GENDERS: Gender[] = ['MALE', 'FEMALE', 'NONBINARY', 'UNDISCLOSED'];
	const canReroll = $derived((user.avatarRerolls ?? 0) < 1);

	// Fields are pristine (read-only) at first glance; a pencil flips one into
	// edit mode. Changing the value autosaves immediately (no Save button) and
	// drops back to the pristine view.
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

	// Phone (optional, no verification): pencil → input → autosave on blur/Enter.
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
		// Already used up → tell them instead of silently doing nothing.
		if (!canReroll) {
			flashReroll(m.account_reroll_none());
			return;
		}
		rerolling = true;
		const res = await rerollAvatar(true);
		rerolling = false;
		if (res && 'animal' in res) {
			await invalidateAll(); // repaint with the new animal/seed + bumped counter
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
			.padEnd(40, '<')
			.slice(0, 40)
	);

	type Passkey = {
		id: string;
		name: string | null;
		createdAt: string | Date;
		deviceType?: string | null;
	};

	let passkeys = $state<Passkey[]>([]);
	let loading = $state(true);
	let error = $state('');

	let addingMode = $state(false);
	let newName = $state('');
	let addBusy = $state(false);

	// Tracks which passkey-id is currently in confirm-delete state, plus
	// any per-row delete error. Inline confirm beats a native dialog —
	// the brand says "no Apple-clean", so we don't reach for window.confirm.
	let confirmingId = $state<string | null>(null);
	let deleteBusy = $state<string | null>(null);

	async function refresh() {
		loading = true;
		error = '';
		try {
			const result = await authClient.passkey.listUserPasskeys();
			// Better Auth client surfaces either `{ data, error }` or the
			// raw list depending on plugin version; handle both shapes.
			const list = (result as { data?: Passkey[] }).data ?? (result as unknown as Passkey[]);
			passkeys = Array.isArray(list) ? list : [];
		} catch {
			passkeys = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		refresh();
	});

	async function addPasskey() {
		if (addBusy) return;
		error = '';

		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			error = m.passkey_add_unsupported();
			return;
		}

		addBusy = true;
		try {
			const result = await authClient.passkey.addPasskey({ name: newName.trim() || undefined });
			if (result?.error) {
				error = m.passkey_add_error();
				return;
			}
			addingMode = false;
			newName = '';
			await refresh();
		} catch (e) {
			if (e instanceof Error && e.name === 'NotAllowedError') {
				error = m.passkey_add_cancelled();
			} else {
				error = m.passkey_add_error();
			}
		} finally {
			addBusy = false;
		}
	}

	async function deletePasskey(id: string) {
		if (deleteBusy) return;
		deleteBusy = id;
		error = '';
		try {
			const result = await authClient.passkey.deletePasskey({ id });
			if (result?.error) {
				error = m.passkey_delete_error();
				return;
			}
			confirmingId = null;
			await refresh();
		} catch {
			error = m.passkey_delete_error();
		} finally {
			deleteBusy = null;
		}
	}

	let signingOut = $state(false);
	async function signOut() {
		if (signingOut) return;
		signingOut = true;
		try {
			await authClient.signOut();
			await invalidateAll();
			await goto('/login');
		} catch {
			signingOut = false;
		}
	}
</script>

<div class="mb-6 flex flex-col gap-6 lg:flex-row lg:items-start">
	<!-- Farm ID — a Pokémon-trainer-style card with GSAP pointer-tilt + holo glare.
	     The extra padding around it is the "stage" the 3D tilt plays in. -->
	<div class="shrink-0 px-2 py-3 lg:py-4">
		<div
			use:tilt
			class="relative w-full max-w-sm rounded-[26px] p-[3px] shadow-2xl will-change-transform"
			style="background: linear-gradient(135deg, #2f4a22 0%, #cfe09a 22%, #6b8746 50%, #cfe09a 78%, #2c4420 100%);"
		>
			<div
				class="relative overflow-hidden rounded-3xl"
				style="background: linear-gradient(135deg, #f7f3e8 0%, #e7efc6 26%, #d6e6a4 50%, #e7efc6 74%, #f7f3e8 100%);"
			>
				<!-- Cover strip -->
				<div
					class="flex items-center justify-between gap-2 bg-gradient-to-r from-olf-darkgreen to-olf-moss px-4 py-2.5 text-olf-eggshell"
				>
					<span
						class="flex items-center gap-1.5 font-oswald text-xs font-bold tracking-[0.2em] uppercase"
					>
						<Sparkles size={14} class="shrink-0" /> Farm ID
					</span>
					<span class="font-oswald text-[10px] tracking-[0.25em] uppercase opacity-70"
						>ourlittlefarm</span
					>
				</div>

				<!-- Trainer header: photo + name + animal (with one-time reroll) -->
				<div class="flex items-center gap-4 p-5 pb-3">
					<div class="shrink-0 rounded-full shadow-lg ring-2 ring-olf-darkbrown/15">
						<Avatar
							animal={user.animal}
							avatarSeed={user.avatarSeed}
							gender={user.gender}
							size="md"
						/>
					</div>
					<div class="min-w-0">
						<p class="truncate font-supermercado-one text-xl text-olf-darkbrown">{user.username}</p>
						<p
							class="mt-0.5 flex flex-wrap items-center gap-1.5 font-oswald text-sm text-olf-darkbrown/60"
						>
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
						</p>
					</div>
				</div>

				<!-- Flair badges + achievements (links to the achievements tab) -->
				<div class="flex flex-wrap items-center gap-1.5 px-5 pb-3">
					{#if user.isFoundingFlock}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-olf-yolk/15 px-2.5 py-1 font-oswald text-[11px] font-bold text-olf-yolk"
						>
							<Sparkles size={12} class="shrink-0" />
							{m.account_founding_flock()}
						</span>
					{/if}
					{#if user.isFarmOwner}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-olf-darkgreen/15 px-2.5 py-1 font-oswald text-[11px] font-bold text-olf-darkgreen"
						>
							<Crown size={12} class="shrink-0" />
							{m.account_farm_owner()}
						</span>
					{/if}
					<a
						href="/users/{user.id}?tab=achievements"
						aria-label={m.account_achievements()}
						class="inline-flex items-center gap-1 rounded-full bg-olf-darkbrown/10 px-2.5 py-1 font-oswald text-[11px] font-bold text-olf-darkbrown transition-colors hover:bg-olf-darkbrown/20"
					>
						<Trophy size={12} class="shrink-0" />
						{achCount ?? '…'}
					</a>
				</div>

				<!-- Fields: pristine at first glance; a pencil enables edit, autosaved -->
				<dl class="px-5 pb-4 font-oswald">
					<!-- Email (locked) -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt
							class="flex items-center gap-1.5 text-xs tracking-wide text-olf-darkbrown/70 uppercase"
						>
							{m.account_field_email()}
							<!-- Locked: hover the 🔒 for how to request a change. -->
							<span class="group relative inline-flex">
								<button
									type="button"
									aria-label={m.account_locked_hint()}
									class="inline-flex cursor-help text-olf-darkbrown/50 hover:text-olf-darkbrown"
								>
									<Lock size={11} class="shrink-0" />
								</button>
								<span
									role="tooltip"
									class="absolute top-5 left-0 z-20 hidden w-56 rounded-xl border border-olf-darkbrown/15 bg-white p-3 text-xs leading-snug font-medium normal-case shadow-xl group-focus-within:block group-hover:block"
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
						</dt>
						<dd class="truncate font-bold text-olf-darkbrown">{user.email}</dd>
					</div>
					<!-- Phone (optional, pencil → input → autosave on blur/Enter) -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt class="text-xs tracking-wide text-olf-darkbrown/70 uppercase">
							{m.account_field_phone()}
						</dt>
						<dd class="flex items-center gap-2">
							{#if editingPhone}
								{#if savingPhone}<Spinner size={14} />{/if}
								<input
									type="tel"
									bind:value={phoneDraft}
									onblur={savePhone}
									onkeydown={(e) => {
										if (e.key === 'Enter') savePhone();
										else if (e.key === 'Escape') editingPhone = false;
									}}
									placeholder={m.account_phone_hint()}
									class="w-36 rounded-lg border border-olf-darkbrown/20 bg-white px-2 py-1 text-right font-oswald text-sm font-bold text-olf-darkbrown"
								/>
							{:else}
								<span class="font-bold text-olf-darkbrown">{user.phoneNumber || '—'}</span>
								<button
									type="button"
									onclick={startEditPhone}
									aria-label={m.account_field_phone()}
									class="inline-flex cursor-pointer text-olf-darkbrown/40 hover:text-olf-darkgreen"
								>
									<Pencil size={13} class="shrink-0" />
								</button>
							{/if}
						</dd>
					</div>
					<!-- Gender (pencil → select → autosave) -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt class="text-xs tracking-wide text-olf-darkbrown/70 uppercase">
							{m.account_field_gender()}
						</dt>
						<dd class="flex items-center gap-2">
							{#if editingGender}
								{#if savingGender}<Spinner size={14} />{/if}
								<select
									value={user.gender}
									onchange={changeGender}
									disabled={savingGender}
									class="cursor-pointer rounded-lg border border-olf-darkbrown/20 bg-white px-2 py-1 font-oswald text-sm font-bold text-olf-darkbrown disabled:opacity-50"
								>
									{#each GENDERS as g (g)}
										<option value={g}>{GENDER_LABEL[g]()}</option>
									{/each}
								</select>
							{:else}
								<span class="font-bold text-olf-darkbrown">{GENDER_LABEL[user.gender]()}</span>
								<button
									type="button"
									onclick={() => (editingGender = true)}
									aria-label={m.account_field_gender()}
									class="inline-flex cursor-pointer text-olf-darkbrown/40 hover:text-olf-darkgreen"
								>
									<Pencil size={13} class="shrink-0" />
								</button>
							{/if}
						</dd>
					</div>
					<!-- Eggs eaten -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt class="text-xs tracking-wide text-olf-darkbrown/70 uppercase">
							{m.account_field_eggs_eaten()}
						</dt>
						<dd class="flex items-center gap-1.5 font-bold text-olf-darkbrown">
							🥚 {eggsEaten ?? '…'}
						</dd>
					</div>
					<!-- Last order -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt class="text-xs tracking-wide text-olf-darkbrown/70 uppercase">
							{m.account_field_last_order()}
						</dt>
						<dd class="font-bold text-olf-darkbrown">
							{lastOrderAt ? formatDate(lastOrderAt) : m.account_no_orders()}
						</dd>
					</div>
					<!-- Coins -->
					<div
						class="flex items-center justify-between gap-3 border-b border-olf-darkbrown/10 py-2"
					>
						<dt class="text-xs tracking-wide text-olf-darkbrown/70 uppercase">
							{m.account_field_coin_balance()}
						</dt>
						<dd class="flex items-center gap-1.5 font-bold text-olf-darkbrown">
							<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
							{user.coinBalance}
						</dd>
					</div>
					<!-- Unlock coins (info popover opens upward to stay inside the card) -->
					<div class="flex items-center justify-between gap-3 py-2">
						<dt
							class="flex items-center gap-1.5 text-xs tracking-wide text-olf-darkbrown/70 uppercase"
						>
							{m.account_field_unlock_coins()}
							<!-- Auto-popup on hover/focus (CSS group), no click needed. -->
							<span class="group relative inline-flex">
								<button
									type="button"
									aria-label={m.account_field_unlock_coins()}
									class="inline-flex cursor-help text-olf-darkbrown/50 hover:text-olf-darkbrown"
								>
									<HelpCircle size={13} class="shrink-0" />
								</button>
								<span
									role="tooltip"
									class="pointer-events-none absolute bottom-6 left-0 z-20 hidden w-52 rounded-xl border border-olf-darkbrown/15 bg-white p-3 text-xs leading-snug font-medium normal-case shadow-xl group-focus-within:block group-hover:block"
								>
									{m.account_unlock_info()}
								</span>
							</span>
						</dt>
						<dd class="font-bold text-olf-darkbrown">{user.unlockCoins}</dd>
					</div>
				</dl>

				<!-- Machine-readable strip (decorative trainer-card flair) -->
				<div
					class="overflow-hidden border-t border-olf-darkbrown/10 bg-olf-darkbrown/5 px-5 py-2 font-mono text-[10px] tracking-[0.15em] whitespace-nowrap text-olf-darkbrown/40"
				>
					{mrz}
				</div>

				<!-- Static metal-leaf sheen — a faint eggshell streak (soft-light so it
			     never bleaches the text). -->
				<div
					class="pointer-events-none absolute inset-0"
					style="background: linear-gradient(112deg, transparent 44%, rgba(247,243,232,0.28) 50%, transparent 56%); mix-blend-mode: soft-light;"
				></div>

				<!-- Holo glare — follows the cursor, fades in on hover (set by GSAP). -->
				<div
					class="pointer-events-none absolute inset-0"
					style="background: radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(247,243,232,0.4), transparent 45%); opacity: var(--glare, 0); transition: opacity 0.35s; mix-blend-mode: soft-light;"
				></div>
			</div>
		</div>
	</div>

	<section class="w-full rounded-2xl bg-olf-beige p-6 shadow-md lg:flex-1">
		<div class="mb-2 flex items-center gap-2">
			<KeyRound size={22} class="text-olf-darkbrown" />
			<h2 class="font-homemade-apple text-2xl font-bold text-olf-darkbrown">
				{m.passkeys_heading()}
			</h2>
		</div>
		<p class="mb-5 font-oswald text-sm text-olf-darkbrown/70">{m.passkeys_intro()}</p>

		{#if error}
			<p class="mb-4 rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">{error}</p>
		{/if}

		{#if loading}
			<p class="font-oswald text-olf-darkbrown/60">…</p>
		{:else if passkeys.length === 0}
			<p
				class="mb-5 rounded-xl bg-olf-darkbrown/10 px-4 py-6 text-center font-oswald text-olf-darkbrown/70"
			>
				{m.passkeys_empty()}
			</p>
		{:else}
			<ul class="mb-5 flex flex-col gap-3">
				{#each passkeys as pk (pk.id)}
					<li class="flex items-center gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white">
						<span
							class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen"
						>
							<Fingerprint size={24} class="text-olf-darkbrown" />
						</span>
						<div class="flex-1 font-oswald">
							<p class="font-bold">{pk.name ?? m.passkey_unnamed_device()}</p>
							<p class="text-xs text-white/70">
								{m.passkey_added_label()}: {formatDate(pk.createdAt)}
								{#if pk.deviceType}
									· {m.passkey_device_type_label()}: {pk.deviceType}
								{/if}
							</p>
						</div>

						{#if confirmingId === pk.id}
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => deletePasskey(pk.id)}
									disabled={deleteBusy === pk.id}
									class="rounded-full bg-red-700 px-3 py-1 font-oswald text-sm font-bold disabled:opacity-50"
								>
									{m.passkey_delete_confirm_yes()}
								</button>
								<button
									type="button"
									onclick={() => (confirmingId = null)}
									class="rounded-full bg-olf-lightbrown px-3 py-1 font-oswald text-sm font-bold"
								>
									{m.passkey_delete_confirm_no()}
								</button>
							</div>
						{:else}
							<button
								type="button"
								onclick={() => (confirmingId = pk.id)}
								aria-label={m.passkey_delete_button()}
								class="flex h-9 w-9 items-center justify-center rounded-full bg-olf-rose text-olf-eggshell"
							>
								<Trash2 size={16} />
							</button>
						{/if}
					</li>
					{#if confirmingId === pk.id}
						<li
							class="-mt-2 rounded-xl bg-red-700/15 px-4 py-2 font-oswald text-sm text-olf-darkbrown"
						>
							<p class="font-bold">{m.passkey_delete_confirm_title()}</p>
							<p class="text-olf-darkbrown/70">{m.passkey_delete_confirm_body()}</p>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}

		{#if addingMode}
			<div class="rounded-xl bg-olf-darkbrown p-4">
				<label class="block">
					<span class="mb-1 block font-oswald text-sm font-bold text-white/80">
						{m.passkey_add_name_label()}
					</span>
					<input
						bind:value={newName}
						type="text"
						placeholder={m.passkey_add_name_placeholder()}
						maxlength="60"
						class="w-full rounded-lg border-2 border-olf-lightbrown bg-olf-beige px-3 py-2 font-oswald text-olf-darkbrown focus:border-olf-lightgreen focus:outline-none"
					/>
				</label>
				<div class="mt-3 flex gap-2">
					<button
						type="button"
						onclick={addPasskey}
						disabled={addBusy}
						class="flex-1 rounded-full bg-olf-lightgreen px-4 py-2 font-oswald font-bold text-white disabled:opacity-50"
					>
						{addBusy ? m.passkey_add_in_progress() : m.passkey_add_confirm()}
					</button>
					<button
						type="button"
						onclick={() => {
							addingMode = false;
							newName = '';
						}}
						disabled={addBusy}
						class="rounded-full bg-olf-lightbrown px-4 py-2 font-oswald font-bold text-olf-darkbrown disabled:opacity-50"
					>
						{m.passkey_add_cancel()}
					</button>
				</div>
			</div>
		{:else}
			<button
				type="button"
				onclick={() => (addingMode = true)}
				class="inline-flex items-center gap-1.5 font-oswald font-semibold text-olf-darkbrown underline underline-offset-2 hover:text-olf-darkgreen"
			>
				<Plus size={16} class="shrink-0" />
				{m.passkey_add_button()}
			</button>
		{/if}
	</section>
</div>

<button
	type="button"
	onclick={signOut}
	disabled={signingOut}
	class="mt-4.5 inline-flex items-center gap-1.5 font-oswald font-semibold text-olf-darkbrown underline underline-offset-2 hover:text-olf-darkgreen disabled:opacity-50"
>
	<LogOut size={16} class="shrink-0" />
	{signingOut ? m.home_signout_in_progress() : m.home_signout_button()}
</button>
