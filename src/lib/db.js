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

/** 現在出店中の屋台一覧を取得 */
export async function getActiveStalls() {
	requireSupabase();
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from('reservations')
		.select(`
			id,
			rental_spaces ( id, name, lat, lng, address ),
			stall_specs (
				id, stall_name, specs,
				operators ( business_name, icon_path )
			)
		`)
		.lte('start_datetime', now)
		.gte('end_datetime', now);

	if (error) throw error;

	return (data ?? [])
		.filter((r) => r.rental_spaces && r.stall_specs)
		.map((r) => ({
			id: r.id,
			name: r.stall_specs.stall_name,
			lat: r.rental_spaces.lat,
			lng: r.rental_spaces.lng,
			status: 'active',
			owner: r.stall_specs.operators?.business_name ?? '未設定',
			genre: r.stall_specs.specs ?? '',
			image: r.stall_specs.operators?.icon_path ?? null,
			spaceName: r.rental_spaces.name
		}));
}

/** 予約可能なレンタルスペース一覧を取得 */
export async function getAvailableSpaces() {
	requireSupabase();
	const { data, error } = await supabase
		.from('rental_spaces')
		.select(`
			id, name, lat, lng, address,
			space_fee, fire_use_allowed, ground_type, photos_path,
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
		address: s.address
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
			id, start_datetime, end_datetime, planned_items, created_at,
			rental_spaces ( name, address ),
			stall_specs ( stall_name )
		`)
		.eq('user_id', userId)
		.order('start_datetime', { ascending: false });
	if (error) throw error;
	return data ?? [];
}

// =====================================================
// 予約
// =====================================================

/** 予約を作成 */
export async function createReservation(
	userId,
	{ rentalSpaceId, stallId, startDatetime, endDatetime, plannedItems }
) {
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
