<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { authClient, signIn, sendMagicLink } from '$lib/api/auth';
	import { loadingScreen } from '$lib/stores/loadingScreen.svelte';
	import Seo from '$lib/components/seo/Seo.svelte';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { FingerprintPattern, Mail } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// A failed magic-link verify redirects back here with ?error= set by the
	// BE (see sendMagicLink in $lib/api/auth) — translate it into the page's
	// error slot so the user knows why they're looking at the login form again.
	function magicLinkRedirectError(): string {
		switch (page.url.searchParams.get('error')) {
			case 'INVALID_TOKEN':
			case 'EXPIRED_TOKEN':
				return m.magic_link_expired();
			case 'new_user_signup_disabled':
				return m.magic_link_no_account();
			default:
				return '';
		}
	}

	let identifier = $state('');
	let password = $state('');
	let error = $state(magicLinkRedirectError());
	let submitting = $state(false);
	let passkeyBusy = $state(false);
	let magicBusy = $state(false);
	let magicSent = $state(false);

	// Already clucking — no reason to sit on the sign-in page.
	$effect(() => {
		if (data.session) goto('/', { replaceState: true });
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		error = '';
		submitting = true;
		// Signing in re-resolves the session + reloads every layout load — a
		// "big" wait, so the global chicken loading screen takes over.
		loadingScreen.show(m.login_submitting());
		try {
			const result = await signIn(identifier.trim(), password);
			if (result.ok) {
				// Layout's server load re-resolves the session from the new cookie.
				await invalidateAll();
				await goto('/');
			} else {
				error = result.message;
				submitting = false;
			}
		} finally {
			loadingScreen.hide();
		}
	}

	async function signInWithPasskey() {
		if (passkeyBusy) return;
		error = '';

		// Feature detection: bail before invoking the client so we can surface a
		// specific message instead of an opaque ceremony failure.
		if (typeof window === 'undefined' || !window.PublicKeyCredential) {
			error = m.passkey_signin_unsupported();
			return;
		}

		passkeyBusy = true;
		try {
			const result = await authClient.signIn.passkey();
			if (result?.error) {
				// No passkey enrolled for this device, or the cred matches
				// nothing on the server — Better Auth surfaces as an error.
				error = m.passkey_signin_no_passkey();
				return;
			}
			// Ceremony done (the OS prompt is gone) — cover the session refresh
			// + redirect with the global loading screen.
			await loadingScreen.during(
				invalidateAll().then(() => goto('/')),
				m.login_submitting()
			);
		} catch (e) {
			// NotAllowedError fires when the user cancels the OS prompt or
			// times out. Anything else is a generic ceremony failure.
			if (e instanceof Error && e.name === 'NotAllowedError') {
				error = m.passkey_signin_cancelled();
			} else {
				error = m.passkey_signin_generic_error();
			}
		} finally {
			passkeyBusy = false;
		}
	}

	async function emailMagicLink() {
		if (magicBusy) return;
		error = '';
		// The link needs an address — reuse the identifier field, but it
		// accepts usernames too, so gate on it actually being an email.
		const email = identifier.trim();
		if (!email.includes('@')) {
			error = m.magic_link_need_email();
			return;
		}
		magicBusy = true;
		try {
			const result = await sendMagicLink(email);
			if (result.ok) {
				magicSent = true;
			} else {
				error =
					result.reason === 'rate-limited' ? m.magic_link_too_many() : m.magic_link_generic_error();
			}
		} finally {
			magicBusy = false;
		}
	}
</script>

<Seo
	title="Sign in · Our Little Farm"
	description="Sign in to Our Little Farm — anonymous, hyperlocal chatter from the animals in your neighbourhood."
	noindex
/>

<div class="flex flex-1 items-center justify-center bg-olf-lightgreen px-4 py-10">
	<form onsubmit={submit} class="w-full max-w-sm rounded-2xl bg-olf-beige p-6 shadow-lg" novalidate>
		<h1 class="mb-1 font-homemade-apple text-3xl font-bold text-olf-darkbrown">
			{m.login_heading()}
		</h1>
		<p class="mb-6 font-oswald text-olf-darkbrown/70">{m.login_subtitle()}</p>

		<label class="mb-4 block">
			<span class="mb-1 block font-oswald text-sm font-bold text-olf-darkbrown">
				{m.login_identifier_label()}
			</span>
			<input
				bind:value={identifier}
				type="text"
				autocomplete="username"
				required
				class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
			/>
		</label>

		<label class="mb-6 block">
			<span class="mb-1 block font-oswald text-sm font-bold text-olf-darkbrown"
				>{m.login_password_label()}</span
			>
			<input
				bind:value={password}
				type="password"
				autocomplete="current-password"
				required
				class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
			/>
		</label>

		{#if error}
			<p class="mb-4 rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">{error}</p>
		{/if}

		<button
			type="submit"
			disabled={submitting || !identifier || !password}
			class="flex w-full items-center justify-center gap-2 rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-lg font-bold text-white disabled:opacity-50"
		>
			{#if submitting}<Spinner size={16} />{/if}
			{submitting ? m.login_submitting() : m.login_submit()}
		</button>

		<div class="my-4 flex items-center gap-3 font-oswald text-xs text-olf-darkbrown/60">
			<span class="h-px flex-1 bg-olf-darkbrown/20"></span>
			{m.login_passkey_divider()}
			<span class="h-px flex-1 bg-olf-darkbrown/20"></span>
		</div>

		<button
			type="button"
			onclick={signInWithPasskey}
			disabled={passkeyBusy}
			class="flex w-full items-center justify-center gap-2 rounded-full border-2 border-olf-darkbrown bg-olf-beige px-4 py-2 font-oswald text-lg font-bold text-olf-darkbrown disabled:opacity-50"
		>
			<FingerprintPattern size={20} />
			{passkeyBusy ? m.passkey_add_in_progress() : m.passkey_signin_button()}
		</button>

		<div class="my-4 flex items-center gap-3 font-oswald text-xs text-olf-darkbrown/60">
			<span class="h-px flex-1 bg-olf-darkbrown/20"></span>
			{m.login_magic_divider()}
			<span class="h-px flex-1 bg-olf-darkbrown/20"></span>
		</div>

		{#if magicSent}
			<p class="rounded-lg bg-olf-darkgreen px-3 py-2 font-oswald text-sm text-white">
				{m.magic_link_sent()}
			</p>
		{:else}
			<button
				type="button"
				onclick={emailMagicLink}
				disabled={magicBusy}
				class="flex w-full items-center justify-center gap-2 rounded-full border-2 border-olf-darkbrown bg-olf-beige px-4 py-2 font-oswald text-lg font-bold text-olf-darkbrown disabled:opacity-50"
			>
				{#if magicBusy}<Spinner size={16} />{:else}<Mail size={20} />{/if}
				{magicBusy ? m.magic_link_sending() : m.magic_link_button()}
			</button>
		{/if}

		<p class="mt-4 text-center font-oswald text-sm text-olf-darkbrown/70">
			{m.login_no_account()}
			<a href="/signup" class="font-bold text-olf-darkgreen underline">{m.login_signup_link()}</a>
		</p>
	</form>
</div>
