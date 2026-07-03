<script lang="ts">
	import { hasPassword, setPassword } from '$lib/api/auth';
	import { m } from '$lib/paraglide/messages.js';
	import { KeyRound, Check } from '@lucide/svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	// Shown on the owner's own profile when the account has no credential
	// (password) account — i.e. it was pre-registered by the admin panel and
	// has only ever signed in via magic link. Offers an inline one-field
	// password bootstrap (POST /users/me/set-password). No confirm field on
	// purpose: a typo can't lock anyone out, the magic link always works.
	let visible = $state(false);
	let done = $state(false);
	let open = $state(false);
	let password = $state('');
	let busy = $state(false);
	let error = $state('');

	$effect(() => {
		hasPassword().then((has) => {
			if (has === false) visible = true;
		});
	});

	async function save() {
		if (busy) return;
		error = '';
		if (password.length < 8) {
			error = m.set_password_too_short();
			return;
		}
		busy = true;
		try {
			const result = await setPassword(password);
			if (result.ok) {
				done = true;
			} else {
				error = result.reason === 'too-short' ? m.set_password_too_short() : m.set_password_error();
			}
		} finally {
			busy = false;
		}
	}
</script>

{#if visible}
	<section class="mt-5 rounded-2xl bg-olf-darkbrown p-4 shadow-md">
		{#if done}
			<p class="flex items-center gap-2 font-oswald text-sm text-white">
				<span
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen"
				>
					<Check size={18} class="text-olf-darkbrown" />
				</span>
				{m.set_password_success()}
			</p>
		{:else}
			<div class="flex flex-wrap items-center gap-3">
				<span
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-olf-lightgreen"
				>
					<KeyRound size={20} class="text-olf-darkbrown" />
				</span>
				<div class="min-w-0 flex-1 font-oswald text-white">
					<p class="font-bold">{m.set_password_title()}</p>
					<p class="text-sm text-white/70">{m.set_password_body()}</p>
				</div>
				{#if !open}
					<button
						type="button"
						onclick={() => (open = true)}
						class="rounded-full bg-olf-lightgreen px-4 py-1.5 font-oswald font-bold whitespace-nowrap text-olf-darkbrown"
					>
						{m.set_password_button()}
					</button>
				{/if}
			</div>

			{#if open}
				<div class="mt-4">
					<label class="block">
						<span class="mb-1 block font-oswald text-sm font-bold text-white/80">
							{m.set_password_label()}
						</span>
						<input
							bind:value={password}
							type="password"
							autocomplete="new-password"
							minlength="8"
							class="w-full rounded-lg border-2 border-olf-lightbrown bg-olf-beige px-3 py-2 font-oswald text-olf-darkbrown focus:border-olf-lightgreen focus:outline-none"
						/>
					</label>

					{#if error}
						<p class="mt-3 rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">
							{error}
						</p>
					{/if}

					<div class="mt-3 flex gap-2">
						<button
							type="button"
							onclick={save}
							disabled={busy}
							class="flex flex-1 items-center justify-center gap-2 rounded-full bg-olf-lightgreen px-4 py-2 font-oswald font-bold text-olf-darkbrown disabled:opacity-50"
						>
							{#if busy}<Spinner size={14} />{/if}
							{busy ? m.set_password_saving() : m.set_password_save()}
						</button>
						<button
							type="button"
							onclick={() => {
								open = false;
								password = '';
								error = '';
							}}
							disabled={busy}
							class="rounded-full bg-olf-lightbrown px-4 py-2 font-oswald font-bold text-olf-darkbrown disabled:opacity-50"
						>
							{m.set_password_cancel()}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</section>
{/if}
