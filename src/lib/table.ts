import type { Readable, Subscriber, Writable, Unsubscriber } from 'svelte/store';
import { inPlaceSort, sort, type ISortBy } from './fast-sort.js';

type HasKey<T> = { key?: string } & T;
type IQuery<T> = HasKey<(item: T) => boolean>;
type IOrder<T> = HasKey<ISortBy<T> | ISortBy<T>[]>;

type SubscribeSet<T> = readonly [run: Subscriber<T>, invalidate: (value?: T) => void];

type TableChildren<T> = { [idx in string]: TableWritable<T> };
type TableExtra = {
	orderType: boolean;
	where?: string;
	order?: string;
};
type TableWritable<T> = TableReadable<T> & {
	toReader(): TableReadable<T>;
	set(data: T[]): void;
	add(data: T[]): void;
	delBy(ids: string[]): void;
};
type TableReadable<T> = Readable<T[] & TableExtra> & {
	find(key: string): T;
	shuffle(): TableReadable<T>;
	where(query: IQuery<T>, key?: string): TableReadable<T>;
	order(order: IOrder<T>, key?: string): TableReadable<T>;
	reduce<R>(mapper: IMapper<T, R>, key?: string): MapReduceReadable<R>;

	idx: string;
};

type IMapper<T, R> = HasKey<(item: T) => R>;
type MapReduceContext<T, G> = readonly [
	G,
	T,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void
];

type MapReduceChildren<T, R> = { [idx in string]: MapReduceWritable<T, R> };
type MapReduceWritable<T, R> = MapReduceReadable<R> & {
	set(data: T[]): void;
	add(data: T[]): void;
	delBy(ids: string[]): void;
};
type MapReduceReadable<R> = Readable<R> & {
	idx: string;
};

function nop() {}

function subKey(oldIt: HasKey<any>, newIt: HasKey<any>, key?: string) {
	let result = '';

	if (newIt) {
		result = key || newIt.key || newIt.toString();
		newIt.key = result;
	}
}

export function table<T>(finder: (item: T) => string, data: T[]) {
	const writable = writableTable(finder);
	writable.set(data);
	return writable;
}

function writableTable<T>(
	finder: (item: T) => string,
	children: TableChildren<T> = {},
	orderType: boolean = true,
	query?: IQuery<T>,
	sort?: IOrder<T>
): TableWritable<T> {
	const idx = `${query?.key || ''}${orderType ? '+' : '-'}${sort?.key || ''}`;

	const subscribers = new Set<SubscribeSet<T[] & TableExtra>>();
	const reduceSubscribers = new Set<SubscribeSet<any>>();

	let list: T[] & TableExtra = [] as any;
	let findAt: { [key in string]: T } = {};

	return {
		subscribe,
		find,
		shuffle,
		where,
		order,
		reduce,

		set,
		add,
		delBy,
		toReader,

		idx
	};

	// private section.
	function toChild(w: TableWritable<T>): TableReadable<T> {
		const { find, idx, subscribe, shuffle, where, order, reduce } = w;

		if (children[idx]) return children[idx];

		w.add(list);
		children[idx] = w;
		return { find, idx, subscribe, shuffle, where, order, reduce };
	}

	function subKey(oldIt: HasKey<any>, newIt: HasKey<any>, key?: string) {
		let result = '';

		if (newIt) {
			result = key || newIt.key || newIt.toString();
			newIt.key = result;
		}
	}

	// MapReduce section.
	function reduce<R>(mapper: IMapper<T, R> | undefined, key = undefined) {
		const reduceIdx = `${idx}:reduce`;
		const reduceChildren = children as any as MapReduceChildren<T, R>;
		const result = {} as R;
		let inits: { [key in string]: () => void } = {};
		let calcs: { [key in string]: () => void } = {};
		let addAts: { [key in string]: () => void } = {};
		let delAts: { [key in string]: () => void } = {};

		let base: any = result;
		let item: T;
		let headIdx = '';
		let contextAt = 0;

		subKey(undefined, mapper, key);

		const tools = {
			...BasicTools<T>(context),
			GROUP<K extends string, G>(key: K, cb: () => G) {
				const ground = base;
				ground[key] ||= {};

				base = ground[key];
				cb();
				base = ground;

				return undefined as any as { [idx in K]: G };
			}
		};

		toChild({ idx: reduceIdx, subscribe, set, add, delBy });
		return { idx: reduceIdx, subscribe };

		// private section for MapReduce
		function toChild(w: MapReduceWritable<T, R>): MapReduceReadable<R> {
			const { idx, subscribe } = w;

			if (reduceChildren[idx]) return reduceChildren[idx];

			w.add(list);
			reduceChildren[idx] = w;
			return { idx, subscribe };
		}

		// Mapper section for MapReduce
		function context<G>(ctxIdx: string): MapReduceContext<T, G> {
			const baseIdx = `${headIdx}.${ctxIdx}.`;
			contextAt++;
			return [
				base as G,
				item,
				(cb) => {
					inits[baseIdx] = cb;
				},
				(cb) => {
					calcs[baseIdx] = cb;
				},
				(cb) => {
					addAts[baseIdx + contextAt] = cb;
				},
				(cb) => {
					delAts[baseIdx + contextAt] = cb;
				}
			] as const;
		}

		// Readable section for MapReduce
		function subscribe(
			run: (result: R) => void,
			invalidate: (value?: R) => void = nop
		): Unsubscriber {
			const subscriber = [run, invalidate] as const;
			reduceSubscribers.add(subscriber);
			if (reduceSubscribers.size === 1) {
				// do START. // stop = start(set)
			}

			run(result);

			return () => {
				reduceSubscribers.delete(subscriber);
				if (reduceSubscribers.size === 0) {
					// do STOP. // stop!(); stop = null;
				}
			};
		}
		// Writable private section for MapReduce.
		function publish() {
			list = Object.values(findAt) as any;

			// skip if stop.
			for (const [publishTo, invalidate] of reduceSubscribers) {
				invalidate();
				publishTo(list);
			}
		}

		// Writable section for MapReduce
		function set(data: T[]) {
			if (query) data = data.filter(query);

			findAt = {};
			data.forEach(itemAdd);
			publish();
		}

		function add(data: T[]) {
			if (query) data = data.filter(query);

			data.forEach(itemAdd);
			publish();
		}

		function delBy(ids: string[]) {
			ids.forEach(itemDelBy);
			publish();
		}
	}

	// Readable section.
	function subscribe(
		run: (list: T[] & TableExtra) => void,
		invalidate: (value?: T[] & TableExtra) => void = nop
	): Unsubscriber {
		const subscriber = [run, invalidate] as const;
		subscribers.add(subscriber);
		if (subscribers.size === 1) {
			// do START. // stop = start(set)
		}

		run(list);

		return () => {
			subscribers.delete(subscriber);
			if (subscribers.size === 0) {
				// do STOP. // stop!(); stop = null;
			}
		};
	}

	function find(key: string) {
		return findAt[key];
	}

	function shuffle() {
		const newSort: IOrder<T> = () => Math.random();
		newSort.key = 'shuffle';
		const w = writableTable<T>(finder, children, true, query, newSort);
		delete children[w.idx];
		return toChild(w);
	}

	function where(newQuery: IQuery<T> | undefined, key = undefined) {
		subKey(query, newQuery, key);
		return toChild(writableTable<T>(finder, children, orderType, newQuery, sort));
	}

	function order(newSort: IOrder<T> | undefined, key = undefined) {
		subKey(sort, newSort, key);
		const isSame = !sort || !newSort || sort.key === newSort.key;
		const newOrderType = isSame ? !orderType : true;
		return toChild(writableTable<T>(finder, children, newOrderType, query, newSort));
	}

	// Writable private section.
	function publish() {
		list = Object.values(findAt) as any;
		if (sort) {
			orderType ? inPlaceSort(list).desc(sort) : inPlaceSort(list).asc(sort);
		}

		list.where = query?.key;
		list.order = sort?.key;
		list.orderType = orderType;

		// skip if stop.
		for (const [publishTo, invalidate] of subscribers) {
			invalidate();
			publishTo(list);
		}
	}

	function itemAdd(item: T) {
		const id = finder(item);
		itemDelBy(id);
		findAt[id] = item;
	}

	function itemDelBy(id: string) {
		const item: T = findAt[id];
		if (item) {
			delete findAt[id];
		}
	}

	// Writable section.
	function toReader() {
		return { find, idx, subscribe, shuffle, where, order, reduce };
	}

	function update(fn: (list: T[]) => T[]) {
		set(fn(list));
	}

	function set(data: T[]) {
		if (query) data = data.filter(query);

		findAt = {};
		data.forEach(itemAdd);
		publish();

		if (children[idx]) {
		} else {
			for (const child of Object.values(children)) {
				child.set(data);
			}
		}
	}

	function add(data: T[]) {
		if (query) data = data.filter(query);

		data.forEach(itemAdd);
		publish();

		if (children[idx]) {
		} else {
			for (const child of Object.values(children)) {
				child.add(data);
			}
		}
	}

	function delBy(ids: string[]) {
		if (children[idx]) {
		} else {
			for (const child of Object.values(children)) {
				child.delBy(ids);
			}
		}

		ids.forEach(itemDelBy);
		publish();
	}
}

function BasicTools<T>(context: <G>(key: string) => MapReduceContext<T, G>) {
	return { COUNT, SUM, POW, MAX, MIN, AVERAGE, VARIANCE };

	function COUNT(n = 1) {
		const [o, item, format, calc, add, del] = context<{ count: number }>('COUNT');

		format(() => (o.count = 0));
		add(() => (o.count += n));
		del(() => (o.count -= n));
		return undefined as any as typeof o;
	}

	function SUM(n: number) {
		const [o, item, format, calc, add, del] = context<{ sum: number }>('SUM');

		format(() => (o.sum = 0));
		add(() => (o.sum += n));
		del(() => (o.sum -= n));
		return undefined as any as typeof o;
	}

	function POW(n: number) {
		const [o, item, format, calc, add, del] = context<{ pow: number }>('POW');

		format(() => (o.pow = 1));
		add(() => (o.pow *= n));
		del(() => (o.pow /= n));
		return undefined as any as typeof o;
	}

	function AVERAGE() {
		const [oo, item, format, calc, add, del] = context<{ count: number; avg: number }>('AVERAGE');
		const o = oo as { sum: number; pow: number } & typeof oo;
		format(() => (o.avg = 0));
		calc(() => {
			if ('sum' in o && 'count' in o) o.avg = o.sum / o.count;
			if ('pow' in o && 'count' in o) o.avg = o.pow ** (1 / o.count);
		});
		return undefined as any as typeof oo;
	}

	function standard(this: any, data: number) {
		return (data - this.avg) / this.sd;
	}

	function VARIANCE(sum: number, count = 1) {
		const [oo, item, format, calc, add, del] = context<{
			sum: number;
			count: number;
			avg: number;
			variance: number;
			standard(data: number): number;
			sd: number;
		}>('VARIANCE');
		const o = oo as { variance_data: number[] } & typeof oo;

		format(() => {
			o.variance_data = [];
			o.avg = 0;
			o.sum = 0;
			o.count = 0;
			o.variance = 0;
			o.sd = 0;
			o.standard = standard;
		});

		add(() => {
			o.variance_data.push(sum);
			o.sum += sum;
			o.count += count;
		});

		del(() => {
			const idx = o.variance_data.indexOf(sum);
			o.variance_data.splice(idx, 1);
			o.sum -= sum;
			o.count -= count;
		});

		calc(() => {
			if (!('sum' in o && 'count' in o)) return;
			o.avg = o.sum / o.count;

			let sum = 0;
			for (let x of o.variance_data) {
				sum += (x - o.avg) ** 2;
			}

			o.variance = sum / (o.count - 1);
			o.sd = o.variance ** 0.5;
		});

		return undefined as any as typeof oo;
	}

	function MAX<X extends number | string>(x: X) {
		const [o, item, format, calc, add, del] = context<{ max: X; maxIs: T }>('MAX');

		format(() => {
			o.max = o.maxIs = undefined as any;
		});
		add(() => {
			if (x <= o.max) return;
			o.max = x;
			o.maxIs = item;
		});
		del(() => {
			if (x <= o.max) return;
			throw "can't execute.";
		});
		return undefined as any as typeof o;
	}

	function MIN<X extends number | string>(x: X) {
		const [o, item, format, calc, add, del] = context<{ min: X; minIs: T }>('MIN');

		format(() => {
			o.min = o.minIs = undefined as any;
		});
		add(() => {
			if (o.min <= x) return;
			o.min = x;
			o.minIs = item;
		});
		del(() => {
			if (o.min <= x) return;
			throw "can't execute.";
		});
		return undefined as any as typeof o;
	}
}
