<svelte:head>
	<title>ダッシュボード | YATAKARI</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase.js';
	import { getMyStalls, getMyMenuItems, addMenuItem, updateMenuItem, deleteMenuItem, uploadImage, setIconShape } from '$lib/db.js';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import Icon from '$lib/components/Icon.svelte';
	import ShapeIcon from '$lib/components/ShapeIcon.svelte';

	let userId = $state(null);
	let profile = $state(null);
	let operatorData = $state(null);
	let ownerData = $state(null);
	let isLoading = $state(true);
	// profile / revenue / menu / ec / inventory / bank / stalls / subscription
	let section = $state('profile');

	const now = new Date();
	let selectedMonth = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

	// 収益データ
	let revenueByType = $state({ yatai_usage: 0, yatai_rental: 0, land_rental: 0 });
	let shopRevenue = $state(0);
	let orderCount = $state(0);
	let chartData = $state([]);
	let myStalls = $state([]);

	// 在庫データ
	let menuItems = $state([]);
	let invItems = $state([]);
	let ingredients = $state([]);
	let invMsg = $state('');
	let invErr = $state('');

	// ロール判定
	let hasShopRole = $derived(!!operatorData || !!profile?.is_shop_operator);
	let hasLandRole = $derived(!!ownerData || !!profile?.is_land_owner);
	let hasYataiOwnerRole = $derived(!!profile?.is_yatai_owner || profile?.user_type === '屋台提供者');
	let hasYataiUserRole = $derived(!!profile?.is_yatai_user || ['利用者', '購入者'].includes(profile?.user_type));
	let hasAnyRole = $derived(hasYataiUserRole || hasYataiOwnerRole || hasLandRole || hasShopRole);

	let totalRevenue = $derived(
		(revenueByType.yatai_usage ?? 0) + (revenueByType.yatai_rental ?? 0) +
		(revenueByType.land_rental ?? 0) + shopRevenue
	);

	const ROLE_META = {
		yatai_usage:  { label: '屋台利用者', desc: '屋台販売売上',         color: '#2a78d6' },
		yatai_rental: { label: '屋台主',     desc: '屋台貸し出し収益',     color: '#eb6834' },
		land_rental:  { label: '土地主',     desc: '土地利用収益',         color: '#1baf7a' },
		shop:         { label: 'ショップ',   desc: 'オンラインストア売上', color: '#eda100' }
	};
	let breakdown = $derived([
		hasYataiUserRole  && { ...ROLE_META.yatai_usage,  amount: revenueByType.yatai_usage ?? 0 },
		hasYataiOwnerRole && { ...ROLE_META.yatai_rental, amount: revenueByType.yatai_rental ?? 0 },
		hasLandRole       && { ...ROLE_META.land_rental,  amount: revenueByType.land_rental ?? 0 },
		hasShopRole       && { ...ROLE_META.shop,         amount: shopRevenue }
	].filter(Boolean));

	let deltaPct = $derived.by(() => {
		const idx = chartData.findIndex((d) => d.month === selectedMonth);
		if (idx <= 0) return null;
		const cur = chartData[idx].total, prev = chartData[idx - 1].total;
		if (prev <= 0) return null;
		return Math.round(((cur - prev) / prev) * 100);
	});

	// ── 在庫サマリー ──
	let shortageItems = $derived(invItems.filter((i) => i.required_qty > i.current_qty).length);
	let totalNeeded = $derived(invItems.reduce((s, i) => s + Math.max(0, i.required_qty - i.current_qty) * i.unit_price, 0));

	// ── 見込み利益（現在の在庫で作れる数 × 1食あたり利益） ──
	let profitByMenu = $derived.by(() => {
		const invById = Object.fromEntries(invItems.map((i) => [i.id, i]));
		const byMenu = {};
		for (const ing of ingredients) (byMenu[ing.menu_item_id] ??= []).push(ing);
		return menuItems.map((menu) => {
			const ings = (byMenu[menu.id] ?? []).filter(
				(ing) => ing.inventory_item_id && invById[ing.inventory_item_id] && ing.qty_per_serving > 0
			);
			if (ings.length === 0) return { menu, configured: false };
			let servings = Infinity, bottleneck = null, costPerServing = 0;
			for (const ing of ings) {
				const inv = invById[ing.inventory_item_id];
				const s = Math.floor((inv.current_qty ?? 0) / ing.qty_per_serving);
				if (s < servings) { servings = s; bottleneck = inv.name; }
				costPerServing += ing.qty_per_serving * (inv.unit_price ?? 0);
			}
			if (!isFinite(servings)) servings = 0;
			const profitPerServing = (menu.price ?? 0) - costPerServing;
			return {
				menu, configured: true, servings, bottleneck, costPerServing, profitPerServing,
				projectedProfit: servings * profitPerServing,
				projectedRevenue: servings * (menu.price ?? 0)
			};
		});
	});
	let configuredMenus = $derived(profitByMenu.filter((m) => m.configured));
	let totalProjectedProfit = $derived(configuredMenus.reduce((s, m) => s + m.projectedProfit, 0));
	let totalProjectedRevenue = $derived(configuredMenus.reduce((s, m) => s + m.projectedRevenue, 0));

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) { goto(`${base}/`); return; }
		const user = session.user;
		userId = user.id;
		accessToken = session.access_token;
		await loadProfile(user.id);
		await Promise.all([
			loadRevenue(user.id), loadChart(user.id), loadMyStalls(user.id),
			loadMenu(user.id), loadInv(user.id), loadIngredients(user.id),
			loadBank(user.id), loadYakonin(user.id)
		]);
		initProfileForm();
		initAdForm();
	});

	async function loadMyStalls(uid) { try { myStalls = await getMyStalls(uid); } catch { myStalls = []; } }

	async function loadProfile(uid) {
		const [profileRes, opRes, ownerRes] = await Promise.all([
			supabase.from('user_profiles').select('*').eq('user_id', uid).single(),
			supabase.from('operators').select('*').eq('user_id', uid).maybeSingle(),
			supabase.from('owners').select('*').eq('user_id', uid).maybeSingle()
		]);
		profile = profileRes.data; operatorData = opRes.data; ownerData = ownerRes.data;
	}

	function monthRange(monthStr) {
		const start = `${monthStr}-01T00:00:00Z`;
		const next = new Date(`${monthStr}-01`); next.setMonth(next.getMonth() + 1);
		return { start, end: next.toISOString().slice(0, 10) + 'T00:00:00Z' };
	}

	async function loadRevenue(uid) {
		isLoading = true;
		const { start, end } = monthRange(selectedMonth);
		const [logsRes, ordersRes] = await Promise.all([
			supabase.from('revenue_logs').select('revenue_type, amount').eq('user_id', uid).gte('occurred_at', start).lt('occurred_at', end),
			operatorData
				? supabase.from('shop_orders').select('total_amount').eq('operator_id', uid).gte('created_at', start).lt('created_at', end)
				: Promise.resolve({ data: [] })
		]);
		const byType = { yatai_usage: 0, yatai_rental: 0, land_rental: 0 };
		for (const log of logsRes.data ?? []) if (log.revenue_type in byType) byType[log.revenue_type] += log.amount;
		revenueByType = byType;
		const orders = ordersRes.data ?? [];
		shopRevenue = orders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
		orderCount = orders.length;
		isLoading = false;
	}

	async function loadChart(uid) {
		const months = Array.from({ length: 6 }, (_, i) => {
			const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		});
		const sixMonthsAgo = `${months[0]}-01T00:00:00Z`;
		const [allLogsRes, allOrdersRes] = await Promise.all([
			supabase.from('revenue_logs').select('amount, occurred_at').eq('user_id', uid).gte('occurred_at', sixMonthsAgo),
			operatorData
				? supabase.from('shop_orders').select('total_amount, created_at').eq('operator_id', uid).gte('created_at', sixMonthsAgo)
				: Promise.resolve({ data: [] })
		]);
		const totals = Object.fromEntries(months.map((m) => [m, 0]));
		for (const log of allLogsRes.data ?? []) { const m = log.occurred_at.slice(0, 7); if (m in totals) totals[m] += log.amount; }
		for (const o of allOrdersRes.data ?? []) { const m = o.created_at.slice(0, 7); if (m in totals) totals[m] += o.total_amount ?? 0; }
		chartData = months.map((m) => ({ month: m, label: `${parseInt(m.slice(5))}月`, total: totals[m] }));
	}

	async function loadMenu(uid) {
		try { menuItems = await getMyMenuItems(uid); } catch { menuItems = []; }
	}
	async function loadInv(uid) {
		const { data } = await supabase.from('inventory').select('*').eq('user_id', uid).order('created_at', { ascending: true });
		invItems = data ?? [];
	}
	async function loadIngredients(uid) {
		const { data } = await supabase.from('menu_ingredients').select('menu_item_id, inventory_item_id, qty_per_serving, item_type').eq('user_id', uid);
		ingredients = data ?? [];
	}

	$effect(() => { selectedMonth; if (userId && operatorData !== undefined) loadRevenue(userId); });

	function fmt(n) { return `¥${Math.round(n ?? 0).toLocaleString()}`; }
	function fmtShort(n) {
		if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
		if (n >= 1000) return `¥${Math.round(n / 1000)}K`;
		return `¥${Math.round(n)}`;
	}

	// ── チャート座標 ──
	const CW = 620, CH = 210, padL = 46, padR = 16, padT = 16, padB = 34;
	const plotW = CW - padL - padR, plotH = CH - padT - padB;
	function niceMax(v) {
		if (v <= 0) return 1;
		const p = Math.pow(10, Math.floor(Math.log10(v)));
		const n = v / p; const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
		return step * p;
	}
	let axisMax = $derived(niceMax(Math.max(...chartData.map((d) => d.total), 1)));
	let pts = $derived(chartData.map((d, i) => ({
		...d, i,
		x: padL + (chartData.length === 1 ? plotW / 2 : (i * plotW) / (chartData.length - 1)),
		y: padT + plotH - (d.total / axisMax) * plotH
	})));
	let linePath = $derived(pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
	let areaPath = $derived(pts.length ? `${linePath} L ${pts.at(-1).x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z` : '');
	let gridLines = $derived([0, 0.5, 1].map((g) => ({ v: axisMax * g, y: padT + plotH - g * plotH })));
	let hoverIdx = $state(null);
	let chartEl = $state();
	function onChartMove(e) {
		if (!chartEl || pts.length === 0) return;
		const rect = chartEl.getBoundingClientRect();
		const xVb = (e.clientX - rect.left) * (CW / rect.width);
		const step = chartData.length > 1 ? plotW / (chartData.length - 1) : plotW;
		hoverIdx = Math.max(0, Math.min(chartData.length - 1, Math.round((xVb - padL) / step)));
	}
	function onChartLeave() { hoverIdx = null; }
	let hover = $derived(hoverIdx != null ? pts[hoverIdx] : null);

	// ── 在庫 CRUD ──
	let newName = $state(''), newUnitPrice = $state(''), newRequired = $state(''), newCurrent = $state('');
	let isAdding = $state(false);
	let editingId = $state(null);
	let editName = $state(''), editUnitPrice = $state(''), editRequired = $state(''), editCurrent = $state('');
	let isSaving = $state(false);

	function invFlash(m) { invMsg = m; setTimeout(() => (invMsg = ''), 2500); }

	async function addInvItem() {
		if (!newName.trim()) return;
		isAdding = true; invErr = '';
		const { error } = await supabase.from('inventory').insert({
			user_id: userId, name: newName.trim(),
			unit_price: parseInt(newUnitPrice) || 0, required_qty: parseInt(newRequired) || 0, current_qty: parseInt(newCurrent) || 0
		});
		if (error) invErr = '追加に失敗しました: ' + error.message;
		else { newName = ''; newUnitPrice = ''; newRequired = ''; newCurrent = ''; invFlash('追加しました'); await loadInv(userId); }
		isAdding = false;
	}
	function startEdit(it) { editingId = it.id; editName = it.name; editUnitPrice = String(it.unit_price); editRequired = String(it.required_qty); editCurrent = String(it.current_qty); }
	function cancelEdit() { editingId = null; }
	async function saveEdit(id) {
		isSaving = true; invErr = '';
		const { error } = await supabase.from('inventory').update({
			name: editName.trim(), unit_price: parseInt(editUnitPrice) || 0, required_qty: parseInt(editRequired) || 0, current_qty: parseInt(editCurrent) || 0
		}).eq('id', id).eq('user_id', userId);
		if (error) invErr = '更新に失敗しました: ' + error.message;
		else { editingId = null; invFlash('更新しました'); await loadInv(userId); }
		isSaving = false;
	}
	async function deleteInvItem(id) {
		if (!confirm('この商品を削除しますか？\n（このアイテムを参照するメニュー紐付けも解除されます）')) return;
		const { error } = await supabase.from('inventory').delete().eq('id', id).eq('user_id', userId);
		if (!error) { invFlash('削除しました'); await Promise.all([loadInv(userId), loadIngredients(userId)]); }
	}
	// 現在数のクイック増減
	async function bumpStock(it, delta) {
		const next = Math.max(0, (it.current_qty ?? 0) + delta);
		const { error } = await supabase.from('inventory').update({ current_qty: next }).eq('id', it.id).eq('user_id', userId);
		if (!error) await loadInv(userId);
	}

	// ── 屋台: 口座設定 ──
	let bankAccount = $state(null);
	let bankForm = $state({ bank_name: '', branch_name: '', account_type: '普通', account_number: '', account_holder: '' });
	let isSavingBank = $state(false);
	let bankMsg = $state(''), bankErr = $state('');

	async function loadBank(uid) {
		const { data } = await supabase.from('operator_bank_accounts').select('*').eq('user_id', uid).maybeSingle();
		bankAccount = data;
		if (data) bankForm = {
			bank_name: data.bank_name, branch_name: data.branch_name, account_type: data.account_type,
			account_number: data.account_number, account_holder: data.account_holder
		};
	}
	async function saveBank() {
		bankMsg = ''; bankErr = '';
		if (!bankForm.bank_name.trim() || !bankForm.account_number.trim() || !bankForm.account_holder.trim()) {
			bankErr = '銀行名・口座番号・名義は必須です'; return;
		}
		isSavingBank = true;
		const payload = { ...bankForm, user_id: userId };
		const { error } = bankAccount
			? await supabase.from('operator_bank_accounts').update(bankForm).eq('user_id', userId)
			: await supabase.from('operator_bank_accounts').insert(payload);
		isSavingBank = false;
		if (error) bankErr = '保存に失敗しました: ' + error.message;
		else { bankAccount = payload; bankMsg = '口座情報を保存しました'; setTimeout(() => (bankMsg = ''), 2500); }
	}

	// ── 屋台: マイメニュー（写真つき・モーダル編集） ──
	let menuModalOpen = $state(false);
	let menuEdit = $state(null); // { id?, name, description, price, photo_path, photoFile }
	let menuPhotoPreview = $state('');
	let isSavingMenu = $state(false);
	let menuMsg = $state(''), menuErr = $state('');

	function menuFlash(m) { menuMsg = m; setTimeout(() => (menuMsg = ''), 2500); }

	function openAddMenu() {
		menuEdit = { name: '', description: '', price: '', photo_path: '', photoFile: null };
		menuPhotoPreview = ''; menuErr = ''; menuModalOpen = true;
	}
	function openEditMenu(m) {
		menuEdit = { ...m, photoFile: null };
		menuPhotoPreview = m.photo_path ?? ''; menuErr = ''; menuModalOpen = true;
	}
	function onMenuPhotoChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		menuEdit = { ...menuEdit, photoFile: file };
		menuPhotoPreview = URL.createObjectURL(file);
	}
	async function saveMenuModal() {
		if (!menuEdit?.name?.trim()) { menuErr = '商品名を入力してください'; return; }
		isSavingMenu = true; menuErr = '';
		try {
			let photoPath = menuEdit.photo_path ?? null;
			if (menuEdit.photoFile) photoPath = await uploadImage(userId, menuEdit.photoFile, 'menu-item-images');
			const payload = {
				name: menuEdit.name.trim(),
				description: menuEdit.description?.trim() || null,
				price: parseInt(String(menuEdit.price)) || 0,
				photoPath,
				displayOrder: menuEdit.display_order ?? menuItems.length
			};
			if (menuEdit.id) await updateMenuItem(menuEdit.id, payload);
			else await addMenuItem(userId, payload);
			menuModalOpen = false;
			menuFlash(menuEdit.id ? '更新しました' : 'メニューを追加しました');
			await loadMenu(userId);
		} catch (e) { menuErr = '保存に失敗しました: ' + e.message; } finally { isSavingMenu = false; }
	}
	async function removeMenu(id) {
		if (!confirm('このメニューを削除しますか？')) return;
		try { await deleteMenuItem(id); menuFlash('削除しました'); await Promise.all([loadMenu(userId), loadIngredients(userId)]); }
		catch (e) { menuErr = '削除に失敗しました: ' + e.message; }
	}

	// ── プロフィール（夜行人図鑑プロフィールに統合） ──
	let yakonin = $state(null);
	let pfName = $state(''), pfOneLiner = $state(''), pfBio = $state('');
	let pfIconPreview = $state(''), pfIconFile = $state(null);
	let savingProfile = $state(false);
	let profileMsg = $state(''), profileErr = $state('');

	async function loadYakonin(uid) {
		const { data } = await supabase.from('yakonin_profiles').select('handle, one_liner, is_public, avatar_path').eq('user_id', uid).maybeSingle();
		yakonin = data;
	}
	function initProfileForm() {
		pfName = profile?.name ?? yakonin?.handle ?? '';
		pfOneLiner = yakonin?.one_liner ?? '';
		pfBio = profile?.bio ?? '';
		pfIconPreview = profile?.icon_path ?? yakonin?.avatar_path ?? '';
	}
	function onIconPick(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		pfIconFile = file;
		pfIconPreview = URL.createObjectURL(file);
	}
	async function saveProfile() {
		profileErr = ''; profileMsg = '';
		if (!pfName.trim()) { profileErr = '名前を入力してください'; return; }
		savingProfile = true;
		try {
			let iconPath = profile?.icon_path ?? null;
			if (pfIconFile) iconPath = await uploadImage(userId, pfIconFile, 'profile-images');

			const { error: e1 } = await supabase.from('user_profiles').update({ name: pfName.trim(), bio: pfBio.trim() || null, icon_path: iconPath }).eq('user_id', userId);
			if (e1) throw e1;
			const { error: e2 } = await supabase.from('yakonin_profiles').upsert(
				{ user_id: userId, handle: pfName.trim(), one_liner: pfOneLiner.trim() || null, avatar_path: iconPath, is_public: true, updated_at: new Date().toISOString() },
				{ onConflict: 'user_id' }
			);
			if (e2) throw e2;
			profile = { ...profile, name: pfName.trim(), bio: pfBio.trim() || null, icon_path: iconPath };
			yakonin = { ...(yakonin ?? {}), handle: pfName.trim(), one_liner: pfOneLiner.trim() || null, avatar_path: iconPath, is_public: true };
			pfIconFile = null;
			profileMsg = 'プロフィールを保存しました（夜行人図鑑に反映されます）';
			setTimeout(() => (profileMsg = ''), 3000);
		} catch (e) { profileErr = '保存に失敗しました: ' + e.message; } finally { savingProfile = false; }
	}

	// ── 夜行人図鑑用アイコン形状（所有分の選択・変更） ──
	const SHAPE_LABELS = { star: '星', heart: 'ハート', diamond: '菱形', hexagon: '六角形' };
	let shapeMsg = $state('');
	let ownedShapes = $derived(Array.isArray(profile?.owned_shapes) ? profile.owned_shapes : []);
	let currentShape = $derived(profile?.icon_shape ?? 'circle');
	async function selectShape(shape) {
		if (shape !== 'circle' && !ownedShapes.includes(shape)) return;
		const prev = profile.icon_shape;
		profile = { ...profile, icon_shape: shape };
		try {
			await setIconShape(userId, shape);
			shapeMsg = 'アイコンの形を変更しました';
			setTimeout(() => (shapeMsg = ''), 2500);
		} catch { profile = { ...profile, icon_shape: prev }; }
	}

	// ── サブスクリプション（法人ダッシュボードを移植） ──
	let accessToken = $state('');
	let adHeadline = $state(''), adStoreUrl = $state(''), adRecruitUrl = $state('');
	let adImagePreview = $state(''), adImageFile = $state(null);
	let subBusy = $state(false), subMsg = $state(''), subErr = $state('');

	function initAdForm() {
		adHeadline = profile?.ad_headline ?? '';
		adStoreUrl = profile?.ad_store_url ?? '';
		adRecruitUrl = profile?.ad_recruit_url ?? '';
		adImagePreview = profile?.ad_image_path ?? '';
	}
	function onAdImagePick(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		adImageFile = file;
		adImagePreview = URL.createObjectURL(file);
	}
	async function saveAd() {
		subErr = ''; subMsg = ''; subBusy = true;
		try {
			let imagePath = profile?.ad_image_path ?? '';
			if (adImageFile) imagePath = await uploadImage(userId, adImageFile, 'profile-images');
			const res = await fetch('/api/corporate/ad', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ headline: adHeadline, storeUrl: adStoreUrl, recruitUrl: adRecruitUrl, imagePath })
			});
			if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? '保存に失敗しました'); }
			profile = { ...profile, ad_headline: adHeadline, ad_store_url: adStoreUrl, ad_recruit_url: adRecruitUrl, ad_image_path: imagePath };
			adImageFile = null;
			subMsg = '広告を保存しました。夜行人図鑑に反映されます。';
			setTimeout(() => (subMsg = ''), 4000);
		} catch (e) { subErr = e.message; } finally { subBusy = false; }
	}
	async function subscribe() {
		subErr = ''; subBusy = true;
		try {
			const res = await fetch('/api/subscription/checkout', {
				method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? '決済ページの作成に失敗しました');
			window.location.href = d.url;
		} catch (e) { subErr = e.message; subBusy = false; }
	}
	async function openPortal() {
		subErr = ''; subBusy = true;
		try {
			const res = await fetch('/api/subscription/portal', {
				method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? 'お支払い管理ページを開けませんでした');
			window.location.href = d.url;
		} catch (e) { subErr = e.message; subBusy = false; }
	}
	// 法人申請（未申請の個人からのアップグレード）
	let corpName = $state(''), applyingCorp = $state(false);
	async function applyCorporate() {
		subErr = ''; if (!corpName.trim()) { subErr = '法人名（屋号）を入力してください'; return; }
		applyingCorp = true;
		try {
			const res = await fetch('/api/corporate/apply', {
				method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ corpName })
			});
			if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? '申請に失敗しました'); }
			profile = { ...profile, account_type: 'corporate', corp_name: corpName.trim(), corp_status: 'pending' };
			subMsg = '法人申請を送信しました。運営の審査をお待ちください。';
		} catch (e) { subErr = e.message; } finally { applyingCorp = false; }
	}

	let ctr = $derived((() => {
		const v = profile?.ad_view_count ?? 0, c = profile?.ad_click_count ?? 0;
		if (!v) return '—';
		return `${((c / v) * 100).toFixed(1)}%`;
	})());
	let isActiveSub = $derived(profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing');
	let subStatusLabel = $derived(
		profile?.subscription_status === 'active' ? '利用中'
		: profile?.subscription_status === 'trialing' ? 'お試し中'
		: profile?.subscription_status === 'past_due' ? 'お支払い確認中'
		: profile?.subscription_status === 'canceled' ? '解約済み'
		: '未申し込み'
	);
</script>

<div class="page">
	<header class="page-header">
		<h1 class="page-title">ダッシュボード</h1>
	</header>

	<!-- セクション切替（横スクロール） -->
	<div class="seg">
		<button class="seg-btn" class:active={section === 'profile'} onclick={() => (section = 'profile')}><Icon name="user" size={15} /> プロフィール</button>
		<button class="seg-btn" class:active={section === 'revenue'} onclick={() => (section = 'revenue')}><Icon name="bar-chart" size={15} /> 収益</button>
		{#if hasShopRole}<button class="seg-btn" class:active={section === 'menu'} onclick={() => (section = 'menu')}><Icon name="utensils-crossed" size={15} /> メニュー</button>{/if}
		{#if hasShopRole}<button class="seg-btn" class:active={section === 'ec'} onclick={() => (section = 'ec')}><Icon name="shopping-bag" size={15} /> EC</button>{/if}
		<button class="seg-btn" class:active={section === 'inventory'} onclick={() => (section = 'inventory')}><Icon name="package" size={15} /> 在庫{#if shortageItems > 0}<span class="seg-badge">{shortageItems}</span>{/if}</button>
		{#if hasShopRole}<button class="seg-btn" class:active={section === 'bank'} onclick={() => (section = 'bank')}><Icon name="landmark" size={15} /> 口座</button>{/if}
		{#if hasShopRole}<button class="seg-btn" class:active={section === 'stalls'} onclick={() => (section = 'stalls')}><Icon name="yatai" size={15} /> 屋台</button>{/if}
		<button class="seg-btn" class:active={section === 'subscription'} onclick={() => (section = 'subscription')}><Icon name="badge-check" size={15} /> サブスクリプション</button>
	</div>

	{#if isLoading}
		<div class="loading">読み込み中…</div>

	<!-- ===== プロフィール（夜行人図鑑と統合） ===== -->
	{:else if section === 'profile'}
		<section class="card">
			<div class="card-head"><h2 class="card-title">プロフィール</h2><span class="card-sub">夜行人図鑑に表示</span></div>
			<p class="card-note">屋台と夜行人図鑑のプロフィールは共通です。ここで設定した内容が図鑑に反映されます。</p>
			{#if profileMsg}<p class="ok-msg">{profileMsg}</p>{/if}
			{#if profileErr}<p class="err-msg">{profileErr}</p>{/if}

			<div class="avatar-field">
				{#if pfIconPreview}
					<img class="avatar-img" src={pfIconPreview.startsWith('blob:') || pfIconPreview.startsWith('http') ? pfIconPreview : base + pfIconPreview} alt="アイコン" />
				{:else}
					<span class="avatar-img placeholder">{pfName?.charAt(0) ?? '?'}</span>
				{/if}
				<div class="avatar-actions">
					<label class="file-btn"><Icon name="image" size={15} /> アイコンを変更<input type="file" accept="image/*" onchange={onIconPick} hidden /></label>
					<span class="avatar-note">夜行人ネットワークのアイコンにも反映されます</span>
				</div>
			</div>

			<label class="f-field"><span class="f-label">名前</span>
				<input class="inp" bind:value={pfName} maxlength="30" placeholder="表示名 / 夜行人ハンドル" />
			</label>

			<div class="trust-row">
				<span class="f-label">信頼ポイント</span>
				<span class="trust-val">{profile?.credit_score ?? 0}</span>
				<span class="trust-note">屋台の利用・返却で増減します（自動）</span>
			</div>

			<label class="f-field"><span class="f-label">一言メッセージ</span>
				<input class="inp" bind:value={pfOneLiner} maxlength="60" placeholder="例: 夜な夜な出没する屋台好き" />
			</label>

			<label class="f-field"><span class="f-label">店舗説明文</span>
				<textarea class="inp ta" bind:value={pfBio} maxlength="300" rows="3" placeholder="お店・提供内容の紹介など"></textarea>
			</label>

			<button class="btn-primary" onclick={saveProfile} disabled={savingProfile}>{savingProfile ? '保存中…' : 'プロフィールを保存'}</button>
			<a href="{base}/network" class="card-foot-link">夜行人ネットワークで見る ›</a>
		</section>

		<!-- 所有アイコンの選択・変更 -->
		<section class="card">
			<div class="card-head"><h2 class="card-title">アイコンの形</h2></div>
			<p class="card-note">夜行人図鑑（星図）に表示されるアイコンの形を、所有している中から選べます。</p>
			{#if shapeMsg}<p class="ok-msg">{shapeMsg}</p>{/if}
			<div class="shape-grid">
				<button class="shape-cell" class:selected={currentShape === 'circle'} onclick={() => selectShape('circle')}>
					<ShapeIcon shape="circle" size={36} />
					<span class="shape-name">まる</span>
					{#if currentShape === 'circle'}<span class="shape-tag">使用中</span>{/if}
				</button>
				{#each Object.keys(SHAPE_LABELS) as key}
					{#if ownedShapes.includes(key)}
						<button class="shape-cell" class:selected={currentShape === key} onclick={() => selectShape(key)}>
							<ShapeIcon shape={key} size={36} filled={currentShape === key} />
							<span class="shape-name">{SHAPE_LABELS[key]}</span>
							{#if currentShape === key}<span class="shape-tag">使用中</span>{:else}<span class="shape-tag pick">選ぶ</span>{/if}
						</button>
					{/if}
				{/each}
			</div>
			{#if ownedShapes.length === 0}
				<a href="{base}/shop" class="card-foot-link">オンラインストアでアイコンを購入する ›</a>
			{:else}
				<a href="{base}/shop" class="card-foot-link">ほかのアイコンを購入する ›</a>
			{/if}
		</section>

	<!-- ===== 収益 ===== -->
	{:else if section === 'revenue'}
		{#if !hasAnyRole}
			<div class="empty-box">
				<p>収益を表示するためのロールが設定されていません。</p>
				<a href="{base}/mypage" class="link-strong">マイページでロールを追加する ›</a>
			</div>
		{:else}
			<div class="toolbar">
				<label class="field-inline"><span>表示月</span>
					<input type="month" bind:value={selectedMonth} class="month-input" />
				</label>
			</div>

			<section class="analytics">
				<p class="metric-label">総利益</p>
				<p class="metric-value">{fmt(totalRevenue)}</p>
				<p class="metric-sub">
					<span class="metric-month">{selectedMonth}</span>
					{#if deltaPct != null}
						<span class="delta" class:up={deltaPct >= 0} class:down={deltaPct < 0}>
							{deltaPct >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}% <span class="delta-note">前月比</span>
						</span>
					{/if}
				</p>

				<figure class="chart">
					<figcaption class="chart-cap">総利益の推移（直近6ヶ月）</figcaption>
					<div class="chart-holder">
						<svg bind:this={chartEl} viewBox="0 0 {CW} {CH}" class="chart-svg" onpointermove={onChartMove} onpointerleave={onChartLeave} role="presentation">
							<defs>
								<linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stop-color="var(--accent)" stop-opacity="0.22" />
									<stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
								</linearGradient>
							</defs>
							{#each gridLines as g}
								<line x1={padL} x2={CW - padR} y1={g.y} y2={g.y} class="grid" />
								<text x={padL - 8} y={g.y + 3} text-anchor="end" class="axis-y">{fmtShort(g.v)}</text>
							{/each}
							<path d={areaPath} fill="url(#area-grad)" />
							<path d={linePath} class="line" />
							{#if hover}<line x1={hover.x} x2={hover.x} y1={padT} y2={padT + plotH} class="crosshair" />{/if}
							{#each pts as p}
								<circle cx={p.x} cy={p.y} r={hoverIdx === p.i ? 5 : (p.i === pts.length - 1 ? 4 : 3)} class="dot" class:emph={p.i === pts.length - 1 || hoverIdx === p.i} />
							{/each}
							{#each pts as p}
								<text x={p.x} y={CH - 12} text-anchor="middle" class="axis-x" class:cur={p.month === selectedMonth}>{p.label}</text>
							{/each}
						</svg>
						{#if hover}
							<div class="tooltip" style="left: {(hover.x / CW) * 100}%; top: {(hover.y / CH) * 100}%">
								<span class="tt-month">{hover.month.replace('-', '年')}月</span>
								<span class="tt-val">{fmt(hover.total)}</span>
							</div>
						{/if}
					</div>
				</figure>
			</section>

			{#if hasShopRole}
				<section class="kpis">
					<div class="kpi"><span class="kpi-label">ショップ売上</span><span class="kpi-value">{fmt(shopRevenue)}</span></div>
					<div class="kpi"><span class="kpi-label">注文数</span><span class="kpi-value">{orderCount}<span class="kpi-unit">件</span></span></div>
					<div class="kpi"><span class="kpi-label">平均注文額</span><span class="kpi-value">{fmt(orderCount > 0 ? shopRevenue / orderCount : 0)}</span></div>
					<div class="kpi" class:warn={shortageItems > 0}><span class="kpi-label">在庫アラート</span><span class="kpi-value">{shortageItems}<span class="kpi-unit">件</span></span></div>
				</section>
			{/if}

			<section class="card">
				<div class="card-head"><h2 class="card-title">収益の内訳</h2><span class="card-sub">{selectedMonth}</span></div>
				<ul class="bd-list">
					{#each breakdown as b}
						{@const share = totalRevenue > 0 ? (b.amount / totalRevenue) * 100 : 0}
						<li class="bd-row">
							<span class="bd-chip" style="background:{b.color}"></span>
							<div class="bd-main">
								<div class="bd-top"><span class="bd-name">{b.label}</span><span class="bd-amount">{fmt(b.amount)}</span></div>
								<div class="bd-bar"><div class="bd-fill" style="width:{share}%; background:{b.color}"></div></div>
								<div class="bd-meta"><span class="bd-desc">{b.desc}</span><span class="bd-share">{share.toFixed(0)}%</span></div>
							</div>
						</li>
					{/each}
				</ul>
				{#if hasShopRole}<a href="{base}/mypage/operator" class="card-foot-link">ショップの詳細・精算管理 ›</a>{/if}
			</section>

			{#if myStalls.length > 0}
				<section class="card">
					<div class="card-head"><h2 class="card-title">夜行人ネットワーク 接続タグ</h2></div>
					<p class="tag-lead">屋台に QR / NFC タグを設置すると、来場者がスマホをかざすだけで<a href="{base}/network">夜行人ネットワーク</a>につながります。</p>
					<div class="tag-list">
						{#each myStalls as stall}
							<a href="{base}/yakonin/tag/{stall.id}" class="tag-row">
								<span class="tag-name"><Icon name="qr-code" size={16} /> {stall.stall_name ?? '屋台'}</span>
								<span class="tag-cta">接続タグを発行 ›</span>
							</a>
						{/each}
					</div>
				</section>
			{/if}
		{/if}

	<!-- ===== 在庫 ===== -->
	{:else if section === 'inventory'}
		{#if invMsg}<p class="ok-msg">{invMsg}</p>{/if}
		{#if invErr}<p class="err-msg">{invErr}</p>{/if}

		<!-- サマリー -->
		<section class="kpis">
			<div class="kpi"><span class="kpi-label">登録商品</span><span class="kpi-value">{invItems.length}<span class="kpi-unit">件</span></span></div>
			<div class="kpi" class:warn={shortageItems > 0}><span class="kpi-label">不足商品</span><span class="kpi-value">{shortageItems}<span class="kpi-unit">件</span></span></div>
			<div class="kpi" class:warn={totalNeeded > 0}><span class="kpi-label">必要資金</span><span class="kpi-value">{fmt(totalNeeded)}</span></div>
		</section>

		<!-- 見込み利益 -->
		<section class="analytics">
			<p class="metric-label">見込み利益 <span class="metric-hint">今の在庫で作れる分</span></p>
			<p class="metric-value" class:pos={totalProjectedProfit > 0} class:neg={totalProjectedProfit < 0}>{fmt(totalProjectedProfit)}</p>
			<p class="metric-sub">
				<span>売上見込 {fmt(totalProjectedRevenue)}</span>
				{#if configuredMenus.length}<span class="metric-month">・ {configuredMenus.length}メニュー</span>{/if}
			</p>

			{#if configuredMenus.length === 0}
				<div class="hint-box">
					メニューに食材・消耗品を紐付けると、<b>今の在庫であと何食作れて、いくら利益が見込めるか</b>を自動で計算します。
					<a href="{base}/mypage/inventory" class="link-strong">メニューと食材を紐付ける ›</a>
				</div>
			{:else}
				<ul class="proj-list">
					{#each configuredMenus as m}
						<li class="proj-row">
							<div class="proj-main">
								<span class="proj-name">{m.menu.name}</span>
								<span class="proj-servings">あと <b>{m.servings}</b> 食</span>
							</div>
							<div class="proj-side">
								<span class="proj-profit" class:pos={m.projectedProfit > 0} class:neg={m.projectedProfit < 0}>{fmt(m.projectedProfit)}</span>
								{#if m.servings === 0 && m.bottleneck}
									<span class="proj-bottleneck"><Icon name="alert-triangle" size={12} /> {m.bottleneck} 切れ</span>
								{:else if m.bottleneck}
									<span class="proj-bottleneck muted">{m.bottleneck}で頭打ち</span>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				<a href="{base}/mypage/inventory" class="card-foot-link">メニューと食材の紐付けを編集 ›</a>
			{/if}
		</section>

		<!-- 在庫の追加 -->
		<section class="card">
			<div class="card-head"><h2 class="card-title">在庫アイテムを追加</h2></div>
			<div class="add-form">
				<input type="text" bind:value={newName} placeholder="商品名（例：紙トレイ、鴨肉）" class="inp inp-name" />
				<input type="number" bind:value={newUnitPrice} placeholder="単価" class="inp inp-num" min="0" />
				<input type="number" bind:value={newRequired} placeholder="必要数" class="inp inp-num" min="0" />
				<input type="number" bind:value={newCurrent} placeholder="現在数" class="inp inp-num" min="0" />
				<button class="btn-primary" onclick={addInvItem} disabled={isAdding || !newName.trim()}>{isAdding ? '追加中…' : '追加'}</button>
			</div>
		</section>

		<!-- 在庫一覧 -->
		<section class="card">
			<div class="card-head"><h2 class="card-title">在庫一覧</h2></div>
			{#if invItems.length === 0}
				<p class="empty-inline">在庫データがありません。上のフォームから追加してください。</p>
			{:else}
				<div class="table-wrap">
					<table class="inv-table">
						<thead><tr>
							<th class="c-name">商品名</th><th class="c-num">単価</th><th class="c-num">必要</th>
							<th class="c-num">現在</th><th class="c-num">不足</th><th class="c-num">必要資金</th><th></th>
						</tr></thead>
						<tbody>
							{#each invItems as it (it.id)}
								{@const short = it.required_qty - it.current_qty}
								{@const needs = Math.max(0, short) * it.unit_price}
								{#if editingId === it.id}
									<tr class="edit-row">
										<td><input type="text" bind:value={editName} class="inp-inline" /></td>
										<td><input type="number" bind:value={editUnitPrice} class="inp-inline num" min="0" /></td>
										<td><input type="number" bind:value={editRequired} class="inp-inline num" min="0" /></td>
										<td><input type="number" bind:value={editCurrent} class="inp-inline num" min="0" /></td>
										<td colspan="2"></td>
										<td class="c-act">
											<button class="mini-btn dark" onclick={() => saveEdit(it.id)} disabled={isSaving}>{isSaving ? '…' : '保存'}</button>
											<button class="mini-btn" onclick={cancelEdit}>取消</button>
										</td>
									</tr>
								{:else}
									<tr class:short-row={short > 0}>
										<td class="c-name">{#if short > 0}<span class="dot">!</span>{/if}{it.name}</td>
										<td class="c-num">{fmt(it.unit_price)}</td>
										<td class="c-num">{it.required_qty}</td>
										<td class="c-num">
											<span class="stepper">
												<button class="step" aria-label="減らす" onclick={() => bumpStock(it, -1)}>−</button>
												<span class="step-val">{it.current_qty}</span>
												<button class="step" aria-label="増やす" onclick={() => bumpStock(it, 1)}>＋</button>
											</span>
										</td>
										<td class="c-num" class:short-num={short > 0}>{short > 0 ? `−${short}` : '—'}</td>
										<td class="c-num" class:short-num={needs > 0}>{needs > 0 ? fmt(needs) : '—'}</td>
										<td class="c-act">
											<button class="mini-btn" onclick={() => startEdit(it)}>編集</button>
											<button class="mini-btn danger" onclick={() => deleteInvItem(it.id)}>削除</button>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

	<!-- ===== メニュー（出店者） ===== -->
	{:else if section === 'menu' && hasShopRole}
		<section class="card">
			<div class="card-head">
				<h2 class="card-title">マイメニュー <span class="card-sub">{menuItems.length}品</span></h2>
				<button class="mini-btn dark" onclick={openAddMenu}>＋ 追加</button>
			</div>
			<p class="card-note">普段の営業で提供する商品を登録すると、予約時に呼び出せます</p>
			{#if menuMsg}<p class="ok-msg">{menuMsg}</p>{/if}
			{#if menuErr}<p class="err-msg">{menuErr}</p>{/if}

			{#if menuItems.length === 0}
				<p class="empty-inline">メニューがありません。「＋ 追加」から登録できます。</p>
			{:else}
				<ul class="menu-list">
					{#each menuItems as m (m.id)}
						<li class="menu-row">
							{#if m.photo_path}
								<img src={m.photo_path} alt={m.name} class="menu-thumb" />
							{:else}
								<div class="menu-thumb no-photo"><Icon name="utensils-crossed" size={20} /></div>
							{/if}
							<div class="menu-main">
								<span class="menu-name">{m.name}</span>
								{#if m.description}<span class="menu-desc">{m.description}</span>{/if}
								<span class="menu-price">{fmt(m.price)}</span>
							</div>
							<span class="menu-act">
								<button class="mini-btn" onclick={() => openEditMenu(m)}>編集</button>
								<button class="mini-btn danger" onclick={() => removeMenu(m.id)}>削除</button>
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			<a href="{base}/mypage/inventory" class="card-foot-link">メニューと食材の紐付けを編集 ›</a>
		</section>

	<!-- ===== EC（オンラインストア・出店者） ===== -->
	{:else if section === 'ec' && hasShopRole}
		<section class="card">
			<div class="card-head"><h2 class="card-title">オンラインストア（EC）</h2></div>
			<p class="card-note">屋台の商品をオンラインで販売できます。商品の登録・在庫・発送は出品者ページから管理します。</p>
			<div class="link-stack">
				<a href="{base}/mypage/operator/products" class="btn-primary block">商品を管理する</a>
				<a href="{base}/shop" class="link-strong">公開中のストアを見る ›</a>
			</div>
		</section>

	<!-- ===== 口座（出店者） ===== -->
	{:else if section === 'bank' && hasShopRole}
		<section class="card">
			<div class="card-head"><h2 class="card-title">口座設定</h2></div>
			<p class="card-note">売上の精算に使用します。運営が精算時に確認します。</p>
			{#if bankMsg}<p class="ok-msg">{bankMsg}</p>{/if}
			{#if bankErr}<p class="err-msg">{bankErr}</p>{/if}
			<div class="bank-form">
				<label class="f-field"><span class="f-label">銀行名</span><input class="inp" bind:value={bankForm.bank_name} placeholder="〇〇銀行" /></label>
				<label class="f-field"><span class="f-label">支店名</span><input class="inp" bind:value={bankForm.branch_name} placeholder="〇〇支店" /></label>
				<label class="f-field"><span class="f-label">種別</span>
					<select class="inp" bind:value={bankForm.account_type}>
						<option value="普通">普通</option>
						<option value="当座">当座</option>
					</select>
				</label>
				<label class="f-field"><span class="f-label">口座番号</span><input class="inp" bind:value={bankForm.account_number} inputmode="numeric" placeholder="1234567" /></label>
				<label class="f-field wide"><span class="f-label">口座名義（カナ）</span><input class="inp" bind:value={bankForm.account_holder} placeholder="ヤタイ タロウ" /></label>
			</div>
			<button class="btn-primary" onclick={saveBank} disabled={isSavingBank}>{isSavingBank ? '保存中…' : (bankAccount ? '口座情報を更新' : '口座情報を保存')}</button>
		</section>

	<!-- ===== 屋台（出店者） ===== -->
	{:else if section === 'stalls' && hasShopRole}
		<section class="card">
			<div class="card-head"><h2 class="card-title">マイ屋台 <span class="card-sub">{myStalls.length}台</span></h2></div>
			{#if myStalls.length === 0}
				<p class="empty-inline">登録された屋台がありません。</p>
			{:else}
				<ul class="stall-list">
					{#each myStalls as st}
						<li class="stall-row">
							<span class="stall-name"><Icon name="yatai" size={16} /> {st.stall_name ?? '屋台'}</span>
							<a href="{base}/yakonin/tag/{st.id}" class="mini-btn">接続タグ</a>
						</li>
					{/each}
				</ul>
			{/if}
			<a href="{base}/mypage/add-stall" class="card-foot-link">屋台を追加・編集する ›</a>
		</section>

	<!-- ===== サブスクリプション（法人ダッシュボード） ===== -->
	{:else if section === 'subscription'}
		{#if subErr}<p class="err-msg">{subErr}</p>{/if}
		{#if subMsg}<p class="ok-msg">{subMsg}</p>{/if}

		{#if profile?.corp_status === 'approved' || isActiveSub}
			<!-- プラン状態 -->
			<section class="card">
				<h2 class="card-title">プランの状態</h2>
				<div class="status-row">
					<span class="status-chip" class:on={isActiveSub}>{subStatusLabel}</span>
					<span class="status-note">{isActiveSub ? '夜行人図鑑に広告が掲載され、法人バッジが表示されています。' : '月額プランにお申し込みいただくと広告掲載が始まります。'}</span>
				</div>
				<div class="link-stack">
					{#if isActiveSub}
						<button class="btn-primary block" onclick={openPortal} disabled={subBusy}>お支払い・プランの管理（解約）</button>
						<a class="link-strong" href="{base}/groups">イベントグループを作成・管理 ›</a>
					{:else}
						<button class="btn-primary block" onclick={subscribe} disabled={subBusy}>法人プランに申し込む（月額）</button>
					{/if}
				</div>
			</section>

			<!-- アクセス解析 -->
			<section class="card">
				<h2 class="card-title">アクセス解析</h2>
				<p class="card-note">夜行人図鑑での広告の表示回数と、アイコンがクリックされた回数です。</p>
				<div class="metric-row">
					<div class="metric"><span class="metric-value">{(profile.ad_view_count ?? 0).toLocaleString()}</span><span class="metric-label">表示回数</span></div>
					<div class="metric"><span class="metric-value">{(profile.ad_click_count ?? 0).toLocaleString()}</span><span class="metric-label">クリック回数</span></div>
					<div class="metric"><span class="metric-value">{ctr}</span><span class="metric-label">クリック率</span></div>
				</div>
			</section>

			<!-- 広告編集 -->
			<section class="card">
				<h2 class="card-title">広告の内容</h2>
				<p class="card-note">図鑑であなたのアイコンをクリックした際に表示されます。契約中は放浪者として図鑑内を巡回します。</p>
				<label class="f-field"><span class="f-label">キャッチコピー（全角30字まで）</span><input class="inp" bind:value={adHeadline} maxlength="60" placeholder="例: 京都の夜に、あたたかい一杯を。" /></label>
				<label class="f-field"><span class="f-label">オンラインストアURL</span><input class="inp" type="url" bind:value={adStoreUrl} placeholder="https://…" /></label>
				<label class="f-field"><span class="f-label">求人・採用URL</span><input class="inp" type="url" bind:value={adRecruitUrl} placeholder="https://…" /></label>
				<div class="f-field">
					<span class="f-label">広告画像（1枚）</span>
					{#if adImagePreview}<img class="ad-preview" src={adImagePreview.startsWith('blob:') || adImagePreview.startsWith('http') ? adImagePreview : base + adImagePreview} alt="広告画像" />{/if}
					<label class="file-btn"><Icon name="image" size={15} /> 画像を選ぶ<input type="file" accept="image/*" onchange={onAdImagePick} hidden /></label>
				</div>
				<div class="link-stack">
					<button class="btn-primary block" onclick={saveAd} disabled={subBusy}>広告を保存</button>
					<a class="link-strong" href="{base}/network">図鑑で確認する ›</a>
				</div>
			</section>

		{:else if profile?.corp_status === 'pending'}
			<section class="card">
				<h2 class="card-title">法人プラン</h2>
				<p class="card-note">法人申請を審査中です。運営の承認後にプランへお申し込みいただけます。</p>
			</section>

		{:else}
			<section class="card">
				<h2 class="card-title">法人プラン（サブスクリプション）</h2>
				<p class="card-note">法人プラン（月額）で、夜行人図鑑への広告掲載・法人バッジ・アクセス解析・イベントグループ作成が使えます。まずは法人として申請してください（審査あり）。</p>
				{#if profile?.corp_status === 'rejected'}<p class="err-msg">前回の申請は承認されませんでした。</p>{/if}
				<label class="f-field"><span class="f-label">法人名 / 屋号</span><input class="inp" bind:value={corpName} placeholder="例: 株式会社 夜行社" /></label>
				<button class="btn-primary block" onclick={applyCorporate} disabled={applyingCorp}>{applyingCorp ? '送信中…' : '法人として申請する'}</button>
			</section>
		{/if}

	{:else}
		<div class="empty-box">
			<p>このタブは屋台出店者としての登録後にご利用いただけます。</p>
			<a href="{base}/mypage" class="link-strong">マイページで登録する ›</a>
		</div>
	{/if}
</div>

<!-- ===== マイメニュー 追加/編集モーダル ===== -->
{#if menuModalOpen && menuEdit}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (menuModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (menuModalOpen = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-card">
			<h3 class="modal-title">{menuEdit.id ? 'メニューを編集' : 'メニューを追加'}</h3>

			{#if menuErr}<p class="err-msg">{menuErr}</p>{/if}

			<!-- 商品写真 -->
			<div class="photo-upload-row">
				<label class="photo-upload-label" for="menu-photo-upload">
					{#if menuPhotoPreview}
						<img src={menuPhotoPreview} alt="商品写真" class="photo-preview" />
					{:else}
						<div class="photo-placeholder"><Icon name="camera" size={20} /> 写真を追加</div>
					{/if}
				</label>
				<input id="menu-photo-upload" type="file" accept="image/*" class="hidden-file" onchange={onMenuPhotoChange} />
			</div>

			<label class="field-label">
				商品名 <span class="req">*</span>
				<input type="text" bind:value={menuEdit.name} class="field-input" placeholder="例: クラフトビール" />
			</label>

			<label class="field-label">
				商品説明
				<textarea bind:value={menuEdit.description} class="field-input textarea" rows="2" placeholder="例: 地元醸造所のIPAビール"></textarea>
			</label>

			<label class="field-label">
				料金（円）
				<input type="number" bind:value={menuEdit.price} class="field-input" placeholder="800" min="0" />
			</label>

			<div class="modal-btns">
				<button class="cancel-btn" onclick={() => (menuModalOpen = false)}>キャンセル</button>
				<button class="btn-primary" onclick={saveMenuModal} disabled={isSavingMenu}>{isSavingMenu ? '保存中…' : '保存する'}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page { max-width: 820px; margin: 0 auto; padding: 22px 16px 80px; color: var(--ink); }

	.page-header { margin-bottom: 16px; }
	.page-title { font-size: 1.35rem; font-weight: 700; margin: 6px 0 0; }

	/* セグメント */
	.seg { display: flex; gap: 4px; background: var(--surface-sunk); border-radius: 11px; padding: 4px; margin-bottom: 20px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
	.seg::-webkit-scrollbar { display: none; }
	.seg-btn { display: inline-flex; align-items: center; gap: 5px; padding: 8px 13px; border: none; background: transparent; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: var(--ink-2); cursor: pointer; font-family: inherit; white-space: nowrap; flex: 0 0 auto; }
	.seg-btn :global(.icon) { color: currentColor; }
	.seg-btn.active { background: var(--surface); color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
	.seg-badge { background: var(--accent-deep); color: #fff; font-size: 0.66rem; font-weight: 700; padding: 1px 6px; border-radius: 999px; }

	.loading { text-align: center; padding: 60px; color: var(--ink-2); }
	.empty-box { text-align: center; padding: 48px 20px; color: var(--ink-2); font-size: 0.9rem; }
	.link-strong { display: inline-block; margin-top: 10px; color: var(--accent); text-decoration: none; font-weight: 600; }
	.ok-msg { font-size: 0.84rem; color: #1a8a4f; margin: 0 0 12px; }
	.err-msg { font-size: 0.84rem; color: var(--accent-deep); margin: 0 0 12px; }

	.toolbar { margin-bottom: 14px; }
	.field-inline { display: inline-flex; align-items: center; gap: 8px; font-size: 0.84rem; color: var(--ink-2); }
	.month-input { padding: 7px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.85rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.month-input:focus { outline: 2px solid var(--accent); border-color: transparent; }

	/* 分析サマリー */
	.analytics { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; padding: 22px 22px 18px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.metric-label { font-size: 0.8rem; color: var(--ink-2); margin: 0 0 4px; display: flex; align-items: baseline; gap: 8px; }
	.metric-hint { font-size: 0.7rem; color: var(--ink-3); font-weight: 400; }
	.metric-value { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.02em; margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1.05; }
	.metric-value.pos { color: #1a8a4f; }
	.metric-value.neg { color: var(--accent-deep); }
	.metric-sub { display: flex; align-items: center; gap: 12px; margin: 8px 0 0; font-size: 0.82rem; color: var(--ink-3); }
	.metric-month { font-variant-numeric: tabular-nums; }
	.delta { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-variant-numeric: tabular-nums; }
	.delta.up { color: #1a8a4f; }
	.delta.down { color: var(--accent-deep); }
	.delta-note { color: var(--ink-3); font-weight: 500; margin-left: 2px; }

	.chart { margin: 18px 0 0; }
	.chart-cap { font-size: 0.76rem; color: var(--ink-3); margin: 0 0 6px; }
	.chart-holder { position: relative; width: 100%; }
	.chart-svg { display: block; width: 100%; height: auto; touch-action: none; }
	.grid { stroke: var(--line); stroke-width: 1; }
	.axis-y { fill: var(--ink-3); font-size: 10px; font-family: inherit; }
	.axis-x { fill: var(--ink-3); font-size: 11px; font-family: inherit; }
	.axis-x.cur { fill: var(--accent); font-weight: 700; }
	.line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
	.dot { fill: var(--surface); stroke: var(--accent); stroke-width: 2; }
	.dot.emph { fill: var(--accent); }
	.crosshair { stroke: var(--accent); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5; }
	.tooltip { position: absolute; transform: translate(-50%, -125%); background: var(--ink); color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 0.74rem; white-space: nowrap; pointer-events: none; display: flex; flex-direction: column; gap: 1px; box-shadow: var(--shadow-2); }
	.tt-month { color: #cdbfae; font-size: 0.66rem; }
	.tt-val { font-weight: 700; font-variant-numeric: tabular-nums; }

	/* KPI */
	.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 16px; }
	.kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
	.kpi-label { font-size: 0.74rem; color: var(--ink-2); }
	.kpi-value { font-size: 1.35rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
	.kpi-unit { font-size: 0.78rem; font-weight: 600; color: var(--ink-3); margin-left: 2px; }
	.kpi.warn { border-color: #f0c98a; background: #fdf6e9; }
	.kpi.warn .kpi-value { color: #b07d1e; }

	/* カード */
	.card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; box-shadow: var(--shadow-1); margin-bottom: 16px; }
	.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
	.card-title { font-size: 1rem; font-weight: 700; margin: 0; }
	.card-sub { font-size: 0.74rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
	.card-foot-link { display: inline-block; margin-top: 14px; font-size: 0.8rem; color: var(--accent); text-decoration: none; font-weight: 600; }
	.card-foot-link:hover { text-decoration: underline; }

	/* 内訳 */
	.bd-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 16px; }
	.bd-row { display: flex; gap: 12px; align-items: flex-start; }
	.bd-chip { flex-shrink: 0; width: 12px; height: 12px; border-radius: 4px; margin-top: 3px; }
	.bd-main { flex: 1; min-width: 0; }
	.bd-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
	.bd-name { font-size: 0.88rem; font-weight: 600; }
	.bd-amount { font-size: 0.95rem; font-weight: 800; font-variant-numeric: tabular-nums; }
	.bd-bar { height: 7px; background: var(--surface-sunk); border-radius: 4px; overflow: hidden; }
	.bd-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
	.bd-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 5px; }
	.bd-desc { font-size: 0.72rem; color: var(--ink-3); }
	.bd-share { font-size: 0.72rem; color: var(--ink-2); font-weight: 600; font-variant-numeric: tabular-nums; }

	/* 見込み利益リスト */
	.hint-box { margin-top: 14px; background: var(--surface-sunk); border: 1px dashed var(--line-strong); border-radius: 12px; padding: 16px; font-size: 0.84rem; color: var(--ink-2); line-height: 1.7; }
	.hint-box b { color: var(--ink); }
	.proj-list { list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; }
	.proj-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
	.proj-main { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
	.proj-name { font-size: 0.9rem; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.proj-servings { font-size: 0.8rem; color: var(--ink-2); white-space: nowrap; }
	.proj-servings b { font-size: 1rem; color: var(--ink); font-variant-numeric: tabular-nums; }
	.proj-side { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
	.proj-profit { font-size: 0.98rem; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--ink); }
	.proj-profit.pos { color: #1a8a4f; }
	.proj-profit.neg { color: var(--accent-deep); }
	.proj-bottleneck { display: inline-flex; align-items: center; gap: 3px; font-size: 0.68rem; color: var(--accent-deep); }
	.proj-bottleneck.muted { color: var(--ink-3); }

	/* 追加フォーム */
	.add-form { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
	.inp { padding: 9px 11px; border: 1px solid var(--line-strong); border-radius: 9px; font-size: 0.88rem; font-family: inherit; background: var(--surface); color: var(--ink); }
	.inp:focus { outline: 2px solid var(--accent); border-color: transparent; }
	.inp-name { flex: 2; min-width: 150px; }
	.inp-num { flex: 1; min-width: 78px; text-align: right; }
	.btn-primary { padding: 9px 20px; background: var(--accent); color: #fff; border: none; border-radius: 9px; font-size: 0.88rem; font-weight: 700; cursor: pointer; font-family: inherit; white-space: nowrap; }
	.btn-primary:hover:not(:disabled) { background: var(--accent-deep); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

	/* テーブル */
	.table-wrap { overflow-x: auto; margin: 0 -4px; }
	.inv-table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
	.inv-table th { padding: 8px 12px; text-align: left; font-size: 0.72rem; color: var(--ink-2); border-bottom: 1px solid var(--line); white-space: nowrap; }
	.inv-table td { padding: 9px 12px; border-bottom: 1px solid var(--surface-sunk); vertical-align: middle; }
	.inv-table tr:last-child td { border-bottom: none; }
	.c-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
	.c-name { font-weight: 600; }
	.c-act { white-space: nowrap; text-align: right; }
	.short-row { background: #fdf6e9; }
	.short-num { color: var(--accent-deep); font-weight: 700; }
	.dot { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; background: var(--accent-deep); color: #fff; font-size: 0.6rem; font-weight: 800; border-radius: 50%; margin-right: 5px; }

	.stepper { display: inline-flex; align-items: center; gap: 8px; }
	.step { width: 22px; height: 22px; border: 1px solid var(--line-strong); background: var(--surface); border-radius: 6px; font-size: 0.9rem; line-height: 1; cursor: pointer; color: var(--ink-2); }
	.step:hover { border-color: var(--accent); color: var(--accent); }
	.step-val { min-width: 20px; text-align: center; font-weight: 700; }

	.mini-btn { padding: 5px 11px; font-size: 0.76rem; background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 7px; cursor: pointer; color: var(--ink); font-family: inherit; }
	.mini-btn:hover { border-color: var(--accent); color: var(--accent); }
	.mini-btn.dark { background: var(--accent); color: #fff; border-color: var(--accent); }
	.mini-btn.danger { color: var(--accent-deep); border-color: #e6b8a8; background: var(--surface); }
	.mini-btn.danger:hover { background: #fdf2ee; }
	.edit-row { background: #fffbf5; }
	.inp-inline { padding: 6px 8px; border: 1.5px solid var(--accent); border-radius: 6px; font-size: 0.84rem; width: 100%; box-sizing: border-box; font-family: inherit; }
	.inp-inline.num { text-align: right; max-width: 84px; }
	.empty-inline { font-size: 0.86rem; color: var(--ink-3); margin: 0; }
	.card-note { font-size: 0.8rem; color: var(--ink-2); margin: 0 0 14px; line-height: 1.6; }

	/* 屋台: 口座フォーム */
	.bank-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
	.f-field { display: flex; flex-direction: column; gap: 5px; }
	.f-field.wide { grid-column: 1 / -1; }
	.f-label { font-size: 0.74rem; color: var(--ink-2); font-weight: 600; }

	/* プロフィール */
	.f-field { margin-bottom: 14px; }
	.avatar-field { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
	.avatar-img { width: 68px; height: 68px; border-radius: 50%; object-fit: cover; border: 1px solid var(--line); flex-shrink: 0; }
	.avatar-img.placeholder { display: inline-flex; align-items: center; justify-content: center; background: var(--surface-sunk); color: var(--ink-3); font-family: "Zen Antique", serif; font-size: 1.7rem; }
	.avatar-actions { display: flex; flex-direction: column; gap: 6px; }
	.file-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--ink); background: var(--surface-sunk); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; cursor: pointer; align-self: flex-start; }
	.file-btn:hover { border-color: var(--accent); color: var(--accent); }
	.file-btn :global(.icon) { color: var(--accent); }
	.avatar-note { font-size: 0.7rem; color: var(--ink-3); }

	/* アイコンの形 */
	.shape-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; margin: 4px 0 6px; }
	.shape-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); color: var(--ink-2); cursor: pointer; font-family: inherit; transition: border-color 0.15s, color 0.15s, background 0.15s; }
	.shape-cell:hover { border-color: var(--accent); color: var(--accent); }
	.shape-cell.selected { border-color: var(--accent); color: var(--accent); background: var(--accent-tint); }
	.shape-name { font-size: 0.78rem; font-weight: 600; }
	.shape-tag { font-size: 0.66rem; color: var(--accent-deep); font-weight: 700; }
	.shape-tag.pick { color: var(--ink-3); font-weight: 500; }
	.ta { resize: vertical; min-height: 68px; line-height: 1.6; }
	.trust-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; padding: 12px 14px; background: var(--surface-sunk); border-radius: 10px; }
	.trust-val { font-size: 1.4rem; font-weight: 800; color: var(--accent-deep); font-variant-numeric: tabular-nums; }
	.trust-note { font-size: 0.72rem; color: var(--ink-3); }

	/* サブスク（法人ダッシュボード移植） */
	.status-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
	.status-chip { font-size: 0.8rem; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: var(--surface-sunk); color: var(--ink-2); border: 1px solid var(--line); }
	.status-chip.on { background: rgba(181,137,46,0.14); color: #8a6a1e; border-color: rgba(181,137,46,0.4); }
	.status-note { font-size: 0.82rem; color: var(--ink-2); }
	.metric-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
	.metric { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 16px 8px; border-radius: 12px; background: var(--surface-sunk); border: 1px solid var(--line); }
	.metric-value { font-size: 1.5rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
	.metric-label { font-size: 0.72rem; color: var(--ink-3); font-weight: 600; }
	.ad-preview { display: block; width: 100%; max-height: 200px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); margin-bottom: 10px; }

	/* EC / 汎用リンクスタック */
	.link-stack { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
	.btn-primary.block { display: block; width: 100%; box-sizing: border-box; text-align: center; text-decoration: none; }

	/* 屋台一覧 */
	.stall-list { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; }
	.stall-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-top: 1px solid var(--line); }
	.stall-row:first-child { border-top: none; }
	.stall-name { display: inline-flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 600; color: var(--ink); }
	.stall-name :global(.icon) { color: var(--accent); }
	.bank-form .inp { width: 100%; box-sizing: border-box; }

	/* 屋台: マイメニュー */
	.menu-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
	.menu-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
	.menu-row:first-child { border-top: none; }
	.menu-thumb { width: 56px; height: 56px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.menu-thumb.no-photo { background: var(--surface-sunk); display: flex; align-items: center; justify-content: center; color: var(--ink-3); }
	.menu-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
	.menu-name { font-size: 0.9rem; font-weight: 600; color: var(--ink); }
	.menu-desc { font-size: 0.76rem; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.menu-price { font-size: 0.9rem; font-weight: 700; color: var(--accent); font-variant-numeric: tabular-nums; white-space: nowrap; }
	.menu-act { display: flex; gap: 6px; flex-shrink: 0; }

	/* メニュー編集モーダル */
	.modal-overlay { position: fixed; inset: 0; z-index: 1600; background: rgba(30, 22, 14, 0.5); display: flex; align-items: center; justify-content: center; padding: 20px; overflow-y: auto; }
	.modal-card { background: var(--surface); border-radius: 18px; padding: 22px 20px; width: 100%; max-width: 420px; margin: auto; box-shadow: 0 12px 40px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 12px; }
	.modal-title { font-size: 1.1rem; font-weight: 700; color: var(--ink); margin: 0; }
	.photo-upload-row { display: flex; justify-content: center; }
	.photo-upload-label { cursor: pointer; }
	.photo-preview { width: 130px; height: 150px; object-fit: cover; border-radius: 12px; border: 1.5px solid var(--line-strong); display: block; }
	.photo-placeholder { width: 130px; height: 150px; background: var(--surface-sunk); border: 2px dashed var(--line-strong); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; font-size: 0.85rem; color: var(--ink-3); }
	.field-label { display: block; font-size: 0.82rem; color: var(--ink-2); }
	.req { color: var(--accent-deep); }
	.field-input { display: block; width: 100%; margin-top: 5px; padding: 10px 12px; border: 1.5px solid var(--line-strong); border-radius: 8px; font-size: 0.95rem; font-family: inherit; box-sizing: border-box; background: var(--surface); color: var(--ink); }
	.field-input:focus { outline: none; border-color: var(--accent); }
	.textarea { resize: vertical; min-height: 70px; }
	.modal-btns { display: flex; gap: 10px; margin-top: 6px; }
	.modal-btns .btn-primary { flex: 1; }
	.cancel-btn { flex: 1; padding: 11px; background: var(--surface-sunk); border: 1px solid var(--line-strong); color: var(--ink-2); border-radius: 9px; font-size: 0.9rem; font-weight: 600; cursor: pointer; font-family: inherit; }
	.cancel-btn:hover { background: var(--line); }

	@media (max-width: 480px) {
		.metric-value { font-size: 2.1rem; }
		.bank-form { grid-template-columns: 1fr; }
	}
</style>
