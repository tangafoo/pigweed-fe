<script lang="ts">
	import { X, Plus, RefreshCw, Egg } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import { sineIn } from 'svelte/easing';
	import Button from '$lib/components/ui/Button.svelte';
	import EggOrderEntry from '$lib/components/admin/EggOrderEntry.svelte';
	import * as admin from '$lib/api/admin';
	import type { RegisterUserResult } from '$lib/api/admin';
	import type { AdminBox } from '$lib/components/admin/shared.svelte';

	// Pre-register a user from an email + magic link. Reused by the Users panel
	// and the Eggs panel. After a successful create (or when the email already
	// existed), offers to log egg orders for that user inline.
	let {
		open = $bindable(false),
		boxes = [],
		oncreated
	}: { open?: boolean; boxes?: AdminBox[]; oncreated?: () => void } = $props();

	let email = $state('');
	let username = $state('');
	let animal = $state('');
	let gender = $state('UNDISCLOSED');
	let result = $state<RegisterUserResult | null>(null);
	let error = $state('');
	let busy = $state(false);
	let generating = $state(false);
	let loggingEggs = $state(false);

	// Once the admin hand-edits the username, stop auto-deriving it from the email.
	let usernameLocked = $state(false);
	let emailTimer: ReturnType<typeof setTimeout>;

	function resetFields() {
		email = '';
		username = '';
		animal = '';
		gender = 'UNDISCLOSED';
		result = null;
		error = '';
		usernameLocked = false;
		loggingEggs = false;
		rerollIdentity();
	}

	// Email → username, automatically (debounced). Skipped once hand-edited.
	function onEmailInput() {
		clearTimeout(emailTimer);
		emailTimer = setTimeout(async () => {
			if (usernameLocked || !email.includes('@')) return;
			generating = true;
			try {
				const r = await admin.previewIdentity(email.trim());
				if (r) username = r.username;
			} finally {
				generating = false;
			}
		}, 350);
	}

	// Reroll a fresh RANDOM username + animal.
	async function rerollIdentity() {
		if (generating) return;
		generating = true;
		try {
			const r = await admin.previewIdentity('');
			if (r) {
				username = r.username;
				animal = r.animal;
			}
		} finally {
			generating = false;
		}
	}

	async function submit() {
		if (busy || !email.trim()) return;
		busy = true;
		error = '';
		try {
			const r = await admin.registerUser({
				email: email.trim(),
				username: username.trim() || undefined,
				gender,
				animal: animal || undefined
			});
			if ('error' in r) error = r.error;
			else {
				result = r;
				oncreated?.();
			}
		} finally {
			busy = false;
		}
	}

	let dialog = $state<HTMLDialogElement>();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			resetFields();
			dialog.showModal();
		} else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-olf-beige text-olf-darkgreen backdrop:bg-olf-darkgreen/60"
>
	<div class="flex flex-col gap-4 p-6">
		<div class="flex items-start justify-between gap-4">
			<h2 class="font-homemade-apple text-xl">Add user</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={() => (open = false)}
				class="shrink-0 text-olf-darkgreen/60 hover:text-olf-darkgreen"
			>
				<X size={22} />
			</button>
		</div>

		{#if result}
			<!-- Success state -->
			<div class="flex flex-col gap-3">
				<p class="font-oswald text-sm">
					{result.existed ? 'That email already had an account.' : 'Registered!'} A magic-link sign-in
					was emailed to <b>{email}</b> — they can leave a review straight away. ⭐
				</p>
				<div class="rounded-lg bg-olf-darkgreen/5 px-4 py-3 font-oswald text-sm">
					They join as <b>{result.username}</b>, a <b>{result.animal.toLowerCase()}</b> 🐣
				</div>

				<!-- Log egg orders for this freshly added / existing user -->
				<button
					type="button"
					onclick={() => (loggingEggs = !loggingEggs)}
					class="flex w-fit cursor-pointer items-center gap-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
				>
					<Egg size={14} class="shrink-0" />
					{loggingEggs ? 'Hide egg records' : 'Add eggs this user bought?'}
				</button>
				{#if loggingEggs}
					<div
						in:fade={{ duration: 150, easing: sineIn }}
						class="rounded-lg border border-olf-darkgreen/15 bg-olf-eggshell/60 p-3"
					>
						<EggOrderEntry userId={result.id} {boxes} onsaved={() => oncreated?.()} />
					</div>
				{/if}

				<div class="flex justify-end">
					<Button
						onclick={() => (open = false)}
						class="rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white"
					>
						Done
					</Button>
				</div>
			</div>
		{:else}
			<p class="font-oswald text-sm text-olf-darkgreen/80">
				Enter an email — we'll suggest a username from it. Reroll for a random one. We pre-register
				them and email a one-click magic-link login.
			</p>
			<label
				class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
			>
				Email
				<input
					type="email"
					bind:value={email}
					oninput={onEmailInput}
					placeholder="name@email.com"
					class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
				/>
			</label>

			<!-- Generated identity (reroll to confirm before sending) -->
			<div class="flex flex-col gap-1.5">
				<span class="font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
					>Generated identity</span
				>
				<div class="flex items-center gap-2">
					<input
						bind:value={username}
						oninput={() => (usernameLocked = true)}
						placeholder="username"
						class="min-w-0 flex-1 rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 font-oswald text-sm"
					/>
					<button
						type="button"
						onclick={rerollIdentity}
						disabled={generating}
						aria-label="Reroll username + animal"
						title="Reroll random"
						class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-olf-darkgreen/10 text-olf-darkgreen transition-colors hover:bg-olf-darkgreen/20 disabled:opacity-50"
					>
						<RefreshCw size={16} class={generating ? 'animate-spin' : ''} />
					</button>
					{#if animal}
						<span
							class="shrink-0 rounded-full bg-olf-lightgreen px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen"
						>
							{animal.toLowerCase()}
						</span>
					{/if}
				</div>
			</div>

			<label
				class="flex flex-col gap-1 font-oswald text-xs font-bold tracking-wide text-olf-darkgreen/80 uppercase"
			>
				Gender
				<select
					bind:value={gender}
					class="rounded-md border border-olf-darkgreen/20 bg-white px-2 py-1.5 text-sm normal-case"
				>
					<option value="UNDISCLOSED">Undisclosed</option>
					<option value="FEMALE">Female</option>
					<option value="MALE">Male</option>
					<option value="NONBINARY">Nonbinary</option>
				</select>
			</label>

			{#if error}<p class="font-oswald text-xs text-olf-darkbrown">{error}</p>{/if}
			<div class="flex justify-end gap-2">
				<Button
					onclick={() => (open = false)}
					class="rounded-md px-3 py-1.5 font-oswald text-xs font-bold text-olf-darkgreen/70 hover:text-olf-darkgreen"
				>
					Cancel
				</Button>
				<Button
					disabled={!email.trim()}
					loading={busy}
					onclick={submit}
					class="flex items-center gap-1.5 rounded-md bg-olf-darkgreen px-4 py-1.5 font-oswald text-xs font-bold text-white disabled:opacity-50"
				>
					<Plus size={14} /> Send magic link
				</Button>
			</div>
		{/if}
	</div>
</dialog>
