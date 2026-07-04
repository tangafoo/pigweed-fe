<script lang="ts">
	import BadgeModal from '$lib/components/posts/BadgeModal.svelte';

	// The identity pills next to a username: farm-owner ("OP") and founding-flock.
	// Uppercase, each with its own subtle shimmer (with a long break so it's never
	// jarring), and tappable → a little "what's this?" reveal (BadgeModal). Sits
	// above the card's stretched link (z-20) and swallows the click so tapping the
	// badge opens the modal instead of navigating the card.
	let { variant, label, title }: { variant: 'owner' | 'founder'; label: string; title?: string } =
		$props();

	let open = $state(false);
</script>

<button
	type="button"
	{title}
	onclick={(e) => {
		e.stopPropagation();
		e.preventDefault();
		open = true;
	}}
	class="badge badge-{variant} relative z-20 shrink-0 cursor-pointer overflow-hidden rounded px-1.5 font-oswald text-xxs font-bold tracking-wider uppercase {variant ===
	'owner'
		? 'bg-olf-darkgreen text-white'
		: 'bg-olf-yolk text-olf-eggshell'}"
>
	{label}
</button>

{#if open}
	<BadgeModal {variant} bind:open />
{/if}

<style>
	/* Owner: a light sweep that fires, then rests ~6s before the next pass. */
	.badge-owner::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			115deg,
			transparent 30%,
			rgba(255, 255, 255, 0.85) 50%,
			transparent 70%
		);
		transform: translateX(-130%);
		animation: badge-owner-sweep 6.8s ease-in-out infinite;
	}
	@keyframes badge-owner-sweep {
		0% {
			transform: translateX(-130%);
		}
		12%,
		100% {
			transform: translateX(130%);
		}
	}

	/* Founder: a different treatment — a soft gold twinkle (brightness pulse)
	   with its own long rest, so the two badges never read the same. */
	.badge-founder {
		animation: badge-founder-twinkle 5.5s ease-in-out infinite;
	}
	@keyframes badge-founder-twinkle {
		0%,
		82%,
		100% {
			filter: brightness(1);
		}
		89% {
			filter: brightness(1.4) saturate(1.2);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.badge-owner::after,
		.badge-founder {
			animation: none;
		}
	}
</style>
