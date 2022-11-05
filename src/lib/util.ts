import { listen } from 'svelte/internal';

export const nop = () => {};
export const inRange = <T extends number | string | BigInt>(min: T, value: T, max: T) => min < value ? value < max ? value : max : min;
export const isRange = <T extends number | string | BigInt>(min: T, value: T, max: T) => min < value ? value < max ? true : false : false;
export function toRange <T extends number | string | BigInt>(...ary: T[]) {
	let min = ary[0];
	let max = ary[0];
	for(const n of ary) {
		if (n < min) min = n;
		if (max < n) max = n;
	}
	return [min, max];
}

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
