import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 法人広告のアクセス計測（表示 / クリック）。公開エンドポイント（fire-and-forget）。
// 乱用を軽減するため、対象が広告有効(ad_active)な法人のときのみ加算する。
export async function POST({ request }) {
	try {
		const { userId, kind } = await request.json().catch(() => ({}));
		if (!userId || !['view', 'click', 'reach'].includes(kind)) {
			return json({ ok: false }, { status: 400 });
		}
		if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
			return json({ ok: false });
		}
		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

		// 広告有効な法人のみ計測（存在しない/個人は無視）
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('ad_active, ad_reach_count')
			.eq('user_id', userId)
			.maybeSingle();
		if (!profile?.ad_active) return json({ ok: true, skipped: true });

		// 時系列ログ（v25。未適用でもフォールバックで無視）
		await supabase.from('ad_events').insert({ user_id: userId, kind }).then(
			() => {},
			() => {}
		);

		// 累計カウンタ（後方互換）
		if (kind === 'view' || kind === 'click') {
			const { error } = await supabase.rpc('increment_ad_metric', { uid: userId, metric: kind });
			if (error) console.error('track increment error:', error);
		} else if (kind === 'reach') {
			// reach は ad_reach_count を加算（v25 未適用なら列が無く失敗するので握りつぶす）
			await supabase
				.from('user_profiles')
				.update({ ad_reach_count: (profile.ad_reach_count ?? 0) + 1 })
				.eq('user_id', userId)
				.then(() => {}, () => {});
		}
		return json({ ok: true });
	} catch (e) {
		console.error('track error:', e);
		return json({ ok: false });
	}
}
