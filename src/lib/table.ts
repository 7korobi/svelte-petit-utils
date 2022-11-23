import type { Readable, Subscriber, Unsubscriber } from 'svelte/store';
import { BasicTools } from './table-tools.js';

export type Orderable = Date | bigint | number | string | boolean;

type HasKey<T> = { key?: string } & T;
type IQuery<T> = HasKey<(item: T) => boolean>;
type IOrder<T> = HasKey<(item: T) => Orderable>;

type SubscribeSet<T> = readonly [run: Subscriber<T>, invalidate: (value?: T) => void];

type TableExtra = {
	orderType: boolean;
	where?: string;
	order?: string;
};
type TableChildren<T> = { [idx in string]: TableWritable<T> };
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
	reduce<R, TOOL>(
		mapper: IMapper<T, R, Tools<TOOL>>,
		key?: string,
		customTools?: (context: <G>(key: string) => MapReduceContext<T, G>) => TOOL
	): MapReduceReadable<R>;

	idx: string;
};

type GroupTool = <K extends string, G>(key: K, cb: () => G) => { [idx in K]: G };
type Tools<TOOL> = TOOL & ReturnType<typeof BasicTools> & { GROUP: GroupTool };

type IMapper<T, R, TOOL> = HasKey<(item: T, id: string, tool: TOOL) => R>;

export type MapReduceContext<T, G> = readonly [
	G,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void,
	<C>() => [C, T, string]
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

function findIndex(orderType: boolean, sortKeys: Orderable[], itemKey: Orderable) {
	let idx = sortKeys.length;
	if (orderType) {
		while (idx--) {
			if (sortKeys[idx] >= itemKey) return idx + 1;
		}
		return 0;
	} else {
		while (idx--) {
			if (sortKeys[idx] <= itemKey) return idx + 1;
		}
		return sortKeys.length;
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

	const baseIdx = idx;
	const baseChildren = children;

	const sortKeys: ReturnType<IOrder<T>>[] = [];
	const list: T[] & TableExtra = [] as any;
	list.where = query?.key;
	list.order = sort?.key;
	list.orderType = orderType;

	let findAt: { [key in string]: T } = {};

	if (!query && !sort) {
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

		// parent writable.
		function set(data: T[]) {
			if (query) data = data.filter(query);

			findAt = {};
			data.forEach(itemAdd);
			publish();

			for (const child of Object.values(children)) {
				child.set(data);
			}
		}

		function add(data: T[]) {
			if (query) data = data.filter(query);

			data.forEach(itemAdd);
			publish();

			for (const child of Object.values(children)) {
				child.add(data);
			}
		}

		function delBy(ids: string[]) {
			for (const child of Object.values(children)) {
				child.delBy(ids);
			}

			for (const id of ids) {
				const idx = list.findIndex((item) => id === finder(item));
				list.splice(idx, 1);
				delete findAt[id];
			}
			publish();
		}
	} else {
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

		// child writable.
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
			for (const id of ids) {
				const idx = list.findIndex((item) => id === finder(item));
				list.splice(idx, 1);
				delete findAt[id];
			}
			publish();
		}
	}

	// private section.
	function toChild(w: TableWritable<T>): TableReadable<T> {
		const { find, idx, subscribe, shuffle, where, order, reduce } = w;

		if (children[idx]) return children[idx];

		w.set(list);
		children[idx] = w;
		return { find, idx, subscribe, shuffle, where, order, reduce };
	}

	// MapReduce section.
	function reduce<R, TOOL>(
		mapper: IMapper<T, R, Tools<TOOL>>,
		key = undefined,
		customTools: (context: <G>(key: string) => MapReduceContext<T, G>) => TOOL = () => {
			return {} as TOOL;
		}
	) {
		subKey(undefined, mapper, key);

		const idx = `${baseIdx}:${mapper.key}`;
		const children = baseChildren as any as MapReduceChildren<T, R>;
		const subscribers = new Set<SubscribeSet<R>>();
		const result = {} as R;

		let locals: { [baseIdx in string]: any } = {};
		let inits: { [baseIdx in string]: () => void } = {};
		let calcs: { [baseIdx in string]: () => void } = {};
		let addAts: { [itemId in string]: { [baseIdx in string]: () => void } } = {};
		let delAts: { [itemId in string]: { [baseIdx in string]: () => void } } = {};

		let base: any = result;
		let item: T;
		let itemId: string;
		let groupIdx: string;
		let localIdx: number;

		const tools: Tools<TOOL> = {
			...BasicTools<T>(context),
			...customTools(context),
			GROUP<K extends string, G>(key: K, cb: () => G) {
				const stack = [base, groupIdx, localIdx];

				base[key] ||= {};
				base = base[key];
				groupIdx = `${groupIdx}/${localIdx}/${key}`;
				localIdx = 0;
				cb();

				[base, groupIdx, localIdx] = stack;

				return undefined as any as { [idx in K]: G };
			}
		};

		return toChild({ idx, subscribe, set, add, delBy });

		// private section for MapReduce
		function toChild(w: MapReduceWritable<T, R>): MapReduceReadable<R> {
			const { idx, subscribe } = w;

			if (children[idx]) return children[idx];

			w.set(list);
			children[idx] = w;
			return { idx, subscribe };
		}

		// Mapper section for MapReduce
		function context<G>(ctxIdx: string): MapReduceContext<T, G> {
			++localIdx;
			const path = `${groupIdx}/${localIdx}/${ctxIdx}`;
			return [
				base as G,
				(cb) => {
					if (!inits[path]) cb();
					inits[path] = cb;
				},
				(cb) => {
					calcs[path] = cb;
				},
				(cb) => {
					addAts[itemId][path] = cb;
				},
				(cb) => {
					delAts[itemId][path] = cb;
				},
				() => {
					locals[path] ??= {};
					return [locals[path], item, itemId];
				}
			] as const;
		}

		// Readable section for MapReduce
		function subscribe(
			run: (result: R) => void,
			invalidate: (value?: R) => void = nop
		): Unsubscriber {
			const subscriber = [run, invalidate] as const;
			subscribers.add(subscriber);
			if (subscribers.size === 1) {
				// do START. // stop = start(set)
			}

			run(result);

			return () => {
				subscribers.delete(subscriber);
				if (subscribers.size === 0) {
					// do STOP. // stop!(); stop = null;
				}
			};
		}
		// Writable private section for MapReduce.
		function publish() {
			for (const cb of Object.values(calcs)) {
				cb();
			}

			// skip if stop.
			for (const [publishTo, invalidate] of subscribers) {
				invalidate();
				publishTo(result);
			}
		}

		function itemAdd(o: T) {
			item = o;
			itemId = finder(item);
			groupIdx = '';
			localIdx = 0;

			const dels = delAts[itemId];
			addAts[itemId] = {};
			delAts[itemId] = {};
			mapper(item, itemId, tools);

			if (dels) {
				for (const cb of Object.values(dels)) {
					cb();
				}
			}

			for (const cb of Object.values(addAts[itemId])) {
				cb();
			}
		}

		// Writable section for MapReduce
		function set(data: T[]) {
			if (query) data = data.filter(query);

			for (const cb of Object.values(inits)) {
				cb();
			}

			data.forEach(itemAdd);
			publish();
		}

		function add(data: T[]) {
			if (query) data = data.filter(query);

			data.forEach(itemAdd);
			publish();
		}

		function delBy(ids: string[]) {
			for (const id of ids) {
				for (const cb of Object.values(delAts[id])) {
					cb();
				}
			}
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
		// skip if stop.
		for (const [publishTo, invalidate] of subscribers) {
			invalidate();
			publishTo(list);
		}
	}

	function itemAdd(item: T) {
		const id = finder(item);
		delete findAt[id];
		findAt[id] = item;
		if (sort) {
			const itemKey = sort(item);
			const idx = findIndex(orderType, sortKeys, itemKey);
			sortKeys.splice(idx, 0, itemKey);
			list.splice(idx, 0, item);
		} else {
			list.push(item);
		}
	}

	// Writable section.
	function toReader() {
		return { find, idx, subscribe, shuffle, where, order, reduce };
	}
}
