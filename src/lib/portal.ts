import { tick } from 'svelte';

export function portal(selector: string | undefined = undefined) {
	let targetEl: HTMLElement | null;

	if (selector) {
		catchSlot(5);
		return { mount };
	} else {
		return { slot, mount };
	}

	async function catchSlot(remain: number) {
		targetEl = document.querySelector(selector!);
		if (remain-- && !targetEl) {
			await tick();
			catchSlot(remain);
		}
	}

	function slot(el: HTMLElement) {
		targetEl = el;
		return { destroy() {} };
	}

	function mount(el: HTMLElement) {
		(async () => {
			await tick();
			targetEl!.appendChild(el);
		})();
		return {
			destroy() {
				if (el.parentNode) {
					el.parentNode.removeChild(el);
				}
			}
		};
	}
}
