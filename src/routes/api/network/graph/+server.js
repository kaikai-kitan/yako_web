import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// user_profiles のロールフラグ → 表示ラベル
// ビジネスロールを持たない人は「流浪人」（既定）
function rolesFor(p) {
	if (!p) return ['流浪人'];
	const roles = [];
	if (p.is_shop_operator || p.user_type === '屋台営業者') roles.push('屋台営業者');
	if (p.is_yatai_owner || p.user_type === '屋台提供者') roles.push('屋台オーナー');
	if (p.is_land_owner || p.user_type === '土地オーナー') roles.push('土地オーナー');
	if (roles.length === 0) roles.push('流浪人');
	return roles;
}

// 公開夜行人ネットワークを {nodes, links} で返す（PII なし・公開プロフィールのみ）
export async function GET({ setHeaders }) {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
		return json({ nodes: [], links: [] });
	}
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const [profilesRes, edgesRes, stallLinksRes] = await Promise.all([
		supabase.from('yakonin_profiles')
			.select('user_id, handle, status, one_liner, avatar_path')
			.eq('is_public', true),
		supabase.from('yakonin_edges').select('user_a, user_b, weight, origin'),
		supabase.from('yakonin_stall_links').select('user_id, stall_id')
	]);

	const profiles = profilesRes.data ?? [];
	const publicIds = new Set(profiles.map((p) => p.user_id));

	// ロール & 法人/広告状態を取得（user_profiles をまとめて引く）
	let roleMap = {};
	let corpMap = {}; // user_id → { corporate, adActive }
	if (profiles.length > 0) {
		// account_type / ad_active は migration v18 で追加。未適用環境でも動くようフォールバック
		let ups = null;
		const r = await supabase
			.from('user_profiles')
			.select('user_id, is_shop_operator, is_yatai_owner, is_land_owner, user_type, account_type, ad_active')
			.in('user_id', [...publicIds]);
		if (r.error && (r.error.code === '42703' || /account_type|ad_active/.test(r.error.message ?? ''))) {
			const r2 = await supabase
				.from('user_profiles')
				.select('user_id, is_shop_operator, is_yatai_owner, is_land_owner, user_type')
				.in('user_id', [...publicIds]);
			ups = r2.data;
		} else {
			ups = r.data;
		}
		for (const p of ups ?? []) {
			roleMap[p.user_id] = rolesFor(p);
			corpMap[p.user_id] = {
				corporate: p.account_type === 'corporate',
				adActive: p.ad_active === true
			};
		}
	}

	// --- 人 ↔ 人 エッジ（両端が公開者のみ） ---
	const links = [];
	const degree = {}; // user_id → 人とのつながり数
	for (const e of edgesRes.data ?? []) {
		if (publicIds.has(e.user_a) && publicIds.has(e.user_b)) {
			links.push({
				source: `u:${e.user_a}`,
				target: `u:${e.user_b}`,
				weight: e.weight ?? 1,
				origin: e.origin ?? 'manual'
			});
			degree[e.user_a] = (degree[e.user_a] ?? 0) + 1;
			degree[e.user_b] = (degree[e.user_b] ?? 0) + 1;
		}
	}

	// --- 人ノード ---
	const nodes = profiles.map((p) => ({
		id: `u:${p.user_id}`,
		name: p.handle,
		img: p.avatar_path || '',
		status: p.status || '',
		message: p.one_liner || '',
		roles: roleMap[p.user_id] ?? ['流浪人'],
		degree: degree[p.user_id] ?? 0,
		corporate: corpMap[p.user_id]?.corporate ?? false,
		adActive: corpMap[p.user_id]?.adActive ?? false,
		type: 'person'
	}));

	// --- 屋台ハブ（公開者からのリンクがある屋台だけをノード化） ---
	const stallLinks = (stallLinksRes.data ?? []).filter((l) => publicIds.has(l.user_id));
	const usedStallIds = [...new Set(stallLinks.map((l) => l.stall_id))];

	if (usedStallIds.length > 0) {
		const { data: stalls } = await supabase
			.from('stall_specs')
			.select('id, stall_name, show_in_network')
			.in('id', usedStallIds);
		const shown = new Map(
			(stalls ?? [])
				.filter((s) => s.show_in_network !== false)
				.map((s) => [s.id, s.stall_name])
		);

		for (const [id, name] of shown) {
			nodes.push({ id: `s:${id}`, name: name || '屋台', type: 'stall', degree: 0, roles: [] });
		}
		for (const l of stallLinks) {
			if (shown.has(l.stall_id)) {
				links.push({ source: `u:${l.user_id}`, target: `s:${l.stall_id}`, weight: 1, origin: 'stall' });
			}
		}
	}

	setHeaders({ 'cache-control': 'public, max-age=30' });
	return json({ nodes, links });
}
