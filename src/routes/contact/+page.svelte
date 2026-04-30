<svelte:head>
	<title>お問合せ | 微小夜行電灯</title>
	<meta name="description" content="微小夜行電灯へのお問合せはこちらから。ご質問・ご要望・不具合報告など、お気軽にお寄せください。" />
</svelte:head>

<script>
	import { base } from '$app/paths';

	let name = $state('');
	let email = $state('');
	let category = $state('');
	let message = $state('');
	let isSubmitting = $state(false);
	let submitted = $state(false);
	let errorMsg = $state('');

	const CATEGORIES = [
		'サービスについて',
		'屋台・スペースの予約について',
		'公式ストアについて',
		'公式ストア開設について',
		'不具合・エラーの報告',
		'その他'
	];

	async function handleSubmit() {
		if (!name.trim() || !email.trim() || !category || !message.trim()) {
			errorMsg = 'すべての項目を入力してください';
			return;
		}
		isSubmitting = true;
		errorMsg = '';

		// フォームデータをメール送信API（またはSupabaseへの保存）へ送信
		// 現在はフォームの表示確認のみ（実装時にAPIエンドポイントを設定）
		try {
			const res = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					email: email.trim(),
					category,
					message: message.trim()
				})
			});
			if (res.ok) {
				submitted = true;
			} else {
				errorMsg = '送信に失敗しました。しばらく時間をおいてお試しください。';
			}
		} catch {
			errorMsg = '通信エラーが発生しました。インターネット接続を確認してください。';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="page">
	<div class="page-inner">
		<a href="{base}/" class="back-link">← ホームに戻る</a>
		<h1 class="page-title">お問合せ</h1>
		<p class="page-desc">
			ご質問・ご要望・不具合報告など、お気軽にお寄せください。<br />
			通常3営業日以内にご返信いたします。
		</p>

		{#if submitted}
			<div class="success-box">
				<div class="success-icon">✓</div>
				<h2>送信が完了しました</h2>
				<p>お問合せありがとうございます。内容を確認の上、ご連絡いたします。</p>
				<a href="{base}/" class="btn-home">ホームへ戻る</a>
			</div>
		{:else}
			<form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				{#if errorMsg}
					<div class="error-msg">{errorMsg}</div>
				{/if}

				<div class="field-group">
					<label class="field-label" for="contact-name">
						お名前 <span class="req">*</span>
					</label>
					<input
						id="contact-name"
						type="text"
						bind:value={name}
						class="field-input"
						placeholder="山田 太郎"
						required
					/>
				</div>

				<div class="field-group">
					<label class="field-label" for="contact-email">
						メールアドレス <span class="req">*</span>
					</label>
					<input
						id="contact-email"
						type="email"
						bind:value={email}
						class="field-input"
						placeholder="example@email.com"
						required
					/>
				</div>

				<div class="field-group">
					<label class="field-label" for="contact-category">
						お問合せ種類 <span class="req">*</span>
					</label>
					<select id="contact-category" bind:value={category} class="field-input" required>
						<option value="">選択してください</option>
						{#each CATEGORIES as cat}
							<option value={cat}>{cat}</option>
						{/each}
					</select>
				</div>

				<div class="field-group">
					<label class="field-label" for="contact-message">
						お問合せ内容 <span class="req">*</span>
					</label>
					<textarea
						id="contact-message"
						bind:value={message}
						class="field-input textarea"
						rows="6"
						placeholder="お問合せ内容を詳しくご記入ください"
						required
					></textarea>
				</div>

				<p class="privacy-note">
					送信いただいた情報は、お問合せ対応のみに使用し、第三者に提供することはありません。
					詳しくは<a href="{base}/terms">利用規約</a>をご確認ください。
				</p>

				<button type="submit" class="submit-btn" disabled={isSubmitting}>
					{isSubmitting ? '送信中…' : '送信する'}
				</button>
			</form>

			<div class="alt-contact">
				<h3>その他のお問合せ方法</h3>
				<a
					href="https://www.instagram.com/delta_yako?igsh=MTYxZmJzZG5yZHZieA%3D%3D&utm_source=qr"
					target="_blank"
					rel="noopener noreferrer"
					class="alt-contact-item"
				>
					<svg class="ig-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
						stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
						<circle cx="12" cy="12" r="4"/>
						<circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
					</svg>
					Instagram DM: @delta_yako
				</a>
			</div>
		{/if}
	</div>
</div>

<style>
	.page {
		min-height: 60vh;
		padding: 48px 16px 80px;
		background: #faf8f5;
	}
	.page-inner {
		max-width: 560px;
		margin: 0 auto;
	}
	.back-link {
		display: inline-block;
		font-size: 0.85rem;
		color: #7a6f67;
		text-decoration: none;
		margin-bottom: 16px;
	}
	.back-link:hover { color: #26201a; }
	.page-title {
		font-size: 1.6rem;
		font-weight: 700;
		color: #26201a;
		margin: 0 0 12px;
	}
	.page-desc {
		font-size: 0.9rem;
		color: #7a6f67;
		line-height: 1.7;
		margin-bottom: 32px;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.field-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field-label {
		font-size: 0.88rem;
		font-weight: 600;
		color: #26201a;
	}
	.req { color: #d56d04; }
	.field-input {
		padding: 11px 14px;
		border: 1.5px solid #e8e0d8;
		border-radius: 10px;
		font-size: 0.95rem;
		font-family: inherit;
		background: #fff;
		color: #26201a;
		box-sizing: border-box;
		width: 100%;
		transition: border-color 0.15s;
	}
	.field-input:focus {
		outline: none;
		border-color: #d56d04;
	}
	.textarea {
		resize: vertical;
		min-height: 140px;
	}
	.privacy-note {
		font-size: 0.78rem;
		color: #9e9289;
		line-height: 1.6;
		margin: 0;
	}
	.privacy-note a {
		color: #d56d04;
		text-decoration: none;
	}
	.submit-btn {
		padding: 14px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 1rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.submit-btn:hover { background: #3d2f25; }
	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

	.error-msg {
		background: #fee2e2;
		color: #dc2626;
		border-radius: 8px;
		padding: 10px 14px;
		font-size: 0.85rem;
	}

	.success-box {
		text-align: center;
		padding: 48px 24px;
		background: #fff;
		border-radius: 20px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.06);
	}
	.success-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: #dcfce7;
		color: #15803d;
		font-size: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}
	.success-box h2 {
		font-size: 1.2rem;
		color: #26201a;
		margin: 0 0 10px;
	}
	.success-box p {
		font-size: 0.9rem;
		color: #7a6f67;
		margin: 0 0 24px;
	}
	.btn-home {
		display: inline-block;
		padding: 12px 32px;
		background: #26201a;
		color: #fff;
		border-radius: 10px;
		text-decoration: none;
		font-weight: 700;
		font-size: 0.95rem;
	}

	.alt-contact {
		margin-top: 40px;
		padding-top: 28px;
		border-top: 1px solid #e8e0d8;
	}
	.alt-contact h3 {
		font-size: 0.88rem;
		font-weight: 700;
		color: #7a6f67;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 14px;
	}
	.alt-contact-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 16px;
		background: #fff;
		border: 1.5px solid #e8e0d8;
		border-radius: 10px;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 600;
		color: #26201a;
		transition: border-color 0.15s;
	}
	.alt-contact-item:hover { border-color: #d56d04; }
	.ig-icon {
		width: 20px;
		height: 20px;
		stroke: #e1306c;
		flex-shrink: 0;
	}
</style>
