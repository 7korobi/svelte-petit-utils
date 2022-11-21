<script lang="ts">
	import { table, __BROWSER__ } from '$lib';
	const namesBase = table(
		(o) => `${o.id}`,
		[
			{ id: 1, name: 'イチ' },
			{ id: 2, name: 'ニ' },
			{ id: 3, name: 'サン' },
			{ id: 4, name: 'シ' }
		]
	);
	namesBase.add([{ id: 10, name: 'トオ' }]);

	//	const namesBaseCount = namesBase.reduce((o, id, { MAX, MIN, SUM, COUNT }) => ({ ...COUNT(), ...SUM(o.id) }));
	let id = 100;
	__BROWSER__ &&
		setInterval(() => {
			id++;
			namesBase.add([{ id, name: `name-${id}` }]);
		}, 2000);
	let names = namesBase.toReader();
	$: namesCount = names.reduce((o, id, { GROUP, COUNT, MEDIAN, VARIANCE, MAX, MIN }) => ({
		...MAX(o.id),
		...MIN(o.id),
		...VARIANCE(o.id),
		...MEDIAN(o.id),
		...GROUP(`length ${o.name.length}`, COUNT)
	}));
	$: console.log($namesCount['length 1'].count);
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
		names = names.order((o) => o.id);
	}}>order to id {$names.orderType}</button
>
<button
	on:click={() => {
		names = names.order((o) => o.name);
	}}>order to name {$names.orderType}</button
>
<button
	on:click={() => {
		names = names.order((o) => o.name?.length);
	}}>order to name.length {$names.orderType}</button
>
<button
	on:click={() => {
		names = names.where((o) => 0 === o.id % 2).shuffle();
	}}>shuffle</button
>

<p>
	{names.find('10')?.id} : {names.find('10')?.name}
</p>
