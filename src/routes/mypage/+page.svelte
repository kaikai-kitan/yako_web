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

	let profile = $state(null);
	let mySpaces = $state([]);
	let myStalls = $state([]);
	let myMenuItems = $state([]);
	let isLoading = $state(true);
	let userId = $state('');

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
		if (profile.operators) tasks.push(getMyStalls(userId).then((d) => (myStalls = d)));
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
		goto(`${base}/`);
	}

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


</script>

<div class="page">
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

		<!-- ===== マイメニュー ===== -->
		<section class="section">
			<div class="section-header">
				<h3 class="section-title">マイメニュー</h3>
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
								<div class="menu-thumb no-photo">🍽</div>
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
						<span class="role-icon">📍</span>
						<span class="role-text"><strong>土地貸し出し人</strong>として登録</span>
						<span class="arrow">›</span>
					</button>
					<button class="role-add-btn" onclick={() => openRoleModal('屋台提供者')}>
						<span class="role-icon">🏮</span>
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
					<h3 class="section-title">📍 マイスペース</h3>
					<a href="{base}/mypage/add-space" class="add-btn">＋ 追加</a>
				</div>
				{#if mySpaces.length === 0}
					<p class="empty-msg">スペースがまだ登録されていません</p>
				{:else}
					<div class="card-list">
						{#each mySpaces as space}
							<div class="item-card">
								<div class="item-header">
									<span class="item-name">{space.name}</span>
									<span class="status-badge available">公開中</span>
								</div>
								<div class="item-detail">📍 {space.address ?? '住所未設定'}</div>
								<div class="item-detail">
									¥{(space.space_fee ?? 0).toLocaleString()} / 泊　{space.ground_type ?? ''}
									{space.fire_use_allowed ? '🔥 火気可' : '🚫 火気不可'}
								</div>
								<button class="qr-btn" onclick={() => showSpaceQR(space)}>
									QRコードを表示（印刷用）
								</button>
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
					<h3 class="section-title">🏮 マイ屋台</h3>
					<a href="{base}/mypage/add-stall" class="add-btn">＋ 追加</a>
				</div>
				{#if myStalls.length === 0}
					<p class="empty-msg">屋台がまだ登録されていません</p>
				{:else}
					<div class="card-list">
						{#each myStalls as stall}
							<div class="item-card">
								<div class="item-header">
									<span class="item-name">{stall.stall_name}</span>
									<span class="status-badge stall">登録済み</span>
								</div>
								<div class="item-detail">{stall.specs ?? 'スペック未設定'}</div>
								<div class="item-detail">¥{(stall.rental_fee ?? 0).toLocaleString()} / 日</div>
								<button class="qr-btn" onclick={() => showStallQR(stall)}>
									QRコードを表示（印刷用）
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

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
			<p class="qr-space-name">📍 {qrModalSpace.name}</p>
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
						<div class="photo-placeholder">📷 写真を追加</div>
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
				{addingRole === '場所提供者' ? '📍' : '🏮'}
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

	.loading { text-align: center; padding: 60px; color: #64748b; }

	/* ===== プロフィール編集 ===== */
	.profile-edit-section {
		background: #0f172a;
		color: white;
		border-radius: 16px;
		padding: 20px 16px 24px;
		margin-bottom: 28px;
	}

	.profile-edit-section .section-title {
		color: #94a3b8;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0 0 16px;
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
		border: 2px solid #facc15;
	}

	.avatar-placeholder {
		width: 72px;
		height: 72px;
		background: #facc15;
		color: #0f172a;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.8rem;
		font-weight: bold;
	}

	.avatar-edit-hint {
		font-size: 0.72rem;
		color: #94a3b8;
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
		font-weight: bold;
		padding: 3px 10px;
		border-radius: 20px;
	}

	.badge.user { background: #334155; color: #94a3b8; }
	.badge.owner { background: #166534; color: #bbf7d0; }
	.badge.operator { background: #92400e; color: #fef9c3; }

	.profile-edit-section .field-label {
		color: #94a3b8;
	}

	.profile-edit-section .field-input {
		border-color: #334155;
		background: #1e293b;
		color: white;
	}

	.profile-edit-section .field-input:focus {
		border-color: #facc15;
	}

	.save-msg {
		font-size: 0.82rem;
		color: #4ade80;
		margin: 6px 0;
	}

	.save-msg.error-msg {
		color: #f87171;
	}

	.save-btn {
		width: 100%;
		padding: 12px;
		background: #facc15;
		color: #0f172a;
		border: none;
		border-radius: 10px;
		font-size: 0.95rem;
		font-weight: bold;
		cursor: pointer;
		margin-top: 4px;
	}

	.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

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
		color: #0f172a;
		margin: 0 0 12px 0;
	}

	.section-header .section-title { margin-bottom: 0; }

	.section-hint {
		font-size: 0.78rem;
		color: #94a3b8;
		margin: 0 0 12px;
	}

	.add-btn {
		background: #facc15;
		color: #0f172a;
		font-size: 0.85rem;
		font-weight: bold;
		padding: 6px 14px;
		border-radius: 20px;
		text-decoration: none;
		border: none;
		cursor: pointer;
	}

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
		background: #f1f5f9;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.4rem;
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
		color: #0f172a;
	}

	.menu-desc {
		font-size: 0.78rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.menu-price {
		font-size: 0.82rem;
		color: #92400e;
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
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		background: none;
		color: #475569;
		cursor: pointer;
	}

	.icon-btn.danger { color: #dc2626; border-color: #fca5a5; }

	/* ===== 役割追加 ===== */
	.role-add-row { display: flex; flex-direction: column; gap: 10px; }

	.role-add-btn {
		display: flex;
		align-items: center;
		gap: 12px;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-radius: 12px;
		padding: 14px 16px;
		cursor: pointer;
		text-align: left;
		width: 100%;
	}

	.role-add-btn:hover { border-color: #facc15; }
	.role-icon { font-size: 1.4rem; }
	.role-text { flex: 1; font-size: 0.9rem; color: #334155; }
	.arrow { color: #94a3b8; font-size: 1.2rem; }

	/* ===== カードリスト ===== */
	.card-list { display: flex; flex-direction: column; gap: 10px; }

	.item-card {
		background: white;
		border-radius: 12px;
		padding: 14px 16px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.item-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
	}

	.item-name { font-weight: bold; font-size: 0.95rem; color: #0f172a; }
	.item-detail { font-size: 0.82rem; color: #64748b; margin-top: 3px; }

	.status-badge {
		font-size: 0.7rem;
		font-weight: bold;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.status-badge.available { background: #dcfce7; color: #166534; }
	.status-badge.stall { background: #fef9c3; color: #92400e; }

	.qr-btn {
		margin-top: 10px;
		padding: 6px 14px;
		background: none;
		border: 1.5px solid #26201a;
		color: #26201a;
		border-radius: 6px;
		font-size: 0.78rem;
		cursor: pointer;
		font-family: inherit;
		width: 100%;
	}

	.qr-modal { align-items: center; text-align: center; }

	.qr-space-name {
		font-size: 0.95rem;
		color: #26201a;
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
		color: #9e9289;
		font-size: 0.9rem;
	}

	.qr-note {
		font-size: 0.78rem;
		color: #7a6f67;
		line-height: 1.6;
		margin: 8px 0;
	}

	.qr-download-btn {
		display: block;
		text-decoration: none;
		text-align: center;
		margin-bottom: 8px;
	}

	.empty-msg { color: #94a3b8; font-size: 0.9rem; padding: 12px 0; }

	/* ===== ログアウト ===== */
	.logout-section { text-align: center; margin-top: 16px; }

	.logout-btn {
		background: none;
		border: 1.5px solid #e2e8f0;
		color: #64748b;
		padding: 10px 28px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
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
		font-size: 1.1rem;
		font-weight: bold;
		margin: 0 0 20px 0;
		color: #0f172a;
	}

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
		background: #f1f5f9;
		border: 2px dashed #cbd5e1;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.hidden-file { display: none; }

	/* ===== フォーム ===== */
	.field-label {
		display: block;
		font-size: 0.85rem;
		color: #475569;
		margin-bottom: 14px;
	}

	.req { color: #ef4444; }

	.field-input {
		display: block;
		width: 100%;
		margin-top: 5px;
		padding: 10px 12px;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		font-size: 0.95rem;
		font-family: inherit;
		box-sizing: border-box;
		background: white;
		color: #0f172a;
	}

	.field-input:focus { outline: none; border-color: #facc15; }
	.textarea { resize: vertical; min-height: 70px; }

	.error-msg {
		background: #fee2e2;
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
		background: #f1f5f9;
		color: #475569;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.95rem;
	}

	.submit-btn {
		flex: 2;
		padding: 12px;
		background: #facc15;
		color: #0f172a;
		border: none;
		border-radius: 10px;
		font-weight: bold;
		cursor: pointer;
		font-size: 0.95rem;
	}

	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
