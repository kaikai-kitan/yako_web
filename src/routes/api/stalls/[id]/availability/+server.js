import { env } from '$env/dynamic/private';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { buildSlots, jstToday } from '$lib/rental-availability.js';
import { BOOKING_HORIZON_DAYS, SLOT_MINUTES, BUFFER_SLOTS, BASE_MINUTES } from '$lib/rental-pricing.js';
import { loadRentalTarget, loadBlackouts, loadStallReservations } from '$lib/server/rental-reservation.js';

export const prerender = false;

/**
 * 屋台の空き状況（30分ごと）。ログイン不要。
 * 予約者の情報は返さず、各枠の状態（free / busy / blocked / past）と料金設定だけを返す。
 * GET /api/stalls/:id/availability?from=YYYY-MM-DD&days=14
 */
export async function GET({ params, url }) {
	const stallId = params.id;
	if (!/^[0-9a-f-]{36}$/i.test(stallId ?? '')) error(400, '屋台の指定が正しくありません');

	const today = jstToday();
	const fromParam = url.searchParams.get('from');
	const from = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && fromParam >= today ? fromParam : today;
	const daysParam = Number(url.searchParams.get('days') ?? BOOKING_HORIZON_DAYS);
	const days = Number.isInteger(daysParam) ? Math.min(Math.max(daysParam, 1), BOOKING_HORIZON_DAYS) : BOOKING_HORIZON_DAYS;

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { stall, space, fees } = await loadRentalTarget(supabase, { stallId });
	const [reservations, blackouts] = await Promise.all([
		loadStallReservations(supabase, stall.id),
		loadBlackouts(supabase, { stallId: stall.id, spaceId: space?.id })
	]);

	return json(
		{
			stall: { id: stall.id, name: stall.stall_name },
			space: space ? { id: space.id, name: space.name } : null,
			rules: { slotMinutes: SLOT_MINUTES, bufferSlots: BUFFER_SLOTS, baseMinutes: BASE_MINUTES, horizonDays: BOOKING_HORIZON_DAYS },
			fees: {
				stallBase: fees.locked_stall_fee,
				stallExt: fees.locked_stall_ext_fee,
				spaceBase: fees.locked_space_fee,
				spaceExt: fees.locked_space_ext_fee
			},
			days: buildSlots({ from, days, reservations, blackouts })
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
}
