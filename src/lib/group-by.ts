export function groupBy<T, U extends boolean>(
	list: T[],
	cb: (item: T) => 'true' | 'false'
): {
	true?: T[];
	false?: T[];
};
export function groupBy<T, U extends string>(
	list: T[],
	cb: (item: T) => U
): {
	[category in U]?: T[];
};
export function groupBy<T, U extends string>(list: T[], cb: (item: T) => U) {
	const result: {
		[category in string]?: T[];
	} = {};
	for (const item of list) {
		const bucketCategory = cb(item).toString();
		const bucket = result[bucketCategory];
		if (bucket) {
			bucket.push(item);
		} else {
			result[bucketCategory] = [item];
		}
	}
	return result;
}
