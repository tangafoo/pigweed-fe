<script lang="ts">
	import { getLocale, setLocale, locales, type Locale } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';
	import { ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	// Each locale's own name (endonym) — what we SHOW. Flags are decoration
	// (flags map to countries, not languages); the name is the source of
	// truth and what assistive tech reads. Pigweed is a Malaysian app, so the
	// Jalur Gemilang stands in for `en` (not the Union Jack / Stars & Stripes).
	const names: Record<string, string> = {
		en: 'English',
		ko: '한국어',
		zh: '繁體中文',
		ja: '日本語'
	};

	const current = $derived(getLocale());

	let open = $state(false);
	let root = $state<HTMLElement>();

	function pick(code: Locale) {
		open = false;
		if (code === current) return;
		// Paraglide writes the cookie and full-reloads by default — the BE
		// then re-resolves the page in the new locale on the next request.
		setLocale(code);
	}

	// Close on outside-click / Escape while open. Listeners attach only when
	// open (and after the opening click has finished propagating, so they
	// don't immediately re-close it).
	$effect(() => {
		if (!open) return;
		const onClick = (e: MouseEvent) => {
			if (root && !root.contains(e.target as Node)) open = false;
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		document.addEventListener('click', onClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<!-- Reusable flag tile, shared between the trigger and the dropdown rows. -->
{#snippet flag(code: string)}
	{#if code === 'en'}
		<!-- Jalur Gemilang: 14 stripes (7 red on white), blue canton
		     with a yellow crescent + 14-pointed star. -->
		<svg viewBox="0 0 28 14" class="h-3 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<rect width="28" height="14" fill="#fff" />
			<rect y="0" width="28" height="1" fill="#cc0001" />
			<rect y="2" width="28" height="1" fill="#cc0001" />
			<rect y="4" width="28" height="1" fill="#cc0001" />
			<rect y="6" width="28" height="1" fill="#cc0001" />
			<rect y="8" width="28" height="1" fill="#cc0001" />
			<rect y="10" width="28" height="1" fill="#cc0001" />
			<rect y="12" width="28" height="1" fill="#cc0001" />
			<rect width="14" height="7" fill="#010066" />
			<circle cx="5" cy="3.5" r="2" fill="#ffcc00" />
			<circle cx="5.6" cy="3.5" r="1.65" fill="#010066" />
			<polygon
				fill="#ffcc00"
				points="9.5,1.9 9.68,2.72 10.19,2.06 10,2.88 10.75,2.5 10.22,3.15 11.06,3.14 10.3,3.5 11.06,3.86 10.22,3.85 10.75,4.5 10,4.13 10.19,4.94 9.68,4.28 9.5,5.1 9.32,4.28 8.81,4.94 9,4.13 8.25,4.5 8.78,3.85 7.94,3.86 8.7,3.5 7.94,3.14 8.78,3.15 8.25,2.5 9,2.88 8.81,2.06 9.32,2.72"
			/>
		</svg>
	{:else if code === 'ko'}
		<!-- Taegeukgi: red+blue taegeuk on white, four black trigrams. -->
		<svg viewBox="0 0 36 24" class="h-3 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<rect width="36" height="24" fill="#fff" />
			<g transform="translate(18,12)">
				<circle r="6" fill="#cd2e3a" />
				<path d="M0,-6 A3,3 0 0 1 0,0 A3,3 0 0 0 0,6 A6,6 0 0 1 0,-6" fill="#0047a0" />
			</g>
			<g fill="#000">
				<g transform="translate(7,5.5) rotate(-33.7)">
					<rect x="-3" y="-1.8" width="6" height="0.7" />
					<rect x="-3" y="-0.35" width="6" height="0.7" />
					<rect x="-3" y="1.1" width="6" height="0.7" />
				</g>
				<g transform="translate(29,5.5) rotate(33.7)">
					<rect x="-3" y="-1.8" width="6" height="0.7" />
					<rect x="-3" y="-0.35" width="2.5" height="0.7" />
					<rect x="0.5" y="-0.35" width="2.5" height="0.7" />
					<rect x="-3" y="1.1" width="6" height="0.7" />
				</g>
				<g transform="translate(7,18.5) rotate(33.7)">
					<rect x="-3" y="-1.8" width="2.5" height="0.7" />
					<rect x="0.5" y="-1.8" width="2.5" height="0.7" />
					<rect x="-3" y="-0.35" width="6" height="0.7" />
					<rect x="-3" y="1.1" width="2.5" height="0.7" />
					<rect x="0.5" y="1.1" width="2.5" height="0.7" />
				</g>
				<g transform="translate(29,18.5) rotate(-33.7)">
					<rect x="-3" y="-1.8" width="2.5" height="0.7" />
					<rect x="0.5" y="-1.8" width="2.5" height="0.7" />
					<rect x="-3" y="-0.35" width="2.5" height="0.7" />
					<rect x="0.5" y="-0.35" width="2.5" height="0.7" />
					<rect x="-3" y="1.1" width="2.5" height="0.7" />
					<rect x="0.5" y="1.1" width="2.5" height="0.7" />
				</g>
			</g>
		</svg>
	{:else if code === 'zh'}
		<!-- Qingtian Bairi Mandi Hong: red field, blue canton, white 12-rayed sun. -->
		<svg viewBox="0 0 30 20" class="h-3 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<rect width="30" height="20" fill="#fe0000" />
			<rect width="15" height="10" fill="#000095" />
			<g transform="translate(7.5,5)">
				<g fill="#fff">
					<polygon points="0,-4 0.92,-1.16 -1.49,-2.91 1.49,-2.91 -0.92,-1.16" />
					<polygon points="0,4 -0.92,1.16 1.49,2.91 -1.49,2.91 0.92,1.16" />
					<polygon points="4,0 1.16,0.92 2.91,-1.49 2.91,1.49 1.16,-0.92" />
					<polygon points="-4,0 -1.16,-0.92 -2.91,1.49 -2.91,-1.49 -1.16,0.92" />
					<polygon points="2.83,-2.83 0.62,-1.51 1.51,-3.61 1.51,-1.13 0.41,-1.78" />
					<polygon points="-2.83,2.83 -0.62,1.51 -1.51,3.61 -1.51,1.13 -0.41,1.78" />
					<polygon points="2.83,2.83 1.51,0.62 3.61,1.51 1.13,1.51 1.78,0.41" />
					<polygon points="-2.83,-2.83 -1.51,-0.62 -3.61,-1.51 -1.13,-1.51 -1.78,-0.41" />
				</g>
				<circle r="2.1" fill="#000095" />
				<circle r="1.7" fill="#fff" />
			</g>
		</svg>
	{:else if code === 'ja'}
		<!-- Hinomaru: a single red disc, centred, on white. -->
		<svg viewBox="0 0 30 20" class="h-3 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
			<rect width="30" height="20" fill="#fff" />
			<circle cx="15" cy="10" r="6" fill="#bc002d" />
		</svg>
	{/if}
{/snippet}

<div class="relative" bind:this={root}>
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={m.locale_switcher_label()}
		class="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/60 bg-olf-darkbrown/40 px-2.5 py-1 text-white"
	>
		{@render flag(current)}
		<span class="font-oswald text-xs">{names[current] ?? current}</span>
		<ChevronDown size={14} class="shrink-0 transition-transform duration-200 {open ? 'rotate-180' : ''}" />
	</button>

	{#if open}
		<ul
			role="listbox"
			aria-label={m.locale_switcher_label()}
			transition:slide={{ duration: 150 }}
			class="absolute right-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-xl border border-olf-darkgreen/20 bg-olf-beige shadow-lg"
		>
			{#each locales as code (code)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={current === code}
						onclick={() => pick(code as Locale)}
						class="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left font-oswald text-sm text-olf-darkbrown transition-colors hover:bg-olf-darkgreen/10 {current ===
						code
							? 'bg-olf-darkgreen/10 font-bold'
							: ''}"
					>
						{@render flag(code)}
						<span>{names[code] ?? code}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
