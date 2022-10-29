export function wordSearch(str: string) {
	if (!str) return;

	const words = str
		.replace(escapeTarget, escape)
		.split(/\s+/g)
		.filter((str) => !!str)
		.map((str) => {
			if (2 < str.length && '\\[' === str.slice(0, 2)) str = `^${str.slice(2)}`;
			if (2 < str.length && '\\]' === str.slice(-2)) str = `${str.slice(0, -2)}$`;
			return str;
		});
	if (words.length) return new RegExp(`(${words.join('|')})`, 'ig');
}

function controlCharacters(list: string[]) {
	return new RegExp(`(${list.map((c) => `\\${c}`).join('|')})`, 'g');
}

const escapeTarget = controlCharacters([...'$?*^+.|(){}[]']);
function escape(chr: string, match: string, idx: number, text: string) {
	switch (chr) {
		case '*':
			return `.+`;
		case '?':
			return `.`;
		default:
			return `\\${chr}`;
	}
}
