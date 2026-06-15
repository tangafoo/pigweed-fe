<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { Heart, Sprout, Recycle } from '@lucide/svelte';

	const promises = [
		// The heart is the one pop of a complementary colour on the whole home
		// page — a soft rose against all the greens and browns.
		{
			icon: Heart,
			title: m.home_promise_1_title,
			body: m.home_promise_1_body,
			iconClass: 'fill-olf-rose text-olf-rose'
		},
		{
			icon: Sprout,
			title: m.home_promise_2_title,
			body: m.home_promise_2_body,
			iconClass: 'text-olf-lightgreen'
		},
		{
			icon: Recycle,
			title: m.home_promise_3_title,
			body: m.home_promise_3_body,
			iconClass: 'text-olf-lightgreen'
		}
	];
</script>

<section class="bg-olf-darkgreen px-6 py-12 text-olf-beige">
	<p class="text-center font-oswald text-xs tracking-[0.25em] text-olf-lightgreen uppercase">
		{m.home_promise_kicker()}
	</p>
	<h2 class="mt-1 text-center font-homemade-apple text-3xl">
		{m.home_promise_heading()}
	</h2>
	<div class="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-6">
		{#each promises as p, i (i)}
			{@const Icon = p.icon}
			<div class="flex flex-1 flex-col items-center gap-2 text-center">
				<Icon size={36} strokeWidth={1.5} class={p.iconClass} />
				<p class="font-supermercado-one text-lg">{p.title()}</p>
				<p class="max-w-xs font-oswald text-sm text-olf-beige/75">{p.body()}</p>
			</div>
		{/each}
	</div>
</section>
