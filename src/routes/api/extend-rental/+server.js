import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { requireRentalUser } from '$lib/server/rental-authorization.js';
import { BILLING_FIELDS } from '$lib/server/rental-billing.js';
import { loadBlackouts, loadStallReservations } from '$lib/server/rental-reservation.js';
import { busyIntervals, isBlackedOut } from '$lib/rental-availability.js';
import { rentalCharge, feesFromReservation, toJstIso, SLOT_MS } from '$lib/rental-pricing.js';

export const prerender = false;

const MAX_SLOTS_PER_REQUEST = 12; // 1回で最大6時間

/**
 * 利用中の延長（30分単位）。次の予約とゆとり枠・貸し出し不可の時間帯に重ならないときだけ延長できる。
 * 延長分は返却時の一括請求に含める。
 * POST { reservationId, slots }
 */
export async function POST({ request }) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const user = await requireRentalUser(supabase, request);
	const body = await request.json().catch(() => ({}));
	const reservationId = typeof body?.reservationId === 'string' ? body.reservationId : '';
	const slots = Number(body?.slots);
	if (!reservationId) error(400, 'reservationId が必要です');
	if (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS_PER_REQUEST) error(400, '延長は30分単位で指定してください');

	const { data: res, error: resError } = await supabase
		.from('reservations')
		.select(BILLING_FIELDS)
		.eq('id', reservationId)
		.maybeSingle();
	if (resError) error(500, '予約情報を取得できませんでした');
	if (!res) error(404, '予約が見つかりません');
	if (res.user_id !== user.id) error(403, '権限がありません');
	if (res.status !== 'active') error(409, '利用中の予約だけ延長できます');

	const oldEndMs = Date.parse(toJstIso(res.end_datetime));
	const newEndMs = oldEndMs + slots * SLOT_MS;

	const [reservations, blackouts] = await Promise.all([
		loadStallReservations(supabase, res.stall_id),
		loadBlackouts(supabase, { stallId: res.stall_id, spaceId: res.rental_space_id })
	]);
	for (let s = oldEndMs; s < newEndMs; s += SLOT_MS) {
		if (isBlackedOut(s, blackouts)) error(409, 'この時間帯は貸し出しを行っていないため延長できません');
	}
	const clash = busyIntervals(reservations, { excludeId: res.id }).some((i) => oldEndMs < i.end && newEndMs > i.start);
	if (clash) error(409, '次の予約（前後30分の準備時間を含む）と重なるため延長できません');

	const newEnd = new Date(newEndMs).toISOString();
	const { data: updated, error: updateError } = await supabase
		.from('reservations')
		.update({ end_datetime: newEnd })
		.eq('id', res.id)
		.eq('status', 'active')
		.eq('end_datetime', res.end_datetime)
		.select('id');
	if (updateError) error(500, '延長できませんでした');
	if (!updated?.length) error(409, '予約の状態が変わったため延長できませんでした。画面を更新してください');

	const charge = rentalCharge({ start: res.start_datetime, end: newEnd, fees: feesFromReservation(res) });
	return json({ endDatetime: newEnd, charge: { total: charge.total, base: charge.base, extension: charge.extension, extensionSlots: charge.extensionSlots } });
}
