import { browser } from '$app/environment';

export const prerender = true;

export function load() {
	if (browser) {
		// ブラウザ専用の初期化（認証リスナーなど）は +layout.svelte の onMount で管理する
		// auth.js の session ストアが onMount で更新される
	}
	return {};
}
