<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { signUp, isUsernameAvailable, rerollAvatar, getSession } from '$lib/api/auth';
	import type { Gender, SessionUser } from '$lib/api/auth';
	import { randomUsername } from '$lib/username';
	import type { PageData } from './$types';

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

	const genders: { value: Gender; label: string }[] = [
		{ value: 'MALE', label: 'Male' },
		{ value: 'FEMALE', label: 'Female' },
		{ value: 'NONBINARY', label: 'Nonbinary' },
		{ value: 'UNDISCLOSED', label: 'Rather not say' }
	];

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

<svelte:head><title>Hatch your animal · Our Little Farm</title></svelte:head>

<div class="flex w-full items-center bg-olf-darkbrown px-2 py-3">
	<a href="/" class="font-homemade-apple font-bold tracking-wider text-white">Our Little Farm</a>
</div>

<div
	class="flex min-h-[calc(100dvh-3rem)] items-center justify-center bg-olf-lightgreen px-4 py-10"
>
	{#if phase === 'form'}
		<form
			onsubmit={submit}
			class="w-full max-w-sm rounded-2xl bg-olf-beige p-6 shadow-lg"
			novalidate
		>
			<h1 class="mb-1 font-homemade-apple text-3xl font-bold text-olf-darkbrown">
				Hatch your animal
			</h1>
			<p class="mb-6 font-oswald text-olf-darkbrown/70">
				Email and a password. Your animal is rolled for you.
			</p>

			<label class="mb-4 block">
				<span class="mb-1 block font-oswald text-sm font-bold text-olf-darkbrown">Email</span>
				<input
					bind:value={email}
					type="email"
					autocomplete="email"
					required
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
				/>
			</label>

			<div class="mb-4 block">
				<span
					class="mb-1 flex items-center justify-between font-oswald text-sm font-bold text-olf-darkbrown"
				>
					<span>Username</span>
					<button
						type="button"
						onclick={shuffle}
						class="font-oswald text-xs font-bold text-olf-darkbrown underline"
					>
						🎲 surprise me
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
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
				/>
				{#if usernameError}
					<p class="mt-1 font-oswald text-sm font-bold text-red-700">{usernameError}</p>
				{:else if avail === 'checking'}
					<p class="mt-1 font-oswald text-sm text-olf-darkbrown/60">Checking…</p>
				{:else if avail === 'available'}
					<p class="mt-1 font-oswald text-sm font-bold text-green-700">That name is free 🌾</p>
				{:else if avail === 'taken'}
					<p class="mt-1 font-oswald text-sm font-bold text-red-700">
						Already taken — try another.
					</p>
				{/if}
			</div>

			<label class="mb-4 block">
				<span class="mb-1 block font-oswald text-sm font-bold text-olf-darkbrown">Password</span>
				<input
					bind:value={password}
					type="password"
					autocomplete="new-password"
					minlength="8"
					required
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
				/>
				<span class="mt-1 block font-oswald text-xs text-olf-darkbrown/60"
					>At least 8 characters.</span
				>
			</label>

			<label class="mb-6 block">
				<span class="mb-1 block font-oswald text-sm font-bold text-olf-darkbrown">Gender</span>
				<select
					bind:value={gender}
					class="w-full rounded-lg border-2 border-olf-lightbrown bg-white/80 px-3 py-2 font-oswald focus:border-olf-darkbrown focus:outline-none"
				>
					{#each genders as g (g.value)}
						<option value={g.value}>{g.label}</option>
					{/each}
				</select>
			</label>

			{#if error}
				<p class="mb-4 rounded-lg bg-red-700 px-3 py-2 font-oswald text-sm text-white">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting || !email || !username || !password || avail === 'taken'}
				class="w-full rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-lg font-bold text-white disabled:opacity-50"
			>
				{submitting ? 'Hatching…' : 'Hatch'}
			</button>

			<p class="mt-4 text-center font-oswald text-sm text-olf-darkbrown/70">
				Already have an animal?
				<a href="/login" class="font-bold text-olf-darkbrown underline">Sign in</a>
			</p>
		</form>
	{:else}
		<div class="w-full max-w-sm rounded-2xl bg-olf-beige p-6 text-center shadow-lg">
			<h1 class="mb-1 font-homemade-apple text-3xl font-bold text-olf-darkbrown">
				Meet your animal
			</h1>
			<p class="mb-6 font-oswald text-olf-darkbrown/70">
				Don't like it? Reroll for a new one — whatever you land on is yours.
			</p>

			<!-- TODO: replace this placeholder with the procedural
			     (animal, avatarSeed) → layered-SVG avatar component once the
			     silhouette layers are drawn. For now it's a flat colored disc. -->
			<div
				class="mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-olf-lightbrown"
			>
				<span class="font-supermercado-one text-2xl text-white">
					{me?.animal ?? '…'}
				</span>
			</div>

			<p class="mb-6 font-oswald text-olf-darkbrown">
				You're <span class="font-bold">{me?.username}</span>, a
				<span class="font-bold">{me?.animal?.toLowerCase() ?? 'creature'}</span>.
			</p>

			<button
				type="button"
				onclick={reroll}
				disabled={rerolling}
				class="mb-3 w-full rounded-full border-2 border-olf-darkbrown px-4 py-2 font-oswald text-lg font-bold text-olf-darkbrown disabled:opacity-50"
			>
				{rerolling ? 'Rolling…' : '🎲 Reroll'}
			</button>

			<button
				type="button"
				onclick={enterFarm}
				class="w-full rounded-full bg-olf-darkbrown px-4 py-2 font-oswald text-lg font-bold text-white"
			>
				Enter the farm
			</button>
		</div>
	{/if}
</div>
