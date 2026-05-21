<script lang="ts">
	import type { Animal, Gender } from '@meteorclass/pigweed-contract';

	interface AvatarProps {
		animal: Animal;
		avatarSeed: number;
		gender: Gender;
		size?: 'sm' | 'md' | 'lg';
	}

	// Placeholder for the procedural avatar system. avatarSeed + gender are
	// surfaced on data-* attributes so every call site already passes them —
	// the real SVG avatar (drawn from animal + avatarSeed, varied by gender)
	// drops in here without touching a single caller.
	let { animal, avatarSeed, gender, size = 'md' }: AvatarProps = $props();

	const SIZE_CLASS: Record<NonNullable<AvatarProps['size']>, string> = {
		sm: 'h-10 w-10 text-xxs',
		md: 'h-20 w-20 text-sm',
		lg: 'h-32 w-32 text-2xl'
	};
</script>

<div
	data-avatar-seed={avatarSeed}
	data-gender={gender}
	class="flex shrink-0 items-center justify-center rounded-full bg-olf-lightbrown {SIZE_CLASS[
		size
	]}"
>
	<span class="font-supermercado-one text-white">{animal}</span>
</div>
