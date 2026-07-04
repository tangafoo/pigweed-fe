<script lang="ts">
	import type { SegmentMeta } from '$lib/utils/analytics';

	// The RFM segment pill. Colour follows a fixed status-style tone and ALWAYS
	// ships with the label — never colour alone (accessibility). `blurb` shows as
	// a title tooltip so the meaning is discoverable.
	let { segment, size = 'sm' }: { segment: SegmentMeta; size?: 'sm' | 'md' } = $props();

	const toneClass: Record<SegmentMeta['tone'], string> = {
		good: 'bg-olf-darkgreen text-olf-eggshell',
		loyal: 'bg-olf-moss text-olf-eggshell',
		active: 'bg-olf-lightgreen text-olf-darkgreen',
		new: 'bg-olf-blue text-olf-eggshell',
		warn: 'bg-olf-yolk text-olf-darkgreen',
		lost: 'bg-olf-darkbrown/70 text-olf-eggshell'
	};
</script>

<span
	title={segment.blurb}
	class="inline-flex items-center rounded-full font-oswald font-bold tracking-wide uppercase {toneClass[
		segment.tone
	]} {size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-xxs'}"
>
	{segment.label}
</span>
