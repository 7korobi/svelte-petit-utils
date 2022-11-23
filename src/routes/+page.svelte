<script lang="ts">
	import { table, __BROWSER__ } from '$lib';
	const zero = new Date().getTime();
	const namesBase = table(
		(o) => `${o.id}`,
		[
			{ id: 1, name: 'イチ', created_at: new Date().getTime() - zero },
			{ id: 2, name: 'ニ', created_at: new Date().getTime() - zero },
			{ id: 3, name: 'サン', created_at: new Date().getTime() - zero },
			{ id: 4, name: 'シ', created_at: new Date().getTime() - zero }
		]
	);
	namesBase.add([{ id: 10, name: 'トオ', created_at: new Date().getTime() - zero }]);

	//	const namesBaseCount = namesBase.reduce((o, id, { MAX, MIN, SUM, COUNT }) => ({ ...COUNT(), ...SUM(o.id) }));
	let id = 100;
	__BROWSER__ &&
		setInterval(() => {
			id++;
			namesBase.add([{ id, name: `name-${id}`, created_at: new Date().getTime() - zero }]);
		}, 50);
	let names = namesBase.toReader();
	$: namesCount = names.reduce((o, id, { GROUP, COUNT, QUANTILE, VARIANCE }) => ({
		...QUANTILE('min', 'med', 'max')((o.created_at as any) - 0),
		...VARIANCE((o.created_at as any) - 0),
		...GROUP(`size`, () => GROUP(`is ${o.name.length}`, COUNT))
	}));
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

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

<p>
	{@html JSON.stringify($namesCount).replaceAll(',', '<br/>,')}
</p>

{#each $names as item (item.id)}
	<p>
		{item.id} : {item.name}
	</p>
{/each}
