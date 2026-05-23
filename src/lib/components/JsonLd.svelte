<script lang="ts">
	type JsonLdProps = { data: Record<string, unknown> };

	let { data }: JsonLdProps = $props();
	// Escape `<` so any nested string can't accidentally close the script tag.
	const json = $derived(JSON.stringify(data).replace(/</g, '\\u003c'));
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${json}</script>`}
</svelte:head>
