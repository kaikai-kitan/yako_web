import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { requireRentalUser } from '$lib/server/rental-authorization.js';
import { sanitizeSalesItems } from '$lib/server/rental-sales.js';

export const prerender = false;

/**
 * 返却完了（active → completed）と、売上明細・支払い履歴の記録。
 * 金額・受取人はブラウザから受け取らず、予約時に確定した料金からサーバーで計算する。
 * 同じ予約に二重に記録されないよう、active → completed の切り替えに成功した1回だけ記録する。
 */
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const body = await request.json().catch(() => ({}));
	const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
	if (!reservationId) error(400, 'reservationId が必要です');
	const salesItems = sanitizeSalesItems(body.salesItems);

	const { data: res, error: resError } = await supabase
		.from('reservations')
		.select(`
			id, user_id, status, start_datetime, end_datetime,
			locked_space_fee, locked_stall_fee,
			stall_specs ( user_id, operators ( business_name ) ),
			rental_spaces ( user_id, owners ( owner_name ) )
		`)
		.eq('id', reservationId)
		.maybeSingle();
	if (resError) error(500, '予約情報を取得できませんでした');
	if (!res) error(404, '予約が見つかりません');
	if (res.user_id !== user.id) error(403, '権限がありません');
	if (res.status === 'completed') return json({ completed: true, already: true });
	if (res.status !== 'active') error(409, '利用中の予約ではないため返却できません');

	// active → completed を原子的に切り替える（同時実行時は片方だけ成功）
	const { data: switched, error: updateError } = await supabase
		.from('reservations')
		.update({ status: 'completed' })
		.eq('id', reservationId)
		.eq('user_id', user.id)
		.eq('status', 'active')
		.select('id');
	if (updateError) error(500, '返却処理に失敗しました');
	if (!switched?.length) return json({ completed: true, already: true });

	if (Object.values(salesItems).some((n) => n > 0)) {
		const { error: salesError } = await supabase
			.from('sales')
			.insert({ reservation_id: reservationId, item_sales: salesItems });
		if (salesError) console.error('[complete-rental] sales insert failed:', salesError.code);
	}

	const days = Math.max(
		1,
		Math.ceil((new Date(res.end_datetime) - new Date(res.start_datetime)) / 86400000)
	);
	const stallFee = Math.max(0, Number(res.locked_stall_fee ?? 0)) * days;
	const spaceFee = Math.max(0, Number(res.locked_space_fee ?? 0)) * days;
	const payments = [];
	if (res.stall_specs?.user_id && stallFee > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: user.id,
			recipient_id: res.stall_specs.user_id,
			recipient_name: res.stall_specs.operators?.business_name ?? null,
			total_amount: stallFee
		});
	}
	if (res.rental_spaces?.user_id && spaceFee > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: user.id,
			recipient_id: res.rental_spaces.user_id,
			recipient_name: res.rental_spaces.owners?.owner_name ?? null,
			total_amount: spaceFee
		});
	}
	if (payments.length > 0) {
		const { error: paymentError } = await supabase.from('payment_history').insert(payments);
		if (paymentError) {
			console.error('[complete-rental] payment_history insert failed:', paymentError.code);
			error(500, '支払い履歴の記録に失敗しました。運営へお問い合わせください。');
		}
	}

	return json({ completed: true });
}
