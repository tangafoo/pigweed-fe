<script lang="ts">
	import { authClient } from '$lib/api/auth';
	import Seo from '$lib/components/Seo.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/utils/date';
	import { Fingerprint, KeyRound, Trash2, Plus, UserRound, LogOut } from '@lucide/svelte';
	import type { PageData } from './$types';
	import { ANIMAL_LABEL, GENDER_LABEL } from '$lib/utils/labels';
	import { asset } from '$lib/assets';
	import { goto, invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();
	// `+page.server.ts` redirects unauthenticated visitors, so the layout's
	// session is always present by the time this renders.
	const user = $derived(data.session!.user);

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
			await goto('/');
		} catch {
			signingOut = false;
		}
	}
</script>

<Seo title={m.settings_page_title()} description="Account settings" noindex />

<div class="flex-1 bg-olf-lightgreen px-4 py-10">
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center justify-between gap-3">
			<h1 class="font-homemade-apple text-4xl font-bold text-olf-darkbrown">
				{m.settings_heading()}
			</h1>
			<!-- Auto-loop: faces left & hops left ×3, flips to face right, hops back
			     ×3, flips back — then repeats. Hop (translate) + facing (scaleX)
			     animate together on the wrapper, so the img itself is unflipped. -->
			<span class="hop inline-flex shrink-0">
				<img src={asset('chicken-drawing-white.webp')} alt="" class="h-14 w-auto" />
			</span>
		</div>

		<section class="mb-6 rounded-2xl bg-olf-eggshell p-6 shadow-md">
			<div class="mb-4 flex items-center gap-2">
				<UserRound size={22} class="text-olf-darkbrown" />
				<h2 class="font-homemade-apple text-2xl font-bold text-olf-darkbrown">
					{m.account_heading()}
				</h2>
			</div>
			<dl class="flex flex-col gap-2 font-oswald">
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_username()}</dt>
					<dd class="font-bold">{user.username}</dd>
				</div>
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_email()}</dt>
					<dd class="truncate font-bold">{user.email}</dd>
				</div>
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_gender()}</dt>
					<dd class="font-bold">{GENDER_LABEL[user.gender]()}</dd>
				</div>
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_animal()}</dt>
					<dd class="font-bold">{ANIMAL_LABEL[user.animal]()}</dd>
				</div>
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_coin_balance()}</dt>
					<dd class="flex items-center gap-1.5 font-bold">
						<img src={asset('egg05.webp')} alt="" class="h-4 w-4 shrink-0 object-contain" />
						{user.coinBalance}
					</dd>
				</div>
				<div
					class="flex items-center justify-between gap-3 rounded-xl bg-olf-darkbrown px-4 py-3 text-white"
				>
					<dt class="text-white/70">{m.account_field_unlock_coins()}</dt>
					<dd class="font-bold">{user.unlockCoins}</dd>
				</div>
			</dl>
		</section>

		<section class="rounded-2xl bg-olf-beige p-6 shadow-md">
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

		<button
			type="button"
			onclick={signOut}
			disabled={signingOut}
			class="mt-4.5 inline-flex items-center gap-1.5 font-oswald font-semibold text-olf-darkbrown underline underline-offset-2 hover:text-olf-darkgreen disabled:opacity-50"
		>
			<LogOut size={16} class="shrink-0" />
			{signingOut ? m.home_signout_in_progress() : m.home_signout_button()}
		</button>
	</div>
</div>

<style>
	/* hop ×3 left → wait 2s → flip to right → wait 1s → hop ×3 back → flip to
	   left (no wait) → wait 5s → loop. ~12s total. translate + scaleX share one
	   transform so hop and facing never fight; per-keyframe easing gives each hop
	   a gravity feel (rise eases out, fall eases in). Reduced-motion rests left. */
	.hop {
		transform: scaleX(-1);
		transform-origin: center bottom;
		animation: chicken-pace 12s infinite;
	}
	@keyframes chicken-pace {
		/* hop left ×3 */
		0% {
			transform: translate(0, 0) scaleX(-1);
			animation-timing-function: ease-out;
		}
		2.08% {
			transform: translate(-7px, -11px) scaleX(-1);
			animation-timing-function: ease-in;
		}
		4.17% {
			transform: translate(-14px, 0) scaleX(-1);
			animation-timing-function: ease-out;
		}
		6.25% {
			transform: translate(-21px, -11px) scaleX(-1);
			animation-timing-function: ease-in;
		}
		8.33% {
			transform: translate(-28px, 0) scaleX(-1);
			animation-timing-function: ease-out;
		}
		10.42% {
			transform: translate(-35px, -11px) scaleX(-1);
			animation-timing-function: ease-in;
		}
		12.5% {
			transform: translate(-42px, 0) scaleX(-1);
		}
		/* wait 2s, then flip to face right */
		29.17% {
			transform: translate(-42px, 0) scaleX(-1);
		}
		33.33% {
			transform: translate(-42px, 0) scaleX(1);
		}
		/* wait 1s, then hop right ×3 back to origin */
		41.67% {
			transform: translate(-42px, 0) scaleX(1);
			animation-timing-function: ease-out;
		}
		43.75% {
			transform: translate(-35px, -11px) scaleX(1);
			animation-timing-function: ease-in;
		}
		45.83% {
			transform: translate(-28px, 0) scaleX(1);
			animation-timing-function: ease-out;
		}
		47.92% {
			transform: translate(-21px, -11px) scaleX(1);
			animation-timing-function: ease-in;
		}
		50% {
			transform: translate(-14px, 0) scaleX(1);
			animation-timing-function: ease-out;
		}
		52.08% {
			transform: translate(-7px, -11px) scaleX(1);
			animation-timing-function: ease-in;
		}
		54.17% {
			transform: translate(0, 0) scaleX(1);
		}
		/* straight flip back to left (no wait), then wait 5s before looping */
		58.33% {
			transform: translate(0, 0) scaleX(-1);
		}
		100% {
			transform: translate(0, 0) scaleX(-1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.hop {
			animation: none;
		}
	}
</style>
