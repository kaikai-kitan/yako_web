import { json, error } from '@sveltejs/kit';
import { assertAdmin, serviceClient } from '$lib/server/admin.js';

export const prerender = false;

/**
 * 月末の振込額（提供者別・屋台代／場所代別）。
 * 返却時に記録した支払い履歴を、記録日（日本時間）の月で集計する。
 * あわせて、カードで全額を請求できなかった予約（partial / failed）を返す。
 * GET ?month=YYYY-MM
 */
export async function GET({ url, cookies }) {
	assertAdmin(cookies);
	const month = url.searchParams.get('month') ?? '';
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) error(400, '月の指定が正しくありません（例：2026-10）');
	const [y, m] = month.split('-').map(Number);
	const from = new Date(Date.parse(`${month}-01T00:00:00+09:00`)).toISOString();
	const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
	const to = new Date(Date.parse(`${nextMonth}-01T00:00:00+09:00`)).toISOString();

	const supabase = serviceClient();
	const { data: rows, error: e } = await supabase
		.from('payment_history')
		.select('recipient_id, recipient_name, total_amount, payee_role, reservation_id, created_at, reservations ( charge_status, charged_amount, stall_specs ( user_id ) )')
		.gte('created_at', from)
		.lt('created_at', to);
	if (e) error(500, e.message);

	const groups = new Map();
	const owedByReservation = new Map();
	for (const r of rows ?? []) {
		const role = r.payee_role ?? (r.reservations?.stall_specs?.user_id === r.recipient_id ? 'stall' : 'space');
		const key = `${r.recipient_id}:${role}`;
		const g = groups.get(key) ?? { recipientId: r.recipient_id, name: r.recipient_name ?? '名前未設定', role, count: 0, amount: 0, unpaidCount: 0 };
		g.count += 1;
		g.amount += Number(r.total_amount ?? 0);
		const status = r.reservations?.charge_status;
		if (status === 'partial' || status === 'failed') g.unpaidCount += 1;
		groups.set(key, g);
		owedByReservation.set(r.reservation_id, (owedByReservation.get(r.reservation_id) ?? 0) + Number(r.total_amount ?? 0));
	}

	const { data: shortfalls, error: e2 } = await supabase
		.from('reservations')
		.select('id, returned_at, charged_amount, charge_status, stall_specs ( stall_name ), rental_spaces ( name )')
		.in('charge_status', ['partial', 'failed'])
		.gte('returned_at', from)
		.lt('returned_at', to);
	if (e2) error(500, e2.message);

	const payees = [...groups.values()].sort((a, b) => b.amount - a.amount);
	return json({
		month,
		totals: {
			stall: payees.filter((p) => p.role === 'stall').reduce((s, p) => s + p.amount, 0),
			space: payees.filter((p) => p.role === 'space').reduce((s, p) => s + p.amount, 0)
		},
		payees,
		shortfalls: (shortfalls ?? []).map((r) => ({
			id: r.id,
			returnedAt: r.returned_at,
			place: [r.stall_specs?.stall_name, r.rental_spaces?.name].filter(Boolean).join('／'),
			owed: owedByReservation.get(r.id) ?? null,
			charged: r.charged_amount ?? 0,
			status: r.charge_status
		}))
	});
}
