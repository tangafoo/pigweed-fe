<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/seo/Seo.svelte';
	import RichText from '$lib/components/ui/RichText.svelte';
	import { projectNumber } from '$lib/data/projects';

	// Deliberately bare for now: the project's details, one after another.
	let { data } = $props();
	const project = $derived(data.project);
</script>

<Seo title={m.nav_projects()} description="A project at Our Little Farm." noindex />

<div class="flex-1 bg-olf-sunfadedsage px-4 py-10 font-oswald text-olf-darkgreen">
	<article class="mx-auto flex max-w-3xl flex-col gap-4">
		<p class="font-mono text-sm font-light">{projectNumber(project)}</p>
		<h1 class="text-3xl font-bold text-olf-darkbrown"><RichText text={project.title} /></h1>
		<p class="font-mono text-olf-darkbrown/80"><RichText text={project.subtitle} /></p>
		{#each project.imageUrls as url (url)}
			<img src={url} alt="" class="w-full rounded-2xl bg-black object-contain" />
		{/each}
		{#each project.description as paragraph, i (i)}
			<p class="leading-relaxed"><RichText text={paragraph} /></p>
		{/each}
		{#if project.toolsUsed.length}
			<p>{m.projects_tools()}: {project.toolsUsed.map((t) => t.name).join(', ')}</p>
		{/if}
		{#if project.people.length}
			<p>{m.projects_people()}: {project.people.map((p) => p.name).join(', ')}</p>
		{/if}
	</article>
</div>
