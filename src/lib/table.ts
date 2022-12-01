import type { Readable, Subscriber, Unsubscriber } from 'svelte/store';
import { BasicTools } from './table-tools.js';

export type Orderable = Date | bigint | number | string | boolean;

type HasKey<T> = { key?: string } & T;
type IQuery<T> = HasKey<(item: T) => boolean>;
type IOrder<T> = HasKey<(item: T) => Orderable[] | Orderable>;

type SubscribeSet<T> = readonly [run: Subscriber<T>, invalidate: (value?: T) => void];

type TableExtra = {
	orderType: boolean;
	where?: string;
	order?: string;
};
type TableChildren<T> = { [idx in string]: TableBase<T> };
type TableBase<T> = {
	set(data: T[]): void;
	add(data: T[]): void;
	delBy(ids: string[]): void;
}
type TableWritable<T> = TableBase<T> & TableReadable<T> & {
	toReader(): TableReadable<T>;

	entagle(): [Finder<T>, TableChildren<T>];
	belongsTo<U>(pair: TableWritable<U>, t2key: toKey<T>, u2key: toKey<U>, tBind: Bind<T, U>): void;
	hasMany<U>(
		pair: TableWritable<U>,
		u2key: toKey<U>,
		t2key: toKey<T>,
		uBind: Bind<U, T>,
		tBind: Bind<T, U>
	): void;
	through<X, Y>(
		xw: TableWritable<X>,
		yw: TableWritable<Y>,
		xBind: (x:X)=>any,
		yBind: (y:Y)=>any
	): void;
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

function spliceAt(orderType: boolean, sortKeys: Orderable[][], itemKey: Orderable[]) {
	// バイナリサーチ
	if (orderType) {
		// desc list scan.
		let head = 0;
		let tail = sortKeys.length

		while (head < tail) {
			let sortIdx = itemKey.length;
			while (sortIdx--) {
				const b = itemKey[sortIdx];
				if (undefined === b) return tail;

				const idx = (head + tail) >>> 1;
				const a = sortKeys[idx][sortIdx];
				if (undefined === a) {
					tail = idx;
					break;
				} else if (b > a) {
					tail = idx;
					break;
				} else if (a > b) {
					head = idx + 1;
					break;
				} else {
					idx + 1;
					continue;
				}
			}
		}
		return head;
	} else {
		// asc list scan.
		let head = 0;
		let tail = sortKeys.length

		while (head < tail) {
			let sortIdx = itemKey.length;
			while (sortIdx--) {
				const b = itemKey[sortIdx];
				if (undefined === b) return tail;

				const idx = (head + tail) >>> 1;
				const a = sortKeys[idx][sortIdx];
				if (undefined === a) {
					tail = idx;
					break;
				} else if (b < a) {
					tail = idx;
					break;
				} else if (a < b) {
					head = idx + 1;
					break;
				} else {
					idx + 1;
					continue;
				}
			}
		}
		return head;
	}
}

type Finder<A> = (a: A) => string;
type toKey<A> = (a: A) => Orderable | undefined;
type Bind<A, B> = (a: A, bs: B[]) => any;
type Foreign<A> = { [id: string]: A };
type Foreigns<A, B> = {
	[key: string]: [Foreign<A>, Foreign<B>];
};
type ByForeign<A, B> = [
	aw: TableWritable<A>,
	aFinder: Finder<A>,
	aChildren: TableChildren<A>,
	a2key: toKey<A>,
	aBind?: Bind<A, B>
];

function byForeign<T, U>(
	[tw, tFinder, tChildren, t2key, tBind]: ByForeign<T, U>,
	[uw, uFinder, uChildren, u2key, uBind]: ByForeign<U, T>
): any {
	const foreign: Foreigns<T, U> = {};

	tChildren['foreign'] = doIt(tEntry)
	uChildren['foreign'] = doIt(uEntry)

	function doIt<A>(bind: (a:A)=> any) {
		return { set, add, delBy }
		function set(as: A[]) {
			as.forEach(bind)
		}
		function add(as: A[]) {
			as.forEach(bind)
		}
		function delBy(ids: string[]) {
		}
	}

	function tEntry(t: T) {
		const key = t2key(t);
		if (!key) return;

		const [ts, us] = (foreign[`${key}`] ||= [{}, {}]);
		ts[tFinder(t)] = t;

		binds(ts, us, tBind, uBind);
	}

	function uEntry(u: U) {
		const key = u2key(u);
		if (!key) return;

		const [ts, us] = (foreign[`${key}`] ||= [{}, {}]);
		us[uFinder(u)] = u;

		binds(ts, us, tBind, uBind);
	}

	function binds(ts: Foreign<T>, us: Foreign<U>, tBind?: Bind<T, U>, uBind?: Bind<U, T>) {
		const tlist = Object.values(ts);
		const ulist = Object.values(us);

		if (tBind)
			for (const t of tlist) {
				tBind(t, ulist);
			}

		if (uBind)
			for (const u of ulist) {
				uBind(u, tlist);
			}
	}
}

export function table<T>(finder: Finder<T>, data: T[]) {
	const writable = writableTable(finder);
	writable.set(data);
	return writable;
}

function writableTable<T>(
	finder: Finder<T>,
	children: TableChildren<T> = {},
	orderType: boolean = false,
	query?: IQuery<T>,
	sort?: IOrder<T>
): TableWritable<T> {
	const idx = `${query?.key || ''}${orderType ? '+' : '-'}${sort?.key || ''}`;
	const subscribers = new Set<SubscribeSet<T[] & TableExtra>>();

	const baseIdx = idx;
	const baseChildren = children;

	const sortKeys: Orderable[][] = [];
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

			entagle,
			belongsTo,
			hasMany,
			through,
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

			entagle,
			belongsTo,
			hasMany,
			through,
			idx
		};

		// child writable.
		function set(data: T[]) {
			if (query) data = data.filter(query);

			findAt = {};
			list.length = 0;

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

		if (children[idx]) return children[idx] as TableWritable<T>;

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

	// Foreign section.
	function entagle(): [Finder<T>, TableChildren<T>] {
		return [finder, baseChildren];
	}

	function belongsTo<U>(uw: TableWritable<U>, t2key: toKey<T>, u2key: toKey<U>, tBind: Bind<T, U>) {
		const [uFinder, uChildren] = uw.entagle();
		byForeign([{} as TableWritable<T>, finder, baseChildren, t2key, tBind], [uw, uFinder, uChildren, u2key]);
	}

	function hasMany<U>(
		uw: TableWritable<U>,
		u2key: toKey<U>,
		t2key: toKey<T>,
		uBind: Bind<U, T>,
		tBind: Bind<T, U>
	) {
		const [uFinder, uChildren] = uw.entagle();
		byForeign([uw, uFinder, uChildren, u2key, uBind], [{} as TableWritable<T>, finder, baseChildren, t2key, tBind]);
	}

	function through<X, Y>(
		xw: TableWritable<X>,
		yw: TableWritable<Y>,
		xBind: (x: X) => any,
		yBind: (y: Y) => any
	) {
		const [xFinder, xChildren] = xw.entagle();
		const [yFinder, yChildren] = yw.entagle();
		xChildren['through'] = doIt(xBind);
		yChildren['through'] = doIt(yBind);

		function doIt<A>(bind: (a:A)=> any) {
			return { set, add, delBy }
			function set(as: A[]) {
				as.forEach(bind)
			}
			function add(as: A[]) {
				as.forEach(bind)
			}
			function delBy(ids: string[]) {
			}
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
		return toChild(writableTable<T>(finder, children, false, query, newSort));
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
			const itemKeyBase = sort(item);
			const itemKey: Orderable[] =
				itemKeyBase instanceof Array ? itemKeyBase.reverse() : [itemKeyBase];
			const idx = spliceAt(orderType, sortKeys, itemKey);
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

type A = { _id: number; name: string; b?: B; b_id?: number; c?: C; c_id?: number };
type B = {
	_id: number;
	name: string;
	as?: A[];
	cs?: (C | undefined)[];
	parent?: B;
	children?: B[];
	parent_id?: number;
};
type C = { _id: number; name: string; as?: A[]; bs?: (B | undefined)[] };
const A = table<A>(({ _id }) => `${_id}`, [{ _id: 1, name: 'いち', b_id: 2, c_id: 4 }]);
const B = table<B>(
	({ _id }) => `${_id}`,
	[
		{ _id: 2, name: 'に', parent_id: 3 },
		{ _id: 3, name: 'さん' }
	]
);
const C = table<C>(({ _id }) => `${_id}`, [{ _id: 4, name: 'よん' }]);

A.belongsTo(
	// foreign[key] = [{},{}]
	// A#children.push(    !B.add; key = arg2(a); [as, bs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
	// B#children.push( A.add([]); key = arg3(b); [as, bs] = foreign[key]; bs[B#finder(b)] = b; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
	B,
	(a) => a.b_id,
	(b) => b._id,
	(a, bs) => (a.b = bs[0])
);
B.hasMany(
	// foreign[key] = [{},{}]
	// A#children.push( B.add([]); key = arg2(a); [as, bs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
	// B#children.push( A.add([]); key = arg3(b); [as, bs] = foreign[key]; bs[B#finder(b)] = b; as{ arg4(a, bs, a_id, b_ids) }; bs{ arg5(as, b, a_ids, b_id) })
	A,
	(a) => a.b_id,
	(b) => b._id,
	(a, bs) => (a.b = bs[0]),
	(b, as) => (b.as = as)
);

A.belongsTo(
	// foreign[key] = [{},{}]
	// A#children.push(    !C.add; key = arg2(a); [as, cs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
	// C#children.push( A.add([]); key = arg3(c); [as, cs] = foreign[key]; cs[C#finder(c)] = c; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
	C,
	(a) => a.c_id,
	(c) => c._id,
	(a, cs) => (a.c = cs[0])
);
C.hasMany(
	// foreign[key] = [{},{}]
	// A#children.push( C.add([]); key = arg2(a); [as, cs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
	// C#children.push( A.add([]); key = arg3(c); [as, cs] = foreign[key]; cs[C#finder(b)] = c; as{ arg4(a, cs, a_id, c_ids) }; cs{ arg5(as, c, a_ids, c_id) })
	A,
	(a) => a.c_id,
	(c) => c._id,
	(a, cs) => (a.c = cs[0]),
	(c, as) => (c.as = as)
);

B.belongsTo(
	// foreign[key] = [{},{}]
	// B#children.push( !B.add; key = arg2(b1); [b1s, b2s] = foreign[key]; b1s[B#finder(b1)] = b1; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
	// B#children.push( !B.add; key = arg3(b2); [b1s, b2s] = foreign[key]; b2s[B#finder(b2)] = b2; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
	B,
	(b1) => b1.parent_id,
	(b2) => b2._id,
	(b1, b2s) => (b1.parent = b2s[0])
);
B.hasMany(
	// foreign[key] = [{},{}]
	// B#children.push( !B.add; key = arg2(b1); [b1s, b2s] = foreign[key]; b1s[B#finder(b1)] = b1; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
	// B#children.push( !B.add; key = arg3(b2); [b1s, b2s] = foreign[key]; b2s[B#finder(b2)] = b2; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
	B,
	(b1) => b1.parent_id,
	(b2) => b2._id,
	(b1, b2s) => (b1.parent = b2s[0]),
	(b2, b1s) => (b2.children = b1s)
);

A.through(
	// B#children.push( A.add([]); C.add([]); arg3(b) )
	// C#children.push( A.add([]); B.add([]); arg4(c) )
	B,
	C,
	(b) => (b.cs = b.as?.map((a) => a.c!)),
	(c) => (c.bs = c.as?.map((a) => a.b))
);
