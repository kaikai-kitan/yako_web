import { error } from '@sveltejs/kit';
import { RENTAL_PAYMENT_FIELDS } from '$lib/rental-payment.js';
import { toJstIso, BOOKING_HORIZON_DAYS } from '$lib/rental-pricing.js';
import { checkRange, RANGE_ERROR_MESSAGES } from '$lib/rental-availability.js';
import { matchPriceRule, applyMultiplier } from '$lib/rental-price-rules.js';

const MAX_PLANNED_ITEMS_LENGTH = 20000;
const MAX_USE_CASES = 10;

/** 有効な割増ルール（土日・イベントなど） */
export async function loadPriceRules(supabase) {
	const { data, error: rulesError } = await supabase
		.from('rental_price_rules')
		.select('id, label, multiplier, weekday, start_date, end_date, stall_id, rental_space_id, active')
		.eq('active', true);
	if (rulesError) error(500, '料金の設定を確認できませんでした');
	return data ?? [];
}

/**
 * 屋台・場所の料金設定を取得する（場所は屋台に紐づいた設置場所を優先）。
 * start（予約の開始日時）を渡すと、その日に当てはまる割増率を掛けた料金を返す。
 */
export async function loadRentalTarget(supabase, { stallId, rentalSpaceId, start = null }) {
	let stall = null;
	if (stallId) {
		const { data, error: stallError } = await supabase
			.from('stall_specs')
			.select('id, stall_name, rental_fee, extension_fee, space_id')
			.eq('id', stallId)
			.maybeSingle();
		if (stallError) error(500, '屋台の情報を取得できませんでした');
		if (!data) error(404, '屋台が見つかりません');
		stall = data;
	}
	const spaceId = stall?.space_id ?? rentalSpaceId ?? null;
	let space = null;
	if (spaceId) {
		const { data, error: spaceError } = await supabase
			.from('rental_spaces')
			.select('id, name, space_fee, extension_fee')
			.eq('id', spaceId)
			.maybeSingle();
		if (spaceError) error(500, 'スペースの情報を取得できませんでした');
		if (!data) error(404, 'スペースが見つかりません');
		space = data;
	}
	let base = {
		stallBase: Number(stall?.rental_fee ?? 0),
		stallExt: Number(stall?.extension_fee ?? 0),
		spaceBase: Number(space?.space_fee ?? 0),
		spaceExt: Number(space?.extension_fee ?? 0)
	};
	if (Object.values(base).some((n) => !Number.isInteger(n) || n < 0)) error(500, '料金設定が正しくありません');
	let rule = null;
	if (start) {
		const startMs = Date.parse(toJstIso(start));
		rule = matchPriceRule(startMs, await loadPriceRules(supabase), { stallId: stall?.id ?? null, spaceId: space?.id ?? null });
		if (rule) base = applyMultiplier(base, rule.multiplier);
	}
	const fees = {
		locked_stall_fee: base.stallBase,
		locked_stall_ext_fee: base.stallExt,
		locked_space_fee: base.spaceBase,
		locked_space_ext_fee: base.spaceExt
	};
	return { stall, space, fees, rule };
}

/** 屋台・場所の貸し出し不可の時間帯 */
export async function loadBlackouts(supabase, { stallId, spaceId }) {
	const filters = [];
	if (stallId) filters.push(`stall_id.eq.${stallId}`);
	if (spaceId) filters.push(`rental_space_id.eq.${spaceId}`);
	if (filters.length === 0) return [];
	const { data, error: blackoutError } = await supabase
		.from('rental_blackouts')
		.select('weekday, on_date, start_time, end_time')
		.or(filters.join(','));
	if (blackoutError) error(500, '貸し出し不可の時間帯を確認できませんでした');
	return data ?? [];
}

/** 屋台の予約（使用中の時間の計算用。個人情報は取らない） */
export async function loadStallReservations(supabase, stallId) {
	if (!stallId) return [];
	const { data, error: resError } = await supabase
		.from('reservations')
		.select(`id, status, start_datetime, end_datetime, ${RENTAL_PAYMENT_FIELDS}`)
		.eq('stall_id', stallId)
		.in('status', ['pending', 'active']);
	if (resError) error(500, '屋台の空き状況を確認できませんでした');
	return data ?? [];
}

/**
 * 予約（決済前の下書き）をサーバー側で作成する。
 * - 料金はブラウザから受け取らず、DB の現在価格から確定する
 * - 30分単位・前後30分のゆとり・貸し出し不可の時間帯をサーバーで確認する
 * - 日時はタイムゾーンが無ければ日本時間として扱う
 * クライアントからの reservations への直接 INSERT は v26 で禁止している。
 */
export async function createPendingReservation(supabase, userId, input) {
	const rentalSpaceId = typeof input?.rentalSpaceId === 'string' && input.rentalSpaceId ? input.rentalSpaceId : null;
	const stallId = typeof input?.stallId === 'string' && input.stallId ? input.stallId : null;
	if (!rentalSpaceId && !stallId) error(400, 'スペースまたは屋台を選択してください');

	const startIso = toJstIso(input?.startDatetime);
	const endIso = toJstIso(input?.endDatetime);
	if (!startIso || !endIso) error(400, '利用日時が正しくありません');

	let plannedItems = null;
	if (input?.plannedItems != null) {
		if (typeof input.plannedItems !== 'string' || input.plannedItems.length > MAX_PLANNED_ITEMS_LENGTH) {
			error(400, '販売予定の品目が正しくありません');
		}
		plannedItems = input.plannedItems;
	}
	const selectedUseCases = Array.isArray(input?.selectedUseCases)
		? input.selectedUseCases.filter((v) => typeof v === 'string' && v.length <= 50).slice(0, MAX_USE_CASES)
		: [];

	// DB を見る前に、日時の形式だけ先に確認する
	const formatProblem = checkRange({ start: startIso, end: endIso });
	if (formatProblem) error(400, RANGE_ERROR_MESSAGES[formatProblem]);

	const { stall, space, fees } = await loadRentalTarget(supabase, { stallId, rentalSpaceId, start: startIso });
	const [reservations, blackouts] = await Promise.all([
		loadStallReservations(supabase, stall?.id),
		loadBlackouts(supabase, { stallId: stall?.id, spaceId: space?.id })
	]);
	const problem = checkRange({ start: startIso, end: endIso, reservations, blackouts });
	if (problem) error(problem === 'busy' ? 409 : 400, RANGE_ERROR_MESSAGES[problem]);

	const base = {
		user_id: userId,
		rental_space_id: space?.id ?? null,
		stall_id: stall?.id ?? null,
		start_datetime: startIso,
		end_datetime: endIso,
		planned_items: plannedItems,
		status: 'pending',
		...fees
	};
	const withUseCases = selectedUseCases.length > 0 ? { ...base, selected_use_cases: selectedUseCases } : base;

	let { data, error: insertError } = await supabase.from('reservations').insert(withUseCases).select('id').single();
	// v24（selected_use_cases 列）未適用環境では列なしで再試行
	if (insertError && /selected_use_cases/.test(insertError.message ?? '')) {
		({ data, error: insertError } = await supabase.from('reservations').insert(base).select('id').single());
	}
	if (insertError || !data?.id) error(500, '予約を作成できませんでした');
	return data.id;
}

export { BOOKING_HORIZON_DAYS };
