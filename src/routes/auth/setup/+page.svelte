<!-- プロフィール設定ページ (登録直後にユーザータイプを選択) -->
<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import {
		createUserProfile,
		createOwnerProfile,
		createOperatorProfile,
		getMyProfile
	} from '$lib/db.js';

	// step: 'purpose' | 'type' | 'detail'
	let step = $state('purpose');
	let purpose = $state(''); // 'shop' | 'yatakari'
	let selectedType = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let userId = $state('');

	let name = $state('');
	let ownerName = $state('');
	let bio = $state('');
	let career = $state('');
	let businessName = $state('');
	let phoneNumber = $state('');

	const yatakariTypes = [
		{
			id: '利用者',
			icon: '🛒',
			label: 'さすらい屋台人',
			description: '屋台・場所を借りて出店したい方'
		},
		{
			id: '場所提供者',
			icon: '📍',
			label: '土地貸し出し人',
			description: '出店できる場所を提供したい方'
		},
		{
			id: '屋台提供者',
			icon: '🏮',
			label: '屋台主',
			description: '屋台本体を貸し出したい方'
		}
	];

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto(`${base}/auth`);
			return;
		}
		userId = data.session.user.id;

		const profile = await getMyProfile(userId);
		if (profile) {
			goto(profile.user_type === '購入者' ? `${base}/shop` : `${base}/map`);
		}
	});

	function choosePurpose(p) {
		purpose = p;
		if (p === 'shop') {
			selectedType = '購入者';
			step = 'detail';
		} else {
			selectedType = '';
			step = 'type';
		}
	}

	function goToDetail() {
		if (!selectedType) return;
		step = 'detail';
	}

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) {
			errorMessage = '名前を入力してください';
			return;
		}

		isLoading = true;
		try {
			await createUserProfile(userId, selectedType, name.trim());

			if (selectedType === '場所提供者') {
				if (!ownerName.trim()) {
					errorMessage = 'オーナー名を入力してください';
					isLoading = false;
					return;
				}
				await createOwnerProfile(userId, {
					ownerName: ownerName.trim(),
					bio: bio.trim(),
					career: career.trim()
				});
			} else if (selectedType === '屋台提供者') {
				if (!businessName.trim()) {
					errorMessage = '屋号を入力してください';
					isLoading = false;
					return;
				}
				await createOperatorProfile(userId, {
					businessName: businessName.trim(),
					phoneNumber: phoneNumber.trim()
				});
			}

			if (selectedType === '購入者') {
				goto(`${base}/shop`);
			} else {
				goto(`${base}/map`);
			}
		} catch (e) {
			errorMessage = `登録に失敗しました: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}

	const stepLabel = $derived(
		step === 'purpose' ? 'STEP 1 / 3' :
		step === 'type'    ? 'STEP 2 / 3' : 'STEP 3 / 3'
	);
</script>

<div class="setup-page">
	<div class="setup-card">

		<!-- STEP 1: 目的選択 -->
		{#if step === 'purpose'}
			<div class="step-header">
				<div class="step-badge">STEP 1 / 3</div>
				<h2>ご利用目的を選択してください</h2>
				<p class="step-desc">目的に合わせたアカウントを作成します</p>
			</div>

			<div class="purpose-grid">
				<button class="purpose-card shop" onclick={() => choosePurpose('shop')}>
					<span class="purpose-icon">🛍️</span>
					<span class="purpose-label">オンラインストアで<br/>商品を購入したい</span>
					<span class="purpose-desc">購入者として登録。商品をカートに入れて購入できます。</span>
				</button>
				<button class="purpose-card yatakari" onclick={() => choosePurpose('yatakari')}>
					<span class="purpose-icon">🏮</span>
					<span class="purpose-label">YATAKARIサービスを<br/>利用したい</span>
					<span class="purpose-desc">屋台の貸し借り・スペース提供・出店などYATAKARI全般。</span>
				</button>
			</div>

			<p class="change-note">※ 後からマイページで役割を追加することができます</p>

		<!-- STEP 2: YATAKARIタイプ選択 -->
		{:else if step === 'type'}
			<div class="step-header">
				<div class="step-badge">STEP 2 / 3</div>
				<h2>YATAKARIの役割を選択</h2>
				<p class="step-desc">当てはまるものをお選びください</p>
			</div>

			<div class="type-grid">
				{#each yatakariTypes as type}
					<button
						class="type-card"
						class:selected={selectedType === type.id}
						onclick={() => (selectedType = type.id)}
					>
						<span class="type-icon">{type.icon}</span>
						<span class="type-label">{type.label}</span>
						<span class="type-desc">{type.description}</span>
						{#if selectedType === type.id}
							<span class="check-badge">✓</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="btn-row">
				<button class="back-btn" onclick={() => (step = 'purpose')}>← 戻る</button>
				<button class="next-btn" onclick={goToDetail} disabled={!selectedType}>次へ →</button>
			</div>

		<!-- STEP 3: 詳細入力 -->
		{:else}
			<div class="step-header">
				<div class="step-badge">{stepLabel}</div>
				<h2>
					{selectedType === '購入者' ? '🛍️ 購入者' :
					 yatakariTypes.find((t) => t.id === selectedType)?.icon + ' ' +
					 yatakariTypes.find((t) => t.id === selectedType)?.label}
				</h2>
				<p class="step-desc">プロフィール情報を入力してください</p>
			</div>

			{#if errorMessage}
				<p class="error-msg">{errorMessage}</p>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<label class="field-label">
					お名前 <span class="required">*</span>
					<input type="text" bind:value={name} class="field-input" placeholder="山田 太郎" required />
				</label>

				{#if selectedType === '場所提供者'}
					<label class="field-label">
						オーナー名 <span class="required">*</span>
						<input type="text" bind:value={ownerName} class="field-input" placeholder="表示されるオーナー名" required />
					</label>
					<label class="field-label">
						紹介文
						<textarea bind:value={bio} class="field-input textarea" placeholder="場所の特徴や提供できるスペースについて" rows="3"></textarea>
					</label>
					<label class="field-label">
						経歴
						<input type="text" bind:value={career} class="field-input" placeholder="例：鴨川沿いで10年" />
					</label>
				{/if}

				{#if selectedType === '屋台提供者'}
					<label class="field-label">
						屋号 <span class="required">*</span>
						<input type="text" bind:value={businessName} class="field-input" placeholder="例：鴨川珈琲" required />
					</label>
					<label class="field-label">
						電話番号
						<input type="tel" bind:value={phoneNumber} class="field-input" placeholder="090-0000-0000" />
					</label>
				{/if}

				<div class="btn-row">
					<button type="button" class="back-btn"
						onclick={() => (purpose === 'shop' ? (step = 'purpose') : (step = 'type'))}>
						← 戻る
					</button>
					<button type="submit" class="submit-btn" disabled={isLoading}>
						{isLoading ? '登録中…' : '登録を完了する'}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

<style>
	.setup-page {
		min-height: 80vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: #f8f5f0;
	}

	.setup-card {
		background: white;
		border-radius: 20px;
		padding: 36px 28px;
		width: 100%;
		max-width: 480px;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
	}

	.step-badge {
		display: inline-block;
		background: #fef9c3;
		color: #92400e;
		font-size: 0.75rem;
		font-weight: bold;
		padding: 3px 10px;
		border-radius: 20px;
		margin-bottom: 10px;
	}

	.step-header h2 {
		font-size: 1.2rem;
		color: #0f172a;
		margin: 0 0 6px 0;
	}

	.step-desc {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0 0 24px 0;
	}

	/* 目的選択 */
	.purpose-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-bottom: 16px;
	}

	.purpose-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 24px 14px;
		border: 2px solid #e2e8f0;
		border-radius: 16px;
		background: white;
		cursor: pointer;
		text-align: center;
		transition: all 0.2s;
	}

	.purpose-card.shop:hover {
		border-color: #d56d04;
		background: #fbf3ea;
	}

	.purpose-card.yatakari:hover {
		border-color: #facc15;
		background: #fefce8;
	}

	.purpose-icon {
		font-size: 2.4rem;
	}

	.purpose-label {
		font-size: 0.88rem;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.4;
	}

	.purpose-desc {
		font-size: 0.72rem;
		color: #64748b;
		line-height: 1.5;
	}

	.change-note {
		font-size: 0.75rem;
		color: #94a3b8;
		text-align: center;
		margin: 0;
	}

	/* タイプ選択 */
	.type-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-bottom: 20px;
	}

	.type-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 16px 8px;
		border: 2px solid #e2e8f0;
		border-radius: 14px;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.type-card:hover,
	.type-card.selected {
		border-color: #facc15;
		background: #fefce8;
	}

	.type-icon {
		font-size: 1.8rem;
		margin-bottom: 6px;
	}

	.type-label {
		font-size: 0.78rem;
		font-weight: bold;
		color: #0f172a;
		margin-bottom: 4px;
	}

	.type-desc {
		font-size: 0.68rem;
		color: #64748b;
		line-height: 1.4;
	}

	.check-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		background: #facc15;
		color: #0f172a;
		font-size: 0.65rem;
		font-weight: bold;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* フォーム */
	.error-msg {
		background: #fee2e2;
		color: #dc2626;
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 0.85rem;
		margin-bottom: 16px;
	}

	.field-label {
		display: block;
		font-size: 0.85rem;
		color: #475569;
		margin-bottom: 14px;
	}

	.required { color: #ef4444; }

	.field-input {
		display: block;
		width: 100%;
		margin-top: 5px;
		padding: 10px 14px;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		font-size: 1rem;
		box-sizing: border-box;
		font-family: inherit;
		transition: border-color 0.2s;
	}

	.field-input:focus {
		outline: none;
		border-color: #facc15;
	}

	.textarea {
		resize: vertical;
		min-height: 80px;
	}

	.btn-row {
		display: flex;
		gap: 10px;
		margin-top: 8px;
	}

	.back-btn {
		padding: 12px 16px;
		background: #f1f5f9;
		color: #475569;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.next-btn {
		flex: 1;
		padding: 12px;
		background: #facc15;
		color: #0f172a;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.next-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.submit-btn {
		flex: 1;
		padding: 12px;
		background: #facc15;
		color: #0f172a;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: bold;
		cursor: pointer;
		transition: opacity 0.2s;
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 400px) {
		.purpose-grid { grid-template-columns: 1fr; }
		.type-grid { grid-template-columns: 1fr; }
	}
</style>
