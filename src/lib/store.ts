import type { Readable } from 'svelte/store';
import { writable } from 'svelte/store';
import { nop, timeoutOn } from './util';

export function debounce<T>(init: T, timeout: number) {
	let bye = nop;
	const { set, subscribe } = writable(init, (set) => () => {
		bye();
	});

	return {
		set(value: T) {
			bye();
			bye = timeoutOn(() => {
				set(value);
			}, timeout);
		},
		subscribe
	};
}

type Separate<T extends string> = Readable<string> & {
	set(value: string): void;
	to(substring: string): string;
	all: string[];
} & {
	[key in `${T}_id`]: string;
} & {
	[key in `${T}_idx`]: string;
} & {
	[key in `${T}s`]: string[];
};

function separate<sep extends string, T extends string>(
	init: string,
	sep: sep,
	...names: readonly T[]
): Separate<T> {
	const { set, subscribe } = writable(init);
	const data: any = {
		set(value: string | string[]) {
			const [all, str] =
				'string' === typeof value ? [value.split(sep), value] : [value, value.join('sep')];
			data.all = all;
			names.forEach((name, at) => {
				if (!name) return;
				const sub_value = all.slice(0, at + 1);
				data[`${name}s`] = sub_value;
				data[`${name}_id`] = sub_value.join(sep);
				data[`${name}_idx`] = all[at];
			});
			set(str);
		},
		to(value: string | string[]) {
			const [sub, str] =
				'string' === typeof value ? [value.split(sep), value] : [value, value.join('sep')];
			const gap = names.length - sub.length;
			const result = (data.all as string[]).map((idx, at) =>
				at < gap ? idx : sub[at - gap] || idx
			);
			return result.join(sep);
		},
		subscribe
	};
	return data;
}

let val = separate('a-b-c', '-', 'aa', 'bb', 'cc');
val.set('a-1-1');
val.to('b--1');
