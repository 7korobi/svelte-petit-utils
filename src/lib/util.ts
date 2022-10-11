import { listen } from 'svelte/internal';

let counter = 360;
export function instanceId() {
	return (counter++).toString(36);
}

export function timeoutOn(cb: () => void, msec: number) {
	const tid = setTimeout(cb, msec);
	return () => clearTimeout(tid);
}

export function intervalOn(cb: () => void, msec: number) {
	const tid = setInterval(cb, msec);
	return () => clearInterval(tid);
}

export async function sleep(msec: number, options: { signal?: AbortSignal }) {
	return new Promise<void>((ok, ng) => {
		setTimeout(ok, msec);
		if (options.signal) {
			const bye = listen(options.signal, 'abort', () => {
				bye();
				ng();
			});
		}
	});
}
