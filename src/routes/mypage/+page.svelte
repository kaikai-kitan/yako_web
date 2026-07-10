<!-- マイページ -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import {
		getMyProfile,
		getMySpaces,
		getMyStalls,
		createOwnerProfile,
		createOperatorProfile,
		updateUserProfile,
		getMyMenuItems,
		addMenuItem,
		updateMenuItem,
		deleteMenuItem,
		uploadImage,
		signOut
	} from '$lib/db.js';
	import Icon from '$lib/components/Icon.svelte';

	let profile = $state(null);
	let mySpaces = $state([]);
	let myStalls = $state([]);
	let myMenuItems = $state([]);
	let isLoading = $state(true);
	let userId = $state('');
	let accessToken = $state('');

	// オンラインストア申請
	let completedRentals = $state(0);
	let shopStatus = $state(null); // operators row の shop_application_status など
	let isApplying = $state(false);
	let applyMsg = $state('');
	let applyError = $state('');

	// ---- プロフィール編集 ----
	let editName = $state('');
	let editBio = $state('');
	let editIconFile = $state(null);
	let editIconPreview = $state('');
	let isSavingProfile = $state(false);
	let profileSaveMsg = $state('');

	// ---- マイメニュー ----
	// 編集中のアイテム（null = 追加モード、object = 編集モード）
	let menuEditItem = $state(null); // { id?, name, description, price, photo_path, photoFile? }
	let isMenuModalOpen = $state(false);
	let isSavingMenu = $state(false);
	let menuSaveError = $state('');
	let menuPhotoPreview = $state('');

	// 役割追加モーダル
	let showRoleModal = $state(false);
	let addingRole = $state('');
	let roleFormError = $state('');
	let isAddingRole = $state(false);

	// 場所提供者フォーム
	let ownerName = $state('');
	let bio = $state('');
	let career = $state('');

	// 屋台提供者フォーム
	let businessName = $state('');
	let phoneNumber = $state('');

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		if (!session) { goto(`${base}/auth`); return; }
		userId = session.user.id;
		accessToken = session.access_token;

		profile = await getMyProfile(userId);
		if (!profile) { goto(`${base}/auth/setup`); return; }

		// プロフィール編集フォームの初期値
		editName = profile.name ?? '';
		editBio = profile.bio ?? '';
		editIconPreview = profile.icon_path ?? '';

		const tasks = [
			getMyMenuItems(userId).then((d) => (myMenuItems = d))
		];
		if (profile.owners) tasks.push(getMySpaces(userId).then((d) => (mySpaces = d)));
		if (profile.operators) {
			tasks.push(getMyStalls(userId).then((d) => (myStalls = d)));
			tasks.push(
				(async () => {
					const [{ count }, { data: opData }] = await Promise.all([
						supabase
							.from('reservations')
							.select('id', { count: 'exact', head: true })
							.eq('user_id', userId)
							.eq('status', 'completed'),
						supabase
							.from('operators')
							.select('shop_application_status, rejection_reason, applied_at')
							.eq('user_id', userId)
							.maybeSingle()
					]);
					completedRentals = count ?? 0;
					shopStatus = opData ?? { shop_application_status: 'none', rejection_reason: null };
				})()
			);
		}
		await Promise.all(tasks);

		isLoading = false;
	});

	// ---- プロフィール保存 ----
	async function saveProfile() {
		if (!editName.trim()) return;
		isSavingProfile = true;
		profileSaveMsg = '';
		try {
			let iconPath = profile.icon_path ?? null;
			if (editIconFile) {
				iconPath = await uploadImage(userId, editIconFile, 'profile-images');
			}
			await updateUserProfile(userId, {
				name: editName.trim(),
				bio: editBio.trim() || null,
				iconPath
			});
			profile = { ...profile, name: editName.trim(), bio: editBio.trim(), icon_path: iconPath };
			editIconFile = null;
			profileSaveMsg = '保存しました';
			setTimeout(() => (profileSaveMsg = ''), 2500);
		} catch (e) {
			profileSaveMsg = '保存失敗: ' + e.message;
		} finally {
			isSavingProfile = false;
		}
	}

	function onIconFileChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		editIconFile = file;
		editIconPreview = URL.createObjectURL(file);
	}

	// ---- マイメニュー操作 ----
	function openAddMenu() {
		menuEditItem = { name: '', description: '', price: '', photo_path: '', photoFile: null };
		menuPhotoPreview = '';
		menuSaveError = '';
		isMenuModalOpen = true;
	}

	function openEditMenu(item) {
		menuEditItem = { ...item, photoFile: null };
		menuPhotoPreview = item.photo_path ?? '';
		menuSaveError = '';
		isMenuModalOpen = true;
	}

	function onMenuPhotoChange(e) {
		const file = e.target.files?.[0];
		if (!file) return;
		menuEditItem = { ...menuEditItem, photoFile: file };
		menuPhotoPreview = URL.createObjectURL(file);
	}

	async function saveMenuItemHandler() {
		if (!menuEditItem?.name?.trim()) { menuSaveError = '商品名を入力してください'; return; }
		isSavingMenu = true;
		menuSaveError = '';
		try {
			let photoPath = menuEditItem.photo_path ?? null;
			if (menuEditItem.photoFile) {
				photoPath = await uploadImage(userId, menuEditItem.photoFile, 'menu-item-images');
			}
			const payload = {
				name: menuEditItem.name.trim(),
				description: menuEditItem.description?.trim() || null,
				price: parseInt(String(menuEditItem.price)) || 0,
				photoPath,
				displayOrder: menuEditItem.display_order ?? myMenuItems.length
			};
			if (menuEditItem.id) {
				await updateMenuItem(menuEditItem.id, payload);
				myMenuItems = myMenuItems.map((m) =>
					m.id === menuEditItem.id
						? { ...m, ...payload, photo_path: photoPath }
						: m
				);
			} else {
				const newItem = await addMenuItem(userId, payload);
				myMenuItems = [...myMenuItems, newItem];
			}
			isMenuModalOpen = false;
		} catch (e) {
			menuSaveError = '保存失敗: ' + e.message;
		} finally {
			isSavingMenu = false;
		}
	}

	async function handleDeleteMenu(id) {
		if (!confirm('このメニューを削除しますか？')) return;
		try {
			await deleteMenuItem(id);
			myMenuItems = myMenuItems.filter((m) => m.id !== id);
		} catch (e) {
			alert('削除失敗: ' + e.message);
		}
	}

	// ---- 役割追加 ----
	async function handleSignOut() {
		await signOut();
		// /mypage はYATAKARIアプリ内からのアクセスなのでマップへ戻す
		goto(`${base}/map`);
	}

	// 前の画面へ戻る（履歴が無ければマップへ）
	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) window.history.back();
		else goto(`${base}/map`);
	}

	// 公式オンラインストア開設に必要な信頼ポイント
	const STORE_MIN_CREDIT = 200;
	let creditScore = $derived(profile?.credit_score ?? 0);
	let canOpenStore = $derived(creditScore > STORE_MIN_CREDIT);

	function openRoleModal(role) {
		addingRole = role;
		roleFormError = '';
		ownerName = ''; bio = ''; career = '';
		businessName = ''; phoneNumber = '';
		showRoleModal = true;
	}

	async function submitRoleAddition() {
		roleFormError = '';
		isAddingRole = true;
		try {
			if (addingRole === '場所提供者') {
				if (!ownerName.trim()) { roleFormError = 'オーナー名を入力してください'; return; }
				await createOwnerProfile(userId, { ownerName: ownerName.trim(), bio: bio.trim(), career: career.trim() });
			} else if (addingRole === '屋台提供者') {
				if (!businessName.trim()) { roleFormError = '屋号を入力してください'; return; }
				await createOperatorProfile(userId, { businessName: businessName.trim(), phoneNumber: phoneNumber.trim() });
			}
			profile = await getMyProfile(userId);
			if (addingRole === '場所提供者') mySpaces = await getMySpaces(userId);
			if (addingRole === '屋台提供者') myStalls = await getMyStalls(userId);
			showRoleModal = false;
		} catch (e) {
			roleFormError = '登録に失敗しました: ' + e.message;
		} finally {
			isAddingRole = false;
		}
	}

	// ---- QRコード表示 ----
	let qrModalSpace = $state(null); // { id, name, type: 'space'|'stall' }
	let qrDataUrl = $state('');

	async function showSpaceQR(space) {
		qrModalSpace = { ...space, type: 'space' };
		qrDataUrl = '';
		const url = `${window.location.origin}/scan?space=${space.id}`;
		const QRCode = (await import('qrcode')).default;
		qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 });
	}

	async function showStallQR(stall) {
		qrModalSpace = { ...stall, name: stall.stall_name, type: 'stall' };
		qrDataUrl = '';
		const url = `${window.location.origin}/scan?yatai=${stall.id}`;
		const QRCode = (await import('qrcode')).default;
		qrDataUrl = await QRCode.toDataURL(url, { width: 280, margin: 2 });
	}

	async function applyForShop() {
		isApplying = true;
		applyError = '';
		applyMsg = '';
		try {
			const res = await fetch('/api/operator/apply', {
				method: 'POST',
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (!res.ok) {
				const d = await res.json().catch(() => ({}));
				throw new Error(d.message ?? '申請に失敗しました');
			}
			shopStatus = { ...shopStatus, shop_application_status: 'pending' };
			applyMsg = '申請を送信しました。運営からの連絡をお待ちください。';
		} catch (e) {
			applyError = e.message;
		}
		isApplying = false;
	}

	// ---- 法人プラン（夜行人図鑑の広告） ----
	let corpName = $state('');
	let corpMsg = $state('');
	let corpError = $state('');
	let corpBusy = $state(false);

	async function applyCorporate() {
		corpError = ''; corpMsg = '';
		if (!corpName.trim()) { corpError = '法人名（屋号）を入力してください'; return; }
		corpBusy = true;
		try {
			const res = await fetch('/api/corporate/apply', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({ corpName })
			});
			if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message ?? '申請に失敗しました'); }
			profile = { ...profile, corp_name: corpName.trim(), corp_status: 'pending' };
			corpMsg = '法人申請を送信しました。運営の審査をお待ちください。';
		} catch (e) { corpError = e.message; } finally { corpBusy = false; }
	}

	async function subscribeCorporate() {
		corpError = '';
		corpBusy = true;
		try {
			const res = await fetch('/api/subscription/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? '決済ページの作成に失敗しました');
			window.location.href = d.url;
		} catch (e) { corpError = e.message; corpBusy = false; }
	}

	async function openCorpPortal() {
		corpError = '';
		corpBusy = true;
		try {
			const res = await fetch('/api/subscription/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
				body: JSON.stringify({})
			});
			const d = await res.json().catch(() => ({}));
			if (!res.ok || !d.url) throw new Error(d.message ?? 'お支払い管理ページを開けませんでした');
			window.location.href = d.url;
		} catch (e) { corpError = e.message; corpBusy = false; }
	}
</script>

<div class="page">
	<div class="page-nav">
		<button class="back-to-map" onclick={goBack}>← 前の画面に戻る</button>
		<a class="map-return-btn" href="{base}/map">
			<Icon name="map" size={16} /> マップに戻る
		</a>
	</div>

	{#if isLoading}
		<div class="loading">読み込み中…</div>
	{:else if profile}

		<!-- ===== プロフィール編集 ===== -->
		<section class="section profile-edit-section">
			<h3 class="section-title">プロフィール</h3>

			<!-- アイコン -->
			<div class="avatar-edit-row">
				<label class="avatar-label" for="icon-upload">
					{#if editIconPreview}
						<img src={editIconPreview} alt="アイコン" class="avatar-img" />
					{:else}
						<div class="avatar-placeholder">{profile.name?.charAt(0) ?? '?'}</div>
					{/if}
					<span class="avatar-edit-hint">タップして変更</span>
				</label>
				<input id="icon-upload" type="file" accept="image/*" class="hidden-file" onchange={onIconFileChange} />
			</div>

			<!-- バッジ -->
			<div class="badge-row-small">
				<span class="badge user">さすらい屋台人</span>
				{#if profile.owners}<span class="badge owner">土地貸し出し人</span>{/if}
				{#if profile.operators}<span class="badge operator">屋台主</span>{/if}
			</div>

			<!-- 信頼ポイント -->
			<div class="credit-box">
				<div class="credit-head">
					<span class="credit-label">信頼ポイント</span>
					<span class="credit-value" class:low={creditScore <= STORE_MIN_CREDIT}>{creditScore}</span>
				</div>
				<div class="credit-bar">
					<div class="credit-fill" style="width: {Math.max(0, Math.min(100, (creditScore / 300) * 100))}%"></div>
				</div>
				<p class="credit-note">
					屋台の営業を1回終える（返却する）と <strong>+5</strong>、お客様のレビューで最大 <strong>+5</strong>。
					キャンセルやノーショーは減点です。
					{#if !canOpenStore}<br />公式オンラインストアの開設には <strong>{STORE_MIN_CREDIT}超</strong> が必要です。{/if}
				</p>
			</div>

			<!-- 名前 -->
			<label class="field-label">
				名前 / 店舗名
				<input type="text" bind:value={editName} class="field-input" placeholder="例: 鴨川珈琲" />
			</label>

			<!-- 自己紹介 -->
			<label class="field-label">
				店舗説明文
				<textarea
					bind:value={editBio}
					class="field-input textarea"
					rows="3"
					placeholder="例: 京都・鴨川沿いで珈琲と軽食を提供しています"
				></textarea>
			</label>

			{#if profileSaveMsg}
				<p class="save-msg" class:error-msg={profileSaveMsg.startsWith('保存失敗')}>{profileSaveMsg}</p>
			{/if}
			<button class="save-btn" onclick={saveProfile} disabled={isSavingProfile || !editName.trim()}>
				{isSavingProfile ? '保存中…' : '保存する'}
			</button>
		</section>

		<!-- ===== ダッシュボード ===== -->
		<section class="section dashboard-section">
			<!-- 収益ダッシュボード（全員） -->
			<a href="{base}/mypage/dashboard" class="dashboard-link revenue-link">
				<div class="dl-text">
					<strong>収益ダッシュボード</strong>
					<span>売上集計・ロール別収益・売上推移</span>
				</div>
				<span class="dl-arrow">›</span>
			</a>
			<!-- 在庫管理（全員） -->
			<a href="{base}/mypage/inventory" class="dashboard-link inventory-link">
				<div class="dl-text">
					<strong>在庫管理</strong>
					<span>商品の必要数・現在数・不足資金を管理</span>
				</div>
				<span class="dl-arrow">›</span>
			</a>
			<!-- 夜行人プロフィール（全員） -->
			<a href="{base}/yakonin/setup" class="dashboard-link yakonin-link">
				<div class="dl-text">
					<strong>夜行人プロフィール</strong>
					<span>ニックネーム・一言・アイコンの編集、接続QR</span>
				</div>
				<span class="dl-arrow">›</span>
			</a>
			<!-- 夜行人図鑑・ネットワーク（全員） -->
			<a href="{base}/directory" class="dashboard-link">
				<div class="dl-text">
					<strong>夜行人図鑑</strong>
					<span>3Dネットワークの閲覧・QRで繋がる</span>
				</div>
				<span class="dl-arrow">›</span>
			</a>
			{#if profile.operators}
				<a href="{base}/mypage/operator" class="dashboard-link operator-link">
					<div class="dl-text">
						<strong>出店者ダッシュボード</strong>
						<span>受注管理・売上確認・口座設定</span>
					</div>
					<span class="dl-arrow">›</span>
				</a>
			{:else if canOpenStore}
				<div class="operator-cta">
					<div class="cta-text">
						<div>
							<strong>オンラインストアで出店する</strong>
							<p>商品を出品して販売できます。屋号・電話番号を登録してください。</p>
						</div>
					</div>
					<button class="cta-btn" onclick={() => openRoleModal('屋台提供者')}>
						出店申請する →
					</button>
				</div>
			{:else}
				<div class="operator-cta locked">
					<div class="cta-text">
						<div>
							<strong>オンラインストアの開設は準備中</strong>
							<p>公式オンラインストアの開設には、信頼ポイント <strong>{STORE_MIN_CREDIT}超</strong> が必要です（現在 {creditScore}）。YATAKARI を使って信頼を積み重ねましょう。</p>
						</div>
					</div>
				</div>
			{/if}
		</section>

		<!-- ===== マイメニュー ===== -->
		<section class="section">
			<div class="section-header">
				<h3 class="section-title"><Icon name="utensils-crossed" size={18} /> マイメニュー</h3>
				<button class="add-btn" onclick={openAddMenu}>＋ 追加</button>
			</div>
			<p class="section-hint">普段の営業で提供する商品を登録すると、予約時に呼び出せます</p>

			{#if myMenuItems.length === 0}
				<p class="empty-msg">まだ登録がありません</p>
			{:else}
				<div class="menu-list">
					{#each myMenuItems as item}
						<div class="menu-card">
							{#if item.photo_path}
								<img src={item.photo_path} alt={item.name} class="menu-thumb" />
							{:else}
								<div class="menu-thumb no-photo"><Icon name="utensils-crossed" size={20} /></div>
							{/if}
							<div class="menu-info">
								<span class="menu-name">{item.name}</span>
								{#if item.description}
									<span class="menu-desc">{item.description}</span>
								{/if}
								<span class="menu-price">¥{(item.price ?? 0).toLocaleString()}</span>
							</div>
							<div class="menu-actions">
								<button class="icon-btn" onclick={() => openEditMenu(item)}>編集</button>
								<button class="icon-btn danger" onclick={() => handleDeleteMenu(item.id)}>削除</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ===== 役割を追加 ===== -->
		{#if !profile.owners && !profile.operators}
			<section class="section">
				<h3 class="section-title">役割を追加する</h3>
				<div class="role-add-row">
					<button class="role-add-btn" onclick={() => openRoleModal('場所提供者')}>
						<span class="role-icon"><Icon name="map-pin" size={20} /></span>
						<span class="role-text"><strong>土地貸し出し人</strong>として登録</span>
						<span class="arrow">›</span>
					</button>
					<button class="role-add-btn" onclick={() => openRoleModal('屋台提供者')}>
						<span class="role-icon"><Icon name="store" size={20} /></span>
						<span class="role-text"><strong>屋台主</strong>として登録</span>
						<span class="arrow">›</span>
					</button>
				</div>
			</section>
		{/if}

		<!-- ===== 場所提供者セクション ===== -->
		{#if profile.owners}
			<section class="section">
				<div class="section-header">
					<h3 class="section-title"><Icon name="map-pin" size={18} /> マイスペース</h3>
					<a href="{base}/mypage/add-space" class="add-btn">＋ 追加</a>
				</div>
				{#if mySpaces.length === 0}
					<p class="empty-msg">スペースがまだ登録されていません</p>
				{:else}
					<div class="card-list">
						{#each mySpaces as space}
							<div class="item-card">
								{#if space.photos_path?.[0]}
									<img src={space.photos_path[0]} alt={space.name} class="item-photo" />
								{/if}
								<div class="item-header">
									<span class="item-name">{space.name}</span>
									<span class="status-badge available">公開中</span>
								</div>
								<div class="item-detail detail-with-icon"><Icon name="map-pin" size={14} /> {space.address ?? '住所未設定'}</div>
								<div class="item-detail detail-with-icon">
									¥{(space.space_fee ?? 0).toLocaleString()} / 泊　{space.ground_type ?? ''}
									{#if space.fire_use_allowed}<Icon name="flame" size={14} /> 火気可{:else}<Icon name="ban" size={14} /> 火気不可{/if}
								</div>
								<div class="item-actions">
									<a href="{base}/mypage/edit-space/{space.id}" class="edit-btn">編集</a>
									<button class="qr-btn" onclick={() => showSpaceQR(space)}>
										QRコードを表示
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ===== 屋台提供者セクション ===== -->
		{#if profile.operators}
			<section class="section">
				<div class="section-header">
					<h3 class="section-title"><Icon name="store" size={18} /> マイ屋台</h3>
					<a href="{base}/mypage/add-stall" class="add-btn">＋ 追加</a>
				</div>
				{#if myStalls.length === 0}
					<p class="empty-msg">屋台がまだ登録されていません</p>
				{:else}
					<div class="card-list">
						{#each myStalls as stall}
							<div class="item-card">
								{#if stall.photo_path}
									<img src={stall.photo_path} alt={stall.stall_name} class="item-photo" />
								{/if}
								<div class="item-header">
									<span class="item-name">{stall.stall_name}</span>
									<span class="status-badge stall">登録済み</span>
								</div>
								<div class="item-detail">{stall.specs ?? 'スペック未設定'}</div>
								<div class="item-detail">¥{(stall.rental_fee ?? 0).toLocaleString()} / 日</div>
								<div class="item-actions">
									<a href="{base}/mypage/edit-stall/{stall.id}" class="edit-btn">編集</a>
									<button class="qr-btn" onclick={() => showStallQR(stall)}>
										QRコードを表示
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- ===== オンラインストア申請 ===== -->
		{#if profile.operators && shopStatus}
			<section class="section shop-apply-section">
				<h3 class="section-title"><Icon name="shopping-bag" size={18} /> オンラインストア開設</h3>

				{#if shopStatus.shop_application_status === 'approved'}
					<div class="shop-status-box approved">
						<span class="shop-badge approved"><Icon name="check" size={13} /> 承認済み</span>
						<p class="shop-status-msg">オンラインストアが開設されています。</p>
						<a href="{base}/mypage/operator" class="shop-goto-btn">出品者ダッシュボードへ →</a>
					</div>

				{:else if shopStatus.shop_application_status === 'pending'}
					<div class="shop-status-box pending">
						<span class="shop-badge pending"><Icon name="clock" size={13} /> 審査中</span>
						<p class="shop-status-msg">申請を受け付けました。運営からの連絡をお待ちください。</p>
					</div>

				{:else if shopStatus.shop_application_status === 'rejected'}
					<div class="shop-status-box rejected">
						<span class="shop-badge rejected"><Icon name="x" size={13} /> 却下</span>
						{#if shopStatus.rejection_reason}
							<p class="rejection-reason">却下理由: {shopStatus.rejection_reason}</p>
						{/if}
						{#if completedRentals >= 1}
							{#if applyMsg}
								<p class="apply-success">{applyMsg}</p>
							{/if}
							{#if applyError}
								<p class="apply-error">{applyError}</p>
							{/if}
							<button class="apply-btn" onclick={applyForShop} disabled={isApplying}>
								{isApplying ? '申請中…' : '再申請する'}
							</button>
						{/if}
					</div>

				{:else}
					<!-- none: 申請前 -->
					{#if completedRentals >= 1}
						<p class="section-hint">屋台出店の実績が確認されました。オンラインストアを申請できます。</p>
						{#if applyMsg}
							<p class="apply-success">{applyMsg}</p>
						{/if}
						{#if applyError}
							<p class="apply-error">{applyError}</p>
						{/if}
						<button class="apply-btn" onclick={applyForShop} disabled={isApplying}>
							{isApplying ? '申請中…' : 'オンラインストアを申請する'}
						</button>
					{:else}
						<p class="empty-msg">オンラインストア開設には屋台での出店実績（1回以上）が必要です。</p>
						<a href="{base}/map" class="cta-link">屋台を予約する →</a>
					{/if}
				{/if}
			</section>
		{/if}

		<!-- ===== 法人プラン（夜行人図鑑の広告） ===== -->
		<section class="section">
			<h3 class="section-title"><Icon name="badge-check" size={18} /> 法人プラン（夜行人図鑑の広告）</h3>
			<p class="section-hint">法人として登録すると、夜行人図鑑に広告を掲載でき、名前の横に法人バッジが付きます。</p>

			{#if corpError}<p class="error-msg">{corpError}</p>{/if}
			{#if corpMsg}<p class="save-msg">{corpMsg}</p>{/if}

			{#if profile.subscription_status === 'active'}
				<div class="corp-box active">
					<span class="corp-state ok"><Icon name="circle-check" size={14} /> 法人プランご利用中</span>
					<p>夜行人図鑑に広告が掲載され、法人バッジが表示されています。</p>
					<button class="corp-btn ghost" onclick={openCorpPortal} disabled={corpBusy}>お支払い・プランの管理</button>
				</div>
			{:else if profile.corp_status === 'approved'}
				<div class="corp-box">
					<span class="corp-state ok"><Icon name="circle-check" size={14} /> 法人審査 承認済み</span>
					<p>法人プラン（月額）にお申し込みいただくと、広告掲載が始まります。</p>
					<button class="corp-btn" onclick={subscribeCorporate} disabled={corpBusy}>法人プランに申し込む（月額）</button>
					<p class="corp-fine">解約はいつでも「お支払い管理」から可能です。金額は申込画面に表示されます。</p>
				</div>
			{:else if profile.corp_status === 'pending'}
				<div class="corp-box">
					<span class="corp-state pending"><Icon name="clock" size={14} /> 審査中</span>
					<p>法人申請を受け付けました。運営の審査完了をお待ちください。</p>
				</div>
			{:else}
				<div class="corp-box">
					{#if profile.corp_status === 'rejected'}
						<span class="corp-state rejected"><Icon name="x" size={14} /> 前回の申請は承認されませんでした</span>
					{/if}
					<label class="field-label">
						法人名 / 屋号
						<input type="text" bind:value={corpName} class="field-input" placeholder="例: 株式会社 夜行社" />
					</label>
					<button class="corp-btn" onclick={applyCorporate} disabled={corpBusy}>法人として申請する</button>
					<p class="corp-fine">申請後、運営が審査します。承認後にプランへお申し込みいただけます。</p>
				</div>
			{/if}
		</section>

		<!-- ===== ログアウト ===== -->
		<div class="logout-section">
			<button class="logout-btn" onclick={handleSignOut}>ログアウト</button>
		</div>
	{/if}
</div>

<!-- ===== QRコード表示モーダル ===== -->
{#if qrModalSpace}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (qrModalSpace = null)}
		onkeydown={(e) => e.key === 'Escape' && (qrModalSpace = null)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-card qr-modal">
			<h3 class="modal-title">QRコード</h3>
			<p class="qr-space-name"><Icon name="map-pin" size={16} /> {qrModalSpace.name}</p>
			{#if qrDataUrl}
				<img src={qrDataUrl} alt="QRコード" class="qr-image" />
				<p class="qr-note">このQRコードを印刷してスペースに貼ってください。<br />利用者がスキャンすると借り出しが開始されます。</p>
				<a href={qrDataUrl} download="qr_{qrModalSpace.name}.png" class="submit-btn qr-download-btn">
					画像をダウンロード
				</a>
			{:else}
				<div class="qr-loading">生成中…</div>
			{/if}
			<button class="cancel-btn" onclick={() => (qrModalSpace = null)}>閉じる</button>
		</div>
	</div>
{/if}

<!-- ===== マイメニュー追加/編集モーダル ===== -->
{#if isMenuModalOpen && menuEditItem}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (isMenuModalOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isMenuModalOpen = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-card">
			<h3 class="modal-title">{menuEditItem.id ? 'メニューを編集' : 'メニューを追加'}</h3>

			{#if menuSaveError}
				<p class="error-msg">{menuSaveError}</p>
			{/if}

			<!-- 商品写真 -->
			<div class="photo-upload-row">
				<label class="photo-upload-label" for="menu-photo-upload">
					{#if menuPhotoPreview}
						<img src={menuPhotoPreview} alt="商品写真" class="photo-preview" />
					{:else}
						<div class="photo-placeholder"><Icon name="camera" size={20} /> 写真を追加</div>
					{/if}
				</label>
				<input
					id="menu-photo-upload"
					type="file"
					accept="image/*"
					class="hidden-file"
					onchange={onMenuPhotoChange}
				/>
			</div>

			<label class="field-label">
				商品名 <span class="req">*</span>
				<input type="text" bind:value={menuEditItem.name} class="field-input" placeholder="例: クラフトビール" />
			</label>

			<label class="field-label">
				商品説明
				<textarea
					bind:value={menuEditItem.description}
					class="field-input textarea"
					rows="2"
					placeholder="例: 地元醸造所のIPAビール"
				></textarea>
			</label>

			<label class="field-label">
				料金（円）
				<input type="number" bind:value={menuEditItem.price} class="field-input" placeholder="800" min="0" />
			</label>

			<div class="modal-btns">
				<button class="cancel-btn" onclick={() => (isMenuModalOpen = false)}>キャンセル</button>
				<button class="submit-btn" onclick={saveMenuItemHandler} disabled={isSavingMenu}>
					{isSavingMenu ? '保存中…' : '保存する'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ===== 役割追加モーダル ===== -->
{#if showRoleModal}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (showRoleModal = false)}
		onkeydown={(e) => e.key === 'Escape' && (showRoleModal = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-card">
			<h3 class="modal-title">
				{#if addingRole === '場所提供者'}<Icon name="map-pin" size={18} />{:else}<Icon name="store" size={18} />{/if}
				{addingRole}として登録
			</h3>

			{#if roleFormError}
				<p class="error-msg">{roleFormError}</p>
			{/if}

			{#if addingRole === '場所提供者'}
				<label class="field-label">
					オーナー名 <span class="req">*</span>
					<input type="text" bind:value={ownerName} class="field-input" placeholder="例: 山田 太郎" />
				</label>
				<label class="field-label">
					紹介文
					<textarea bind:value={bio} class="field-input textarea" rows="3" placeholder="場所の特徴など"></textarea>
				</label>
				<label class="field-label">
					経歴
					<input type="text" bind:value={career} class="field-input" placeholder="例: 鴨川沿いで10年" />
				</label>
			{:else}
				<label class="field-label">
					屋号 <span class="req">*</span>
					<input type="text" bind:value={businessName} class="field-input" placeholder="例: 鴨川珈琲" />
				</label>
				<label class="field-label">
					電話番号
					<input type="tel" bind:value={phoneNumber} class="field-input" placeholder="090-0000-0000" />
				</label>
			{/if}

			<div class="modal-btns">
				<button class="cancel-btn" onclick={() => (showRoleModal = false)}>キャンセル</button>
				<button class="submit-btn" onclick={submitRoleAddition} disabled={isAddingRole}>
					{isAddingRole ? '登録中…' : '登録する'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		max-width: 600px;
		margin: 0 auto;
		padding: 20px 16px 80px;
	}

	.page-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 20px;
	}

	.back-to-map {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 0.88rem;
		color: var(--ink-2);
		text-decoration: none;
		padding: 6px 0;
		background: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
	}

	.map-return-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		padding: 8px 16px;
		font-size: 0.85rem;
		font-weight: 600;
		color: #fff;
		background: var(--accent);
		border-radius: 100px;
		text-decoration: none;
		box-shadow: 0 2px 8px rgba(184, 92, 43, 0.22);
		transition: background 0.15s, transform 0.1s;
	}
	.map-return-btn:hover { background: var(--accent-deep); }
	.map-return-btn:active { transform: translateY(1px); }
	.map-return-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.back-to-map:hover { color: var(--ink); }

	/* 信頼ポイント */
	.credit-box {
		margin: 16px 0 4px;
		padding: 14px 16px;
		background: var(--surface, #fffdf7);
		border: 1px solid var(--line, var(--line));
		border-radius: 12px;
	}
	.credit-head { display: flex; align-items: baseline; justify-content: space-between; }
	.credit-label { font-size: 0.8rem; color: var(--ink-2, var(--ink-2)); letter-spacing: 0.06em; }
	.credit-value { font-size: 1.5rem; font-weight: 700; color: var(--ink, var(--ink)); }
	.credit-value.low { color: #b0402c; }
	.credit-bar { height: 6px; background: #efe6d6; border-radius: 3px; overflow: hidden; margin: 8px 0; }
	.credit-fill { height: 100%; background: var(--accent, #b85c2b); border-radius: 3px; transition: width 0.4s ease; }
	.credit-note { font-size: 0.74rem; color: var(--ink-3, var(--ink-3)); line-height: 1.6; margin: 0; }
	.operator-cta.locked { opacity: 0.85; background: var(--surface-sunk, #efe6d6); }

	.loading { text-align: center; padding: 60px; color: var(--ink-2); }

	/* ===== プロフィール編集 ===== */
	.profile-edit-section {
		background: var(--surface);
		color: var(--ink);
		border: 1px solid var(--line);
		border-radius: 16px;
		padding: 22px 20px 24px;
		margin-bottom: 28px;
		box-shadow: var(--shadow-1);
	}

	.profile-edit-section .section-title {
		color: var(--ink-3);
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 18px;
	}

	.avatar-edit-row {
		display: flex;
		justify-content: center;
		margin-bottom: 12px;
	}

	.avatar-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}

	.avatar-img {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid var(--accent);
	}

	.avatar-placeholder {
		width: 72px;
		height: 72px;
		background: var(--accent);
		color: #fff;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
		font-weight: bold;
	}

	.avatar-label:hover .avatar-img,
	.avatar-label:hover .avatar-placeholder {
		filter: brightness(0.96);
	}

	.avatar-edit-hint {
		font-size: 0.72rem;
		color: var(--ink-2);
	}

	.badge-row-small {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		margin-bottom: 16px;
	}

	.badge {
		font-size: 0.72rem;
		font-weight: 600;
		padding: 4px 11px;
		border-radius: 20px;
		border: 1px solid transparent;
	}

	.badge.user { background: var(--surface-sunk); color: var(--ink-2); border-color: var(--line-strong); }
	.badge.owner { background: rgba(95, 122, 82, 0.12); color: #4a6a3a; border-color: rgba(95, 122, 82, 0.28); }
	.badge.operator { background: rgba(184, 92, 43, 0.1); color: var(--accent-deep); border-color: rgba(184, 92, 43, 0.28); }

	.profile-edit-section .field-label {
		color: var(--ink-2);
	}

	.save-msg {
		font-size: 0.82rem;
		color: #4a6a3a;
		font-weight: 500;
		margin: 6px 0;
	}

	.save-msg.error-msg {
		color: var(--accent-deep);
	}

	.save-btn {
		width: 100%;
		padding: 13px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: var(--r-md);
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		cursor: pointer;
		margin-top: 8px;
		font-family: inherit;
		box-shadow: 0 2px 8px rgba(184, 92, 43, 0.22);
		transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
	}

	.save-btn:hover:not(:disabled) { background: var(--accent-deep); box-shadow: 0 4px 14px rgba(184, 92, 43, 0.28); }
	.save-btn:active:not(:disabled) { transform: translateY(1px); }
	.save-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }

	/* ===== セクション共通 ===== */
	.section { margin-bottom: 28px; }

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}

	.section-title {
		font-size: 1rem;
		font-weight: bold;
		color: var(--ink);
		margin: 0 0 12px 0;
	}
	.section-title :global(.icon) { color: var(--accent); vertical-align: -3px; }

	.section-header .section-title { margin-bottom: 0; }

	.section-hint {
		font-size: 0.78rem;
		color: var(--ink-3);
		margin: 0 0 12px;
	}

	.add-btn {
		background: var(--accent);
		color: #fff;
		font-size: 0.85rem;
		font-weight: 600;
		padding: 7px 16px;
		border-radius: 20px;
		text-decoration: none;
		border: none;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s, transform 0.1s;
	}
	.add-btn:hover { background: var(--accent-deep); }
	.add-btn:active { transform: translateY(1px); }
	.add-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	/* ===== マイメニュー ===== */
	.menu-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.menu-card {
		display: flex;
		align-items: center;
		gap: 12px;
		background: white;
		border-radius: 12px;
		padding: 12px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.menu-thumb {
		width: 56px;
		height: 56px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.menu-thumb.no-photo {
		background: var(--surface-sunk);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-3);
	}

	.menu-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}

	.menu-name {
		font-size: 0.92rem;
		font-weight: bold;
		color: var(--ink);
	}

	.menu-desc {
		font-size: 0.78rem;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menu-price {
		font-size: 0.82rem;
		color: var(--accent-deep);
		font-weight: bold;
	}

	.menu-actions {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex-shrink: 0;
	}

	.icon-btn {
		font-size: 0.72rem;
		padding: 4px 10px;
		border: 1px solid var(--line-strong);
		border-radius: 6px;
		background: none;
		color: var(--ink-2);
		cursor: pointer;
	}

	.icon-btn.danger { color: #dc2626; border-color: #fca5a5; }

	/* ===== ダッシュボード ===== */
	.dashboard-section { padding: 0; background: none; box-shadow: none; display: flex; flex-direction: column; gap: 10px; }

	.dashboard-link {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 16px 18px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		text-decoration: none;
		color: var(--ink);
		box-shadow: var(--shadow-1);
		transition: transform 0.12s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}
	.dashboard-link:hover {
		border-color: var(--line-strong);
		box-shadow: var(--shadow-2);
		transform: translateY(-1px);
	}
	.dashboard-link:active { transform: translateY(0); box-shadow: var(--shadow-1); }
	.dl-text { flex: 1; display: flex; flex-direction: column; gap: 3px; }
	.dl-text strong { font-size: 0.95rem; font-weight: 600; }
	.dl-text span { font-size: 0.78rem; color: var(--ink-2); line-height: 1.4; }
	.dl-arrow { font-size: 1.4rem; color: var(--ink-3); flex-shrink: 0; }

	.operator-cta {
		background: var(--accent-tint);
		border: 1px solid rgba(184, 92, 43, 0.28);
		border-radius: 14px;
		padding: 18px 20px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.cta-text {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.cta-text strong { font-size: 0.92rem; display: block; margin-bottom: 4px; }
	.cta-text p { font-size: 0.78rem; color: var(--ink-2); margin: 0; line-height: 1.5; }
	.cta-btn {
		padding: 11px 20px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: var(--r-md);
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
		align-self: flex-start;
		font-family: inherit;
		box-shadow: 0 2px 8px rgba(184, 92, 43, 0.22);
		transition: background 0.15s, transform 0.1s;
	}
	.cta-btn:hover { background: var(--accent-deep); }
	.cta-btn:active { transform: translateY(1px); }
	.cta-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

	/* ===== 役割追加 ===== */
	.role-add-row { display: flex; flex-direction: column; gap: 10px; }

	.role-add-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		background: white;
		border: 1.5px solid var(--line-strong);
		border-radius: 12px;
		padding: 14px 16px;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.role-add-btn:hover { border-color: var(--accent); }
	.role-icon { display: inline-flex; color: var(--accent); }
	.role-text { flex: 1; font-size: 0.9rem; color: var(--ink-2); }
	.arrow { color: var(--ink-3); font-size: 1.2rem; }

	/* ===== カードリスト ===== */
	.card-list { display: flex; flex-direction: column; gap: 10px; }

	.item-card {
		background: white;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.item-photo {
		width: 100%; height: 140px;
		object-fit: cover; display: block;
	}

	.item-header,
	.item-detail,
	.item-actions {
		padding-left: 16px;
		padding-right: 16px;
	}

	.item-header { padding-top: 14px; }

	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.item-name { font-weight: bold; font-size: 0.95rem; color: var(--ink); }
	.item-detail { font-size: 0.82rem; color: var(--ink-2); margin-top: 3px; }
	.detail-with-icon :global(.icon) { vertical-align: -2px; color: var(--ink-3); }

	.status-badge {
		font-size: 0.7rem;
		font-weight: bold;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.status-badge.available { background: rgba(95, 122, 82, 0.08); color: var(--ink-2); }
	.status-badge.stall { background: rgba(184, 92, 43, 0.1); color: var(--accent-deep); }

	.item-actions {
		display: flex;
		gap: 8px;
		padding-bottom: 14px;
		margin-top: 10px;
	}

	.edit-btn {
		padding: 6px 16px;
		background: var(--surface-sunk);
		color: var(--ink-2);
		border-radius: 6px;
		font-size: 0.78rem;
		font-weight: 600;
		text-decoration: none;
		display: flex;
		align-items: center;
	}

	.qr-btn {
		flex: 1;
		padding: 6px 14px;
		background: none;
		border: 1.5px solid var(--ink);
		color: var(--ink);
		border-radius: 6px;
		font-size: 0.78rem;
		cursor: pointer;
		font-family: inherit;
	}

	.qr-modal { align-items: center; text-align: center; }

	.qr-space-name {
		font-size: 0.95rem;
		color: var(--ink);
		margin: 0 0 12px;
	}

	.qr-image {
		width: 240px;
		height: 240px;
		border-radius: 8px;
		border: 1px solid #e2ddd8;
	}

	.qr-loading {
		width: 240px;
		height: 240px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-3);
		font-size: 0.9rem;
	}

	.qr-note {
		font-size: 0.78rem;
		color: var(--ink-2);
		line-height: 1.6;
		margin: 8px 0;
	}

	.qr-download-btn {
		display: block;
		text-decoration: none;
		text-align: center;
		margin-bottom: 8px;
	}

	.empty-msg { color: var(--ink-3); font-size: 0.9rem; padding: 12px 0; }

	/* ===== ログアウト ===== */
	.logout-section { text-align: center; margin-top: 16px; }

	.logout-btn {
		background: none;
		border: 1px solid var(--line-strong);
		color: var(--ink-2);
		padding: 10px 28px;
		border-radius: var(--r-md);
		cursor: pointer;
		font-size: 0.9rem;
		font-family: inherit;
		transition: background 0.15s, border-color 0.15s;
	}
	.logout-btn:hover { background: var(--surface-sunk); border-color: var(--ink-3); }

	/* ===== オンラインストア申請 ===== */
	.shop-apply-section { }

	/* 法人プラン */
	.corp-box {
		background: var(--surface); border: 1px solid var(--line);
		border-radius: var(--r-lg); padding: 16px 18px; box-shadow: var(--shadow-1);
	}
	.corp-box.active { background: var(--accent-tint); border-color: rgba(184, 92, 43, 0.28); }
	.corp-box p { font-size: 0.85rem; color: var(--ink-2); line-height: 1.6; margin: 8px 0; }
	.corp-state {
		display: inline-flex; align-items: center; gap: 5px;
		font-size: 0.78rem; font-weight: 700; padding: 4px 10px; border-radius: 20px;
	}
	.corp-state.ok { background: rgba(95, 122, 82, 0.12); color: #4a6a3a; }
	.corp-state.pending { background: rgba(184, 92, 43, 0.1); color: var(--accent-deep); }
	.corp-state.rejected { background: rgba(184, 92, 43, 0.08); color: var(--accent-deep); }
	.corp-btn {
		width: 100%; margin-top: 8px; padding: 12px; border: none; border-radius: var(--r-md);
		background: var(--accent); color: #fff; font-size: 0.95rem; font-weight: 600;
		font-family: inherit; cursor: pointer; box-shadow: 0 2px 8px rgba(184, 92, 43, 0.22);
		transition: background 0.15s;
	}
	.corp-btn:hover:not(:disabled) { background: var(--accent-deep); }
	.corp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.corp-btn.ghost { background: none; color: var(--ink); border: 1.5px solid var(--line-strong); box-shadow: none; }
	.corp-btn.ghost:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
	.corp-fine { font-size: 0.72rem !important; color: var(--ink-3) !important; margin: 8px 0 0 !important; }
	.shop-status-box {
		border-radius: 12px; padding: 16px;
		margin-bottom: 8px;
	}
	.shop-status-box.approved { background: #ecfdf5; border: 1px solid #bbf7d0; }
	.shop-status-box.pending  { background: #fffbeb; border: 1px solid #fde68a; }
	.shop-status-box.rejected { background: #fef2f2; border: 1px solid #fecaca; }

	.shop-badge {
		display: inline-flex; align-items: center; gap: 4px;
		font-size: 0.75rem; font-weight: 700;
		border-radius: 20px; padding: 4px 11px; margin-bottom: 8px;
	}
	.shop-badge.approved { background: rgba(95, 122, 82, 0.12); color: #4a6a3a; }
	.shop-badge.pending  { background: rgba(184, 92, 43, 0.1); color: var(--accent-deep); }
	.shop-badge.rejected { background: rgba(184, 92, 43, 0.08); color: var(--accent-deep); }

	.shop-status-msg { font-size: 0.85rem; color: var(--ink); margin: 0 0 10px; }
	.shop-goto-btn {
		display: inline-block; padding: 9px 18px;
		background: var(--ink); color: white;
		border-radius: 10px; font-size: 0.85rem; font-weight: 700;
		text-decoration: none;
	}
	.rejection-reason {
		font-size: 0.82rem; color: var(--accent-deep); margin: 0 0 10px;
		background: #fff; border-radius: 6px; padding: 6px 10px;
	}
	.apply-btn {
		display: block; width: 100%; padding: 11px;
		background: var(--ink); color: white;
		border: none; border-radius: 10px;
		font-size: 0.9rem; font-weight: 700;
		font-family: inherit; cursor: pointer; margin-top: 4px;
	}
	.apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.apply-success { font-size: 0.82rem; color: var(--ink-2); margin: 0 0 8px; }
	.apply-error   { font-size: 0.82rem; color: var(--accent-deep); margin: 0 0 8px; }
	.cta-link {
		display: inline-block; font-size: 0.85rem;
		color: #5a6e99; text-decoration: none; font-weight: 600;
	}

	/* ===== モーダル共通 ===== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 200;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}

	.modal-card {
		background: white;
		border-radius: 20px 20px 0 0;
		padding: 28px 20px 36px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
	}

	.modal-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 1.1rem;
		font-weight: bold;
		margin: 0 0 20px 0;
		color: var(--ink);
	}
	.modal-title :global(.icon) { color: var(--accent); }

	/* ===== 写真アップロード ===== */
	.photo-upload-row {
		display: flex;
		justify-content: center;
		margin-bottom: 16px;
	}

	.photo-upload-label {
		cursor: pointer;
		display: block;
	}

	.photo-preview {
		width: 100%;
		max-width: 280px;
		height: 160px;
		object-fit: cover;
		border-radius: 10px;
		display: block;
	}

	.photo-placeholder {
		width: 280px;
		height: 120px;
		background: var(--surface-sunk);
		border: 2px dashed var(--line-strong);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		font-size: 0.9rem;
		color: var(--ink-3);
	}

	.hidden-file { display: none; }

	/* ===== フォーム ===== */
	.field-label {
		display: block;
		font-size: 0.85rem;
		color: var(--ink-2);
		margin-bottom: 14px;
	}

	.req { color: var(--accent-deep); }

	.field-input {
		display: block;
		width: 100%;
		margin-top: 6px;
		padding: 11px 13px;
		border: 1px solid var(--line-strong);
		border-radius: var(--r-md);
		font-size: 0.95rem;
		font-family: inherit;
		box-sizing: border-box;
		background: var(--surface);
		color: var(--ink);
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.field-input::placeholder { color: var(--ink-3); }
	.field-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(184, 92, 43, 0.1);
	}
	.textarea { resize: vertical; min-height: 70px; }

	.error-msg {
		background: rgba(184, 92, 43, 0.08);
		color: #dc2626;
		border-radius: 8px;
		padding: 10px 12px;
		font-size: 0.85rem;
		margin-bottom: 14px;
	}

	.modal-btns { display: flex; gap: 10px; margin-top: 8px; }

	.cancel-btn {
		flex: 1;
		padding: 12px;
		background: var(--surface-sunk);
		color: var(--ink-2);
		border: none;
		border-radius: var(--r-md);
		cursor: pointer;
		font-size: 0.95rem;
		font-weight: 500;
		font-family: inherit;
		transition: background 0.15s;
	}
	.cancel-btn:hover { background: var(--line-strong); }

	.submit-btn {
		flex: 2;
		padding: 12px;
		background: var(--accent);
		color: #fff;
		border: none;
		border-radius: var(--r-md);
		font-weight: 600;
		cursor: pointer;
		font-size: 0.95rem;
		font-family: inherit;
		box-shadow: 0 2px 8px rgba(184, 92, 43, 0.22);
		transition: background 0.15s, transform 0.1s;
	}
	.submit-btn:hover:not(:disabled) { background: var(--accent-deep); }
	.submit-btn:active:not(:disabled) { transform: translateY(1px); }
	.submit-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; box-shadow: none; }
</style>
