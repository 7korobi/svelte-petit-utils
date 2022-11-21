import { inPlaceSort } from "./fast-sort"

export type MapReduceContext<T, G> = readonly [
	G,
	T,
	string,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void,
	(cb: () => void) => void
];

export function BasicTools<T>(context: <G>(key: string) => MapReduceContext<T, G>) {
	return { COUNT, SUM, POW, MAX, MIN, AVERAGE, VARIANCE, QUANTILE, MEDIAN: QUANTILE('1/2') };

	function COUNT(n = 1) {
		const [o, item, itemId, format, calc, add, del] = context<{ count: number }>('COUNT');

		format(() => (o.count = 0));
		add(() => (o.count += n));
		del(() => (o.count -= n));
		return undefined as any as typeof o;
	}

	function SUM(n: number) {
		const [o, item, itemId, format, calc, add, del] = context<{ sum: number }>('SUM');

		format(() => (o.sum = 0));
		add(() => (o.sum += n));
		del(() => (o.sum -= n));
		return undefined as any as typeof o;
	}

	function POW(n: number) {
		const [o, item, itemId, format, calc, add, del] = context<{ pow: number }>('POW');

		format(() => (o.pow = 1));
		add(() => (o.pow *= n));
		del(() => (o.pow /= n));
		return undefined as any as typeof o;
	}

	function AVERAGE() {
		const [oo, item, itemId, format, calc, add, del] = context<{ count: number; avg: number }>(
			'AVERAGE'
		);
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

	function QUANTILE(...ats: (number | string)[]) {
		const idxs: [string, number][] = ats.map((x)=> {
			if ('number' === typeof x) return [`${x}`, x];
			let [c, m] = x.split('/').map(Number)
			if (!m) throw `${x} is not fraction.`;
			return [`${x}`, c / m]
		})
		return function QUANTILE<X extends number | string>(x: X) {
			const [oo, item, itemId, format, calc, add, del] = context<{[at: string]: X}>('MEDIAN')
			const o = oo as { quantile_data: X[] } & typeof oo;

			format(() => {
				o.quantile_data = [];
				for (const [label, at] of idxs) {
					o[label] = undefined as any;
				}
			})
			add(()=>{
				o.quantile_data.push(x);
			})
			del(()=>{
				const idx = o.quantile_data.indexOf(x);
				o.quantile_data.splice(idx, 1);
			})
			calc(()=>{
				inPlaceSort(o.quantile_data).asc()
				const tail = o.quantile_data.length - 1
				for (const [label, at] of idxs) {
					const low = Math.ceil(at * tail)
					const high = Math.floor(at * tail)
					const idx = (high - at < at - low) ? high : low;
					o[label] = o.quantile_data[idx];
				}
			})
			return undefined as any as typeof oo;
		}
	}

	function VARIANCE(x: number, count = 1) {
		const [oo, item, itemId, format, calc, add, del] = context<{
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
			o.variance_data.push(x);
			o.sum += x;
			o.count += count;
		});

		del(() => {
			const idx = o.variance_data.indexOf(x);
			o.variance_data.splice(idx, 1);
			o.sum -= x;
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
		const [o, item, itemId, format, calc, add, del] = context<{ max: X; maxIs: T }>('MAX');

		format(() => {
			o.max = o.maxIs = undefined as any;
		});
		add(() => {
			if (x <= o.max) return;
			o.max = x;
			o.maxIs = item;
		});
		del(() => {
			if (x < o.max) return;
			throw "can't execute.";
		});
		return undefined as any as typeof o;
	}

	function MIN<X extends number | string>(x: X) {
		const [o, item, itemId, format, calc, add, del] = context<{ min: X; minIs: T }>('MIN');

		format(() => {
			o.min = o.minIs = undefined as any;
		});
		add(() => {
			if (o.min <= x) return;
			o.min = x;
			o.minIs = item;
		});
		del(() => {
			if (o.min < x) return;
			throw "can't execute.";
		});
		return undefined as any as typeof o;
	}
}
