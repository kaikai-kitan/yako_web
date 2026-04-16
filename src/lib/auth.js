import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabase.js';

/** ログインセッションのグローバルストア */
export const session = writable(null);

if (browser) {
	// 初期セッション取得
	supabase.auth.getSession().then(({ data }) => {
		session.set(data.session);
	});

	// 認証状態の変化を監視
	supabase.auth.onAuthStateChange((_event, newSession) => {
		session.set(newSession);
	});
}
