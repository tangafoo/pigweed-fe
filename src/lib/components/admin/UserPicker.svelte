<script lang="ts">
	import { Search, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';
	import { sineOut } from 'svelte/easing';
	import Avatar from '$lib/components/ui/Avatar.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import * as admin from '$lib/api/admin';
	import type { AdminUserRow } from '@meteorclass/pigweed-contract';

	export interface UserPickerProps {
		/** Local list for instant client-side filtering (the loaded admin page). */
		users?: AdminUserRow[];
		/** The picked user (bindable). When set, shows a chip with a clear button. */
		value?: AdminUserRow | null;
		/** Fires on pick (in addition to updating `value`). */
		onselect?: (u: AdminUserRow) => void;
		/** Also query the BE (debounced) to reach users beyond the loaded page. */
		serverSearch?: boolean;
		/** Don't retain the selection — clears after pick so the caller owns display. */
		clearOnSelect?: boolean;
		placeholder?: string;
		/** Max results shown in the dropdown. */
		limit?: number;
	}

	let {
		users = [],
		value = $bindable(null),
		onselect,
		serverSearch = true,
		clearOnSelect = false,
		placeholder = 'search name / email',
		limit = 8
	}: UserPickerProps = $props();

	let q = $state('');
	let serverResults = $state<AdminUserRow[]>([]);
	let searching = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	// Instant client-side filter over the loaded list (no round-trip).
	const localResults = $derived.by(() => {
		const term = q.trim().toLowerCase();
		if (!term) return [];
		return users.filter(
			(u) => u.username.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)
		);
	});

	// Merge local + server hits, dedupe by id, cap at `limit`.
	const results = $derived.by(() => {
		const seen = new Set<string>();
		const out: AdminUserRow[] = [];
		for (const u of [...localResults, ...serverResults]) {
			if (seen.has(u.id)) continue;
			seen.add(u.id);
			out.push(u);
			if (out.length >= limit) break;
		}
		return out;
	});

	// Debounced server search to reach users beyond the loaded page.
	function onInput() {
		serverResults = [];
		clearTimeout(timer);
		const term = q.trim();
		if (!serverSearch || !term) {
			searching = false;
			return;
		}
		searching = true;
		timer = setTimeout(async () => {
			try {
				const res = await admin.fetchAdminUsers(term, 1, '');
				// Ignore a stale response if the box changed while in flight.
				if (q.trim() === term) serverResults = res.data.users;
			} finally {
				if (q.trim() === term) searching = false;
			}
		}, 200);
	}

	function pick(u: AdminUserRow) {
		onselect?.(u);
		value = clearOnSelect ? null : u;
		q = '';
		serverResults = [];
		searching = false;
	}

	function clear() {
		value = null;
		q = '';
		serverResults = [];
	}
</script>

{#if value}
	<div class="flex items-center justify-between gap-2 rounded-lg bg-olf-darkgreen/10 px-2 py-1.5">
		<span class="flex min-w-0 items-center gap-2">
			<Avatar animal={value.animal} avatarSeed={value.avatarSeed} gender={value.gender} size="sm" />
			<span class="min-w-0">
				<span class="block truncate font-oswald text-sm font-bold text-olf-darkgreen"
					>{value.username}</span
				>
				<span class="block truncate font-oswald text-xxs text-olf-darkgreen/60">{value.email}</span>
			</span>
		</span>
		<button
			type="button"
			onclick={clear}
			aria-label="Clear"
			class="shrink-0 cursor-pointer text-olf-darkgreen/50 hover:text-olf-darkgreen"
		>
			<X size={16} />
		</button>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		<div class="relative">
			<Search
				size={14}
				class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-olf-darkgreen/50"
			/>
			<input
				bind:value={q}
				oninput={onInput}
				{placeholder}
				class="w-full rounded-lg border border-olf-darkgreen/20 bg-white py-2 pr-9 pl-8 font-oswald text-sm text-olf-darkgreen"
			/>
			{#if searching}
				<span class="absolute top-1/2 right-2.5 -translate-y-1/2 text-olf-darkgreen/50">
					<Spinner size={14} />
				</span>
			{/if}
		</div>
		{#if results.length}
			<ul class="flex flex-col gap-0.5">
				{#each results as u, i (u.id)}
					<li in:fly={{ y: 6, duration: 180, delay: i * 35, easing: sineOut }}>
						<button
							type="button"
							onclick={() => pick(u)}
							class="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-olf-darkgreen/10"
						>
							<Avatar animal={u.animal} avatarSeed={u.avatarSeed} gender={u.gender} size="sm" />
							<span class="min-w-0 flex-1">
								<span class="block truncate font-oswald text-xs font-bold text-olf-darkgreen"
									>{u.username}</span
								>
								<span class="block truncate font-oswald text-xxs text-olf-darkgreen/60"
									>{u.email}</span
								>
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{:else if q.trim() && !searching}
			<p class="px-1 font-oswald text-xxs text-olf-darkgreen/50">No matches.</p>
		{/if}
	</div>
{/if}
