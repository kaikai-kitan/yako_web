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

	let step = $state(1); // 1: タイプ選択, 2: 詳細入力
	let selectedType = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let userId = $state('');

	// 共通フィールド
	let name = $state('');

	// 場所提供者フィールド
	let ownerName = $state('');
	let bio = $state('');
	let career = $state('');

	// 屋台提供者フィールド
	let businessName = $state('');
	let phoneNumber = $state('');

	const userTypes = [
		{
			id: '利用者',
			icon: '🛒',
			label: '屋台利用者',
			description: '屋台・場所を借りて出店したい方'
		},
		{
			id: '場所提供者',
			icon: '📍',
			label: '場所提供者',
			description: '出店できる場所を提供したい方'
		},
		{
			id: '屋台提供者',
			icon: '🏮',
			label: '屋台提供者',
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

		// すでにプロフィール設定済みならマップへ
		const profile = await getMyProfile(userId);
		if (profile) {
			goto(`${base}/map`);
		}
	});

	function selectType(typeId) {
		selectedType = typeId;
	}

	function goToStep2() {
		if (!selectedType) return;
		step = 2;
	}

	async function handleSubmit() {
		errorMessage = '';
		if (!name.trim()) {
			errorMessage = '名前を入力してください';
			return;
		}

		isLoading = true;
		try {
			// 1. 共通プロフィールを作成
			await createUserProfile(userId, selectedType, name.trim());

			// 2. タイプ別追加プロフィールを作成
			if (selectedType === '場所提供者') {
				if (!ownerName.trim()) {
					errorMessage = 'オーナー名を入力してください';
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
					return;
				}
				await createOperatorProfile(userId, {
					businessName: businessName.trim(),
					phoneNumber: phoneNumber.trim()
				});
			}

			goto(`${base}/map`);
		} catch (e) {
			errorMessage = `登録に失敗しました: ${e.message}`;
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="setup-page">
	<div class="setup-card">
		{#if step === 1}
			<!-- Step 1: ユーザータイプ選択 -->
			<div class="step-header">
				<div class="step-badge">STEP 1 / 2</div>
				<h2>ご利用の種類を選択してください</h2>
				<p class="step-desc">後から変更することはできません</p>
			</div>

			<div class="type-grid">
				{#each userTypes as type}
					<button
						class="type-card"
						class:selected={selectedType === type.id}
						onclick={() => selectType(type.id)}
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

			<button class="next-btn" onclick={goToStep2} disabled={!selectedType}>
				次へ →
			</button>
		{:else}
			<!-- Step 2: 詳細プロフィール入力 -->
			<div class="step-header">
				<div class="step-badge">STEP 2 / 2</div>
				<h2>
					{userTypes.find((t) => t.id === selectedType)?.icon}
					{userTypes.find((t) => t.id === selectedType)?.label}
				</h2>
				<p class="step-desc">プロフィール情報を入力してください</p>
			</div>

			{#if errorMessage}
				<p class="error-msg">{errorMessage}</p>
			{/if}

			<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<label class="field-label">
					お名前 <span class="required">*</span>
					<input
						type="text"
						bind:value={name}
						class="field-input"
						placeholder="山田 太郎"
						required
					/>
				</label>

				{#if selectedType === '場所提供者'}
					<label class="field-label">
						オーナー名 <span class="required">*</span>
						<input
							type="text"
							bind:value={ownerName}
							class="field-input"
							placeholder="表示されるオーナー名"
							required
						/>
					</label>
					<label class="field-label">
						紹介文
						<textarea
							bind:value={bio}
							class="field-input textarea"
							placeholder="場所の特徴や提供できるスペースについて"
							rows="3"
						></textarea>
					</label>
					<label class="field-label">
						経歴
						<input
							type="text"
							bind:value={career}
							class="field-input"
							placeholder="例：鴨川沿いで10年"
						/>
					</label>
				{/if}

				{#if selectedType === '屋台提供者'}
					<label class="field-label">
						屋号 <span class="required">*</span>
						<input
							type="text"
							bind:value={businessName}
							class="field-input"
							placeholder="例：鴨川珈琲"
							required
						/>
					</label>
					<label class="field-label">
						電話番号
						<input
							type="tel"
							bind:value={phoneNumber}
							class="field-input"
							placeholder="090-0000-0000"
						/>
					</label>
				{/if}

				<div class="btn-row">
					<button type="button" class="back-btn" onclick={() => (step = 1)}>← 戻る</button>
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
		max-width: 460px;
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
		font-size: 1.3rem;
		color: #0f172a;
		margin: 0 0 6px 0;
	}

	.step-desc {
		font-size: 0.85rem;
		color: #64748b;
		margin: 0 0 24px 0;
	}

	/* タイプ選択カード */
	.type-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 12px;
		margin-bottom: 24px;
	}

	.type-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 18px 10px;
		border: 2px solid #e2e8f0;
		border-radius: 14px;
		background: white;
		cursor: pointer;
		transition: all 0.2s;
		text-align: center;
	}

	.type-card:hover {
		border-color: #facc15;
		background: #fefce8;
	}

	.type-card.selected {
		border-color: #facc15;
		background: #fefce8;
	}

	.type-icon {
		font-size: 2rem;
		margin-bottom: 8px;
	}

	.type-label {
		font-size: 0.85rem;
		font-weight: bold;
		color: #0f172a;
		margin-bottom: 4px;
	}

	.type-desc {
		font-size: 0.72rem;
		color: #64748b;
		line-height: 1.4;
	}

	.check-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		background: #facc15;
		color: #0f172a;
		font-size: 0.7rem;
		font-weight: bold;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.next-btn {
		width: 100%;
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

	/* フォーム部品 */
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

	.required {
		color: #ef4444;
	}

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
		.type-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
