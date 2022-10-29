<script lang="ts">
	import { table, SearchText } from '$lib';
	const names = table([
		{ id: 1, name: 'イチ' },
		{ id: 2, name: 'ニ' },
		{ id: 3, name: 'サン' },
		{ id: 4, name: 'シ' }
	]);
	const names_order_type = names.orderType;

	let search = 'デフォルト';
	let search_reg;
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

{#each $names as item (item.id)}
	<p>
		{item.id} : {item.name}
	</p>
{/each}

<button
	on:click={() => {
		names.order((o) => o.id, 'by id');
	}}>order to id {$names_order_type}</button
>
<button
	on:click={() => {
		names.order((o) => o.name, 'by name');
	}}>order to name {$names_order_type}</button
>
<button
	on:click={() => {
		names.order((o) => o.name.length, 'by name length');
	}}>order to name.length {$names_order_type}</button
>
<button
	on:click={() => {
		names.shuffle();
	}}>shuffle</button
>

<p>
	{names.find('4')?.id} : {names.find('4')?.name}
</p>

<SearchText bind:value={search} bind:regexp={search_reg} />

{search}
{search_reg}
