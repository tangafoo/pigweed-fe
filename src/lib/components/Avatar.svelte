<script lang="ts">
	import type { Animal, Gender } from '@meteorclass/pigweed-contract';
	import { asset } from '$lib/assets';

	interface AvatarProps {
		animal: Animal;
		avatarSeed: number;
		gender: Gender;
		size?: 'sm' | 'md' | 'lg';
	}

	// Default profile picture per animal — a static icon in the assets bucket
	// keyed `<animal>-user-icon.webp` (chicken/dog/goose/duck/cat/lizard).
	// avatarSeed + gender are still surfaced on data-* attributes so the future
	// procedural-avatar system can drop in here without touching callers.
	let { animal, avatarSeed, gender, size = 'md' }: AvatarProps = $props();

	const SIZE_CLASS: Record<NonNullable<AvatarProps['size']>, string> = {
		sm: 'h-10 w-10',
		md: 'h-20 w-20',
		lg: 'h-32 w-32'
	};

	const src = $derived(asset(`${animal.toLowerCase()}-user-icon.webp`));
</script>

<div
	data-avatar-seed={avatarSeed}
	data-gender={gender}
	class="shrink-0 overflow-hidden rounded-full bg-olf-lightbrown shadow-md {SIZE_CLASS[size]}"
>
	<img {src} alt={animal.toLowerCase()} loading="lazy" class="h-full w-full object-cover" />
</div>
