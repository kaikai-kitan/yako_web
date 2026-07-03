import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

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

	// --- 人ノード ---
	const nodes = profiles.map((p) => ({
		id: `u:${p.user_id}`,
		name: p.handle,
		img: p.avatar_path || '',
		status: p.status || '',
		message: p.one_liner || '',
		type: 'person'
	}));

	// --- 人 ↔ 人 エッジ（両端が公開者のみ） ---
	const links = [];
	for (const e of edgesRes.data ?? []) {
		if (publicIds.has(e.user_a) && publicIds.has(e.user_b)) {
			links.push({
				source: `u:${e.user_a}`,
				target: `u:${e.user_b}`,
				weight: e.weight ?? 1,
				origin: e.origin ?? 'manual'
			});
		}
	}

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
			nodes.push({ id: `s:${id}`, name: name || '屋台', type: 'stall' });
		}
		for (const l of stallLinks) {
			if (shown.has(l.stall_id)) {
				links.push({ source: `u:${l.user_id}`, target: `s:${l.stall_id}`, weight: 1, origin: 'stall' });
			}
		}
	}

	// 公開ネットワークは 60 秒キャッシュ（頻繁に変わらない）
	setHeaders({ 'cache-control': 'public, max-age=60' });
	return json({ nodes, links });
}
