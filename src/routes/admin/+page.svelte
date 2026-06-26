<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll, goto } from '$app/navigation';
	import Avatar from '$lib/components/Avatar.svelte';
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
		Trash2,
		Save,
		X,
		ChevronDown,
		ChevronRight,
		Users as UsersIcon,
		Layers,
		Gift
	} from '@lucide/svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import Button from '$lib/components/Button.svelte';
	import * as admin from '$lib/api/admin';
	import type { AdminUserRow } from '@meteorclass/pigweed-contract';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Which dashboard section is showing.
	let view = $state<'users' | 'tiers' | 'benefits'>('users');

	let busy = $state(false);

	// Debounced live search — typing updates the ?q= URL (which re-runs the
	// server load) 200ms after the last keystroke. No button needed.
	let searchQ = $state(untrack(() => data.q));
	let searching = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			const q = searchQ.trim();
			searching = true;
			try {
				await goto(q ? `/admin?q=${encodeURIComponent(q)}` : '/admin', {
					keepFocus: true,
					replaceState: true,
					noScroll: true
				});
			} finally {
				searching = false;
			}
		}, 200);
	}
	async function run(fn: () => Promise<boolean>) {
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

	// ─── Per-user manage MODAL ──────────────────────────────────────
	// The row's "subscribed" checkbox + Manage button both OPEN this modal —
	// they never toggle the subscription directly. Subscribing/unsubscribing
	// happens inside the modal; the checkbox then reflects the fresh state.
	let manageId = $state<string | null>(null);
	const manageUser = $derived(manageId ? (data.users.find((u) => u.id === manageId) ?? null) : null);
	let formPlanId = $state('');
	let formStart = $state('');
	let formDay = $state(4);

	function openManage(u: AdminUserRow) {
		manageId = u.id;
		formPlanId = u.subscription?.plan.id ?? data.plans[0]?.id ?? '';
		formStart = (u.subscription?.startedAt ?? new Date().toISOString()).slice(0, 10);
		formDay = u.subscription?.deliveryDay ?? 4;
	}
	const closeManage = () => (manageId = null);

	// Drive the native <dialog> from manageUser, both directions.
	let manageDialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!manageDialog) return;
		if (manageUser && !manageDialog.open) manageDialog.showModal();
		else if (!manageUser && manageDialog.open) manageDialog.close();
	});

	// Split into admins (their own collapsed group — rarely touched) and
	// everyone else (the day-to-day group, open by default).
	const admins = $derived(data.users.filter((u) => u.isAdmin));
	const regular = $derived(data.users.filter((u) => !u.isAdmin));
	let adminsOpen = $state(false);
	let usersOpen = $state(true);

	const statusClass = (s?: string) =>
		s === 'ACTIVE'
			? 'bg-olf-moss text-white'
			: s === 'PAUSED'
				? 'bg-olf-yolk text-olf-darkgreen'
				: 'bg-olf-darkbrown/60 text-olf-beige';

	// ─── Benefits CRM (editable copies) ─────────────────────────────
	let benefitEdits = $state<Record<string, { label: string; sortOrder: number; active: boolean }>>({});
	let newBenefit = $state('');
	$effect(() => {
		const next: Record<string, { label: string; sortOrder: number; active: boolean }> = {};
		for (const b of data.benefits) next[b.id] = { label: b.label, sortOrder: b.sortOrder, active: b.active };
		benefitEdits = next;
	});

	// ─── Per-tier benefit checklist (local checked sets) ────────────
	let checklist = $state<Record<string, string[]>>({});
	$effect(() => {
		const next: Record<string, string[]> = {};
		for (const p of data.plans) next[p.id] = [...p.benefitIds];
		checklist = next;
	});
	function toggleBenefit(planId: string, benefitId: string) {
		const set = new Set(checklist[planId] ?? []);
		if (set.has(benefitId)) set.delete(benefitId);
		else set.add(benefitId);
		checklist[planId] = [...set];
	}

	const NAV = [
		{ id: 'users', label: 'Users', icon: UsersIcon },
		{ id: 'tiers', label: 'Tiers', icon: Layers },
		{ id: 'benefits', label: 'Benefits', icon: Gift }
	] as const;
</script>

<svelte:head><title>Admin · Our Little Farm</title></svelte:head>

<div class="flex flex-1 bg-olf-lightgreen">
	<!-- Sidebar -->
	<aside class="flex w-16 shrink-0 flex-col gap-2 bg-olf-darkgreen px-2 py-6 text-olf-beige sm:w-52 sm:px-4">
		<p class="hidden px-2 pb-4 font-homemade-apple text-3xl text-olf-yolk sm:block">Admin</p>
		<span class="pb-4 text-center text-2xl sm:hidden">🥚</span>
		{#each NAV as item (item.id)}
			{@const Icon = item.icon}
			<Button
				onclick={() => (view = item.id)}
				class="flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 font-oswald text-sm font-bold tracking-wide transition-colors sm:justify-start {view ===
				item.id
					? 'bg-olf-yolk text-olf-darkgreen'
					: 'text-olf-beige/70 hover:bg-olf-beige/10'}"
				title={item.label}
			>
				<Icon size={18} class="shrink-0" />
				<span class="hidden sm:inline">{item.label}</span>
			</Button>
		{/each}
	</aside>

	<!-- Main -->
	<main class="min-w-0 flex-1 px-4 py-8 sm:px-8">
		<!-- Stat strip -->
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
			{#each [{ label: 'Users', value: data.stats.totalUsers, icon: UsersIcon }, { label: 'Subscribers', value: data.stats.activeSubscribers, icon: Egg }, { label: 'Posts', value: data.stats.totalPosts, icon: FileText }, { label: 'Reviews', value: data.stats.totalReviews, icon: Star }] as s (s.label)}
				{@const Icon = s.icon}
				<div class="flex items-center gap-3 rounded-2xl bg-olf-beige px-5 py-4 text-olf-darkgreen shadow">
					<span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen text-olf-darkgreen">
						<Icon size={20} />
					</span>
					<div class="flex flex-col">
						<span class="font-oswald text-xs uppercase tracking-wide opacity-60">{s.label}</span>
						<span class="font-supermercado-one text-2xl tabular-nums leading-none">{s.value}</span>
					</div>
				</div>
			{/each}
		</div>

		<!-- ─── Users view ─── -->
		{#if view === 'users'}
			<section class="mt-8 flex flex-col gap-4">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="font-supermercado-one text-2xl text-olf-darkbrown">Users</h2>
					<div class="flex w-full items-center gap-2 sm:w-auto">
						<span class="flex size-5 shrink-0 items-center justify-center text-olf-darkgreen {searching ? '' : 'invisible'}">
							<Spinner size={18} label="Searching" />
						</span>
						<div class="relative flex-1 sm:flex-none">
							<Search size={16} class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-olf-darkgreen/50" />
							<input
								bind:value={searchQ}
								oninput={onSearchInput}
								placeholder="search name / email"
								aria-label="Search users"
								class="w-full rounded-lg border border-olf-darkgreen/20 bg-olf-beige py-1.5 pr-3 pl-8 font-oswald text-sm text-olf-darkgreen sm:w-64"
							/>
						</div>
					</div>
				</div>

				{#snippet userRow(u: AdminUserRow)}
					<div class="rounded-xl bg-olf-beige text-olf-darkgreen shadow">
						<div class="flex flex-wrap items-center gap-4 p-3">
							<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
							<div class="min-w-0 flex-1">
								<span class="flex items-center gap-1.5">
									<span class="truncate font-supermercado-one text-sm">{u.username}</span>
									{#if u.isFoundingFlock}<span title="Founding flock"><Sparkles size={14} class="text-olf-yolk" /></span>{/if}
									{#if u.isFarmOwner}<span title="Farm owner (OP)"><Crown size={14} class="text-olf-darkgreen" /></span>{/if}
									{#if u.isAdmin}<span title="Admin"><Shield size={14} class="text-olf-darkbrown" /></span>{/if}
								</span>
								<span class="block truncate font-oswald text-xs opacity-60">{u.email}</span>
							</div>

							<div class="hidden items-center gap-4 font-oswald text-xs opacity-70 md:flex">
								<span class="flex items-center gap-1" title="Posts"><FileText size={13} />{u.postCount}</span>
								<span class="flex items-center gap-1" title="Reviews"><Star size={13} />{u.reviewCount}</span>
								<span class="flex items-center gap-1" title="Comments"><MessageSquare size={13} />{u.commentCount}</span>
							</div>

							<div class="flex flex-wrap items-center justify-end gap-3">
								<!-- Checkbox reflects subscribed state and OPENS the modal (never
								     toggles directly). preventDefault keeps it bound to data. -->
								<label class="flex cursor-pointer items-center gap-1.5 font-oswald text-xs">
									<input
										type="checkbox"
										checked={u.subscription?.status === 'ACTIVE'}
										onclick={(e) => {
											e.preventDefault();
											openManage(u);
										}}
										class="size-4 accent-olf-darkgreen"
									/>
									subscribed
								</label>
								<!-- Farm owner toggles directly (unlike subscribed, which opens the modal). -->
								<label class="flex cursor-pointer items-center gap-1.5 font-oswald text-xs">
									<input
										type="checkbox"
										checked={u.isFarmOwner}
										disabled={busy}
										onchange={() => run(() => admin.setUserFlags(u.id, { isFarmOwner: !u.isFarmOwner }))}
										class="size-4 accent-olf-darkgreen"
									/>
									farm owner
								</label>
								{#if u.subscription}
									<span class="rounded-full px-2 py-0.5 font-oswald text-xxs font-bold uppercase tracking-wider {statusClass(u.subscription.status)}">
										{u.subscription.plan.name}
									</span>
								{/if}
								<Button
									onclick={() => openManage(u)}
									class="rounded-lg bg-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-white"
								>
									Manage
								</Button>
							</div>
						</div>
					</div>
				{/snippet}

				<!-- Admins (collapsed by default) -->
				<div class="flex flex-col gap-2">
					<Button
						onclick={() => (adminsOpen = !adminsOpen)}
						class="flex items-center gap-2 font-oswald text-sm font-bold tracking-wide text-olf-darkbrown uppercase"
					>
						{#if adminsOpen}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
						Admins ({admins.length})
					</Button>
					{#if adminsOpen}
						{#each admins as u (u.id)}{@render userRow(u)}{/each}
						{#if admins.length === 0}
							<p class="px-2 font-oswald text-xs text-olf-darkgreen/50">No admins on this page.</p>
						{/if}
					{/if}
				</div>

				<!-- Users (open by default) -->
				<div class="flex flex-col gap-2">
					<Button
						onclick={() => (usersOpen = !usersOpen)}
						class="flex items-center gap-2 font-oswald text-sm font-bold tracking-wide text-olf-darkbrown uppercase"
					>
						{#if usersOpen}<ChevronDown size={16} />{:else}<ChevronRight size={16} />{/if}
						Users ({regular.length})
					</Button>
					{#if usersOpen}
						{#each regular as u (u.id)}{@render userRow(u)}{/each}
						{#if regular.length === 0}
							<p class="px-2 font-oswald text-xs text-olf-darkgreen/50">No users found.</p>
						{/if}
					{/if}
				</div>

				{#if data.total > 50}
					<div class="flex items-center justify-center gap-4 font-oswald text-sm text-olf-darkgreen">
						{#if data.page > 1}<a href="/admin?q={data.q}&page={data.page - 1}" class="underline">← Prev</a>{/if}
						<span>Page {data.page} of {Math.ceil(data.total / 50)}</span>
						{#if data.page < Math.ceil(data.total / 50)}<a href="/admin?q={data.q}&page={data.page + 1}" class="underline">Next →</a>{/if}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ─── Tiers view: per-tier benefit checklist ─── -->
		{#if view === 'tiers'}
			<section class="mt-8 flex flex-col gap-4">
				<h2 class="font-supermercado-one text-2xl text-olf-darkbrown">Tier benefits</h2>
				<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{#each data.plans as p (p.id)}
						<div class="flex flex-col gap-3 rounded-2xl bg-olf-beige p-5 text-olf-darkgreen shadow">
							<h3 class="font-supermercado-one text-lg">{p.name}</h3>
							<ul class="flex flex-col gap-1.5">
								{#each data.benefits as b (b.id)}
									<li>
										<label class="flex items-start gap-2 font-oswald text-sm">
											<input
												type="checkbox"
												checked={(checklist[p.id] ?? []).includes(b.id)}
												onchange={() => toggleBenefit(p.id, b.id)}
												class="mt-1 accent-olf-darkgreen"
											/>
											<span class={b.active ? '' : 'opacity-40 line-through'}>{b.label}</span>
										</label>
									</li>
								{/each}
							</ul>
							<Button
								disabled={busy}
								onclick={() => run(() => admin.setPlanBenefits(p.id, checklist[p.id] ?? []))}
								class="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-olf-darkgreen py-2 font-oswald text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
							>
								<Save size={14} /> Save checklist
							</Button>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ─── Benefits view: catalog CRM ─── -->
		{#if view === 'benefits'}
			<section class="mt-8 flex max-w-3xl flex-col gap-4">
				<h2 class="font-supermercado-one text-2xl text-olf-darkbrown">Benefit catalog</h2>
				<div class="flex flex-col gap-2">
					{#each data.benefits as b (b.id)}
						{#if benefitEdits[b.id]}
							<div class="flex flex-wrap items-center gap-2 rounded-xl bg-olf-beige p-2.5 text-olf-darkgreen shadow">
								<input
									bind:value={benefitEdits[b.id].label}
									class="min-w-0 flex-1 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm"
								/>
								<input
									type="number"
									bind:value={benefitEdits[b.id].sortOrder}
									title="Sort order"
									class="w-16 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm tabular-nums"
								/>
								<label class="flex items-center gap-1 font-oswald text-xs">
									<input type="checkbox" bind:checked={benefitEdits[b.id].active} class="accent-olf-darkgreen" /> active
								</label>
								<Button
									disabled={busy}
									onclick={() => run(() => admin.updateBenefit(b.id, benefitEdits[b.id]))}
									class="rounded-lg bg-olf-darkgreen px-3 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
								>
									Save
								</Button>
								<Button
									disabled={busy}
									onclick={() => run(() => admin.deleteBenefit(b.id))}
									class="flex size-8 items-center justify-center rounded-lg bg-olf-darkbrown/70 text-olf-beige disabled:opacity-50"
									aria-label="Delete benefit"
								>
									<Trash2 size={15} />
								</Button>
							</div>
						{/if}
					{/each}

					<div class="flex items-center gap-2 rounded-xl bg-olf-beige/60 p-2.5">
						<input
							bind:value={newBenefit}
							placeholder="New benefit…"
							class="min-w-0 flex-1 rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm text-olf-darkgreen"
						/>
						<Button
							disabled={busy || !newBenefit.trim()}
							onclick={() =>
								run(async () => {
									const ok = await admin.createBenefit(newBenefit.trim(), data.benefits.length);
									if (ok) newBenefit = '';
									return ok;
								})}
							class="flex items-center gap-1.5 rounded-lg bg-olf-darkgreen px-3 py-2 font-oswald text-xs font-bold text-white disabled:opacity-50"
						>
							<Plus size={14} /> Add
						</Button>
					</div>
				</div>
			</section>
		{/if}
	</main>

	<!-- Manage modal (opened by the row checkbox / Manage button) -->
	<dialog
		bind:this={manageDialog}
		onclose={closeManage}
		onclick={(e) => {
			if (e.target === manageDialog) closeManage();
		}}
		class="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
	>
		{#if manageUser}
			<div class="flex flex-col gap-5 p-6">
				<div class="flex items-start justify-between gap-4">
					<div class="flex items-center gap-2.5">
						<Avatar animal={manageUser.animal} avatarSeed={manageUser.avatarSeed} gender={manageUser.gender} size="sm" />
						<div class="flex min-w-0 flex-col">
							<span class="truncate font-supermercado-one">{manageUser.username}</span>
							<span class="truncate font-oswald text-xs opacity-60">{manageUser.email}</span>
						</div>
					</div>
					<Button type="button" aria-label="Close" onclick={closeManage} class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen">
						<X size={22} />
					</Button>
				</div>

				<!-- Subscription / backfill -->
				<div class="flex flex-wrap items-end gap-3">
					<label class="flex flex-col gap-1 font-oswald text-xs uppercase tracking-wide opacity-70">
						Tier
						<select bind:value={formPlanId} class="rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case">
							{#each data.plans as p (p.id)}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1 font-oswald text-xs uppercase tracking-wide opacity-70">
						Started
						<input type="date" bind:value={formStart} class="rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case" />
					</label>
					<label class="flex flex-col gap-1 font-oswald text-xs uppercase tracking-wide opacity-70">
						Delivery day
						<select bind:value={formDay} class="rounded-lg border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case">
							{#each DAYS as d (d)}<option value={d}>{dayName(d)}</option>{/each}
						</select>
					</label>
					<Button
						disabled={busy || !formPlanId}
						onclick={() =>
							run(() =>
								admin.subscribeUserTier(manageUser!.id, formPlanId, {
									startedAt: formStart ? new Date(formStart).toISOString() : undefined,
									deliveryDay: formDay
								})
							)}
						class="flex items-center gap-1.5 rounded-lg bg-olf-darkbrown px-4 py-2 font-oswald text-xs font-bold uppercase tracking-wide text-olf-beige disabled:opacity-50"
					>
						{manageUser.subscription ? 'Update' : 'Subscribe'}
					</Button>
				</div>

				<!-- Subscription lifecycle -->
				{#if manageUser.subscription}
					<div class="flex flex-wrap gap-2">
						{#if manageUser.subscription.status === 'PAUSED'}
							<Button disabled={busy} onclick={() => run(() => admin.resumeUser(manageUser!.id))} class="flex items-center gap-1.5 rounded-lg bg-olf-moss px-3 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50">Resume</Button>
						{:else}
							<Button disabled={busy} onclick={() => run(() => admin.pauseUser(manageUser!.id))} class="flex items-center gap-1.5 rounded-lg bg-olf-yolk px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen disabled:opacity-50">Pause</Button>
						{/if}
						<Button disabled={busy} onclick={() => run(() => admin.unsubscribeUser(manageUser!.id))} class="flex items-center gap-1.5 rounded-lg bg-olf-darkbrown/70 px-3 py-1.5 font-oswald text-xs font-bold text-olf-beige disabled:opacity-50">Unsubscribe</Button>
					</div>
				{/if}

				<!-- Flairs / roles -->
				<div class="flex flex-wrap gap-2 border-t border-olf-darkgreen/15 pt-4">
					<Button disabled={busy} onclick={() => run(() => admin.setUserFlags(manageUser!.id, { isFoundingFlock: !manageUser!.isFoundingFlock }))} class="flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 font-oswald text-xs font-bold {manageUser.isFoundingFlock ? 'border-olf-yolk bg-olf-yolk text-olf-darkgreen' : 'border-olf-darkgreen/25 text-olf-darkgreen'} disabled:opacity-50">
						<Sparkles size={14} /> Founding flock
					</Button>
				</div>
			</div>
		{/if}
	</dialog>
</div>
