<script lang="ts">
	import { authClient } from '$lib/api/auth';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import { Fingerprint, KeyRound, Trash2, Plus } from '@lucide/svelte';

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
</script>

<svelte:head><title>{m.settings_page_title()}</title></svelte:head>

<div class="flex w-full items-center bg-olf-darkbrown px-2 py-3">
	<a href="/" class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</a>
</div>

<div class="min-h-[calc(100dvh-3rem)] bg-olf-lightgreen px-4 py-10">
	<div class="mx-auto max-w-2xl">
		<h1 class="mb-6 font-homemade-apple text-4xl font-bold text-olf-darkbrown">
			{m.settings_heading()}
		</h1>

		<section class="rounded-2xl bg-olf-beige p-6">
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
									class="flex h-9 w-9 items-center justify-center rounded-full bg-olf-lightbrown text-olf-darkbrown"
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
					class="flex w-full items-center justify-center gap-2 rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-lg font-bold text-white"
				>
					<Plus size={18} />
					{m.passkey_add_button()}
				</button>
			{/if}
		</section>
	</div>
</div>
