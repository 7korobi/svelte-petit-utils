import type { MapReduceContext, Orderable } from './table';

const quantileDic = {
	max: 1,
	min: 0,
	med: 1 / 2,
	median: 1 / 2
};

function spliceAt<X, T>(list: [X, T, string][], itemKey: Orderable) {
	let idx = list.length;

	while (idx--) {
		if (list[idx][0] <= itemKey) return idx + 1;
	}
	return list.length;
}

function toIdx(value: number): number {
	const low = Math.floor(value);
	const high = Math.ceil(value);
	return high - value < value - low ? high : low;
}

export function BasicTools<T>(context: <G>(key: string) => MapReduceContext<T, G>) {
	return {
		COUNT,
		SUM,
		POW,
		AVERAGE,
		VARIANCE,
		FREQUENCY,
		QUANTILE,
		MAX: QUANTILE('max'),
		MIN: QUANTILE('min'),
		RANGE: QUANTILE('min', 'max'),
		MEDIAN: QUANTILE('median'),
		TERTILE: QUANTILE('min', '1/3', '2/3', 'max'),
		QUINTILE: QUANTILE('min', '1/5', '2/5', '3/5', '4/5', 'max')
	};

	function COUNT(n = 1) {
		const [o, format, calc, add, del] = context<{ count: number }>('COUNT');

		format(() => (o.count = 0));
		add(() => (o.count += n));
		del(() => (o.count -= n));
		return undefined as any as typeof o;
	}

	function SUM(n: number) {
		const [o, format, calc, add, del] = context<{ sum: number }>('SUM');

		format(() => (o.sum = 0));
		add(() => (o.sum += n));
		del(() => (o.sum -= n));
		return undefined as any as typeof o;
	}

	function POW(n: number) {
		const [o, format, calc, add, del] = context<{ pow: number }>('POW');

		format(() => (o.pow = 1));
		add(() => (o.pow *= n));
		del(() => (o.pow /= n));
		return undefined as any as typeof o;
	}

	function AVERAGE() {
		const [oo, format, calc, add, del] = context<{ count: number; avg: number }>('AVERAGE');
		const o = oo as { sum: number; pow: number } & typeof oo;
		format(() => (o.avg = 0));
		calc(() => {
			if ('sum' in o && 'count' in o) o.avg = o.sum / o.count;
			if ('pow' in o && 'count' in o) o.avg = o.pow ** (1 / o.count);
		});
		return undefined as any as typeof oo;
	}

	function FREQUENCY<T>(x: T) {
		const [o, format, calc, add, del] = context<{ [x: string]: number }>(`FREQUENCY.${x}`);

		format(() => {
			o[x as string] = 0;
		});
		add(() => {
			o[x as string]++;
		});
		del(() => {
			o[x as string]--;
		});
		return undefined as any as typeof o;
	}

	function QUANTILE<AT extends string>(...ats: readonly AT[]) {
		const idxs: [AT, number][] = ats.map((x) => {
			const val = quantileDic[x as keyof typeof quantileDic];
			if (undefined !== val) return [x, val];
			let [c, m] = x.split('/').map(Number);
			return m ? [x, c / m] : [x, c];
		});
		return function QUANTILE<X extends Orderable>(x: X) {
			const [o, format, calc, add, del, local] = context<
				{ [at in AT]: X } & { [at in `${AT}_is`]: T } & { [at in `${AT}_id`]: string }
			>('QUANTILE');
			const [c, item, itemId] = local<{ data: [X, T, string][] }>();

			format(() => {
				c.data = [];
				for (const [label, at] of idxs) {
					o[label] = undefined as any;
				}
			});
			add(() => {
				const idx = spliceAt(c.data, x);
				const data: [X, T, string] = [x, item, itemId];
				c.data.splice(idx, 0, data);
			});
			del(() => {
				const idx = c.data.findIndex(([val]) => x === val);
				if (idx < 0) {
				} else {
					c.data.splice(idx, 1);
				}
			});
			calc(() => {
				const tail = c.data.length - 1;
				for (const [label, at] of idxs) {
					const idx = toIdx(at * tail);
					const [x, item, id] = c.data[idx];
					(o as any)[label] = x;
					(o as any)[`${label}_id`] = id;
					(o as any)[`${label}_is`] = item;
				}
			});
			return undefined as any as typeof o;
		};
	}

	function standard(this: any, data: number) {
		return (data - this.avg) / this.sd;
	}

	function VARIANCE(x: number, count = 1) {
		const [o, format, calc, add, del, local] = context<{
			sum: number;
			count: number;
			avg: number;
			variance: number;
			standard(data: number): number;
			sd: number;
		}>('VARIANCE');
		const [c] = local<{ data: number[] }>();

		format(() => {
			c.data = [];
			o.avg = 0;
			o.sum = 0;
			o.count = 0;
			o.variance = 0;
			o.sd = 0;
			o.standard = standard;
		});

		add(() => {
			c.data.push(x);
			o.sum += x;
			o.count += count;
		});

		del(() => {
			const idx = c.data.indexOf(x);
			c.data.splice(idx, 1);
			o.sum -= x;
			o.count -= count;
		});

		calc(() => {
			if (!('sum' in o && 'count' in o)) return;
			o.avg = o.sum / o.count;

			let sum = 0;
			for (let x of c.data) {
				sum += (x - o.avg) ** 2;
			}

			o.variance = sum / (o.count - 1);
			o.sd = o.variance ** 0.5;
		});

		return undefined as any as typeof o;
	}
}
