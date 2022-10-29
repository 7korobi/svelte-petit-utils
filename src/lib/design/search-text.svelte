<script lang="ts">
	import { nop, timeoutOn, instanceId, wordSearch } from '$lib';

	const id = instanceId();
	const log_id = instanceId();

	export let name: string;
	export let size = 30;
	export let placeholder = 'キーワードを入力';

	export let delay = 1000;

	export let value: string;
	export let data: string[] = [];
	export let regexp: RegExp;

	export let onFocus = () => {};

	let bind_value = value;

	$: debounce(bind_value);
	$: regexp = wordSearch(value);

	let bye = nop;
	function debounce(newValue: string) {
		bye();
		bye = timeoutOn(() => {
			value = bind_value;
		}, delay);
	}
</script>

<label for={id}>
	<svg id="icon-search" preserveAspectRatio="xMidYMid slice" viewBox="0 0 24 24">
		<g fill="none">
			<circle cx="15" cy="9" r="6" fill="var(--btnOn, silver)" />
			<path
				d="M3 21L10.5 13.5L10.757 13.243a6 6 0 1 1 8.485-8.486a6 6 0 0 1-8.485 8.486z"
				stroke="var(--pen, black)"
				stroke-width="2"
				stroke-linecap="round"
				class="line"
			/>
		</g>
	</svg>

	<input
		type="search"
		list={log_id}
		bind:value={bind_value}
		{id}
		{size}
		{name}
		{placeholder}
		on:focus={onFocus}
	/>
	&nbsp;
	<datalist id={log_id}>
		{#each data as word}
			<option value={word} />
		{/each}
	</datalist>
</label>

<style>
	svg {
		z-index: 99999;
		margin-right: -1.2em;
		width: 1em;
		height: 1em;
		speak: none;
		user-select: none;
		vertical-align: middle;
		overflow: visible;
		display: inline-block;
	}
	.line {
		animation-delay: 0s;
		animation-duration: 3s;
		animation-iteration-count: infinite;
		animation-timing-function: ease-in;
		animation-direction: alternate;
		animation-fill-mode: forwards;
		animation-name: stroke-150;
		opacity: 0;
		stroke-dasharray: 150;
		stroke-dashoffset: 150;
	}
	@keyframes stroke-150 {
		0% {
			stroke-dashoffset: 150;
			opacity: 0;
		}
		1% {
			stroke-dashoffset: 150;
			opacity: 1;
		}
		100% {
			stroke-dashoffset: 0;
			opacity: 1;
		}
	}

	label {
		display: flex;
		align-items: center;
	}
	input {
		padding: 0 0 0 1.4em;
		border-radius: 1em;
		flex-grow: 1;
	}
</style>
