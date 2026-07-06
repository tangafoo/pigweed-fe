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
		Search,
		Plus,
		Trash2,
		ChevronDown,
		ChevronRight,
		ChevronUp,
		ChevronsUpDown,
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
		localYmd,
		orderDateLabel,
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

	// Batch "Edit details" (Details tab) — username + email + phone in one form.
	// Only changed fields are sent; the BE validates username (format+unique,
	// syncs the 3 name columns) and email (format+unique).
	let editingDetailsId = $state<string | null>(null);
	let detailsDraft = $state({ username: '', email: '', phoneNumber: '' });
	let detailsError = $state('');
	let detailsSaving = $state(false);
	function openDetailsEdit(u: AdminUserRow) {
		editingDetailsId = u.id;
		detailsError = '';
		detailsDraft = { username: u.username, email: u.email, phoneNumber: u.phoneNumber ?? '' };
	}
	async function saveDetails(u: AdminUserRow) {
		if (detailsSaving) return;
		const patch: { username?: string; email?: string; phoneNumber?: string | null } = {};
		const uname = detailsDraft.username.trim().toLowerCase();
		const email = detailsDraft.email.trim().toLowerCase();
		const phone = detailsDraft.phoneNumber.trim();
		if (uname !== u.username) patch.username = uname;
		if (email !== u.email) patch.email = email;
		if (phone !== (u.phoneNumber ?? '')) patch.phoneNumber = phone || null;
		if (Object.keys(patch).length === 0) {
			editingDetailsId = null;
			return;
		}
		detailsSaving = true;
		detailsError = '';
		const res = await admin.updateUserDetails(u.id, patch);
		detailsSaving = false;
		if (res.ok) {
			editingDetailsId = null;
			await invalidateAll();
		} else {
			detailsError = res.message;
		}
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
		formStart = localYmd(u.subscription?.startedAt ?? new Date().toISOString());
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

	// Click-to-sort the loaded page by any column (asc/desc), matching the eggs
	// table. Sort is client-side over the loaded page (the base is small).
	type SortField = 'date' | 'customer' | 'posts' | 'reviews' | 'eggs' | 'subscribed';
	let userSortField = $state<SortField>('date');
	let userSortDir = $state<'asc' | 'desc'>('desc');
	function toggleUserSort(f: SortField) {
		if (userSortField === f) userSortDir = userSortDir === 'asc' ? 'desc' : 'asc';
		else {
			userSortField = f;
			// Names read best A→Z; counts/dates most-first.
			userSortDir = f === 'customer' ? 'asc' : 'desc';
		}
	}
	const sortVal = (u: AdminUserRow, f: SortField): number | string => {
		switch (f) {
			case 'customer':
				return u.username.toLowerCase();
			case 'posts':
				return u.postCount;
			case 'reviews':
				return u.reviewCount;
			case 'eggs':
				return u.eggsEaten;
			case 'subscribed':
				return u.subscription?.status === 'ACTIVE' ? 1 : 0;
			default:
				return +new Date(u.createdAt);
		}
	};
	function sortUsers(list: AdminUserRow[], field: SortField, dir: 'asc' | 'desc'): AdminUserRow[] {
		const s = dir === 'asc' ? 1 : -1;
		return [...list].sort((a, b) => {
			const av = sortVal(a, field);
			const bv = sortVal(b, field);
			if (av < bv) return -s;
			if (av > bv) return s;
			return +new Date(b.createdAt) - +new Date(a.createdAt); // stable tiebreak
		});
	}
	// Admins are rarely touched — always newest-first.
	const sortedAdmins = $derived(sortUsers(admins, 'date', 'desc'));
	// Users group: filter by the search box (scoped here, admins untouched), then sort.
	const filteredRegular = $derived.by(() => {
		const q = searchQ.trim().toLowerCase();
		if (!q) return regular;
		return regular.filter(
			(u) => u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
		);
	});
	const sortedRegular = $derived(sortUsers(filteredRegular, userSortField, userSortDir));

	// Shared column template so the header and every row line up as a real table.
	// Mobile: [avatar | customer | subscribed | actions] (stats hidden). md+: the
	// full 8 columns. Header + rows both apply MD_COLS so cells align exactly.
	// NOTE: every column is a FIXED width (no `auto`) so the header (empty
	// actions cell) and the rows (delete+chevron) reserve identical space —
	// otherwise the 1fr customer column differs and shifts every column after it.
	const MD_COLS = 'md:grid-cols-[4rem_minmax(0,1fr)_3rem_3rem_4.5rem_5rem_8rem_4.5rem]';
	const ROW_GRID = `grid grid-cols-[3rem_minmax(0,1fr)_auto_auto] items-center gap-2 ${MD_COLS} md:gap-3`;
	const joinedShort = (iso: string) =>
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- transient formatting
		new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

	// Client-side paging over the loaded/filtered set — default 10 rows.
	const PAGE_SIZES = [10, 25, 50];
	let pageSize = $state(10);
	let clientPage = $state(1);
	// Any filter/sort/size change resets to the first page.
	$effect(() => {
		searchQ;
		userSortField;
		userSortDir;
		pageSize;
		clientPage = 1;
	});
	const clientPages = $derived(Math.max(1, Math.ceil(sortedRegular.length / pageSize)));
	const pagedRegular = $derived(
		sortedRegular.slice((clientPage - 1) * pageSize, clientPage * pageSize)
	);

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

	<!-- Clickable column header — toggles sort field/direction (like the eggs table). -->
	{#snippet sortTh(label: string, field: SortField, extra = '')}
		<button
			type="button"
			onclick={() => toggleUserSort(field)}
			class="flex cursor-pointer items-center gap-0.5 tracking-widest uppercase transition-colors hover:text-olf-darkgreen {userSortField ===
			field
				? 'text-olf-darkgreen'
				: ''} {extra}"
		>
			<span>{label}</span>
			{#if userSortField === field}
				{#if userSortDir === 'asc'}<ChevronUp size={12} class="shrink-0" />{:else}<ChevronDown
						size={12}
						class="shrink-0"
					/>{/if}
			{:else}
				<ChevronsUpDown size={12} class="shrink-0 opacity-40" />
			{/if}
		</button>
	{/snippet}

	<!-- Table header row — same grid columns as the rows (md+ only). -->
	{#snippet usersHeader()}
		<div
			class="hidden {MD_COLS} border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-3 py-2 font-oswald text-xxs font-bold text-olf-darkgreen/50 md:grid md:items-center md:gap-3"
		>
			<span></span>
			{@render sortTh('Customer', 'customer')}
			<div class="flex justify-center">{@render sortTh('Posts', 'posts')}</div>
			<div class="flex justify-center">{@render sortTh('Reviews', 'reviews')}</div>
			<div class="flex justify-center">{@render sortTh('Eggs', 'eggs')}</div>
			<div class="flex justify-center">{@render sortTh('Added', 'date')}</div>
			<div class="flex justify-center">{@render sortTh('Subscribed', 'subscribed')}</div>
			<span></span>
		</div>
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
				class="{ROW_GRID} px-3 py-2.5 transition-colors hover:bg-olf-darkgreen/5 {expandedId ===
				u.id
					? 'bg-olf-darkgreen/5'
					: ''}"
			>
				<!-- 1 · batch-select + avatar -->
				<span class="flex shrink-0 items-center gap-1.5">
					<input
						type="checkbox"
						checked={selectedIds.has(u.id)}
						onclick={() => toggleSelect(u.id)}
						aria-label="Select {u.username}"
						class="size-4 shrink-0 cursor-pointer rounded border-olf-darkgreen/30 text-olf-blue focus:ring-olf-blue"
					/>
					<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
				</span>
				<!-- 2 · customer -->
				<div class="min-w-0">
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
				<!-- 3 · posts -->
				<span
					class="hidden items-center justify-center gap-1 font-oswald text-xs text-olf-darkgreen/70 tabular-nums md:flex"
					title="Posts"><FileText size={13} class="shrink-0" />{u.postCount}</span
				>
				<!-- 4 · reviews -->
				<span
					class="hidden items-center justify-center gap-1 font-oswald text-xs text-olf-darkgreen/70 tabular-nums md:flex"
					title="Reviews"><Star size={13} class="shrink-0" />{u.reviewCount}</span
				>
				<!-- 5 · eggs (opens the eggs tab) -->
				<button
					type="button"
					onclick={() => openExpand(u, 'eggs')}
					class="hidden items-center justify-center gap-1 rounded-md font-oswald text-xs font-bold text-olf-darkgreen tabular-nums hover:bg-olf-darkgreen/10 md:flex"
					title="Eggs sold — view order history">🥚 {u.eggsEaten}</button
				>
				<!-- 6 · added (join date) -->
				<span
					class="hidden items-center justify-center gap-1 font-oswald text-xs text-olf-darkgreen/70 tabular-nums md:flex"
					title="Joined"><CalendarDays size={13} class="shrink-0" />{joinedShort(u.createdAt)}</span
				>
				<!-- 7 · subscribed pill + pause/resume shortcut -->
				<div class="flex items-center justify-center gap-1.5">
					{#if u.subscription?.status === 'ACTIVE'}
						<button
							type="button"
							onclick={() => openExpand(u, 'subscription')}
							class="cursor-pointer rounded-full bg-olf-darkgreen px-2.5 py-1 font-oswald text-xs font-bold tracking-wide text-olf-eggshell uppercase transition-colors hover:bg-olf-moss"
						>
							subscribed
						</button>
						<button
							type="button"
							onclick={() => (pauseModalUser = u)}
							aria-label="Pause subscription"
							title="Pause subscription"
							class="flex size-7 items-center justify-center rounded-lg text-olf-yolk hover:bg-olf-yolk/15"
						>
							<PauseCircle size={16} />
						</button>
					{:else if u.subscription?.status === 'PAUSED'}
						<button
							type="button"
							onclick={() => openExpand(u, 'subscription')}
							class="cursor-pointer rounded-full bg-olf-yolk px-2.5 py-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen uppercase transition-colors hover:brightness-105"
						>
							paused
						</button>
						<button
							type="button"
							onclick={() => run(() => admin.resumeUser(u.id))}
							aria-label="Resume subscription"
							title={pauseWindowLabel(u.subscription)}
							class="flex size-7 items-center justify-center rounded-lg text-olf-moss hover:bg-olf-moss/15"
						>
							<Play size={16} />
						</button>
					{:else}
						<label
							class="flex cursor-pointer items-center gap-1.5 font-oswald text-xs text-olf-darkgreen"
						>
							<input
								type="checkbox"
								checked={false}
								onclick={(e) => {
									e.preventDefault();
									openExpand(u, 'subscription');
								}}
								class="size-4 rounded text-olf-moss focus:ring-olf-moss"
							/>
							subscribe
						</label>
					{/if}
				</div>
				<!-- 8 · actions -->
				<div class="flex items-center justify-end gap-1">
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
							{#if editingDetailsId === u.id}
								<div class="flex flex-col gap-3 font-oswald text-sm text-olf-darkgreen">
									<label class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Username</span
										>
										<input
											bind:value={detailsDraft.username}
											autocapitalize="none"
											autocomplete="off"
											spellcheck="false"
											class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-sm sm:w-1/2"
										/>
										<span class="text-xxs text-olf-darkgreen/45"
											>lowercase letters, numbers, underscore · 3–30 chars</span
										>
									</label>
									<label class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Email</span
										>
										<input
											type="email"
											bind:value={detailsDraft.email}
											autocapitalize="none"
											autocomplete="off"
											spellcheck="false"
											class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-sm sm:w-1/2"
										/>
									</label>
									<label class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Phone</span
										>
										<input
											type="tel"
											bind:value={detailsDraft.phoneNumber}
											placeholder="+60…"
											class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1 text-sm tabular-nums sm:w-1/2"
										/>
									</label>
									{#if detailsError}
										<p class="rounded-lg bg-red-700 px-3 py-2 font-oswald text-xs text-white">
											{detailsError}
										</p>
									{/if}
									<div class="flex gap-2">
										<Button
											disabled={detailsSaving}
											onclick={() => saveDetails(u)}
											class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
										>
											Save
										</Button>
										<Button
											disabled={detailsSaving}
											onclick={() => (editingDetailsId = null)}
											class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
											>Cancel</Button
										>
									</div>
								</div>
							{:else}
								<div class="flex flex-col gap-3 font-oswald text-sm text-olf-darkgreen">
									<div class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Username</span
										>
										<span>{u.username}</span>
									</div>
									<div class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Email</span
										>
										<span class="flex items-center gap-1.5"
											><span class="break-all">{u.email}</span>{@render copyBtn(u.email)}</span
										>
									</div>
									<div class="flex flex-col gap-0.5">
										<span
											class="text-xxs font-bold tracking-[0.2em] text-olf-darkgreen/50 uppercase"
											>Phone</span
										>
										<span>{u.phoneNumber || '—'}</span>
									</div>
								</div>
							{/if}

							<!-- Per-user actions — Details-only (they're about the person,
							     not the eggs/subscription views). -->
							<div
								class="flex flex-wrap items-center justify-between gap-2 border-t border-olf-darkgreen/15 pt-3"
							>
								<div class="flex flex-wrap items-center gap-2">
									<a
										href="/users/{u.id}"
										target="_blank"
										rel="noopener"
										class="flex items-center gap-1.5 rounded-md border border-olf-darkgreen/20 px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen hover:bg-olf-darkgreen/10"
										><ExternalLink size={14} /> View user profile</a
									>
									{#if editingDetailsId !== u.id}
										<button
											type="button"
											onclick={() => openDetailsEdit(u)}
											class="flex items-center gap-1.5 rounded-md border border-olf-darkgreen/20 px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen hover:bg-olf-darkgreen/10"
										>
											<Pencil size={14} /> Edit
										</button>
									{/if}
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
								</div>
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
		</div>
		{#if adminsOpen && mounted}
			<div class="overflow-hidden rounded-xl border border-olf-darkgreen/10 bg-olf-eggshell/60">
				{@render usersHeader()}
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
			</div>
		</div>
		{#if usersOpen && mounted}
			<div class="overflow-hidden rounded-xl border border-olf-darkgreen/10 bg-olf-eggshell/60">
				{@render usersHeader()}
				{#each pagedRegular as u, i (u.id)}{@render userRow(u, i)}{/each}
				{#if regular.length === 0}
					<p class="px-3 py-4 font-oswald text-xs text-olf-darkgreen/50">No users found.</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Rows-per-page (below the table). appearance-none + our own chevron so the
	     native arrow never overlaps the number. -->
	{#if usersOpen && mounted}
		<label class="flex items-center gap-1.5 self-start font-oswald text-xs text-olf-darkgreen/70">
			Show
			<span class="relative">
				<select
					bind:value={pageSize}
					aria-label="Rows per page"
					class="cursor-pointer appearance-none rounded-lg border border-olf-darkgreen/20 bg-white py-1.5 pr-8 pl-3 font-oswald text-sm text-olf-darkgreen"
				>
					{#each PAGE_SIZES as n (n)}<option value={n}>{n}</option>{/each}
				</select>
				<ChevronDown
					size={14}
					class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-olf-darkgreen/50"
				/>
			</span>
			per page
		</label>
	{/if}

	{#if usersOpen && sortedRegular.length > pageSize}
		<div class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen">
			<button
				type="button"
				disabled={clientPage <= 1}
				onclick={() => (clientPage -= 1)}
				class="underline disabled:opacity-40">← Prev</button
			>
			<span class="tabular-nums">Page {clientPage} of {clientPages}</span>
			<button
				type="button"
				disabled={clientPage >= clientPages}
				onclick={() => (clientPage += 1)}
				class="underline disabled:opacity-40">Next →</button
			>
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
				{#each [['Posts', userToDelete.postCount], ['Reviews', userToDelete.reviewCount], ['Comments', userToDelete.commentCount], ['Eggs sold', userToDelete.eggsEaten]] as [label, val] (label)}
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
