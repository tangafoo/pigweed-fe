<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { slide } from 'svelte/transition';
	import { sineOut } from 'svelte/easing';
	import {
		Crown,
		Sparkles,
		Shield,
		FileText,
		Star,
		MessageSquare,
		Search,
		Plus,
		Trash2,
		ChevronDown,
		ChevronRight,
		CalendarDays,
		Check,
		Copy,
		ExternalLink,
		Pencil,
		PauseCircle,
		Play
	} from '@lucide/svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import EggOrderEntry from '$lib/components/admin/EggOrderEntry.svelte';
	import PauseSubscriptionModal from '$lib/components/admin/PauseSubscriptionModal.svelte';
	import {
		adminUrlWith,
		createBusyRunner,
		orderDateLabel,
		SORT_SELECT,
		type AdminPlan
	} from '$lib/components/admin/shared.svelte';
	import * as admin from '$lib/api/admin';
	import type { AdminUserRow, EggOrder } from '@meteorclass/pigweed-contract';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';

	interface UsersPanelProps {
		users: AdminUserRow[];
		plans: AdminPlan[];
		/** Box denominations for the per-user egg composer. */
		boxes: AdminBox[];
		total: number;
		pageNum: number;
		orderedOn: string;
		/** Opens the shared AddUserModal (owned by the page). */
		onAddUser: () => void;
	}
	let { users, plans, boxes, total, pageNum, orderedOn, onAddUser }: UsersPanelProps = $props();

	const runner = createBusyRunner();
	const busy = $derived(runner.busy);
	const run = (fn: () => Promise<unknown>) => runner.run(fn);

	// Svelte skips intro transitions on first paint; flip this after mount so the
	// row lists animate in on load (and on every group expand).
	let mounted = $state(false);
	onMount(() => (mounted = true));

	// Name/email search — client-side over the loaded users group only (NOT the
	// admins group, and not a server round-trip). The base is small, so the page
	// holds everyone.
	let searchQ = $state('');

	// Localized weekday name (0=Sun). 2024-01-07 is a Sunday.
	const dayName = (d: number) =>
		new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'long' });
	const DAYS = [0, 1, 2, 3, 4, 5, 6];

	// ─── Per-user expand card — tabs: details + eggs ledger + subscription ──
	let expandedId = $state<string | null>(null);
	let expandTab = $state<'details' | 'eggs' | 'subscription'>('details');

	// Click-to-copy an email (row + details tab). `copiedEmail` flips the
	// icon to a check for a beat so the tap visibly landed.
	let copiedEmail = $state<string | null>(null);
	let copiedTimer: ReturnType<typeof setTimeout>;
	function copyEmail(email: string) {
		navigator.clipboard
			?.writeText(email)
			.then(() => {
				copiedEmail = email;
				clearTimeout(copiedTimer);
				copiedTimer = setTimeout(() => (copiedEmail = null), 1500);
			})
			.catch(() => {});
	}

	// Inline phone edit (Details tab) — admins log walk-up customers' numbers.
	let phoneEditId = $state<string | null>(null);
	let phoneDraft = $state('');
	function startPhoneEdit(u: AdminUserRow) {
		phoneEditId = u.id;
		phoneDraft = u.phoneNumber ?? '';
	}
	async function savePhone(u: AdminUserRow) {
		const next = phoneDraft.trim();
		if (next === (u.phoneNumber ?? '')) {
			phoneEditId = null;
			return;
		}
		await run(() => admin.updateUserProfile(u.id, { phoneNumber: next || null }));
		phoneEditId = null;
	}

	// Subscription form (Subscription tab).
	let formPlanId = $state('');
	let formStart = $state('');
	let formDay = $state(4);

	// Egg ledger (Eggs tab).
	let orders = $state<EggOrder[]>([]);
	let ordersFor = $state<string | null>(null);
	let ordersLoading = $state(false);

	// After EggOrderEntry saves records for `userId`, refresh the ledger + the
	// row's eggsEaten / home gauge.
	async function onOrdersSaved(userId: string) {
		await reloadOrders(userId);
		await invalidateAll();
	}

	async function loadOrders(userId: string) {
		ordersLoading = true;
		orders = await admin.fetchOrders(userId);
		ordersFor = userId;
		ordersLoading = false;
	}
	const reloadOrders = (userId: string) => loadOrders(userId);

	// Open the expand card on a given tab. Clicking the same user + tab again
	// collapses it. The subscribed checkbox opens the Subscription tab; the
	// egg counter opens Eggs; the row/chevron open Details (the first tab).
	function openExpand(u: AdminUserRow, tab: 'details' | 'eggs' | 'subscription') {
		if (expandedId === u.id && expandTab === tab) {
			expandedId = null;
			return;
		}
		expandedId = u.id;
		expandTab = tab;
		formPlanId = u.subscription?.plan.id ?? plans[0]?.id ?? '';
		formStart = (u.subscription?.startedAt ?? new Date().toISOString()).slice(0, 10);
		formDay = u.subscription?.deliveryDay ?? 4;
		if (ordersFor !== u.id) void loadOrders(u.id);
	}
	// Clicking anywhere on the row toggles the Details tab — but not when the
	// click landed on one of the row's own controls (checkboxes, the
	// egg/chevron buttons), which have their own handlers.
	function rowClick(e: MouseEvent, u: AdminUserRow) {
		if ((e.target as HTMLElement).closest('button, input, label, a')) return;
		openExpand(u, 'details');
	}

	// ─── Delete user (danger): type "delete" to confirm ─────────────
	let userToDelete = $state<AdminUserRow | null>(null);
	let deleteConfirm = $state('');
	let deleting = $state(false);
	let deleteError = $state('');
	let deleteDialog = $state<HTMLDialogElement>();
	const deleteArmed = $derived(deleteConfirm.trim().toLowerCase() === 'delete');
	function openDelete(u: AdminUserRow) {
		userToDelete = u;
		deleteConfirm = '';
		deleteError = '';
	}
	async function confirmDelete() {
		if (!userToDelete || !deleteArmed || deleting) return;
		deleting = true;
		deleteError = '';
		const ok = await admin.deleteUser(userToDelete.id);
		deleting = false;
		if (ok) {
			if (expandedId === userToDelete.id) expandedId = null;
			userToDelete = null;
			await invalidateAll();
		} else {
			deleteError = "Couldn't delete that user. Try again.";
		}
	}
	$effect(() => {
		if (!deleteDialog) return;
		if (userToDelete && !deleteDialog.open) deleteDialog.showModal();
		else if (!userToDelete && deleteDialog.open) deleteDialog.close();
	});

	// ─── Pause subscription (modal-configured window) ───────────────
	// Opened from the row's pause icon AND the expanded tab's Pause button.
	let pauseModalUser = $state<AdminUserRow | null>(null);
	let pausing = $state(false);
	async function confirmPause(opts: { pausedAt?: string; pauseDays?: number }) {
		const u = pauseModalUser;
		if (!u || pausing) return;
		pausing = true;
		const ok = await admin.pauseUser(u.id, opts);
		pausing = false;
		if (ok) {
			pauseModalUser = null;
			await invalidateAll();
		}
	}
	// Human "Paused from X · resumes Y" line for a paused subscription.
	function pauseWindowLabel(sub: AdminUserRow['subscription']): string {
		if (!sub) return '';
		const parts = ['Paused'];
		if (sub.pausedAt) parts.push(`from ${orderDateLabel(sub.pausedAt)}`);
		parts.push(sub.pauseUntil ? `· resumes ${orderDateLabel(sub.pauseUntil)}` : '· open-ended');
		return parts.join(' ');
	}

	// ─── Batch delete: check rows, one red button, one confirm ──────
	// Selection lives in a SvelteSet keyed by user id; the visible count is
	// pruned against the loaded list so a refresh can't leave ghost picks.
	const selectedIds = new SvelteSet<string>();
	const selectedUsers = $derived(users.filter((u) => selectedIds.has(u.id)));
	const selectedCount = $derived(selectedUsers.length);
	function toggleSelect(id: string) {
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
	}

	let batchOpen = $state(false);
	let batchConfirm = $state('');
	let batchDeleting = $state(false);
	let batchDone = $state(0);
	// Snapshot of the batch size when the run STARTS — `selectedCount` shrinks
	// as successes leave the selection set, so it can't be the denominator
	// (it read "Deleting 4/1" on the last of four).
	let batchTotal = $state(0);
	let batchError = $state('');
	let batchDialog = $state<HTMLDialogElement>();
	const batchArmed = $derived(batchConfirm.trim().toLowerCase() === 'delete');
	function openBatchDelete() {
		batchConfirm = '';
		batchError = '';
		batchDone = 0;
		batchOpen = true;
	}
	async function confirmBatchDelete() {
		if (!batchArmed || batchDeleting || selectedCount === 0) return;
		batchDeleting = true;
		batchError = '';
		batchDone = 0;
		const batch = [...selectedUsers];
		batchTotal = batch.length;
		// Sequential on purpose: each delete cascades a user's whole graph
		// server-side — no reason to hammer the BE with parallel ones.
		let failed = 0;
		for (const u of batch) {
			const ok = await admin.deleteUser(u.id);
			if (ok) {
				selectedIds.delete(u.id);
				if (expandedId === u.id) expandedId = null;
				batchDone++;
			} else {
				failed++;
			}
		}
		batchDeleting = false;
		await invalidateAll();
		if (failed > 0) {
			batchError = `Couldn't delete ${failed} user${failed === 1 ? '' : 's'} — they're still selected. Try again.`;
		} else {
			batchOpen = false;
		}
	}
	$effect(() => {
		if (!batchDialog) return;
		if (batchOpen && !batchDialog.open) batchDialog.showModal();
		else if (!batchOpen && batchDialog.open) batchDialog.close();
	});

	// Split into admins (their own collapsed group — rarely touched) and
	// everyone else (the day-to-day group, open by default).
	const admins = $derived(users.filter((u) => u.isAdmin));
	const regular = $derived(users.filter((u) => !u.isAdmin));
	let adminsOpen = $state(false);
	let usersOpen = $state(true);

	// Client-side sort of the loaded page (the base is small, so the page is
	// effectively everyone). Default: newest first ("date added").
	const SORTS = [
		{ id: 'date', label: 'Newest' },
		{ id: 'subscribed', label: 'Subscribed' },
		{ id: 'reviews', label: 'Most reviews' },
		{ id: 'posts', label: 'Most posts' },
		{ id: 'coins', label: 'Most coins' }
	] as const;
	type SortId = (typeof SORTS)[number]['id'];
	let userSort = $state<SortId>('date');
	let adminSort = $state<SortId>('date');
	const byDate = (a: AdminUserRow, b: AdminUserRow) =>
		+new Date(b.createdAt) - +new Date(a.createdAt);
	function sortUsers(list: AdminUserRow[], sort: SortId): AdminUserRow[] {
		const arr = [...list];
		switch (sort) {
			case 'subscribed':
				return arr.sort(
					(a, b) =>
						(b.subscription?.status === 'ACTIVE' ? 1 : 0) -
							(a.subscription?.status === 'ACTIVE' ? 1 : 0) || byDate(a, b)
				);
			case 'reviews':
				return arr.sort((a, b) => b.reviewCount - a.reviewCount || byDate(a, b));
			case 'posts':
				return arr.sort((a, b) => b.postCount - a.postCount || byDate(a, b));
			case 'coins':
				return arr.sort((a, b) => b.coinBalance - a.coinBalance || byDate(a, b));
			default:
				return arr.sort(byDate);
		}
	}
	const sortedAdmins = $derived(sortUsers(admins, adminSort));
	// Users group: filter by the search box (scoped here, admins untouched), then sort.
	const filteredRegular = $derived.by(() => {
		const q = searchQ.trim().toLowerCase();
		if (!q) return regular;
		return regular.filter(
			(u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
		);
	});
	const sortedRegular = $derived(sortUsers(filteredRegular, userSort));

	const statusClass = (s?: string) =>
		s === 'ACTIVE'
			? 'bg-olf-darkgreen text-white'
			: s === 'PAUSED'
				? 'bg-olf-yolk text-olf-darkgreen'
				: 'bg-olf-darkbrown/60 text-olf-beige';
</script>

<section class="mt-8 flex flex-col gap-4">
	<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Users panel</h2>
	<!-- Click-to-copy email — used in the collapsed row AND the details tab.
	     Flips to a check for a beat so the tap visibly landed. -->
	{#snippet copyBtn(email: string)}
		<button
			type="button"
			onclick={() => copyEmail(email)}
			aria-label="Copy email"
			title="Copy email"
			class="inline-flex shrink-0 cursor-pointer text-olf-darkgreen/40 hover:text-olf-darkgreen"
		>
			{#if copiedEmail === email}
				<Check size={13} class="shrink-0 text-olf-moss" />
			{:else}
				<Copy size={13} class="shrink-0" />
			{/if}
		</button>
	{/snippet}

	{#snippet userRow(u: AdminUserRow, i: number)}
		<div
			in:slide|global={{ duration: 220, delay: i * 35, easing: sineOut }}
			class="border-b border-olf-darkgreen/10 text-olf-darkgreen last:border-0"
		>
			<div
				role="button"
				tabindex="0"
				onclick={(e) => rowClick(e, u)}
				onkeydown={(e) => {
					if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
						e.preventDefault();
						openExpand(u, 'details');
					}
				}}
				class="flex flex-wrap items-center gap-4 px-3 py-2.5 transition-colors hover:bg-olf-darkgreen/5 {expandedId ===
				u.id
					? 'bg-olf-darkgreen/5'
					: ''}"
			>
				<!-- Batch-select + avatar share a TIGHT inner gap (the row's gap-4 was
				     too airy between these two on mobile); rowClick ignores inputs,
				     so the checkbox never toggles the expand card. -->
				<span class="flex shrink-0 items-center gap-2">
					<input
						type="checkbox"
						checked={selectedIds.has(u.id)}
						onclick={() => toggleSelect(u.id)}
						aria-label="Select {u.username}"
						class="size-4 shrink-0 cursor-pointer rounded border-olf-darkgreen/30 text-olf-blue focus:ring-olf-blue"
					/>
					<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
				</span>
				<div class="min-w-0 flex-1">
					<span class="flex items-center gap-1.5">
						<span class="truncate font-supermercado-one text-sm">{u.username}</span>
						{#if u.isFoundingFlock}<span title="Founding flock"
								><Sparkles size={14} class="text-olf-yolk" /></span
							>{/if}
						{#if u.isFarmOwner}<span title="Farm owner (OP)"
								><Crown size={14} class="text-olf-darkgreen" /></span
							>{/if}
						{#if u.isAdmin}<span title="Admin"><Shield size={14} class="text-olf-darkbrown" /></span
							>{/if}
					</span>
					<span class="flex items-center gap-1">
						<span class="truncate font-oswald text-xs opacity-70">{u.email}</span>
						{@render copyBtn(u.email)}
					</span>
					{#if u.phoneNumber}
						<span class="block truncate font-oswald text-xxs opacity-50">📱 {u.phoneNumber}</span>
					{/if}
				</div>

				<div class="hidden items-center gap-4 font-oswald text-xs text-olf-darkgreen/70 md:flex">
					<span class="flex items-center gap-1" title="Posts"
						><FileText size={13} />{u.postCount}</span
					>
					<span class="flex items-center gap-1" title="Reviews"
						><Star size={13} />{u.reviewCount}</span
					>
					<span class="flex items-center gap-1" title="Comments"
						><MessageSquare size={13} />{u.commentCount}</span
					>
					<button
						type="button"
						onclick={() => openExpand(u, 'eggs')}
						class="flex items-center gap-1 rounded-md px-1 font-bold text-olf-darkgreen hover:bg-olf-darkgreen/10"
						title="Eggs eaten — view order history"
					>
						🥚 {u.eggsEaten}
					</button>
					{#if u.lastOrderAt}
						<span class="flex items-center gap-1" title="Last order">
							<CalendarDays size={13} />{new Date(u.lastOrderAt).toLocaleDateString(undefined, {
								day: 'numeric',
								month: 'short'
							})}
						</span>
					{/if}
				</div>

				<div class="flex flex-wrap items-center justify-end gap-3">
					<!-- Checkbox reflects subscribed state and OPENS the Subscription tab
					     (never toggles directly). preventDefault keeps it bound to data. -->
					<label class="flex cursor-pointer items-center gap-1.5 font-oswald text-xs">
						<input
							type="checkbox"
							checked={u.subscription?.status === 'ACTIVE'}
							onclick={(e) => {
								e.preventDefault();
								openExpand(u, 'subscription');
							}}
							class="size-4 rounded text-olf-moss focus:ring-olf-moss"
						/>
						subscribed
					</label>
					<!-- Pause / resume shortcut — pause opens the config modal; resume is
					     instant. Only shown when there's a subscription to act on. -->
					{#if u.subscription?.status === 'ACTIVE'}
						<button
							type="button"
							onclick={() => (pauseModalUser = u)}
							aria-label="Pause subscription"
							title="Pause subscription"
							class="flex size-8 items-center justify-center rounded-lg text-olf-yolk hover:bg-olf-yolk/15"
						>
							<PauseCircle size={16} />
						</button>
					{:else if u.subscription?.status === 'PAUSED'}
						<button
							type="button"
							onclick={() => run(() => admin.resumeUser(u.id))}
							aria-label="Resume subscription"
							title={pauseWindowLabel(u.subscription)}
							class="flex size-8 items-center justify-center rounded-lg text-olf-moss hover:bg-olf-moss/15"
						>
							<Play size={16} />
						</button>
					{/if}
					<button
						type="button"
						onclick={() => openDelete(u)}
						aria-label="Delete user"
						title="Delete user"
						class="hidden size-8 items-center justify-center rounded-lg text-olf-red hover:bg-olf-red/10 sm:flex"
					>
						<Trash2 size={16} />
					</button>
					<button
						type="button"
						onclick={() => openExpand(u, 'details')}
						aria-label="Expand"
						class="flex size-8 items-center justify-center rounded-lg text-olf-darkgreen hover:bg-olf-darkgreen/10"
					>
						{#if expandedId === u.id}<ChevronDown size={18} />{:else}<ChevronRight size={18} />{/if}
					</button>
				</div>
			</div>

			{#if expandedId === u.id}
				<div class="border-t border-olf-darkgreen/10 bg-olf-darkgreen/5 p-4">
					<!-- Tabs -->
					<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
						<div class="flex w-fit gap-1 rounded-full bg-olf-darkgreen/5 p-1">
							<button
								type="button"
								onclick={() => (expandTab = 'details')}
								class="rounded-full px-3 py-1 font-oswald text-xs font-bold {expandTab === 'details'
									? 'bg-olf-darkgreen text-olf-beige'
									: 'text-olf-darkgreen'}"
							>
								👤 Details
							</button>
							<button
								type="button"
								onclick={() => (expandTab = 'eggs')}
								class="rounded-full px-3 py-1 font-oswald text-xs font-bold {expandTab === 'eggs'
									? 'bg-olf-darkgreen text-olf-beige'
									: 'text-olf-darkgreen'}"
							>
								🥚 Eggs ordered
							</button>
							<button
								type="button"
								onclick={() => (expandTab = 'subscription')}
								class="rounded-full px-3 py-1 font-oswald text-xs font-bold {expandTab ===
								'subscription'
									? 'bg-olf-darkgreen text-olf-beige'
									: 'text-olf-darkgreen'}"
							>
								Subscription
							</button>
						</div>
					</div>

					{#if expandTab === 'details'}
						<!-- Contact card: the who-is-this basics, copyable email, and an
						     editable phone (walk-up customers give it verbally). -->
						<div class="flex flex-col gap-3 font-oswald text-sm text-olf-darkgreen">
							<div class="flex flex-col gap-0.5">
								<span class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
									>Username</span
								>
								<span>{u.username}</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
									>Email</span
								>
								<span class="flex items-center gap-1.5">
									<span class="break-all">{u.email}</span>
									{@render copyBtn(u.email)}
								</span>
							</div>
							<div class="flex flex-col gap-0.5">
								<span class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
									>Phone</span
								>
								{#if phoneEditId === u.id}
									<span class="flex items-center gap-2">
										{#if busy}<Spinner size={12} />{/if}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											type="tel"
											bind:value={phoneDraft}
											onblur={() => savePhone(u)}
											onkeydown={(e) => {
												if (e.key === 'Enter') savePhone(u);
												else if (e.key === 'Escape') phoneEditId = null;
											}}
											placeholder="+60…"
											autofocus
											class="w-48 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-sm tabular-nums"
										/>
									</span>
								{:else}
									<span class="flex items-center gap-1.5">
										<span>{u.phoneNumber || '—'}</span>
										<button
											type="button"
											onclick={() => startPhoneEdit(u)}
											aria-label="Edit phone"
											class="inline-flex shrink-0 cursor-pointer text-olf-darkgreen/40 hover:text-olf-darkgreen"
										>
											<Pencil size={12} class="shrink-0" />
										</button>
									</span>
								{/if}
							</div>

							<!-- Per-user actions — Details-only (they're about the person,
							     not the eggs/subscription views). -->
							<div class="flex flex-wrap items-center gap-2 border-t border-olf-darkgreen/15 pt-3">
								<a
									href="/users/{u.id}"
									target="_blank"
									rel="noopener"
									class="flex items-center gap-1.5 rounded-md border border-olf-darkgreen/20 px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen hover:bg-olf-darkgreen/10"
									><ExternalLink size={14} /> View user profile</a
								>
								<Button
									disabled={busy}
									onclick={() =>
										run(() => admin.setUserFlags(u.id, { isFarmOwner: !u.isFarmOwner }))}
									class="flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-oswald text-xs font-bold disabled:opacity-50 {u.isFarmOwner
										? 'border-olf-darkgreen bg-olf-darkgreen text-olf-beige'
										: 'border-olf-darkgreen/20 text-olf-darkgreen hover:bg-olf-darkgreen/10'}"
								>
									<Crown size={14} />
									{u.isFarmOwner ? 'Remove as farm owner' : 'Make farm owner?'}
								</Button>
								<button
									type="button"
									onclick={() => openDelete(u)}
									class="flex items-center gap-1.5 rounded-md border border-olf-red/40 px-3 py-1.5 font-oswald text-xs font-bold text-olf-red hover:bg-olf-red/10"
								>
									<Trash2 size={14} /> Delete user
								</button>
							</div>
						</div>
					{:else if expandTab === 'eggs'}
						<!-- Bulk add records (shared component) -->
						<EggOrderEntry userId={u.id} {boxes} onsaved={() => onOrdersSaved(u.id)} />

						<!-- Ledger -->
						<div class="mt-4">
							{#if ordersLoading}
								<div class="flex justify-center py-4 text-olf-darkgreen/60"><Spinner /></div>
							{:else if orders.length === 0}
								<p class="font-oswald text-sm text-olf-darkgreen/60">No orders recorded yet.</p>
							{:else}
								<ul class="flex flex-col gap-1.5">
									{#each orders as o (o.id)}
										<li
											class="flex items-center gap-3 rounded-lg bg-olf-eggshell px-3 py-2 font-oswald text-sm"
										>
											<span class="w-28 shrink-0 tabular-nums">{orderDateLabel(o.orderedAt)}</span>
											<span class="font-bold">🥚 {o.eggs}</span>
											<span
												class="rounded-full px-2 py-0.5 text-xxs font-bold tracking-wider uppercase {o.source ===
												'SUBSCRIPTION'
													? 'bg-olf-moss text-white'
													: 'bg-olf-darkgreen/10 text-olf-darkgreen'}"
											>
												{o.source === 'SUBSCRIPTION' ? 'sub' : 'manual'}
											</span>
											<button
												type="button"
												onclick={() =>
													run(async () => {
														const ok = await admin.deleteOrder(o.id);
														if (ok) await reloadOrders(u.id);
														return ok;
													})}
												aria-label="Delete record"
												class="ml-auto flex size-7 items-center justify-center rounded-md text-olf-darkbrown/50 hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown"
											>
												<Trash2 size={14} />
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					{:else}
						<!-- Subscription tab -->
						<div class="flex flex-wrap items-end gap-3">
							<label
								class="flex w-full flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase sm:w-52"
							>
								Tier
								<select
									bind:value={formPlanId}
									class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
								>
									{#each plans as p (p.id)}
										<option value={p.id}>{p.name}</option>
									{/each}
								</select>
							</label>
							<div
								class="flex w-full flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase sm:w-52"
							>
								<span>Started</span>
								<DatePicker bind:value={formStart} placeholder="Start date" />
							</div>
							<label
								class="flex w-full flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase sm:w-52"
							>
								Delivery day
								<select
									bind:value={formDay}
									class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
								>
									{#each DAYS as d (d)}<option value={d}>{dayName(d)}</option>{/each}
								</select>
							</label>
							<Button
								disabled={busy || !formPlanId}
								onclick={() =>
									run(() =>
										admin.subscribeUserTier(u.id, formPlanId, {
											startedAt: formStart ? new Date(formStart).toISOString() : undefined,
											deliveryDay: formDay
										})
									)}
								class="flex items-center gap-1.5 rounded-md bg-olf-darkbrown px-4 py-2 font-oswald text-xs font-bold tracking-wide text-olf-eggshell uppercase disabled:opacity-50"
							>
								{u.subscription ? 'Update' : 'Add new subscriber'}
							</Button>
							{#if u.subscription}
								<div class="ml-auto flex flex-wrap items-end gap-2">
									{#if u.subscription.status === 'PAUSED'}
										<Button
											disabled={busy}
											onclick={() => run(() => admin.resumeUser(u.id))}
											class="rounded-lg bg-olf-moss px-3 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
											>Resume</Button
										>
									{:else}
										<Button
											disabled={busy}
											onclick={() => (pauseModalUser = u)}
											class="rounded-lg bg-olf-yolk px-3 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-50"
											>Pause</Button
										>
									{/if}
									<Button
										disabled={busy}
										onclick={() => run(() => admin.unsubscribeUser(u.id))}
										class="rounded-lg bg-olf-rose px-3 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-50"
									>
										Unsubscribe
									</Button>
								</div>
							{/if}
						</div>
						{#if u.subscription}
							<div
								class="mt-3 max-w-fit rounded-lg px-3 py-1 font-oswald text-xl font-light tracking-wide uppercase {statusClass(
									u.subscription.status
								)}"
							>
								{u.subscription.plan.name}
							</div>
							{#if u.subscription.status === 'PAUSED'}
								<p
									class="mt-1.5 flex items-center gap-1.5 font-oswald text-xs text-olf-darkgreen/70"
								>
									<PauseCircle size={13} class="shrink-0 text-olf-yolk" />
									{pauseWindowLabel(u.subscription)}
								</p>
							{/if}
						{/if}
						<div class="mt-3 flex flex-wrap gap-2 border-t border-olf-darkgreen/15 pt-3">
							<Button
								disabled={busy}
								onclick={() =>
									run(() => admin.setUserFlags(u.id, { isFoundingFlock: !u.isFoundingFlock }))}
								class="flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 font-oswald text-xs font-bold {u.isFoundingFlock
									? 'border-olf-yolk bg-olf-yolk text-olf-eggshell'
									: 'border-olf-darkgreen/25 text-olf-darkgreen'} bg-olf-eggshell disabled:opacity-50"
							>
								<Sparkles size={14} /> + Founding flock
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/snippet}

	<!-- Admins (collapsed by default) -->
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Button
				onclick={() => (adminsOpen = !adminsOpen)}
				class="flex cursor-pointer items-center gap-2 font-oswald text-sm font-bold tracking-wide text-olf-darkbrown uppercase"
			>
				{#if adminsOpen}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
				Admins ({admins.length})
			</Button>
			<select bind:value={adminSort} aria-label="Sort admins" class={SORT_SELECT}>
				{#each SORTS as srt (srt.id)}<option value={srt.id}>{srt.label}</option>{/each}
			</select>
		</div>
		{#if adminsOpen && mounted}
			<div class="rounded-xl border border-olf-darkgreen/10 bg-olf-eggshell/60">
				{#each sortedAdmins as u, i (u.id)}{@render userRow(u, i)}{/each}
				{#if admins.length === 0}
					<p class="px-3 py-4 font-oswald text-xs text-olf-darkgreen/50">No admins on this page.</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Users (open by default) -->
	<div class="flex flex-col gap-2">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<Button
				onclick={() => (usersOpen = !usersOpen)}
				class="flex cursor-pointer items-center gap-2 font-oswald text-sm font-bold tracking-wide text-olf-darkbrown uppercase"
			>
				{#if usersOpen}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
				Users ({regular.length})
			</Button>
			<div class="flex flex-wrap items-center gap-2">
				<!-- Appears only while rows are checked, sliding in beside Add user. -->
				{#if selectedCount > 0}
					<button
						type="button"
						transition:slide={{ axis: 'x', duration: 180 }}
						onclick={openBatchDelete}
						class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-olf-red px-3 py-1.5 font-oswald text-xs font-bold whitespace-nowrap text-white"
					>
						<Trash2 size={14} /> Delete ({selectedCount})
					</button>
				{/if}
				<Button
					onclick={onAddUser}
					class="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-white"
				>
					<Plus size={14} /> Add user
				</Button>
				<div class="relative flex-1 sm:flex-none">
					<Search
						size={16}
						class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-olf-darkgreen/50"
					/>
					<input
						bind:value={searchQ}
						placeholder="search name / email"
						aria-label="Search users"
						class="w-full rounded-lg border border-olf-darkgreen/20 bg-white py-1.5 pr-3 pl-8 font-oswald text-sm text-olf-darkgreen sm:w-56"
					/>
				</div>
				<div class="w-full sm:w-40">
					<DatePicker
						value={orderedOn ?? ''}
						placeholder="Ordered on…"
						align="right"
						onchange={(v) =>
							goto(adminUrlWith({ orderedOn: v || undefined, page: undefined }), {
								keepFocus: true,
								replaceState: true,
								noScroll: true
							})}
					/>
				</div>
				<select bind:value={userSort} aria-label="Sort users" class={SORT_SELECT}>
					{#each SORTS as srt (srt.id)}<option value={srt.id}>{srt.label}</option>{/each}
				</select>
			</div>
		</div>
		{#if usersOpen && mounted}
			<div class="rounded-xl border border-olf-darkgreen/10 bg-olf-eggshell/60">
				{#each sortedRegular as u, i (u.id)}{@render userRow(u, i)}{/each}
				{#if regular.length === 0}
					<p class="px-3 py-4 font-oswald text-xs text-olf-darkgreen/50">No users found.</p>
				{/if}
			</div>
		{/if}
	</div>

	{#if total > 50}
		<div class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen">
			{#if pageNum > 1}<a href={adminUrlWith({ page: String(pageNum - 1) })} class="underline"
					>← Prev</a
				>{/if}
			<span>Page {pageNum} of {Math.ceil(total / 50)}</span>
			{#if pageNum < Math.ceil(total / 50)}<a
					href={adminUrlWith({ page: String(pageNum + 1) })}
					class="underline">Next →</a
				>{/if}
		</div>
	{/if}
</section>

<!-- Batch-delete danger modal: same type-"delete" arming as the single one. -->
<dialog
	bind:this={batchDialog}
	onclose={() => (batchOpen = false)}
	onclick={(e) => {
		if (e.target === batchDialog) batchOpen = false;
	}}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<h2 class="font-homemade-apple text-xl text-olf-darkbrown">
			Delete {selectedCount} user{selectedCount === 1 ? '' : 's'}?
		</h2>
		<p class="font-oswald text-sm text-olf-darkgreen/80">
			This permanently deletes <b>everything they made</b> — posts, reviews, comments, orders. This can't
			be undone.
		</p>
		<!-- Who's on the chopping block -->
		<div class="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
			{#each selectedUsers as u (u.id)}
				<span
					class="flex items-center gap-1.5 rounded-full bg-olf-red/10 py-0.5 pr-2.5 pl-0.5 font-oswald text-xs font-bold text-olf-darkgreen"
				>
					<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
					{u.username}
				</span>
			{/each}
		</div>
		<label
			class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
		>
			<span>Type <span class="text-olf-red">delete</span> to confirm</span>
			<input
				bind:value={batchConfirm}
				placeholder="delete"
				autocomplete="off"
				class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen normal-case"
			/>
		</label>
		{#if batchError}<p class="font-oswald text-xs text-olf-red">{batchError}</p>{/if}
		<div class="flex justify-end gap-2">
			<Button
				onclick={() => (batchOpen = false)}
				class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
			>
				Cancel
			</Button>
			<Button
				disabled={!batchArmed || batchDeleting || selectedCount === 0}
				onclick={confirmBatchDelete}
				class="flex items-center gap-1.5 rounded-md bg-olf-red px-4 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-50"
			>
				<Trash2 size={14} />
				{batchDeleting
					? `Deleting ${Math.min(batchDone + 1, batchTotal)}/${batchTotal}…`
					: `Delete ${selectedCount} user${selectedCount === 1 ? '' : 's'}`}
			</Button>
		</div>
	</div>
</dialog>

<!-- Delete-user danger modal: type "delete" to arm the button -->
<dialog
	bind:this={deleteDialog}
	onclose={() => (userToDelete = null)}
	onclick={(e) => {
		if (e.target === deleteDialog) userToDelete = null;
	}}
	class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-center gap-2">
			<h2 class="font-homemade-apple text-xl text-olf-darkbrown">Delete user?</h2>
		</div>
		{#if userToDelete}
			<p class="font-oswald text-sm text-olf-darkgreen/80">
				This permanently deletes <b>{userToDelete.username}</b> and <b>everything they made</b>.
				This can't be undone.
			</p>
			<!-- What gets wiped -->
			<dl
				class="divide-y divide-olf-darkgreen/10 overflow-hidden rounded-lg border border-olf-darkgreen/15 font-oswald text-sm"
			>
				{#each [['Posts', userToDelete.postCount], ['Reviews', userToDelete.reviewCount], ['Comments', userToDelete.commentCount], ['Eggs eaten', userToDelete.eggsEaten]] as [label, val] (label)}
					<div class="flex items-center justify-between gap-3 px-3 py-1.5">
						<dt class="text-olf-darkgreen/70">{label}</dt>
						<dd class="font-bold text-olf-darkgreen tabular-nums">{val}</dd>
					</div>
				{/each}
				<div class="flex items-center justify-between gap-3 px-3 py-1.5">
					<dt class="text-olf-darkgreen/70">Subscription</dt>
					<dd class="font-bold text-olf-darkgreen">
						{userToDelete.subscription ? userToDelete.subscription.plan.name : '—'}
					</dd>
				</div>
			</dl>
			<label
				class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
			>
				<span>Type <span class="text-olf-red">delete</span> to confirm</span>
				<input
					bind:value={deleteConfirm}
					placeholder="delete"
					autocomplete="off"
					class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen normal-case"
				/>
			</label>
			{#if deleteError}<p class="font-oswald text-xs text-olf-red">{deleteError}</p>{/if}
			<div class="flex justify-end gap-2">
				<Button
					onclick={() => (userToDelete = null)}
					class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
				>
					Cancel
				</Button>
				<Button
					disabled={!deleteArmed || deleting}
					onclick={confirmDelete}
					class="flex items-center gap-1.5 rounded-md bg-olf-red px-4 py-1.5 font-oswald text-xs font-bold text-olf-eggshell disabled:opacity-50"
				>
					<Trash2 size={14} /> Delete &amp; continue
				</Button>
			</div>
		{/if}
	</div>
</dialog>

<!-- Pause-subscription config modal (shared by the row icon + the expanded
     Subscription tab's Pause button). -->
<PauseSubscriptionModal
	open={pauseModalUser !== null}
	username={pauseModalUser?.username ?? ''}
	busy={pausing}
	onConfirm={confirmPause}
	onCancel={() => (pauseModalUser = null)}
/>
