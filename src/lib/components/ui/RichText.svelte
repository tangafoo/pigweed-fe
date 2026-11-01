<script lang="ts">
	import { RICH_MARK_CLASS, type RichText } from '$lib/utils/richText';

	let { text }: { text: RichText } = $props();

	const spans = $derived(typeof text === 'string' ? [text] : text);
</script>

{#each spans as span, i (i)}{#if typeof span === 'string'}{span}{:else}<span
			class={span.marks.map((mk) => RICH_MARK_CLASS[mk]).join(' ')}>{span.text}</span
		>{/if}{/each}
