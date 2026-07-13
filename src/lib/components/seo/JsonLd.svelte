<script lang="ts">
	type JsonLdProps = { data: Record<string, unknown> };

	let { data }: JsonLdProps = $props();
	// Escape `<` so any nested string can't accidentally close the script tag.
	const json = $derived(JSON.stringify(data).replace(/</g, '\\u003c'));
	// Assembled here (closer split so it can't end this script block) — an
	// inline `<script` in the markup breaks the svelte-eslint parser.
	const tag = $derived(`<script type="application/ld+json">${json}</` + 'script>');
</script>

<svelte:head>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- structured data by design; `json` escapes every `<` above -->
	{@html tag}
</svelte:head>
