<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { createAutosave } from '$lib/stores/autosave.svelte';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import {
		Egg,
		Crown,
		Sparkles,
		Shield,
		FileText,
		Star,
		MessageSquare,
		Search,
		Plus,
		Minus,
		Trash2,
		Save,
		X,
		ChevronDown,
		ChevronRight,
		ChevronUp,
		ChevronsUpDown,
		Users as UsersIcon,
		Layers,
		Gift,
		Umbrella,
		Pencil,
		RefreshCw,
		CalendarDays,
		ExternalLink,
		Home,
		Receipt,
		Download,
		RotateCcw
	} from '@lucide/svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import DatePicker from '$lib/components/ui/DatePicker.svelte';
	import RollingNumber from '$lib/components/ui/RollingNumber.svelte';
	import AddUserModal from '$lib/components/admin/AddUserModal.svelte';
	import EggOrderEntry from '$lib/components/admin/EggOrderEntry.svelte';
	import UserPicker from '$lib/components/admin/UserPicker.svelte';
	import { toasts } from '$lib/realtime/toasts.svelte';
	import { eggStats } from '$lib/data/eggFacts';
	import * as admin from '$lib/api/admin';
	import type {
		AdminUserRow,
		EggOrder,
		AdminEggLedgerRow,
		AdminEggLedgerTotals,
		Animal,
		Gender
	} from '@meteorclass/pigweed-contract';
	import type { PageData } from './$types';
	import { slide, fade } from 'svelte/transition';
	import { sineOut, sineIn } from 'svelte/easing';

	let { data }: { data: PageData } = $props();

	// Which dashboard section is showing — driven by the ?view= URL param so it
	// survives a refresh (and is shareable). Defaults to 'users'.
	const VIEWS = ['home', 'users', 'eggs', 'tiers', 'benefits'] as const;
	type View = (typeof VIEWS)[number];
	const view = $derived(
		(VIEWS.includes(page.url.searchParams.get('view') as View)
			? page.url.searchParams.get('view')
			: 'home') as View
	);

	// Build an /admin URL from the current params with overrides (undefined drops a param).
	function urlWith(overrides: Record<string, string | undefined>): string {
		const sp = new SvelteURLSearchParams(page.url.search);
		for (const [k, v] of Object.entries(overrides)) {
			if (v) sp.set(k, v);
			else sp.delete(k);
		}
		const qs = sp.toString();
		return qs ? `/admin?${qs}` : '/admin';
	}

	let busy = $state(false);

	// Svelte skips intro transitions on first paint; flip this after mount so the
	// row lists animate in on load (and on every group expand).
	let mounted = $state(false);
	onMount(() => (mounted = true));

	// Debounced live search — typing updates the ?q= URL (which re-runs the
	// server load) 200ms after the last keystroke. No button needed.
	// Name/email search — client-side over the loaded users group only (NOT the
	// admins group, and not a server round-trip). The base is small, so the page
	// holds everyone.
	let searchQ = $state('');
	async function run(fn: () => Promise<unknown>) {
		if (busy) return;
		busy = true;
		try {
			await fn();
			await invalidateAll();
		} finally {
			busy = false;
		}
	}

	// Localized weekday name (0=Sun). 2024-01-07 is a Sunday.
	const dayName = (d: number) =>
		new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: 'long' });
	const DAYS = [0, 1, 2, 3, 4, 5, 6];

	// ─── Per-user expand card — tabs: eggs ledger + subscription ────
	let expandedId = $state<string | null>(null);
	let expandTab = $state<'eggs' | 'subscription'>('eggs');

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
	// collapses it. The subscribed checkbox opens the Subscription tab; the egg
	// counter / chevron open the Eggs tab.
	function openExpand(u: AdminUserRow, tab: 'eggs' | 'subscription') {
		if (expandedId === u.id && expandTab === tab) {
			expandedId = null;
			return;
		}
		expandedId = u.id;
		expandTab = tab;
		formPlanId = u.subscription?.plan.id ?? data.plans[0]?.id ?? '';
		formStart = (u.subscription?.startedAt ?? new Date().toISOString()).slice(0, 10);
		formDay = u.subscription?.deliveryDay ?? 4;
		if (ordersFor !== u.id) void loadOrders(u.id);
	}
	// Clicking anywhere on the row toggles the Eggs tab — but not when the click
	// landed on one of the row's own controls (checkboxes, the egg/chevron
	// buttons), which have their own handlers.
	function rowClick(e: MouseEvent, u: AdminUserRow) {
		if ((e.target as HTMLElement).closest('button, input, label, a')) return;
		openExpand(u, 'eggs');
	}
	const orderDateLabel = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});

	// ─── Add-user modal (pre-register by email + magic link) ────────
	// The whole modal (state + handlers + the "log eggs for this user" step) now
	// lives in AddUserModal.svelte; this page just toggles it open.
	let addUserOpen = $state(false);

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

	// Split into admins (their own collapsed group — rarely touched) and
	// everyone else (the day-to-day group, open by default).
	const admins = $derived(data.users.filter((u) => u.isAdmin));
	const regular = $derived(data.users.filter((u) => !u.isAdmin));
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

	// Shared markup for a group's sort dropdown (bound per group).
	const SORT_SELECT =
		'cursor-pointer rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1 font-oswald text-xs text-olf-darkgreen';

	const statusClass = (s?: string) =>
		s === 'ACTIVE'
			? 'bg-olf-darkgreen text-white'
			: s === 'PAUSED'
				? 'bg-olf-yolk text-olf-darkgreen'
				: 'bg-olf-darkbrown/60 text-olf-beige';

	// ─── Benefits CRM (editable copies) ─────────────────────────────
	// Auto-grow a textarea to its content height so long benefit copy wraps and
	// reveals downward (no truncation) — used on the mobile-cramped label field.
	function autosize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		resize();
		node.addEventListener('input', resize);
		const ro = new ResizeObserver(resize);
		ro.observe(node);
		return {
			destroy() {
				node.removeEventListener('input', resize);
				ro.disconnect();
			}
		};
	}
	let benefitEdits = $state<Record<string, { label: string; sortOrder: number; active: boolean }>>(
		{}
	);
	let newBenefit = $state('');
	$effect(() => {
		const next: Record<string, { label: string; sortOrder: number; active: boolean }> = {};
		// Display order 1-indexed for humans (stored 0-indexed in the DB).
		for (const b of data.benefits)
			next[b.id] = { label: b.label, sortOrder: b.sortOrder + 1, active: b.active };
		benefitEdits = next;
	});

	// True when any row differs from the server (drives the single Save button).
	const benefitsDirty = $derived(
		data.benefits.some((b) => {
			const e = benefitEdits[b.id];
			return (
				!!e && (e.label !== b.label || e.sortOrder - 1 !== b.sortOrder || e.active !== b.active)
			);
		})
	);
	// Persist every changed row in one go (run() refetches after).
	async function saveAllBenefits() {
		for (const b of data.benefits) {
			const e = benefitEdits[b.id];
			if (!e) continue;
			if (e.label === b.label && e.sortOrder - 1 === b.sortOrder && e.active === b.active) continue;
			await admin.updateBenefit(b.id, {
				label: e.label,
				sortOrder: e.sortOrder - 1,
				active: e.active
			});
		}
	}
	// Debounced 5s auto-save: any edit/toggle calls .touch() to (re)start the
	// countdown; it saves when it hits zero. Cancelable from the UI.
	const benefitsAutosave = createAutosave(() => run(saveAllBenefits));
	onDestroy(() => benefitsAutosave.cancel());

	// ─── Per-tier benefit checklist (local checked sets) ────────────
	let checklist = $state<Record<string, string[]>>({});
	$effect(() => {
		const next: Record<string, string[]> = {};
		for (const p of data.plans) next[p.id] = [...p.benefitIds];
		checklist = next;
	});
	function toggleBenefit(planId: string, benefitId: string) {
		const arr = checklist[planId] ?? [];
		checklist[planId] = arr.includes(benefitId)
			? arr.filter((id) => id !== benefitId)
			: [...arr, benefitId];
	}
	// Save every tier's checklist in one go (run() handles the refetch after).
	async function saveAllChecklists() {
		for (const p of data.plans) await admin.setPlanBenefits(p.id, checklist[p.id] ?? []);
	}

	// ─── Tier metadata edit (name / eggs / cadence) ─────────────────
	const PRICE_PER_EGG_CENTS = 200; // RM2 / egg
	let editingPlanId = $state<string | null>(null);
	let planName = $state('');
	let planEggs = $state(0);
	let planCadence = $state(1);
	function openPlanEdit(p: {
		id: string;
		name: string;
		eggsPerDelivery: number;
		cadenceWeeks: number;
	}) {
		editingPlanId = p.id;
		planName = p.name;
		planEggs = p.eggsPerDelivery;
		planCadence = p.cadenceWeeks;
	}

	// Create a new tier.
	let creatingPlan = $state(false);
	let newPlanName = $state('');
	let newPlanEggs = $state(60);
	let newPlanCadence = $state(1);
	function openCreatePlan() {
		creatingPlan = true;
		newPlanName = '';
		newPlanEggs = 60;
		newPlanCadence = 1;
	}
	let createDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!createDialog) return;
		if (creatingPlan && !createDialog.open) createDialog.showModal();
		else if (!creatingPlan && createDialog.open) createDialog.close();
	});

	// Clicking a disabled perk pill explains why + offers to open Benefits.
	let disabledPerk = $state<string | null>(null);
	let disabledDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!disabledDialog) return;
		if (disabledPerk && !disabledDialog.open) disabledDialog.showModal();
		else if (!disabledPerk && disabledDialog.open) disabledDialog.close();
	});
	function pillClick(planId: string, b: { id: string; label: string; active: boolean }) {
		if (!b.active) {
			disabledPerk = b.label;
			return;
		}
		toggleBenefit(planId, b.id);
	}

	const NAV = [
		{ id: 'home', label: 'Home', icon: Home },
		{ id: 'eggs', label: 'Eggs', icon: Receipt },
		{ id: 'users', label: 'Users', icon: UsersIcon },
		{ id: 'tiers', label: 'Tiers', icon: Layers },
		{ id: 'benefits', label: 'Benefits', icon: Gift }
	] as const;

	// Total eggs gauge (Home view). Fill a ring toward the next 1,000-egg
	// milestone — a simple game-y "level" sense of the flock's appetite.
	const totalEggs = $derived(data.stats.totalEggs);
	const eggMilestone = $derived((Math.floor(totalEggs / 1000) + 1) * 1000);
	const eggProgress = $derived((totalEggs % 1000) / 1000);
	const eggGlobalFacts = $derived(eggStats(totalEggs));
	// SVG ring geometry.
	const RING_R = 92;
	const RING_C = 2 * Math.PI * RING_R;
	const ringOffset = $derived(RING_C * (1 - eggProgress));

	// Egg calculator (Home view): price × eggs × weeks.
	// Price is a free-typed string (no stepper) — typical eggs run RM1.50 / 1.80 /
	// 2.00, so let the admin just type it; `calcPrice` is the parsed number.
	let calcPriceStr = $state('2.00');
	const calcPrice = $derived(parseFloat(calcPriceStr) || 0);
	let calcEggs = $state(30);
	let calcWeeks = $state(4);
	const calcTotal = $derived(Math.max(0, calcPrice * (calcEggs || 0) * (calcWeeks || 0)));
	const calcMoney = $derived(
		`RM${calcTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
	);

	// Box mode: count in boxes (trays) instead of loose eggs. Eggs stays the
	// source of truth underneath; one box = 30 eggs (a standard tray / our
	// smallest tier). The primary input shows boxes when `byBox`, the presets
	// punch in whole boxes either way.
	const EGGS_PER_BOX = 30;
	const BOX_PRESETS = [2, 3, 4, 5];
	let byBox = $state(false);
	const boxCount = $derived(calcEggs / EGGS_PER_BOX);
	// Write the primary field back to `calcEggs`, converting from boxes if needed.
	function setPrimary(v: number) {
		const n = Math.max(0, Number.isFinite(v) ? v : 0);
		calcEggs = byBox ? Math.round(n * EGGS_PER_BOX) : Math.round(n);
	}

	// "Add customer?" — search a user and log an egg order straight from the
	// calculator (records `calcEggs` against the chosen user via the order route).
	// A picked customer only needs the fields to render + record, so recents
	// restored from localStorage satisfy the same shape.
	type PickedCustomer = {
		id: string;
		username: string;
		animal: Animal;
		avatarSeed: number;
		gender: Gender;
	};
	let custOpen = $state(false);
	let custSelected = $state<PickedCustomer | null>(null);
	let custSaving = $state(false);
	let custDone = $state(false);
	function resetCustomer() {
		custSelected = null;
		custDone = false;
	}
	async function addCalcOrder() {
		if (!custSelected || custSaving || calcEggs <= 0) return;
		custSaving = true;
		const ok = await admin.recordOrder(custSelected.id, {
			eggs: calcEggs,
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
			gender: u.gender
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

	// ─── Eggs panel: global egg ledger (accounting view) ────────────
	// Loaded client-side on demand (not in the SvelteKit `load`); refetched
	// whenever a filter changes. Totals come from the BE over the WHOLE filtered
	// set, so they're correct even when the rows are paginated.
	const LEDGER_LIMIT = 100;
	let ledgerRows = $state<AdminEggLedgerRow[]>([]);
	let ledgerTotals = $state<AdminEggLedgerTotals>({ eggs: 0, revenueCents: 0, orderCount: 0 });
	let ledgerTotal = $state(0);
	let ledgerLoading = $state(false);
	let ledgerLoaded = $state(false);
	let ledgerPage = $state(1);
	let ledgerFrom = $state('');
	let ledgerTo = $state('');
	let ledgerSource = $state(''); // '' | 'MANUAL' | 'SUBSCRIPTION'
	let ledgerQ = $state('');
	let ledgerShowDeleted = $state(false);
	let ledgerGroupBy = $state<'none' | 'week' | 'month'>('none');
	let ledgerSearchTimer: ReturnType<typeof setTimeout>;

	async function loadLedger() {
		ledgerLoading = true;
		const res = await admin.fetchEggLedger({
			page: ledgerPage,
			limit: LEDGER_LIMIT,
			from: ledgerFrom || undefined,
			to: ledgerTo || undefined,
			source: ledgerSource || undefined,
			q: ledgerQ || undefined,
			includeDeleted: ledgerShowDeleted
		});
		ledgerRows = res.data.rows;
		ledgerTotals = res.data.totals;
		ledgerTotal = res.data.total;
		ledgerLoading = false;
		ledgerLoaded = true;
	}
	// Reset to page 1 and reload (used by every filter control).
	function reloadLedger() {
		ledgerPage = 1;
		void loadLedger();
	}
	function ledgerSearchInput() {
		clearTimeout(ledgerSearchTimer);
		ledgerSearchTimer = setTimeout(reloadLedger, 250);
	}
	// First load when the Eggs view is opened.
	$effect(() => {
		if (view === 'eggs' && !ledgerLoaded && !ledgerLoading) void loadLedger();
	});

	async function softDeleteOrder(id: string) {
		if (await admin.deleteOrder(id)) {
			await loadLedger();
			await invalidateAll();
		}
	}
	async function restoreOrder(id: string) {
		if (await admin.restoreOrder(id)) {
			await loadLedger();
			await invalidateAll();
		}
	}
	let ledgerExporting = $state(false);
	async function exportLedger() {
		ledgerExporting = true;
		await admin.exportEggLedgerCsv({
			from: ledgerFrom || undefined,
			to: ledgerTo || undefined,
			source: ledgerSource || undefined,
			q: ledgerQ || undefined,
			includeDeleted: ledgerShowDeleted
		});
		ledgerExporting = false;
	}

	// Money + unit helpers for the ledger.
	const moneyRM = (cents: number) =>
		`RM${(cents / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const lineTotal = (o: AdminEggLedgerRow) => o.eggs * o.unitPriceCents;
	const avgOrderEggs = $derived(
		ledgerTotals.orderCount ? Math.round(ledgerTotals.eggs / ledgerTotals.orderCount) : 0
	);
	const ledgerPages = $derived(Math.max(1, Math.ceil(ledgerTotal / LEDGER_LIMIT)));

	// Click-to-sort the loaded ledger page by any column. Client-side over the
	// loaded rows (the page is small); clicking the active field flips direction.
	type LedgerSortField = 'date' | 'customer' | 'eggs' | 'boxes' | 'unit' | 'total';
	let ledgerSortField = $state<LedgerSortField>('date');
	let ledgerSortDir = $state<'asc' | 'desc'>('desc');
	function toggleLedgerSort(f: LedgerSortField) {
		if (ledgerSortField === f) ledgerSortDir = ledgerSortDir === 'asc' ? 'desc' : 'asc';
		else {
			ledgerSortField = f;
			ledgerSortDir = f === 'customer' ? 'asc' : 'desc';
		}
	}
	const sortValue = (o: AdminEggLedgerRow, f: LedgerSortField): number | string => {
		switch (f) {
			case 'customer':
				return o.username.toLowerCase();
			case 'eggs':
			case 'boxes':
				return o.eggs;
			case 'unit':
				return o.unitPriceCents;
			case 'total':
				return lineTotal(o);
			default:
				return +new Date(o.orderedAt);
		}
	};
	const sortedLedgerRows = $derived.by(() => {
		const dir = ledgerSortDir === 'asc' ? 1 : -1;
		return [...ledgerRows].sort((a, b) => {
			const av = sortValue(a, ledgerSortField);
			const bv = sortValue(b, ledgerSortField);
			return av < bv ? -dir : av > bv ? dir : 0;
		});
	});

	// Delete-record confirmation (soft delete is recoverable, but confirm anyway).
	let orderToDelete = $state<AdminEggLedgerRow | null>(null);
	let confirmDeleteOrderDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!confirmDeleteOrderDialog) return;
		if (orderToDelete && !confirmDeleteOrderDialog.open) confirmDeleteOrderDialog.showModal();
		else if (!orderToDelete && confirmDeleteOrderDialog.open) confirmDeleteOrderDialog.close();
	});
	async function confirmDeleteOrder() {
		if (!orderToDelete) return;
		const id = orderToDelete.id;
		orderToDelete = null;
		await softDeleteOrder(id);
	}

	// Period grouping (week / month) with per-group subtotals — computed over the
	// loaded page. Subtotals exclude soft-deleted rows.
	function periodKey(iso: string, mode: 'week' | 'month'): string {
		const d = new Date(iso);
		if (mode === 'month')
			return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
		// Mon-start ISO week, computed by timestamp math (no mutable Date).
		const day = d.getUTCDay() || 7;
		const weekStartMs =
			Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) -
			(day - 1) * 24 * 60 * 60 * 1000;
		return `Week of ${new Date(weekStartMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
	}
	type LedgerGroup = { key: string; rows: AdminEggLedgerRow[]; eggs: number; revenueCents: number };
	const ledgerGroups = $derived.by<LedgerGroup[] | null>(() => {
		if (ledgerGroupBy === 'none') return null;
		// Plain object index (not a Map) to satisfy svelte/prefer-svelte-reactivity;
		// this is a transient computation, not reactive state.
		const groups: LedgerGroup[] = [];
		const index: Record<string, LedgerGroup> = {};
		for (const r of sortedLedgerRows) {
			const k = periodKey(r.orderedAt, ledgerGroupBy);
			let g = index[k];
			if (!g) {
				g = { key: k, rows: [], eggs: 0, revenueCents: 0 };
				index[k] = g;
				groups.push(g);
			}
			g.rows.push(r);
			if (!r.deletedAt) {
				g.eggs += r.eggs;
				g.revenueCents += lineTotal(r);
			}
		}
		return groups;
	});

	// ─── Add-egg-order modal (pick a customer, then log records) ────
	let addOrderOpen = $state(false);
	let addOrderUser = $state<AdminUserRow | null>(null);
	let addOrderDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!addOrderDialog) return;
		if (addOrderOpen && !addOrderDialog.open) addOrderDialog.showModal();
		else if (!addOrderOpen && addOrderDialog.open) addOrderDialog.close();
	});
</script>

<svelte:head><title>Admin · Our Little Farm</title></svelte:head>

<div class="flex flex-1 bg-olf-lightgreen">
	<!-- Sidebar — left rail on desktop, fixed bottom nav on mobile. -->
	<aside
		class="fixed inset-x-0 bottom-0 z-40 flex flex-row justify-around gap-1 bg-olf-moss px-2 py-2 text-olf-beige shadow-[0_-2px_10px_rgba(0,0,0,0.12)] sm:static sm:w-52 sm:shrink-0 sm:flex-col sm:justify-start sm:gap-2 sm:px-4 sm:py-6 sm:shadow-none"
	>
		<p class="hidden px-2 pb-4 font-homemade-apple text-3xl text-olf-eggshell sm:block">Admin</p>
		{#each NAV as item (item.id)}
			{@const Icon = item.icon}
			{#if item.id === 'tiers'}
				<!-- Umbrella: Tiers + Benefits both live under the subscription. -->
				<div
					class="mt-3 hidden items-center justify-center gap-1.5 px-3 pt-2 pb-1 text-olf-beige/40 sm:flex sm:justify-start"
				>
					<Umbrella size={12} class="shrink-0" />
					<span class="hidden font-oswald text-xxs font-bold tracking-widest uppercase sm:inline"
						>Subscription</span
					>
				</div>
			{/if}
			<Button
				onclick={() => goto(urlWith({ view: item.id, page: undefined }), { noScroll: true })}
				class="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 font-oswald text-sm font-bold tracking-wide transition-colors sm:justify-start {view ===
				item.id
					? 'bg-olf-beige text-olf-darkgreen'
					: 'text-olf-beige/70 hover:bg-olf-beige/10'}"
				title={item.label}
			>
				<Icon size={18} class="shrink-0" />
				<span class="hidden sm:inline">{item.label}</span>
			</Button>
		{/each}
	</aside>

	<!-- Main -->
	<main class="min-w-0 flex-1 px-4 pt-4 pb-12 sm:px-8 sm:pt-6 sm:pb-8">
		<!-- Stat strip — tight cockpit console at every breakpoint -->
		<div class="grid grid-cols-2 gap-2 lg:grid-cols-4">
			{#each [{ label: 'Users', value: data.stats.totalUsers, icon: UsersIcon }, { label: 'Subscribers', value: data.stats.activeSubscribers, icon: Egg }, { label: 'Posts', value: data.stats.totalPosts, icon: FileText }, { label: 'Reviews', value: data.stats.totalReviews, icon: Star }] as s (s.label)}
				{@const Icon = s.icon}
				<div
					class="flex items-center gap-2 rounded-xl bg-olf-darkgreen px-3 py-2 text-olf-eggshell shadow"
				>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen text-olf-darkgreen"
					>
						<Icon size={18} />
					</span>
					<div class="flex flex-col">
						<span class="font-oswald text-xxs tracking-wide uppercase opacity-80">{s.label}</span>
						<span class="font-supermercado-one text-xl leading-none tabular-nums">{s.value}</span>
					</div>
				</div>
			{/each}
		</div>

		<!-- ─── Home view ─── -->
		{#if view === 'home'}
			<section class="mt-8 flex flex-col items-start gap-4">
				<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Home</h2>

				<div class="flex w-full flex-col items-start gap-8 lg:flex-row lg:gap-16">
					<!-- Egg calculator -->
					<div class="w-full max-w-xs rounded-2xl bg-olf-beige p-6 text-olf-darkgreen shadow">
						<div class="flex justify-between">
							<h3
								class="mb-4 flex items-center gap-2 font-oswald text-lg font-light tracking-widest uppercase"
							>
								Calculator
							</h3>
							<span>🥚🧮</span>
						</div>

						<div class="flex flex-col gap-3 font-oswald text-sm">
							<div class="flex flex-col gap-1.5">
								<label class="flex items-center justify-between gap-3">
									<span class="tracking-wide text-olf-darkgreen/70 uppercase">price</span>
									<span class="flex items-center gap-1 font-bold">
										RM
										<input
											type="text"
											inputmode="decimal"
											bind:value={calcPriceStr}
											placeholder="2.00"
											class="w-20 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-right tabular-nums"
										/>
									</span>
								</label>
								<!-- Recent prices (from successful orders) → quick-pick pills -->
								{#if recentPrices.length}
									<div class="flex flex-wrap justify-end gap-1.5">
										{#each recentPrices as p (p)}
											<button
												type="button"
												onclick={() => (calcPriceStr = p.toFixed(2))}
												class="cursor-pointer rounded-full px-2.5 py-1 font-oswald text-xxs font-bold tracking-wide transition-colors {calcPrice ===
												p
													? 'bg-olf-darkgreen text-olf-beige'
													: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
											>
												{priceLabel(p)}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							<div class="flex flex-col gap-2">
								<div class="flex items-center justify-between gap-3">
									<button
										type="button"
										onclick={() => (byBox = !byBox)}
										class="flex cursor-pointer items-center gap-1.5 tracking-wide text-olf-darkgreen/70 uppercase hover:opacity-100"
										title={byBox ? 'Switch to eggs' : 'Switch to boxes'}
									>
										{byBox ? 'Boxes' : 'Eggs'}
										<RefreshCw size={11} class="shrink-0" />
									</button>
									<input
										type="text"
										inputmode="decimal"
										value={byBox ? boxCount : calcEggs}
										oninput={(e) => setPrimary(parseFloat(e.currentTarget.value))}
										class="w-24 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-right font-bold tabular-nums"
									/>
								</div>
								<!-- eggs-underneath hint when counting boxes -->
								{#if byBox}
									<span
										class="text-right font-oswald text-sm font-bold tracking-wide text-olf-darkgreen/80"
									>
										= {calcEggs} eggs
									</span>
								{/if}
								<!-- quick box presets -->
								<div class="flex flex-wrap justify-end gap-1.5">
									{#each BOX_PRESETS as b (b)}
										<button
											type="button"
											onclick={() => (calcEggs = b * EGGS_PER_BOX)}
											class="cursor-pointer rounded-full px-2.5 py-1 font-oswald text-xxs font-bold tracking-wide transition-colors {calcEggs ===
											b * EGGS_PER_BOX
												? 'bg-olf-darkgreen text-olf-beige'
												: 'bg-olf-darkgreen/10 text-olf-darkgreen hover:bg-olf-darkgreen/20'}"
										>
											{b} box
										</button>
									{/each}
								</div>
							</div>
							<label class="flex items-center justify-between gap-3">
								<span class="tracking-wide text-olf-darkgreen/70 uppercase">Weeks</span>
								<input
									type="number"
									min="0"
									bind:value={calcWeeks}
									class="w-24 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-right font-bold tabular-nums"
								/>
							</label>
						</div>

						<!-- Add customer → log an egg order straight from the calculator -->
						<div class="mt-3 border-t border-olf-darkgreen/15 pt-3">
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
											Logged {calcEggs} 🥚 to {custSelected.username}
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
											disabled={custSaving || calcEggs <= 0}
											class="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-olf-darkgreen px-3 py-2 font-oswald text-xs font-bold text-olf-beige disabled:opacity-50"
										>
											Log {calcEggs} 🥚 order
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
										<UserPicker
											users={data.users}
											clearOnSelect
											onselect={(u) => (custSelected = u)}
										/>
									{/if}
								</div>
							{/if}
						</div>

						<div
							class="mt-4 flex items-center justify-between gap-3 border-t border-olf-darkgreen/15 pt-4"
						>
							<span class="font-supermercado-one text-2xl text-olf-darkgreen/40">=</span>
							<span class="font-caveat text-3xl leading-none text-olf-yolk tabular-nums">
								{calcMoney}
							</span>
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
								<span
									class="font-supermercado-one text-5xl leading-none text-olf-darkgreen tabular-nums"
								>
									<RollingNumber text={String(totalEggs)} />
								</span>
								<span
									class="mt-1 font-oswald text-xs tracking-widest text-olf-darkgreen/60 uppercase"
								>
									eggs eaten
								</span>
							</div>
						</div>

						<p class="font-oswald text-sm text-olf-darkgreen/70">
							<span class="font-bold text-olf-darkgreen tabular-nums"
								>{eggMilestone - totalEggs}</span
							>
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
		{/if}

		<!-- ─── Users view ─── -->
		{#if view === 'users'}
			<section class="mt-8 flex flex-col gap-4">
				<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Users panel</h2>
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
									openExpand(u, 'eggs');
								}
							}}
							class="flex flex-wrap items-center gap-4 px-3 py-2.5 transition-colors hover:bg-olf-darkgreen/5 {expandedId ===
							u.id
								? 'bg-olf-darkgreen/5'
								: ''}"
						>
							<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
							<div class="min-w-0 flex-1">
								<span class="flex items-center gap-1.5">
									<span class="truncate font-supermercado-one text-sm">{u.username}</span>
									{#if u.isFoundingFlock}<span title="Founding flock"
											><Sparkles size={14} class="text-olf-yolk" /></span
										>{/if}
									{#if u.isFarmOwner}<span title="Farm owner (OP)"
											><Crown size={14} class="text-olf-darkgreen" /></span
										>{/if}
									{#if u.isAdmin}<span title="Admin"
											><Shield size={14} class="text-olf-darkbrown" /></span
										>{/if}
								</span>
								<span class="block truncate font-oswald text-xs opacity-70">{u.email}</span>
								{#if u.phoneNumber}
									<span class="block truncate font-oswald text-xxs opacity-50"
										>📱 {u.phoneNumber}</span
									>
								{/if}
							</div>

							<div
								class="hidden items-center gap-4 font-oswald text-xs text-olf-darkgreen/70 md:flex"
							>
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
										<CalendarDays size={13} />{new Date(u.lastOrderAt).toLocaleDateString(
											undefined,
											{
												day: 'numeric',
												month: 'short'
											}
										)}
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
									onclick={() => openExpand(u, 'eggs')}
									aria-label="Expand"
									class="flex size-8 items-center justify-center rounded-lg text-olf-darkgreen hover:bg-olf-darkgreen/10"
								>
									{#if expandedId === u.id}<ChevronDown size={18} />{:else}<ChevronRight
											size={18}
										/>{/if}
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
											onclick={() => (expandTab = 'eggs')}
											class="rounded-full px-3 py-1 font-oswald text-xs font-bold {expandTab ===
											'eggs'
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
									<div class="flex flex-wrap items-center gap-2">
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

								{#if expandTab === 'eggs'}
									<!-- Bulk add records (shared component) -->
									<EggOrderEntry userId={u.id} onsaved={() => onOrdersSaved(u.id)} />

									<!-- Ledger -->
									<div class="mt-4">
										{#if ordersLoading}
											<div class="flex justify-center py-4 text-olf-darkgreen/60"><Spinner /></div>
										{:else if orders.length === 0}
											<p class="font-oswald text-sm text-olf-darkgreen/60">
												No orders recorded yet.
											</p>
										{:else}
											<ul class="flex flex-col gap-1.5">
												{#each orders as o (o.id)}
													<li
														class="flex items-center gap-3 rounded-lg bg-olf-eggshell px-3 py-2 font-oswald text-sm"
													>
														<span class="w-28 shrink-0 tabular-nums"
															>{orderDateLabel(o.orderedAt)}</span
														>
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
												{#each data.plans as p (p.id)}
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
														onclick={() => run(() => admin.pauseUser(u.id))}
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
									{/if}
									<div class="mt-3 flex flex-wrap gap-2 border-t border-olf-darkgreen/15 pt-3">
										<Button
											disabled={busy}
											onclick={() =>
												run(() =>
													admin.setUserFlags(u.id, { isFoundingFlock: !u.isFoundingFlock })
												)}
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
								<p class="px-3 py-4 font-oswald text-xs text-olf-darkgreen/50">
									No admins on this page.
								</p>
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
							<Button
								onclick={() => (addUserOpen = true)}
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
									value={data.orderedOn ?? ''}
									placeholder="Ordered on…"
									align="right"
									onchange={(v) =>
										goto(urlWith({ orderedOn: v || undefined, page: undefined }), {
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

				{#if data.total > 50}
					<div
						class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen"
					>
						{#if data.page > 1}<a href={urlWith({ page: String(data.page - 1) })} class="underline"
								>← Prev</a
							>{/if}
						<span>Page {data.page} of {Math.ceil(data.total / 50)}</span>
						{#if data.page < Math.ceil(data.total / 50)}<a
								href={urlWith({ page: String(data.page + 1) })}
								class="underline">Next →</a
							>{/if}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ─── Eggs view: global egg ledger (accounting) ─── -->
		{#if view === 'eggs'}
			<section class="mt-8 flex flex-col gap-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Eggs ledger</h2>
					<div class="flex flex-wrap items-center gap-2">
						<Button
							onclick={() => (addUserOpen = true)}
							class="flex cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-white"
						>
							<Plus size={14} /> Add user
						</Button>
						<Button
							onclick={exportLedger}
							disabled={ledgerExporting || ledgerTotals.orderCount === 0}
							class="flex cursor-pointer items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
						>
							<Download size={14} /> Export CSV
						</Button>
					</div>
				</div>

				<!-- Summary cards — reflect the ACTIVE filter (set a date range for a period statement). -->
				<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
					{#each [{ label: 'Eggs', value: ledgerTotals.eggs.toLocaleString(), sub: `${(ledgerTotals.eggs / 30).toFixed(1)} boxes` }, { label: 'Revenue', value: moneyRM(ledgerTotals.revenueCents), sub: 'at recorded prices' }, { label: 'Orders', value: ledgerTotals.orderCount.toLocaleString(), sub: 'records' }, { label: 'Avg order', value: `${avgOrderEggs} 🥚`, sub: 'per record' }] as card (card.label)}
						<div class="flex flex-col rounded-2xl bg-olf-beige px-5 py-4 text-olf-darkgreen shadow">
							<span class="font-oswald text-xs tracking-wide uppercase opacity-70"
								>{card.label}</span
							>
							{#if ledgerLoading}
								<span class="flex h-8 items-center text-olf-darkgreen/50"
									><Spinner size={18} /></span
								>
							{:else}
								<span class="font-caveat text-2xl leading-tight tabular-nums">{card.value}</span>
							{/if}
							<span class="font-oswald text-xxs text-olf-darkgreen/55">{card.sub}</span>
						</div>
					{/each}
				</div>

				<!-- Filters -->
				<div class="flex flex-wrap items-end gap-3 rounded-2xl bg-olf-beige/60 p-4">
					<div class="flex flex-col gap-1">
						<span
							class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
							>From</span
						>
						<div class="w-40">
							<DatePicker
								bind:value={ledgerFrom}
								placeholder="Start"
								onchange={() => reloadLedger()}
							/>
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<span
							class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
							>To</span
						>
						<div class="w-40">
							<DatePicker bind:value={ledgerTo} placeholder="End" onchange={() => reloadLedger()} />
						</div>
					</div>
					<div class="flex flex-col gap-1">
						<span
							class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
							>Source</span
						>
						<select bind:value={ledgerSource} onchange={() => reloadLedger()} class={SORT_SELECT}>
							<option value="">All</option>
							<option value="MANUAL">Manual</option>
							<option value="SUBSCRIPTION">Subscription</option>
						</select>
					</div>
					<div class="flex flex-col gap-1">
						<span
							class="font-oswald text-xxs font-bold tracking-wide text-olf-darkgreen/60 uppercase"
							>Group by</span
						>
						<select bind:value={ledgerGroupBy} class={SORT_SELECT}>
							<option value="none">None</option>
							<option value="week">Week</option>
							<option value="month">Month</option>
						</select>
					</div>
					<div class="relative flex-1">
						<Search
							size={16}
							class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-olf-darkgreen/50"
						/>
						<input
							bind:value={ledgerQ}
							oninput={ledgerSearchInput}
							placeholder="search customer"
							aria-label="Search customer"
							class="w-full rounded-lg border border-olf-darkgreen/20 bg-white py-1.5 pr-3 pl-8 font-oswald text-sm text-olf-darkgreen sm:w-56"
						/>
					</div>
					<Button
						onclick={() => {
							addOrderUser = null;
							addOrderOpen = true;
						}}
						class="flex cursor-pointer items-center gap-1.5 rounded-md bg-olf-darkbrown px-3 py-1.5 font-oswald text-xs font-bold text-olf-eggshell"
					>
						<Plus size={14} /> Add egg order
					</Button>
				</div>

				<!-- Row snippet (shared by flat + grouped renders) -->
				{#snippet ledgerRowMarkup(o: AdminEggLedgerRow)}
					{@const dead = !!o.deletedAt}
					<div
						class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_2.5rem] items-center gap-2 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/5 {dead
							? 'opacity-50'
							: ''}"
					>
						<span class="font-oswald text-xs tabular-nums {dead ? 'line-through' : ''}"
							>{orderDateLabel(o.orderedAt)}</span
						>
						<span class="font-oswald text-sm font-bold tabular-nums">{o.eggs}</span>
						<a
							href="/users/{o.userId}"
							target="_blank"
							rel="noopener"
							class="flex min-w-0 items-center gap-2 hover:underline"
						>
							<Avatar animal={o.animal} avatarSeed={o.avatarSeed} gender={o.gender} size="sm" />
							<span class="truncate font-oswald text-sm font-bold {dead ? 'line-through' : ''}"
								>{o.username}</span
							>
						</a>
						<span class="text-right font-oswald text-xs text-olf-darkgreen/70 tabular-nums"
							>{moneyRM(o.unitPriceCents)}</span
						>
						<span class="text-right font-oswald text-xs text-olf-darkgreen/60 tabular-nums"
							>{(o.eggs / 30).toFixed(1)}</span
						>
						<span class="text-right font-oswald text-sm font-bold text-olf-darkgreen tabular-nums"
							>{moneyRM(lineTotal(o))}</span
						>
						{#if dead}
							<button
								type="button"
								onclick={() => restoreOrder(o.id)}
								aria-label="Restore record"
								title="Restore"
								class="flex size-7 items-center justify-center rounded-md text-olf-blue hover:bg-olf-blue/10"
							>
								<RotateCcw size={14} />
							</button>
						{:else}
							<button
								type="button"
								onclick={() => (orderToDelete = o)}
								aria-label="Delete record"
								title="Delete (recoverable)"
								class="flex size-7 items-center justify-center rounded-md text-olf-darkbrown/50 hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown"
							>
								<Trash2 size={14} />
							</button>
						{/if}
					</div>
				{/snippet}

				<!-- Ledger table -->
				<div class="overflow-x-auto rounded-2xl bg-olf-beige shadow">
					<div class="min-w-160">
						<!-- Column headers — click to sort the loaded page by that field. -->
						{#snippet sortTh(label: string, field: LedgerSortField, right = false)}
							<button
								type="button"
								onclick={() => toggleLedgerSort(field)}
								class="flex cursor-pointer items-center gap-0.5 tracking-widest uppercase transition-colors hover:text-olf-darkgreen {right
									? 'justify-end'
									: ''} {ledgerSortField === field ? 'text-olf-darkgreen' : ''}"
							>
								<span>{label}</span>
								{#if ledgerSortField === field}
									{#if ledgerSortDir === 'asc'}<ChevronUp
											size={12}
											class="shrink-0"
										/>{:else}<ChevronDown size={12} class="shrink-0" />{/if}
								{:else}
									<ChevronsUpDown size={12} class="shrink-0 opacity-40" />
								{/if}
							</button>
						{/snippet}
						<div
							class="grid grid-cols-[6.5rem_3.5rem_minmax(8rem,1fr)_4.5rem_3.5rem_5.5rem_2.5rem] items-center gap-2 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
						>
							{@render sortTh('Date', 'date')}
							{@render sortTh('Eggs', 'eggs')}
							{@render sortTh('Customer', 'customer')}
							{@render sortTh('Price', 'unit', true)}
							{@render sortTh('Boxes', 'boxes', true)}
							{@render sortTh('Total', 'total', true)}
							<span class="sr-only">Actions</span>
						</div>

						{#if ledgerLoading}
							<div class="flex justify-center py-8 text-olf-darkgreen/60"><Spinner /></div>
						{:else if ledgerRows.length === 0}
							<p class="px-4 py-8 text-center font-oswald text-sm text-olf-darkgreen/50">
								No egg records for this filter.
							</p>
						{:else if ledgerGroups}
							{#each ledgerGroups as g (g.key)}
								<div
									class="flex items-center justify-between gap-3 bg-olf-darkgreen/8 px-4 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen"
								>
									<span>{g.key}</span>
									<span class="tabular-nums">{g.eggs} 🥚 · {moneyRM(g.revenueCents)}</span>
								</div>
								<div class="divide-y divide-olf-darkgreen/10">
									{#each g.rows as o (o.id)}{@render ledgerRowMarkup(o)}{/each}
								</div>
							{/each}
						{:else}
							<div class="divide-y divide-olf-darkgreen/10">
								{#each sortedLedgerRows as o (o.id)}{@render ledgerRowMarkup(o)}{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- Show-deleted toggle (under the table — affects what the ledger lists) -->
				<label
					class="flex cursor-pointer items-center gap-1.5 self-start font-oswald text-xs text-olf-darkgreen/70"
				>
					<input
						type="checkbox"
						bind:checked={ledgerShowDeleted}
						onchange={() => reloadLedger()}
						class="size-4 rounded text-olf-darkbrown"
					/>
					Show deleted records
				</label>

				{#if ledgerTotal > LEDGER_LIMIT}
					<div
						class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen"
					>
						<button
							type="button"
							disabled={ledgerPage <= 1}
							onclick={() => {
								ledgerPage -= 1;
								void loadLedger();
							}}
							class="underline disabled:opacity-40">← Prev</button
						>
						<span>Page {ledgerPage} of {ledgerPages}</span>
						<button
							type="button"
							disabled={ledgerPage >= ledgerPages}
							onclick={() => {
								ledgerPage += 1;
								void loadLedger();
							}}
							class="underline disabled:opacity-40">Next →</button
						>
					</div>
				{/if}
			</section>
		{/if}

		<!-- ─── Tiers view: per-tier benefit checklist ─── -->
		{#if view === 'tiers'}
			<section class="mt-8 flex flex-col gap-4">
				<div class="flex items-center justify-between gap-3">
					<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Tier benefits</h2>
					<Button
						onclick={openCreatePlan}
						class="flex items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
					>
						<Plus size={14} /> Add tier
					</Button>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each data.plans as p (p.id)}
						{@const selectedIds = checklist[p.id] ?? []}
						{@const selected = data.benefits.filter((b) => selectedIds.includes(b.id))}
						{@const unselected = data.benefits.filter((b) => !selectedIds.includes(b.id))}
						<div class="flex flex-col gap-4 rounded-2xl bg-olf-beige p-5 text-olf-darkgreen shadow">
							{#if editingPlanId === p.id}
								<!-- Edit tier metadata -->
								<div class="flex flex-col gap-3">
									<label
										class="flex flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
									>
										Name
										<input
											bind:value={planName}
											class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
										/>
									</label>
									<div class="flex gap-2">
										<label
											class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
										>
											Eggs
											<input
												type="number"
												min="1"
												bind:value={planEggs}
												class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm tabular-nums"
											/>
										</label>
										<label
											class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
										>
											Cadence
											<select
												bind:value={planCadence}
												class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
											>
												<option value={1}>Weekly</option>
												<option value={2}>Biweekly</option>
											</select>
										</label>
									</div>
									<p class="font-oswald text-xs opacity-60">
										Price: RM{planEggs * 2}
										{planCadence === 1 ? 'weekly' : 'biweekly'} · RM2 per egg
									</p>
									<div class="flex gap-2">
										<Button
											disabled={busy || !planName.trim() || planEggs < 1}
											onclick={() =>
												run(() =>
													admin.updatePlan(p.id, {
														name: planName.trim(),
														eggsPerDelivery: planEggs,
														cadenceWeeks: planCadence,
														priceCents: planEggs * PRICE_PER_EGG_CENTS
													})
												).then(() => (editingPlanId = null))}
											class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
										>
											<Save size={14} /> Save
										</Button>
										<Button
											onclick={() => (editingPlanId = null)}
											class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
										>
											Cancel
										</Button>
									</div>
								</div>
							{:else}
								<div class="flex items-start justify-between gap-2">
									<h3 class="font-oswald text-xl font-light tracking-wide">{p.name}</h3>
									<Button
										onclick={() => openPlanEdit(p)}
										class="flex size-8 shrink-0 items-center justify-center rounded-md text-olf-darkgreen/50 transition-colors hover:bg-olf-darkgreen/10 hover:text-olf-darkgreen"
										aria-label="Edit tier"
									>
										<Pencil size={15} />
									</Button>
								</div>

								<!-- Perk pills: selected (filled) first, the rest faded. Tap to toggle. -->
								<div class="flex flex-wrap gap-x-1 gap-y-2">
									{#each selected as b (b.id)}
										<button
											type="button"
											onclick={() => pillClick(p.id, b)}
											class="rounded-full bg-olf-blue px-3 py-1.5 font-oswald text-xs font-medium text-white transition-transform hover:scale-[1.03] {b.active
												? ''
												: 'line-through opacity-60'}"
										>
											{b.label}
										</button>
									{/each}
									{#each unselected as b (b.id)}
										<button
											type="button"
											onclick={() => pillClick(p.id, b)}
											class="rounded-full border border-olf-darkgreen/30 px-3 py-1 font-oswald text-xs font-bold text-olf-darkgreen/60 opacity-70 transition-all hover:opacity-100 {b.active
												? ''
												: 'border-dashed line-through'}"
										>
											{b.label}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
				<Button
					disabled={busy}
					onclick={() => run(saveAllChecklists)}
					class="flex items-center justify-center gap-1.5 self-start rounded-lg bg-olf-darkgreen px-6 py-2.5 font-oswald text-sm font-bold tracking-wide text-white uppercase disabled:opacity-50"
				>
					<Save size={14} /> Save all tiers
				</Button>
			</section>
		{/if}

		<!-- ─── Benefits view: catalog CRM ─── -->
		{#if view === 'benefits'}
			<section class="mt-8 flex max-w-4xl flex-col gap-4">
				<div class="flex items-end justify-between gap-3">
					<h2 class="font-homemade-apple text-2xl text-olf-darkbrown">Benefits</h2>
					{#if benefitsAutosave.active}
						<span class="flex items-center gap-2 font-oswald text-xs text-olf-darkgreen">
							<span class="tabular-nums">Saving in {benefitsAutosave.secondsLeft}…</span>
							<button
								type="button"
								onclick={() => benefitsAutosave.cancel()}
								class="font-bold text-olf-darkbrown underline-offset-2 hover:underline"
							>
								Cancel
							</button>
						</span>
					{:else}
						<span class="font-oswald text-xs text-olf-darkgreen/50"
							>{data.benefits.length} perks</span
						>
					{/if}
				</div>

				<!-- One panel, header + divided rows + add footer (SaaS settings table). -->
				<div class="overflow-hidden rounded-2xl bg-olf-beige shadow">
					<!-- Column headers -->
					<div
						class="grid grid-cols-[3rem_1fr_5.5rem_auto] items-center gap-3 border-b border-olf-darkgreen/10 bg-olf-darkgreen/5 px-4 py-2.5 font-oswald text-xxs font-bold tracking-widest text-olf-darkgreen/50 uppercase"
					>
						<span class="text-center">#</span>
						<span>Benefit</span>
						<span class="text-center">Active</span>
						<span class="sr-only">Actions</span>
					</div>

					<div class="divide-y divide-olf-darkgreen/10">
						{#each data.benefits as b (b.id)}
							{#if benefitEdits[b.id]}
								<div
									class="grid grid-cols-[3rem_1fr_5.5rem_auto] items-center gap-3 px-4 py-2 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/3"
								>
									<input
										type="number"
										min="1"
										bind:value={benefitEdits[b.id].sortOrder}
										oninput={() => benefitsAutosave.touch()}
										title="Order"
										class="w-12 rounded-md border border-transparent bg-transparent py-1 text-center font-oswald text-sm tabular-nums hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
									/>
									<textarea
										bind:value={benefitEdits[b.id].label}
										oninput={() => benefitsAutosave.touch()}
										use:autosize
										rows="1"
										class="min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm leading-snug hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
									></textarea>
									<!-- Active toggle switch (peer-driven, no JS). -->
									<label class="relative mx-auto inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											bind:checked={benefitEdits[b.id].active}
											onchange={() => benefitsAutosave.touch()}
											class="peer sr-only"
										/>
										<span
											class="h-5 w-9 rounded-full bg-olf-darkgreen/25 transition-colors peer-checked:bg-olf-moss after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4"
										></span>
									</label>
									<Button
										disabled={busy}
										onclick={() => run(() => admin.deleteBenefit(b.id))}
										class="mx-auto flex size-8 items-center justify-center rounded-md text-olf-darkbrown/50 transition-colors hover:bg-olf-darkbrown/10 hover:text-olf-darkbrown disabled:opacity-50"
										aria-label="Delete benefit"
									>
										<Trash2 size={15} />
									</Button>
								</div>
							{/if}
						{/each}

						<!-- Add row — stacks on mobile so the input gets full width -->
						<div
							class="flex flex-col gap-2 bg-olf-darkgreen/3 px-4 py-3 sm:flex-row sm:items-center"
						>
							<div class="flex flex-1 items-center gap-2">
								<Plus size={16} class="shrink-0 text-olf-darkgreen/40" />
								<input
									bind:value={newBenefit}
									placeholder="Add a benefit…"
									onkeydown={(e) => {
										if (e.key === 'Enter' && newBenefit.trim() && !busy)
											run(async () => {
												const ok = await admin.createBenefit(
													newBenefit.trim(),
													data.benefits.length
												);
												if (ok) newBenefit = '';
												return ok;
											});
									}}
									class="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 font-oswald text-sm text-olf-darkgreen hover:border-olf-darkgreen/15 focus:border-olf-darkgreen/30 focus:bg-white focus:outline-none"
								/>
							</div>
							<div class="flex shrink-0 gap-2">
								<Button
									disabled={busy || !newBenefit.trim()}
									onclick={() =>
										run(async () => {
											const ok = await admin.createBenefit(newBenefit.trim(), data.benefits.length);
											if (ok) newBenefit = '';
											return ok;
										})}
									class="flex items-center gap-1.5 rounded-md border-2 border-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-40"
								>
									<Plus size={14} /> Add
								</Button>
								<Button
									disabled={busy || !benefitsDirty}
									onclick={() => {
										benefitsAutosave.cancel();
										return run(saveAllBenefits);
									}}
									class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-40"
								>
									<Save size={14} /> Save changes
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</main>

	<!-- Add user modal (pre-register by email + magic link); reused across panels -->
	<AddUserModal bind:open={addUserOpen} oncreated={() => invalidateAll()} />

	<!-- Add egg order modal (pick a customer, then log records) -->
	<dialog
		bind:this={addOrderDialog}
		onclose={() => (addOrderOpen = false)}
		onclick={(e) => {
			if (e.target === addOrderDialog) addOrderOpen = false;
		}}
		class="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		<div class="flex flex-col gap-4 p-6">
			<div class="flex items-start justify-between gap-4">
				<h2 class="font-homemade-apple text-xl">Add egg order</h2>
				<button
					type="button"
					aria-label="Close"
					onclick={() => (addOrderOpen = false)}
					class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
				>
					<X size={22} />
				</button>
			</div>

			<div
				class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
			>
				<span>Customer</span>
				<UserPicker bind:value={addOrderUser} users={data.users} />
			</div>

			{#if addOrderUser}
				<div
					in:fade={{ duration: 150, easing: sineIn }}
					class="rounded-lg border border-olf-darkgreen/15 bg-olf-eggshell/60 p-3"
				>
					<EggOrderEntry
						userId={addOrderUser.id}
						onsaved={async (count) => {
							addOrderOpen = false;
							toasts.push({
								title: count === 1 ? 'Egg order added!' : `${count} egg orders added!`
							});
							await loadLedger();
							await invalidateAll();
						}}
					/>
				</div>
			{:else}
				<p class="font-oswald text-sm text-olf-darkgreen/60">
					Pick a customer to start logging eggs.
				</p>
			{/if}
		</div>
	</dialog>

	<!-- Delete egg record confirmation (soft delete — recoverable) -->
	<dialog
		bind:this={confirmDeleteOrderDialog}
		onclose={() => (orderToDelete = null)}
		onclick={(e) => {
			if (e.target === confirmDeleteOrderDialog) orderToDelete = null;
		}}
		class="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		{#if orderToDelete}
			<div class="flex flex-col gap-4 p-6">
				<h2 class="font-homemade-apple text-xl text-olf-darkbrown">
					Are you sure you want to delete?
				</h2>
				<p class="font-oswald text-sm text-olf-darkgreen/80">
					Delete the <b>🥚 {orderToDelete.eggs}</b> record for
					<b>{orderToDelete.username}</b> on {orderDateLabel(orderToDelete.orderedAt)}? You can
					restore it later from the deleted records.
				</p>
				<div class="flex justify-end gap-2">
					<Button
						onclick={() => (orderToDelete = null)}
						class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
					>
						Cancel
					</Button>
					<Button
						onclick={confirmDeleteOrder}
						class="flex items-center gap-1.5 rounded-md bg-olf-red px-4 py-1.5 font-oswald text-xs font-bold text-olf-eggshell"
					>
						<Trash2 size={14} /> Delete
					</Button>
				</div>
			</div>
		{/if}
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

	<!-- New tier modal (opened by "Add tier") -->
	<dialog
		bind:this={createDialog}
		onclose={() => (creatingPlan = false)}
		onclick={(e) => {
			if (e.target === createDialog) creatingPlan = false;
		}}
		class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		<div class="flex flex-col gap-4 p-6">
			<div class="flex items-start justify-between gap-4">
				<h2 class="font-supermercado-one text-xl">New tier</h2>
				<button
					type="button"
					aria-label="Close"
					onclick={() => (creatingPlan = false)}
					class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
				>
					<X size={22} />
				</button>
			</div>
			<label
				class="flex flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
			>
				Name
				<input
					bind:value={newPlanName}
					placeholder="e.g. 90 Eggs / week"
					class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
				/>
			</label>
			<div class="flex gap-2">
				<label
					class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
				>
					Eggs
					<input
						type="number"
						min="1"
						bind:value={newPlanEggs}
						class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm tabular-nums"
					/>
				</label>
				<label
					class="flex flex-1 flex-col gap-1 font-oswald text-xs tracking-wide text-olf-darkgreen/70 uppercase"
				>
					Cadence
					<select
						bind:value={newPlanCadence}
						class="w-full rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
					>
						<option value={1}>Weekly</option>
						<option value={2}>Biweekly</option>
					</select>
				</label>
			</div>
			<p class="font-oswald text-xs opacity-60">
				Price: RM{newPlanEggs * 2}
				{newPlanCadence === 1 ? 'weekly' : 'biweekly'} · RM2 per egg
			</p>
			<div class="flex justify-end gap-2">
				<Button
					onclick={() => (creatingPlan = false)}
					class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
				>
					Cancel
				</Button>
				<Button
					disabled={busy || !newPlanName.trim() || newPlanEggs < 1}
					onclick={() =>
						run(() =>
							admin.createPlan({
								name: newPlanName.trim(),
								eggsPerDelivery: newPlanEggs,
								cadenceWeeks: newPlanCadence,
								priceCents: newPlanEggs * PRICE_PER_EGG_CENTS
							})
						).then(() => (creatingPlan = false))}
					class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
				>
					<Plus size={14} /> Create
				</Button>
			</div>
		</div>
	</dialog>

	<!-- Disabled-perk modal (clicking a faded/inactive perk pill) -->
	<dialog
		bind:this={disabledDialog}
		onclose={() => (disabledPerk = null)}
		onclick={(e) => {
			if (e.target === disabledDialog) disabledPerk = null;
		}}
		class="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		{#if disabledPerk}
			<div class="flex flex-col gap-4 p-6">
				<h2 class="font-supermercado-one text-xl">This perk is off 🥚</h2>
				<p class="font-oswald text-sm">
					“{disabledPerk}” is disabled in the benefit catalog, so subscribers won't see it. Turn it
					back on in Benefits first.
				</p>
				<div class="flex justify-end gap-2">
					<Button
						onclick={() => (disabledPerk = null)}
						class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
					>
						Close
					</Button>
					<Button
						onclick={() => {
							disabledPerk = null;
							goto(urlWith({ view: 'benefits' }), { noScroll: true });
						}}
						class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white"
					>
						<Gift size={14} /> Open benefits
					</Button>
				</div>
			</div>
		{/if}
	</dialog>
</div>
