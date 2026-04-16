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
		getMyReservations,
		createOwnerProfile,
		createOperatorProfile,
		signOut
	} from '$lib/db.js';

	let profile = $state(null);
	let mySpaces = $state([]);
	let myStalls = $state([]);
	let myReservations = $state([]);
	let isLoading = $state(true);
	let userId = $state('');

	// 役割追加モーダル
	let showRoleModal = $state(false);
	let addingRole = $state(''); // '場所提供者' | '屋台提供者'
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
		if (!session) {
			goto(`${base}/auth`);
			return;
		}
		userId = session.user.id;

		profile = await getMyProfile(userId);
		if (!profile) {
			goto(`${base}/auth/setup`);
			return;
		}

		// 役割に応じたデータを並行取得
		const tasks = [getMyReservations(userId).then((d) => (myReservations = d))];
		if (profile.owners) tasks.push(getMySpaces(userId).then((d) => (mySpaces = d)));
		if (profile.operators) tasks.push(getMyStalls(userId).then((d) => (myStalls = d)));
		await Promise.all(tasks);

		isLoading = false;
	});

	async function handleSignOut() {
		await signOut();
		goto(`${base}/`);
	}

	function openRoleModal(role) {
		addingRole = role;
		roleFormError = '';
		ownerName = '';
		bio = '';
		career = '';
		businessName = '';
		phoneNumber = '';
		showRoleModal = true;
	}

	async function submitRoleAddition() {
		roleFormError = '';
		isAddingRole = true;
		try {
			if (addingRole === '場所提供者') {
				if (!ownerName.trim()) { roleFormError = 'オーナー名を入力してください'; return; }
				await createOwnerProfile(userId, {
					ownerName: ownerName.trim(),
					bio: bio.trim(),
					career: career.trim()
				});
			} else if (addingRole === '屋台提供者') {
				if (!businessName.trim()) { roleFormError = '屋号を入力してください'; return; }
				await createOperatorProfile(userId, {
					businessName: businessName.trim(),
					phoneNumber: phoneNumber.trim()
				});
			}
			// プロフィールを再取得してUIを更新
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

	function formatDate(isoString) {
		return new Date(isoString).toLocaleDateString('ja-JP', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}
</script>

<div class="page">
	{#if isLoading}
		<div class="loading">読み込み中…</div>
	{:else if profile}
		<!-- プロフィールカード -->
		<div class="profile-card">
			<div class="avatar">
				{profile.name?.charAt(0) ?? '?'}
			</div>
			<div class="profile-info">
				<h2 class="profile-name">{profile.name}</h2>
				<div class="badge-row">
					<span class="badge user">屋台利用者</span>
					{#if profile.owners}
						<span class="badge owner">場所提供者</span>
					{/if}
					{#if profile.operators}
						<span class="badge operator">屋台提供者</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- 役割を追加 -->
		{#if !profile.owners || !profile.operators}
			<section class="section">
				<h3 class="section-title">役割を追加する</h3>
				<div class="role-add-row">
					{#if !profile.owners}
						<button class="role-add-btn" onclick={() => openRoleModal('場所提供者')}>
							<span class="role-icon">📍</span>
							<span class="role-text">
								<strong>場所提供者</strong>として登録
							</span>
							<span class="arrow">›</span>
						</button>
					{/if}
					{#if !profile.operators}
						<button class="role-add-btn" onclick={() => openRoleModal('屋台提供者')}>
							<span class="role-icon">🏮</span>
							<span class="role-text">
								<strong>屋台提供者</strong>として登録
							</span>
							<span class="arrow">›</span>
						</button>
					{/if}
				</div>
			</section>
		{/if}

		<!-- 場所提供者セクション -->
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
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- 屋台提供者セクション -->
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
							</div>
						{/each}
					</div>
				{/if}
			</section>
		{/if}

		<!-- 予約履歴セクション -->
		<section class="section">
			<h3 class="section-title">📅 予約履歴</h3>
			{#if myReservations.length === 0}
				<p class="empty-msg">予約履歴はありません</p>
				<a href="{base}/map" class="map-link">マップから予約する →</a>
			{:else}
				<div class="card-list">
					{#each myReservations as res}
						<div class="item-card">
							<div class="item-header">
								<span class="item-name">{res.rental_spaces?.name ?? '不明'}</span>
								<span class="res-date">{formatDate(res.start_datetime)}</span>
							</div>
							{#if res.stall_specs}
								<div class="item-detail">🏮 {res.stall_specs.stall_name}</div>
							{/if}
							{#if res.planned_items}
								<div class="item-detail">品目: {res.planned_items}</div>
							{/if}
							<div class="item-detail">
								{formatDate(res.start_datetime)} 〜 {formatDate(res.end_datetime)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- ログアウト -->
		<div class="logout-section">
			<button class="logout-btn" onclick={handleSignOut}>ログアウト</button>
		</div>
	{/if}
</div>

<!-- 役割追加モーダル -->
{#if showRoleModal}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (showRoleModal = false)}
		role="dialog"
		aria-modal="true"
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
					<textarea bind:value={bio} class="field-input textarea" rows="3"
						placeholder="場所の特徴など"></textarea>
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
		padding: 20px 16px 60px;
	}

	.loading {
		text-align: center;
		padding: 60px;
		color: #64748b;
	}

	/* プロフィールカード */
	.profile-card {
		display: flex;
		align-items: center;
		gap: 16px;
		background: #0f172a;
		color: white;
		border-radius: 16px;
		padding: 20px;
		margin-bottom: 24px;
	}

	.avatar {
		width: 56px;
		height: 56px;
		background: #facc15;
		color: #0f172a;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		font-weight: bold;
		flex-shrink: 0;
	}

	.profile-name {
		font-size: 1.2rem;
		margin: 0 0 8px 0;
	}

	.badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
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

	/* セクション */
	.section {
		margin-bottom: 28px;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.section-title {
		font-size: 1rem;
		font-weight: bold;
		color: #0f172a;
		margin: 0 0 12px 0;
	}

	.section-header .section-title {
		margin-bottom: 0;
	}

	.add-btn {
		background: #facc15;
		color: #0f172a;
		font-size: 0.85rem;
		font-weight: bold;
		padding: 6px 14px;
		border-radius: 20px;
		text-decoration: none;
	}

	/* 役割追加ボタン */
	.role-add-row {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

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
		transition: border-color 0.2s;
	}

	.role-add-btn:hover { border-color: #facc15; }

	.role-icon { font-size: 1.4rem; }

	.role-text {
		flex: 1;
		font-size: 0.9rem;
		color: #334155;
	}

	.arrow { color: #94a3b8; font-size: 1.2rem; }

	/* アイテムカード */
	.card-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

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

	.item-name {
		font-weight: bold;
		font-size: 0.95rem;
		color: #0f172a;
	}

	.item-detail {
		font-size: 0.82rem;
		color: #64748b;
		margin-top: 3px;
	}

	.status-badge {
		font-size: 0.7rem;
		font-weight: bold;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.status-badge.available { background: #dcfce7; color: #166534; }
	.status-badge.stall { background: #fef9c3; color: #92400e; }

	.res-date {
		font-size: 0.78rem;
		color: #94a3b8;
	}

	.empty-msg {
		color: #94a3b8;
		font-size: 0.9rem;
		padding: 12px 0;
	}

	.map-link {
		display: inline-block;
		color: #0f172a;
		font-size: 0.9rem;
		font-weight: bold;
		margin-top: 4px;
	}

	/* ログアウト */
	.logout-section {
		text-align: center;
		margin-top: 16px;
	}

	.logout-btn {
		background: none;
		border: 1.5px solid #e2e8f0;
		color: #64748b;
		padding: 10px 28px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 0.9rem;
	}

	/* モーダル */
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
	}

	.modal-title {
		font-size: 1.1rem;
		font-weight: bold;
		margin: 0 0 20px 0;
		color: #0f172a;
	}

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

	.modal-btns {
		display: flex;
		gap: 10px;
		margin-top: 8px;
	}

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
