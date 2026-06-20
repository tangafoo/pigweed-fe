<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { signUp, isUsernameAvailable, rerollAvatar, getSession } from '$lib/api/auth';
	import type { Gender, SessionUser } from '$lib/api/auth';
	import Seo from '$lib/components/Seo.svelte';
	import { randomUsername } from '$lib/username';
	import { m } from '$lib/paraglide/messages.js';
	import type { Animal } from '@meteorclass/pigweed-contract';
	import type { PageData } from './$types';
	import { Dices, Check } from '@lucide/svelte';

	let { data }: { data: PageData } = $props();

	type Phase = 'form' | 'meet';
	let phase = $state<Phase>('form');

	let email = $state('');
	let username = $state('');
	let password = $state('');
	let gender = $state<Gender>('UNDISCLOSED');

	let error = $state('');
	let usernameError = $state('');
	let submitting = $state(false);

	type Avail = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';
	let avail = $state<Avail>('idle');
	let checkTimer: ReturnType<typeof setTimeout> | undefined;

	// The signed-in user after signup — drives the "meet your animal" step.
	let me = $state<SessionUser | null>(null);
	let rerolling = $state(false);

	const genders: { value: Gender; label: () => string }[] = [
		{ value: 'MALE', label: () => m.gender_male() },
		{ value: 'FEMALE', label: () => m.gender_female() },
		{ value: 'NONBINARY', label: () => m.gender_nonbinary() },
		{ value: 'UNDISCLOSED', label: () => m.gender_undisclosed() }
	];

	const animalLabel = (a: Animal) =>
		a === 'CHICKEN' ? m.animal_chicken() : a === 'DOG' ? m.animal_dog() : m.animal_goose();

	// Already clucking — no reason to sit on the signup page.
	$effect(() => {
		if (data.session) goto('/', { replaceState: true });
	});

	function onUsernameInput() {
		usernameError = '';
		clearTimeout(checkTimer);
		const u = username.trim();
		if (u.length < 3) {
			avail = 'idle';
			return;
		}
		avail = 'checking';
		checkTimer = setTimeout(async () => {
			const result = await isUsernameAvailable(u);
			// Ignore a stale check if the field changed while we waited.
			if (u !== username.trim()) return;
			avail = result === true ? 'available' : result === false ? 'taken' : 'unknown';
		}, 400);
	}

	function shuffle() {
		username = randomUsername();
		onUsernameInput();
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting) return;
		error = '';
		usernameError = '';
		submitting = true;
		const result = await signUp({
			email: email.trim(),
			username: username.trim(),
			password,
			gender
		});
		if (result.ok) {
			// Better Auth signed us in; pull the server-assigned animal + seed.
			me = (await getSession())?.user ?? null;
			phase = 'meet';
		} else if (result.field === 'username') {
			usernameError = result.message;
		} else {
			error = result.message;
		}
		submitting = false;
	}

	async function reroll() {
		if (rerolling) return;
		rerolling = true;
		const next = await rerollAvatar();
		if (next && me) me = { ...me, animal: next.animal, avatarSeed: next.avatarSeed };
		rerolling = false;
	}

	async function enterFarm() {
		// Layout's server load re-resolves the session from the new cookie.
		await invalidateAll();
		await goto('/');
	}
</script>

<Seo
	title="Create an account · Our Little Farm"
	description="Hatch an account and see what the animals in your neighbourhood are clucking about — anonymous, hyperlocal chatter."
	noindex
/>

<div class="flex flex-1 items-center justify-center bg-olf-lightgreen px-4 py-10">
	{#if phase === 'form'}
		<form
			onsubmit={submit}
			class="w-full max-w-sm rounded-2xl bg-olf-beige p-6 shadow-lg"
			novalidate
		>
			<h1 class="mb-1 font-homemade-apple text-3xl font-bold text-olf-darkbrown">
				{m.signup_heading()}
			</h1>
			<p class="mb-6 text-olf-darkbrown/70">{m.signup_subtitle()}</p>

			<label class="mb-4 block">
				<span class="mb-1 block text-sm font-bold text-olf-darkbrown">{m.signup_email_label()}</span
				>
				<input
					bind:value={email}
					type="email"
					autocomplete="email"
					required
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 focus:border-olf-darkbrown focus:outline-none"
				/>
			</label>

			<div class="mb-4 block">
				<span class="mb-1 flex items-center justify-between text-sm font-bold text-olf-darkbrown">
					<span>{m.signup_username_label()}</span>
					<button
						type="button"
						onclick={shuffle}
						class="font-oswald text-xs font-bold text-olf-darkbrown underline"
					>
						{m.signup_username_generate()}
						<Dices size={12} class="inline-block" />
					</button>
				</span>
				<input
					bind:value={username}
					oninput={onUsernameInput}
					type="text"
					autocomplete="username"
					minlength="3"
					maxlength="30"
					required
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 focus:border-olf-darkbrown focus:outline-none"
				/>
				<span class="mt-1 block text-xs tracking-wide text-olf-darkbrown/60"
					>{m.signup_username_instructions()}</span
				>
				<p class="mt-1 text-sm">
					{#if usernameError}
						<span class=" text-red-700">{usernameError}</span>
					{:else if avail === 'checking'}
						<span class="mt-1 text-sm text-olf-darkbrown/60">{m.signup_username_checking()}</span>
					{:else if avail === 'available'}
						<span class="text-olf-darkgreen">{m.signup_username_available()}</span>
						<Check size={12} class="inline-block text-olf-darkgreen" />
					{:else if avail === 'taken'}
						<span class=" text-red-700">{m.signup_username_taken()}</span>
					{/if}
				</p>
			</div>

			<label class="mb-4 block">
				<span class="mb-1 block text-sm font-bold text-olf-darkbrown"
					>{m.signup_password_label()}</span
				>
				<input
					bind:value={password}
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 focus:border-olf-darkbrown focus:outline-none"
				/>
				<span class="mt-1 block text-xs tracking-wide text-olf-darkbrown/60"
					>{m.signup_password_hint()}</span
				>
			</label>

			<label class="mb-6 block">
				<span class="mb-1 block text-sm font-bold text-olf-darkbrown"
					>{m.signup_gender_label()}</span
				>
				<select
					bind:value={gender}
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 focus:border-olf-darkbrown focus:outline-none"
				>
					{#each genders as g (g.value)}
						<option value={g.value}>{g.label()}</option>
					{/each}
				</select>
			</label>

			{#if error}
				<p class="mb-4 rounded-lg bg-red-700 px-3 py-2 text-sm text-white">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting || !email || !username || !password || avail === 'taken'}
				class="w-full rounded-full bg-olf-darkbrown px-4 py-2 text-lg font-bold text-white disabled:opacity-50"
			>
				{submitting ? m.signup_submitting() : m.signup_submit()}
			</button>

			<p class="mt-4 text-center text-sm text-olf-darkbrown/70">
				{m.signup_have_account()}
				<a href="/login" class="font-bold text-olf-darkbrown underline">{m.signup_signin_link()}</a>
			</p>
		</form>
	{:else}
		<div class="w-full max-w-sm rounded-2xl bg-olf-beige p-6 text-center shadow-lg">
			<h1 class="mb-1 font-homemade-apple text-3xl font-bold text-olf-darkbrown">
				{m.signup_meet_heading()}
			</h1>
			<p class="mb-6 text-olf-darkbrown/70">
				{m.signup_meet_subtitle()}
			</p>

			<!-- TODO: replace this placeholder with the procedural
			     (animal, avatarSeed) → layered-SVG avatar component once the
			     silhouette layers are drawn. For now it's a flat colored disc. -->
			<div
				class="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-olf-lightbrown"
			>
				<span class="font-supermercado-one text-2xl text-white">
					{me ? animalLabel(me.animal) : '…'}
				</span>
			</div>

			<p class="mb-6 text-olf-darkbrown">
				{m.signup_meet_intro({
					username: me?.username ?? '',
					animal: me ? animalLabel(me.animal) : ''
				})}
			</p>

			<button
				type="button"
				onclick={reroll}
				disabled={rerolling}
				class="mb-3 w-full rounded-full border-2 border-olf-darkbrown px-4 py-2 text-lg font-semibold text-olf-darkbrown disabled:opacity-50"
			>
				{rerolling ? m.signup_meet_rerolling() : m.signup_meet_reroll()}
				<Dices size={16} class="inline-block" />
			</button>

			<button
				type="button"
				onclick={enterFarm}
				class="w-full rounded-full bg-olf-darkbrown px-4 py-2 text-lg font-bold text-white"
			>
				{m.signup_meet_enter()}
			</button>
		</div>
	{/if}
</div>
