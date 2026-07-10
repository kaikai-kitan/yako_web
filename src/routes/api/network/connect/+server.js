import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// 相席（covisit）弱エッジを張る対象人数の上限と対象期間
const COVISIT_LOOKBACK_DAYS = 30;
const COVISIT_MAX = 20;

// user_a < user_b で正規化した無向エッジの行を作る
function orderedEdge(u1, u2, { weight, origin }) {
	const [user_a, user_b] = u1 < u2 ? [u1, u2] : [u2, u1];
	return { user_a, user_b, weight, origin };
}

export async function POST({ request }) {
	const authHeader = request.headers.get('Authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'ログインが必要です');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user) throw error(401, 'ログインが必要です');

	// 夜行人プロフィール必須（オプトイン）
	const { data: me } = await supabase
		.from('yakonin_profiles')
		.select('user_id')
		.eq('user_id', user.id)
		.maybeSingle();
	if (!me) {
		// フロントはこれを見て /yakonin/setup へ誘導する
		return json({ ok: false, need_profile: true }, { status: 409 });
	}

	const body = await request.json().catch(() => ({}));
	const { stallId, connectCode } = body;

	// ---- 人 ↔ 人（相手の connect_code をスキャン）----
	if (connectCode) {
		const { data: target } = await supabase
			.from('yakonin_profiles')
			.select('user_id, handle')
			.eq('connect_code', connectCode)
			.maybeSingle();

		if (!target) throw error(404, '相手の夜行人プロフィールが見つかりません');
		if (target.user_id === user.id) throw error(400, '自分自身とはつながれません');

		// 既に繋がっているか判定（user_a < user_b で正規化）
		const [ua, ub] = user.id < target.user_id ? [user.id, target.user_id] : [target.user_id, user.id];
		const { data: existing } = await supabase
			.from('yakonin_edges')
			.select('user_a')
			.eq('user_a', ua)
			.eq('user_b', ub)
			.maybeSingle();
		const alreadyConnected = !!existing;

		// 判定のみ（接続は作らない）
		if (body.checkOnly) {
			return json({ ok: true, connected: alreadyConnected, handle: target.handle });
		}

		const { error: edgeErr } = await supabase
			.from('yakonin_edges')
			.upsert([orderedEdge(user.id, target.user_id, { weight: 3, origin: 'qr_person' })], {
				onConflict: 'user_a,user_b',
				ignoreDuplicates: true
			});
		if (edgeErr) throw error(500, edgeErr.message);

		return json({ ok: true, action: 'person', handle: target.handle, already: alreadyConnected });
	}

	// ---- 人 ↔ 屋台ハブ（＋同じ屋台の来場者と相席弱エッジ）----
	if (stallId) {
		const { data: stall } = await supabase
			.from('stall_specs')
			.select('id, stall_name, show_in_network')
			.eq('id', stallId)
			.maybeSingle();
		if (!stall) throw error(404, '屋台が見つかりません');

		// 1) 屋台ハブへ接続（べき等）
		const { error: linkErr } = await supabase
			.from('yakonin_stall_links')
			.upsert([{ user_id: user.id, stall_id: stallId }], {
				onConflict: 'user_id,stall_id',
				ignoreDuplicates: true
			});
		if (linkErr) throw error(500, linkErr.message);

		// 2) 相席弱エッジ: 直近に同じ屋台へ来た他の夜行人と接続
		const since = new Date(Date.now() - COVISIT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
		const { data: recent } = await supabase
			.from('yakonin_stall_links')
			.select('user_id, created_at')
			.eq('stall_id', stallId)
			.gte('created_at', since)
			.order('created_at', { ascending: false })
			.limit(COVISIT_MAX + 1);

		const others = [...new Set((recent ?? [])
			.map((r) => r.user_id)
			.filter((uid) => uid !== user.id))]
			.slice(0, COVISIT_MAX);

		let newCovisitors = 0;
		if (others.length > 0) {
			// 相手も夜行人プロフィール公開者に限定
			const { data: pubs } = await supabase
				.from('yakonin_profiles')
				.select('user_id')
				.in('user_id', others);
			const eligible = new Set((pubs ?? []).map((p) => p.user_id));

			const rows = others
				.filter((uid) => eligible.has(uid))
				.map((uid) => orderedEdge(user.id, uid, { weight: 1, origin: 'covisit' }));

			if (rows.length > 0) {
				// 既存の強いエッジは onConflict ignore で保持される
				const { error: covErr } = await supabase
					.from('yakonin_edges')
					.upsert(rows, { onConflict: 'user_a,user_b', ignoreDuplicates: true });
				if (covErr) throw error(500, covErr.message);
				newCovisitors = rows.length;
			}
		}

		return json({ ok: true, action: 'stall', stallName: stall.stall_name, newCovisitors });
	}

	throw error(400, 'stallId または connectCode が必要です');
}
