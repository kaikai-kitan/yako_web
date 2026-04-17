import { supabase, isSupabaseConfigured } from '$lib/supabase.js';

function requireSupabase() {
	if (!isSupabaseConfigured) {
		throw new Error(
			'Supabase が未設定です。.env の VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください。'
		);
	}
}

// =====================================================
// マップ表示用（ログイン不要）
// =====================================================

/** 現在出店中の屋台一覧を取得（QR解錠済み = status:'active' のみ） */
export async function getActiveStalls() {
	requireSupabase();
	const { data, error } = await supabase
		.from('reservations')
		.select(`
			id,
			planned_items,
			rental_spaces ( id, name, lat, lng, address ),
			stall_specs (
				id, stall_name, specs,
				operators ( business_name, icon_path, user_id )
			)
		`)
		.eq('status', 'active');

	if (error) throw error;

	const filtered = (data ?? []).filter((r) => r.rental_spaces && r.stall_specs);

	// 営業者の user_id を収集して user_profiles を一括取得（bio・プロフィールアイコン）
	const opUserIds = [...new Set(
		filtered.map((r) => r.stall_specs?.operators?.user_id).filter(Boolean)
	)];

	let bioMap = {};
	let profileIconMap = {};
	if (opUserIds.length > 0) {
		const { data: profiles } = await supabase
			.from('user_profiles')
			.select('user_id, bio, icon_path')
			.in('user_id', opUserIds);
		(profiles ?? []).forEach((p) => {
			bioMap[p.user_id] = p.bio ?? null;
			profileIconMap[p.user_id] = p.icon_path ?? null;
		});
	}

	return filtered.map((r) => {
		const opUserId = r.stall_specs.operators?.user_id ?? null;
		// プロフィールアイコン優先、なければ operators.icon_path
		const image = profileIconMap[opUserId] || r.stall_specs.operators?.icon_path || null;
		return {
			id: r.id,
			name: r.stall_specs.stall_name,
			lat: r.rental_spaces.lat,
			lng: r.rental_spaces.lng,
			status: 'active',
			owner: r.stall_specs.operators?.business_name ?? '未設定',
			bio: bioMap[opUserId] ?? null,
			image,
			spaceName: r.rental_spaces.name,
			plannedItems: r.planned_items ?? null
		};
	});
}

/** 予約可能なレンタルスペース一覧を取得 */
export async function getAvailableSpaces() {
	requireSupabase();
	const { data, error } = await supabase
		.from('rental_spaces')
		.select(`
			id, name, lat, lng, address,
			space_fee, fire_use_allowed, ground_type, photos_path,
			max_stalls, capacity,
			owners ( owner_name, icon_path )
		`)
		.eq('status', 'available');

	if (error) throw error;

	return (data ?? []).map((s) => ({
		id: s.id,
		name: s.name,
		lat: s.lat,
		lng: s.lng,
		status: 'available',
		price: s.space_fee,
		specs: [s.ground_type, s.fire_use_allowed ? '火気使用可' : '火気使用不可']
			.filter(Boolean)
			.join(' / '),
		image: s.photos_path?.[0] ?? null,
		address: s.address,
		maxStalls: s.max_stalls ?? 1,
		capacity: s.capacity ?? 10
	}));
}

/** 位置情報を持つ屋台のピン一覧を取得（マップ表示用） */
export async function getAvailableStallPins() {
	requireSupabase();
	const { data, error } = await supabase
		.from('stall_specs')
		.select(`id, stall_name, specs, rental_fee, lat, lng, operators ( business_name, icon_path )`)
		.not('lat', 'is', null)
		.not('lng', 'is', null);

	if (error) throw error;

	return (data ?? []).map((s) => ({
		id: s.id,
		name: s.stall_name,
		lat: s.lat,
		lng: s.lng,
		status: 'stall',
		owner: s.operators?.business_name ?? '未設定',
		specs: s.specs ?? '',
		price: s.rental_fee,
		image: s.operators?.icon_path ?? null
	}));
}

/** 予約フォーム用：全屋台リストを取得 */
export async function getAvailableStallsList() {
	requireSupabase();
	const { data, error } = await supabase
		.from('stall_specs')
		.select(`id, stall_name, specs, rental_fee, operators ( business_name )`)
		.order('created_at', { ascending: false });

	if (error) throw error;
	return data ?? [];
}

// =====================================================
// プロフィール画像アップロード
// =====================================================

/**
 * プロフィール画像を Supabase Storage にアップロードし、公開 URL を返す
 * @param {string} userId
 * @param {File} file
 * @param {'profile-images'|'menu-item-images'} bucket
 * @returns {Promise<string>} 公開 URL
 */
export async function uploadImage(userId, file, bucket = 'profile-images') {
	requireSupabase();
	const ext = file.name.split('.').pop();
	const path = `${userId}/${Date.now()}.${ext}`;
	const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
	if (error) throw error;
	const { data } = supabase.storage.from(bucket).getPublicUrl(path);
	return data.publicUrl;
}

// =====================================================
// 認証
// =====================================================

export async function signIn(email, password) {
	return supabase.auth.signInWithPassword({ email, password });
}

export async function signUp(email, password) {
	return supabase.auth.signUp({ email, password });
}

export async function signOut() {
	return supabase.auth.signOut();
}

export async function getSession() {
	const { data } = await supabase.auth.getSession();
	return data.session;
}

// =====================================================
// プロフィール
// =====================================================

/** ユーザープロフィールを作成（全タイプ共通） */
export async function createUserProfile(userId, userType, name) {
	const { error } = await supabase
		.from('user_profiles')
		.insert({ user_id: userId, user_type: userType, name });
	if (error) throw error;
}

/** オーナー情報を作成（場所提供者） */
export async function createOwnerProfile(userId, { ownerName, bio, career }) {
	const { error } = await supabase
		.from('owners')
		.insert({ user_id: userId, owner_name: ownerName, bio, career });
	if (error) throw error;
}

/** 営業者情報を作成（屋台提供者） */
export async function createOperatorProfile(userId, { businessName, phoneNumber }) {
	const { error } = await supabase
		.from('operators')
		.insert({ user_id: userId, business_name: businessName, phone_number: phoneNumber });
	if (error) throw error;
}

/** ログイン中ユーザーのプロフィールを取得（オーナー・営業者情報も含む） */
export async function getMyProfile(userId) {
	const { data } = await supabase
		.from('user_profiles')
		.select('*, owners(*), operators(*)')
		.eq('user_id', userId)
		.maybeSingle();
	return data;
}

/** ユーザープロフィールを更新（名前・自己紹介・アイコン） */
export async function updateUserProfile(userId, { name, bio, iconPath }) {
	const updates = {};
	if (name !== undefined) updates.name = name;
	if (bio !== undefined) updates.bio = bio;
	if (iconPath !== undefined) updates.icon_path = iconPath;

	const { error } = await supabase
		.from('user_profiles')
		.update(updates)
		.eq('user_id', userId);
	if (error) throw error;
}

// =====================================================
// マイメニュー
// =====================================================

/** マイメニュー一覧を取得（display_order 昇順） */
export async function getMyMenuItems(userId) {
	requireSupabase();
	const { data, error } = await supabase
		.from('my_menu_items')
		.select('id, name, description, price, photo_path, display_order')
		.eq('user_id', userId)
		.order('display_order', { ascending: true })
		.order('created_at', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

/** マイメニュー項目を1件追加 */
export async function addMenuItem(userId, { name, description, price, photoPath, displayOrder }) {
	requireSupabase();
	const { data, error } = await supabase
		.from('my_menu_items')
		.insert({
			user_id: userId,
			name,
			description: description || null,
			price: price || 0,
			photo_path: photoPath || null,
			display_order: displayOrder ?? 0
		})
		.select()
		.single();
	if (error) throw error;
	return data;
}

/** マイメニュー項目を更新 */
export async function updateMenuItem(id, { name, description, price, photoPath, displayOrder }) {
	requireSupabase();
	const updates = { name };
	if (description !== undefined) updates.description = description || null;
	if (price !== undefined) updates.price = price || 0;
	if (photoPath !== undefined) updates.photo_path = photoPath || null;
	if (displayOrder !== undefined) updates.display_order = displayOrder;

	const { error } = await supabase.from('my_menu_items').update(updates).eq('id', id);
	if (error) throw error;
}

/** マイメニュー項目を削除 */
export async function deleteMenuItem(id) {
	requireSupabase();
	const { error } = await supabase.from('my_menu_items').delete().eq('id', id);
	if (error) throw error;
}

// =====================================================
// マイページ用
// =====================================================

/** 自分のレンタルスペース一覧を取得 */
export async function getMySpaces(userId) {
	const { data, error } = await supabase
		.from('rental_spaces')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

/** 自分の屋台一覧を取得 */
export async function getMyStalls(userId) {
	const { data, error } = await supabase
		.from('stall_specs')
		.select('*')
		.eq('user_id', userId)
		.order('created_at', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

/** 自分の予約一覧を取得 */
export async function getMyReservations(userId) {
	const { data, error } = await supabase
		.from('reservations')
		.select(`
			id, start_datetime, end_datetime, planned_items, status, created_at,
			rental_spaces ( name, address ),
			stall_specs ( stall_name )
		`)
		.eq('user_id', userId)
		.order('start_datetime', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

/** 現在予約が入っている屋台IDの一覧を取得（ダブルブッキング表示用） */
export async function getBookedStallIds() {
	requireSupabase();
	const { data } = await supabase
		.from('reservations')
		.select('stall_id')
		.or('status.eq.pending,status.eq.active,status.is.null')
		.not('stall_id', 'is', null);
	return new Set((data ?? []).map((r) => r.stall_id).filter(Boolean));
}

/** ログイン中ユーザーの進行中予約を取得（pending/active） */
export async function getUserReservations(userId) {
	requireSupabase();
	const { data, error } = await supabase
		.from('reservations')
		.select(`
			id, start_datetime, end_datetime, status, planned_items,
			rental_space_id, stall_id,
			rental_spaces ( id, name, lat, lng ),
			stall_specs ( id, stall_name )
		`)
		.eq('user_id', userId)
		.or('status.eq.pending,status.eq.active,status.is.null')
		.order('start_datetime', { ascending: true });
	if (error) throw error;
	return data ?? [];
}

/** 今月の品目別販売個数を取得（屋台利用者用） */
export async function getMySalesThisMonth(userId) {
	requireSupabase();
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

	// 今月完了した自分の予約IDを取得
	const { data: reservations } = await supabase
		.from('reservations')
		.select('id')
		.eq('user_id', userId)
		.eq('status', 'completed')
		.gte('end_datetime', startOfMonth)
		.lte('end_datetime', endOfMonth);

	if (!reservations || reservations.length === 0) return {};
	const ids = reservations.map((r) => r.id);

	const { data: salesRecords } = await supabase
		.from('sales')
		.select('item_sales')
		.in('reservation_id', ids);

	if (!salesRecords) return {};

	// item_sales jsonb の集計
	const totals = {};
	salesRecords.forEach((s) => {
		if (s.item_sales && typeof s.item_sales === 'object') {
			Object.entries(s.item_sales).forEach(([item, count]) => {
				totals[item] = (totals[item] || 0) + (Number(count) || 0);
			});
		}
	});
	return totals;
}

/** 今月の提供者収益を取得（屋台提供者・場所提供者用） */
export async function getMyProviderMonthlyStats(userId) {
	requireSupabase();
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

	const { data } = await supabase
		.from('payment_history')
		.select('total_amount')
		.eq('recipient_id', userId)
		.gte('created_at', startOfMonth)
		.lte('created_at', endOfMonth);

	const count = data?.length ?? 0;
	const grossRevenue = (data ?? []).reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
	const netRevenue = Math.floor(grossRevenue * 0.7);
	return { count, grossRevenue, netRevenue };
}

/** 予約をキャンセル */
export async function cancelReservation(reservationId) {
	requireSupabase();
	const { error } = await supabase
		.from('reservations')
		.update({ status: 'cancelled' })
		.eq('id', reservationId);
	if (error) throw error;
}

/** 貸出開始（pending → active） */
export async function startRental(reservationId) {
	requireSupabase();
	const { error } = await supabase
		.from('reservations')
		.update({ status: 'active' })
		.eq('id', reservationId);
	if (error) throw error;
}

/**
 * 返却完了（active → completed）＋ 売上・支払い履歴記録
 * @param {string} reservationId
 * @param {string} userId - 借主のユーザーID（payer）
 * @param {object} salesItems - { beer: number, yakisoba: number, ... }
 */
export async function completeRental(reservationId, userId, salesItems) {
	requireSupabase();

	// 予約詳細を取得（料金・支払先の特定）
	const { data: res, error: resError } = await supabase
		.from('reservations')
		.select(`
			id, start_datetime, end_datetime,
			stall_specs ( rental_fee, user_id, operators ( business_name ) ),
			rental_spaces ( space_fee, user_id, owners ( owner_name ) )
		`)
		.eq('id', reservationId)
		.single();
	if (resError) throw resError;

	// 利用日数の計算（最低 1 日）
	const days = Math.max(
		1,
		Math.ceil(
			(new Date(res.end_datetime) - new Date(res.start_datetime)) / (1000 * 60 * 60 * 24)
		)
	);
	const stallFee = (res.stall_specs?.rental_fee ?? 0) * days;
	const spaceFee = (res.rental_spaces?.space_fee ?? 0) * days;

	// 予約ステータスを完了に更新
	const { error: updateError } = await supabase
		.from('reservations')
		.update({ status: 'completed' })
		.eq('id', reservationId);
	if (updateError) throw updateError;

	// 売上明細を記録
	if (salesItems && Object.keys(salesItems).some((k) => salesItems[k] > 0)) {
		const { error: salesError } = await supabase
			.from('sales')
			.insert({ reservation_id: reservationId, item_sales: salesItems });
		if (salesError) console.error('Sales insert error:', salesError);
	}

	// 支払い履歴を登録（屋台提供者・場所提供者それぞれ）
	const payments = [];
	if (res.stall_specs?.user_id && stallFee > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: userId,
			recipient_id: res.stall_specs.user_id,
			recipient_name: res.stall_specs.operators?.business_name ?? null,
			total_amount: stallFee
		});
	}
	if (res.rental_spaces?.user_id && spaceFee > 0) {
		payments.push({
			reservation_id: reservationId,
			payer_id: userId,
			recipient_id: res.rental_spaces.user_id,
			recipient_name: res.rental_spaces.owners?.owner_name ?? null,
			total_amount: spaceFee
		});
	}
	if (payments.length > 0) {
		const { error: paymentError } = await supabase
			.from('payment_history')
			.insert(payments);
		if (paymentError) throw paymentError;
	}
}

/** 今月の受取収益合計を取得（recipient_id でフィルタ） */
export async function getMonthlyRevenue(userId) {
	requireSupabase();
	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
	const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

	const { data, error } = await supabase
		.from('payment_history')
		.select('total_amount')
		.eq('recipient_id', userId)
		.gte('created_at', startOfMonth)
		.lte('created_at', endOfMonth);

	if (error) return 0;
	return (data ?? []).reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
}

// =====================================================
// 予約
// =====================================================

/** 予約を作成（屋台のダブルブッキングチェック付き） */
export async function createReservation(
	userId,
	{ rentalSpaceId, stallId, startDatetime, endDatetime, plannedItems }
) {
	requireSupabase();
	// 屋台がすでに他の予約と重複していないか確認
	if (stallId) {
		const { data: existing } = await supabase
			.from('reservations')
			.select('id')
			.eq('stall_id', stallId)
			.or('status.eq.pending,status.eq.active,status.is.null')
			.limit(1);
		if (existing && existing.length > 0) {
			throw new Error('この屋台はすでに予約が入っています。別の屋台をお選びください。');
		}
	}
	const { error } = await supabase.from('reservations').insert({
		user_id: userId,
		rental_space_id: rentalSpaceId || null,
		stall_id: stallId || null,
		start_datetime: startDatetime,
		end_datetime: endDatetime,
		planned_items: plannedItems || null
	});
	if (error) throw error;
}

// =====================================================
// スペース・屋台登録
// =====================================================

/** レンタルスペースを登録（場所提供者） */
export async function createRentalSpace(userId, spaceData) {
	const { error } = await supabase
		.from('rental_spaces')
		.insert({ user_id: userId, ...spaceData });
	if (error) throw error;
}

/** 屋台スペックを登録（屋台提供者） */
export async function createStallSpec(userId, stallData) {
	const { error } = await supabase
		.from('stall_specs')
		.insert({ user_id: userId, ...stallData });
	if (error) throw error;
}
