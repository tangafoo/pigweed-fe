<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Seo from '$lib/components/seo/Seo.svelte';
	import ProjectCard from '$lib/components/projects/ProjectCard.svelte';
	import { PROJECTS } from '$lib/data/projects';
</script>

<Seo title={m.nav_projects()} description="Projects at Our Little Farm." noindex />

<div class="flex-1 bg-olf-sunfadedsage px-4 py-10">
	<div class="mx-auto max-w-5xl">
		<!-- <h1 class="mb-8 w-fit font-frijole text-3xl font-bold tracking-wider text-olf-darkgreen">
			{m.nav_projects()}
		</h1> -->
		<div class="flex flex-col gap-8">
			{#each PROJECTS as project, i (i)}
				<ProjectCard {project} />
			{/each}
		</div>
	</div>
</div>
