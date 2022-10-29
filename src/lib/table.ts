import { derived, writable, type Readable } from 'svelte/store';
import { inPlaceSort, type ISortBy } from './fast-sort';

type IOrder<T> = ((ISortBy<T> | ISortBy<T>[]) & { key?: string }) | undefined;

export function table<T>(data: T[] = [], finder = (item: T) => (item as any).id as string) {
	const writer = writable(data);
	const reader = query(writer);

	let find_by: { [key in string]: [number, T] } = {};
	writer.subscribe(scan);

	return {
		...writer,
		...reader,
		add(data: T[]) {
			writer.update((src) => {
				for (const item of data) {
					const hit = find_by[finder(item)];
					if (hit) src.splice(hit[0], 1);
					src.push(item);
				}
				return src;
			});
		}
	};

	function scan(data: T[]) {
		find_by = {};
		data.forEach((item, idx) => {
			find_by[finder(item)] = [idx, item];
		});
	}

	function query<T>({ subscribe }: Readable<T[]>) {
		const check = writable<(item: T) => boolean>();
		const sort = writable<IOrder<T>>();
		const orderType = writable<boolean>(true);

		const reader = derived(
			[{ subscribe }, check, sort, orderType],
			([base, $check, $sort, $orderType]) => {
				const filtered: T[] = $check ? base.filter($check) : base;
				const ordered: T[] = $sort
					? $orderType
						? inPlaceSort(filtered).desc($sort)
						: inPlaceSort(filtered).asc($sort)
					: filtered;
				return ordered;
			}
		);
		const value = {
			orderType,
			...reader,
			find(key: string) {
				const hit = find_by[key];
				return hit ? hit[1] : undefined;
			},
			where(query: (item: T) => boolean) {
				check.set(query);
			},
			order(order: IOrder<T>, key = order ? order.key || order.toString() : undefined) {
				if (order) {
					order.key = key!;
				}
				sort.update((old) => {
					const isSame = !old || old.key === key;
					orderType.update((b) => (isSame ? !b : true));
					return order;
				});
				return value;
			}
		};
		return value;
	}
}
