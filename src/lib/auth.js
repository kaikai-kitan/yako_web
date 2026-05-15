import { writable } from 'svelte/store';

/** ログインセッションのグローバルストア（初期化は +layout.svelte の onMount で行う） */
export const session = writable(null);
