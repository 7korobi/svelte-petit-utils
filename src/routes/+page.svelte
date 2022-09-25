<script lang="ts">
	import { Location } from '$lib';

	let searchParams = {
		keys: ['a', 'b'], // &keys=a&keys=b
		key: 'c'
	};
	let hash = 'test'; // #test
	let protocol: string; // http:
	let host: string; // localhost
	let port: number; // 3000
	let hostname: string;
	let pathname: string;
	$: console.log({ searchParams, hash, protocol, host, port, hostname, pathname });
</script>

<Location
	bind:searchParams
	bind:hash
	bind:protocol
	bind:host
	bind:port
	bind:hostname
	bind:pathname
/>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

<p>
	hash: <input type="text" bind:value={hash} />
</p>
<p>
	searchparams key: <input type="text" bind:value={searchParams.key} />
</p>
<p>
	searchparams keys:
	{#each searchParams.keys as key, idx (idx)}
		{idx}: <input type="text" bind:value={key} />
	{/each}
	{#each [''] as key, idx (searchParams.keys.length)}
		(add keys): <input type="text" bind:value={searchParams.keys[searchParams.keys.length]} />
	{/each}
</p>
