import { error } from '@sveltejs/kit';
import { isRentalConfirmed, RENTAL_PAYMENT_FIELDS } from '$lib/rental-payment.js';

const MAX_RENTAL_DAYS = 31;
const MAX_PLANNED_ITEMS_LENGTH = 20000;
const MAX_USE_CASES = 10;

/**
 * 予約（決済前の下書き）をサーバー側で作成する。
 * - 料金はブラウザから受け取らず、DB の現在価格から確定する
 * - 屋台の空き確認もサーバーで行う
 * クライアントからの reservations への直接 INSERT は v26 で禁止している。
 */
export async function createPendingReservation(supabase, userId, input) {
	const rentalSpaceId = typeof input?.rentalSpaceId === 'string' && input.rentalSpaceId ? input.rentalSpaceId : null;
	const stallId = typeof input?.stallId === 'string' && input.stallId ? input.stallId : null;
	if (!rentalSpaceId && !stallId) error(400, 'スペースまたは屋台を選択してください');

	// 日時文字列は従来どおりそのまま DB に渡す（タイムゾーンの解釈を変えないため）。
	if (typeof input?.startDatetime !== 'string' || typeof input?.endDatetime !== 'string') {
		error(400, '利用日時が正しくありません');
	}
	const start = new Date(input.startDatetime);
	const end = new Date(input.endDatetime);
	if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
		error(400, '利用日時が正しくありません');
	}
	if (end.getTime() - start.getTime() > MAX_RENTAL_DAYS * 86400000) {
		error(400, `一度に予約できるのは${MAX_RENTAL_DAYS}日までです`);
	}
	if (end.getTime() < Date.now()) error(400, '過去の日時は予約できません');

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

	let stallFee = 0;
	if (stallId) {
		const { data: stall, error: stallError } = await supabase
			.from('stall_specs')
			.select('id, rental_fee')
			.eq('id', stallId)
			.maybeSingle();
		if (stallError) error(500, '屋台の情報を取得できませんでした');
		if (!stall) error(404, '屋台が見つかりません');
		stallFee = Number(stall.rental_fee ?? 0);

		const { data: others, error: othersError } = await supabase
			.from('reservations')
			.select(`id, status, ${RENTAL_PAYMENT_FIELDS}`)
			.eq('stall_id', stallId)
			.or('status.eq.pending,status.eq.active,status.is.null');
		if (othersError) error(500, '屋台の空き状況を確認できませんでした');
		if (others?.some(isRentalConfirmed)) {
			error(409, 'この屋台はすでに予約が入っています。別の屋台をお選びください。');
		}
	}

	let spaceFee = 0;
	if (rentalSpaceId) {
		const { data: space, error: spaceError } = await supabase
			.from('rental_spaces')
			.select('id, space_fee')
			.eq('id', rentalSpaceId)
			.maybeSingle();
		if (spaceError) error(500, 'スペースの情報を取得できませんでした');
		if (!space) error(404, 'スペースが見つかりません');
		spaceFee = Number(space.space_fee ?? 0);
	}
	if (!Number.isFinite(stallFee) || !Number.isFinite(spaceFee) || stallFee < 0 || spaceFee < 0) {
		error(500, '料金設定が正しくありません');
	}

	const base = {
		user_id: userId,
		rental_space_id: rentalSpaceId,
		stall_id: stallId,
		start_datetime: input.startDatetime,
		end_datetime: input.endDatetime,
		planned_items: plannedItems,
		status: 'pending',
		locked_space_fee: spaceFee,
		locked_stall_fee: stallFee
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
