import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function isAdmin(email) {
	const adminEmails = (env.ADMIN_EMAILS ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return adminEmails.includes(email?.toLowerCase() ?? '');
}

export async function GET({ request, url }) {
	const authHeader = request.headers.get('authorization') ?? '';
	const token = authHeader.replace('Bearer ', '').trim();
	if (!token) throw error(401, 'Unauthorized');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
	if (authErr || !user || !isAdmin(user.email)) throw error(403, 'Forbidden');

	// YYYY-MM 形式のフィルタ（省略時は全件）
	const month = url.searchParams.get('month');
	const settlementStatus = url.searchParams.get('settlement_status'); // 'unsettled' | 'settled'

	let query = supabase
		.from('shop_orders')
		.select(`
			id,
			stripe_session_id,
			operator_id,
			items,
			total_amount,
			status,
			shipping_status,
			tracking_number,
			settlement_status,
			settled_at,
			customer_email,
			shipping_address,
			created_at,
			operators (
				business_name,
				email,
				user_id
			)
		`)
		.order('created_at', { ascending: false });

	if (month) {
		const start = `${month}-01T00:00:00Z`;
		const nextMonth = new Date(`${month}-01`);
		nextMonth.setMonth(nextMonth.getMonth() + 1);
		const end = nextMonth.toISOString().slice(0, 10) + 'T00:00:00Z';
		query = query.gte('created_at', start).lt('created_at', end);
	}

	if (settlementStatus) {
		query = query.eq('settlement_status', settlementStatus);
	}

	const { data, error: dbErr } = await query;
	if (dbErr) throw error(500, dbErr.message);

	// 出店者ごとに集計
	const byOperator = {};
	for (const order of data ?? []) {
		const opId = order.operator_id ?? '__unknown__';
		if (!byOperator[opId]) {
			byOperator[opId] = {
				operatorId: opId,
				businessName: order.operators?.business_name ?? '（未設定）',
				email: order.operators?.email ?? null,
				totalSales: 0,
				fee: 0,
				payout: 0,
				orderCount: 0,
				orders: []
			};
		}
		byOperator[opId].totalSales += order.total_amount ?? 0;
		byOperator[opId].orderCount += 1;
		byOperator[opId].orders.push(order);
	}

	// 手数料・振込額計算
	for (const op of Object.values(byOperator)) {
		op.fee = Math.floor(op.totalSales * 0.1);
		op.payout = op.totalSales - op.fee;
	}

	return json({
		operators: Object.values(byOperator),
		orders: data ?? []
	});
}
