import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { requireRentalUser } from '$lib/server/rental-authorization.js';
import { sanitizeSalesItems } from '$lib/server/rental-sales.js';
import Stripe from 'stripe';
import { finalizeRentalReturn } from '$lib/server/rental-billing.js';

export const prerender = false;

/**
 * 返却完了（active → completed）と、売上明細・支払い履歴の記録。
 * 金額・受取人はブラウザから受け取らず、予約時に確定した料金からサーバーで計算する。
 * 予約終了と実際の返却の遅い方までの料金（延長・超過を含む）を、登録カードに一括請求する。
 * 同じ予約に二重に記録されないよう、active → completed の切り替えに成功した1回だけ記録する。
 */
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const body = await request.json().catch(() => ({}));
	const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
	if (!reservationId) error(400, 'reservationId が必要です');
	const salesItems = sanitizeSalesItems(body.salesItems);

	const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null;
	const result = await finalizeRentalReturn({ stripe, supabase, reservationId, userId: user.id, salesItems });
	return json(result);
}
