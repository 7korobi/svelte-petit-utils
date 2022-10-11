export function clip({ target }: { target: Node | EventTarget }) {
	doClip(target as Node);
}

function doClip(target: Node) {
	const range = document.createRange();
	range.selectNode(target);
	const sel_1st = window.getSelection();
	if (sel_1st) sel_1st.addRange(range);
	document.execCommand('copy');
	const sel_2nd = window.getSelection();
	if (sel_2nd) sel_2nd.empty();
}
