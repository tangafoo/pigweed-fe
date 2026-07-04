<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/api/auth';
	import { m } from '$lib/paraglide/messages.js';
	import { asset } from '$lib/config/assets';
	import Spinner from '$lib/components/ui/Spinner.svelte';
	import { MailCheck, Check } from '@lucide/svelte';
	import type { Session } from '@meteorclass/pigweed-contract';

	// Shown on the owner's profile when their email isn't verified yet. Runs the
	// Better Auth email-OTP flow (send code → enter 6 digits → verify). On
	// success the BE flips emailVerified → the `email_verified` bus event grants
	// "Not a Farm Intruder" (+ its live toast/coins); invalidateAll refreshes the
	// session so this banner disappears and the new balance shows.
	const user = $derived((page.data as { session?: Session | null }).session?.user ?? null);
	const visible = $derived(!!user && !user.emailVerified);

	let mode = $state<'idle' | 'sent' | 'done'>('idle');
	let otp = $state('');
	let busy = $state(false);
	let error = $state('');

	async function sendCode() {
		if (busy || !user) return;
		busy = true;
		error = '';
		try {
			const { error: err } = await authClient.emailOtp.sendVerificationOtp({
				email: user.email,
				type: 'email-verification'
			});
			if (err) error = m.verify_email_send_error();
			else mode = 'sent';
		} catch {
			error = m.verify_email_send_error();
		} finally {
			busy = false;
		}
	}

	async function verify() {
		if (busy || !user || otp.trim().length < 6) return;
		busy = true;
		error = '';
		try {
			const { error: err } = await authClient.emailOtp.verifyEmail({
				email: user.email,
				otp: otp.trim()
			});
			if (err) {
				error = m.verify_email_error();
				return;
			}
			mode = 'done';
			// Refresh the session (emailVerified now true → banner hides) + the coin
			// balance the achievement just credited.
			await invalidateAll();
		} catch {
			error = m.verify_email_error();
		} finally {
			busy = false;
		}
	}
</script>

{#if visible}
	<!-- Cream glass banner: eggshell fill, darkgreen border + text. No bg image
	     behind, so the "glass" is a soft gloss sheen + a slow shimmer sweep that
	     rests between passes, not a real backdrop blur. -->
	<section
		class="glass-banner relative mt-5 overflow-hidden rounded-2xl border-2 border-olf-darkbrown bg-olf-beige px-4 py-2 shadow-lg"
	>
		<div class="relative z-10">
			{#if mode === 'done'}
				<p class="flex items-center gap-2 font-oswald text-sm text-olf-darkgreen">
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-full bg-olf-darkgreen shadow-md"
					>
						<Check size={18} class="text-olf-eggshell" />
					</span>
					{m.verify_email_success()}
				</p>
			{:else}
				<div class="flex flex-wrap items-center gap-3">
					<span
						class="flex size-10 shrink-0 items-center justify-center rounded-full bg-olf-blue shadow-md"
					>
						<MailCheck size={20} class="text-olf-eggshell" />
					</span>
					<div class="min-w-0 flex-1 font-oswald text-olf-darkgreen">
						<p class="font-supermercado-one text-lg font-medium">
							{m.verify_email_title()}<span
								class="font-oswald text-base font-light text-olf-darkgreen/80"
							>
								— {m.verify_email_reward()}<img
									src={asset('egg05.webp')}
									alt=""
									class="ml-1 inline-block size-4 object-contain align-[-0.2em]"
								/></span
							>
						</p>
						{#if mode === 'sent'}
							<!-- Bold only the email: split the localized string on a sentinel so
							     word order per locale is preserved. -->
							{@const parts = m.verify_email_sent({ email: '' }).split('')}
							<p class="text-sm text-olf-darkgreen/70">
								{parts[0]}<span class="font-semibold">{user?.email ?? ''}</span>{parts[1] ?? ''}
							</p>
						{/if}
					</div>
					{#if mode === 'idle'}
						<button
							type="button"
							onclick={sendCode}
							disabled={busy}
							class="flex items-center gap-1.5 rounded-full bg-olf-darkbrown px-6 py-1 font-oswald font-medium whitespace-nowrap text-olf-eggshell shadow-sm transition-colors duration-150 ease-in hover:bg-olf-blue disabled:opacity-50"
						>
							{#if busy}<Spinner size={14} />{/if}
							{busy ? m.verify_email_sending() : m.verify_email_send()}
						</button>
					{/if}
				</div>

				{#if mode === 'sent'}
					<div class="mt-4 flex flex-wrap items-center gap-2">
						<label class="flex-1">
							<span class="sr-only">{m.verify_email_code_label()}</span>
							<input
								bind:value={otp}
								inputmode="numeric"
								autocomplete="one-time-code"
								maxlength="6"
								placeholder="123456"
								class="w-full max-w-40 rounded-lg border-2 border-olf-darkgreen/30 bg-olf-beige px-3 py-2 text-center font-oswald text-lg tracking-[0.3em] text-olf-darkgreen tabular-nums focus:border-olf-darkgreen focus:outline-none"
							/>
						</label>
						<button
							type="button"
							onclick={verify}
							disabled={busy || otp.trim().length < 6}
							class="flex items-center gap-1.5 rounded-full bg-olf-darkgreen px-4 py-2 font-oswald font-bold text-olf-eggshell shadow-sm transition-colors hover:bg-olf-blue disabled:opacity-50"
						>
							{#if busy}<Spinner size={14} />{/if}
							{busy ? m.verify_email_verifying() : m.verify_email_verify()}
						</button>
						<button
							type="button"
							onclick={sendCode}
							disabled={busy}
							class="font-oswald text-xs font-bold text-olf-darkgreen/70 underline underline-offset-2 hover:text-olf-darkgreen disabled:opacity-50"
						>
							{m.verify_email_resend()}
						</button>
					</div>
				{/if}

				{#if error}
					<p class="mt-3 rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">{error}</p>
				{/if}
			{/if}
		</div>
	</section>
{/if}

<style>
	/* Soft top gloss so the cream reads like a glass surface. */
	.glass-banner::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(140deg, rgb(255 255 255 / 0.5), transparent 45%);
		pointer-events: none;
	}
	/* Slow gloss sweep with a long rest (sweeps in ~1s, then idles ~6.5s).
	   A bright band over the cream — sits behind the content. */
	.glass-banner::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			115deg,
			transparent 42%,
			rgb(255 255 255 / 0.6) 50%,
			transparent 58%
		);
		transform: translateX(-120%);
		pointer-events: none;
		animation: banner-shimmer 7.5s ease-in-out infinite;
	}
	@keyframes banner-shimmer {
		0% {
			transform: translateX(-120%);
		}
		13%,
		100% {
			transform: translateX(120%);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.glass-banner::after {
			animation: none;
		}
	}
</style>
