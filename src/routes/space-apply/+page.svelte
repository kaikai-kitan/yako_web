<svelte:head>
	<title>場所を貸したい方へ | 微小夜行電灯</title>
	<meta name="description" content="空いている土地や軒先を、屋台の出店場所として貸し出しませんか。申請後、運営が現地に伺ってお話を聞き、契約のうえで登録します。" />
</svelte:head>

<script>
	import { base } from '$app/paths';

	let form = $state({ applicantName: '', organization: '', email: '', phone: '', address: '', description: '', unavailableTimes: '', website: '' });
	let isSending = $state(false);
	let done = $state(false);
	let errMsg = $state('');

	async function submit(e) {
		e.preventDefault();
		errMsg = '';
		if (!form.applicantName.trim() || !form.email.trim() || !form.address.trim()) {
			errMsg = 'お名前・メールアドレス・場所の所在地を入力してください。';
			return;
		}
		isSending = true;
		try {
			const res = await fetch('/api/space-applications', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
			});
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? '送信できませんでした');
			done = true;
		} catch (err) {
			errMsg = err.message;
		} finally {
			isSending = false;
		}
	}
</script>

<div class="page">
	<div class="page-inner">
		<a href="{base}/" class="back-link">← トップへ</a>
		<h1 class="page-title">場所を貸したい方へ</h1>
		<p class="page-desc">
			空いている土地や軒先、駐車場の一角などを、屋台の出店場所として貸し出しませんか。
			屋台は30分単位で予約され、場所代は月末にまとめてお振り込みします。
			申請をいただいたら、運営が現地に伺ってお話を聞き、貸し出せる時間帯や料金を決めたうえで契約・登録します。
		</p>

		<ol class="steps">
			<li><span class="step-name">申請</span><span class="step-desc">このフォームから送信</span></li>
			<li><span class="step-name">現地でヒアリング</span><span class="step-desc">運営が伺い、場所の様子と貸せない時間帯を確認</span></li>
			<li><span class="step-name">契約・登録</span><span class="step-desc">料金と条件を決めて、アプリに登録</span></li>
		</ol>

		{#if done}
			<div class="done" role="status">
				<p class="done-title">申請を受け付けました</p>
				<p class="done-text">ありがとうございます。数日以内に、ご入力のメールアドレスへ運営からご連絡します。</p>
			</div>
		{:else}
			<form class="form" onsubmit={submit} novalidate>
				<label class="field-group">
					<span class="field-label">お名前 <span class="req">*</span></span>
					<input id="sa-name" class="field-input" type="text" autocomplete="name" bind:value={form.applicantName} />
				</label>
				<label class="field-group">
					<span class="field-label">団体・会社名（任意）</span>
					<input id="sa-org" class="field-input" type="text" autocomplete="organization" bind:value={form.organization} />
				</label>
				<label class="field-group">
					<span class="field-label">メールアドレス <span class="req">*</span></span>
					<input id="sa-email" class="field-input" type="email" autocomplete="email" bind:value={form.email} />
				</label>
				<label class="field-group">
					<span class="field-label">電話番号（任意）</span>
					<input id="sa-phone" class="field-input" type="tel" autocomplete="tel" bind:value={form.phone} />
				</label>
				<label class="field-group">
					<span class="field-label">場所の所在地 <span class="req">*</span></span>
					<input id="sa-address" class="field-input" type="text" placeholder="例：京都市北区上賀茂…" bind:value={form.address} />
				</label>
				<label class="field-group">
					<span class="field-label">場所について（任意）</span>
					<textarea id="sa-desc" class="field-input" rows="4" placeholder="広さ、地面の状態、電源・水道の有無、屋台を何台置けそうか など" bind:value={form.description}></textarea>
				</label>
				<label class="field-group">
					<span class="field-label">貸し出せない時間帯（任意）</span>
					<textarea id="sa-times" class="field-input" rows="3" placeholder="例：平日の朝8時まで、毎週月曜は終日不可 など" bind:value={form.unavailableTimes}></textarea>
				</label>
				<!-- 機械的な送信よけ（画面には表示しない） -->
				<input class="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={form.website} />

				{#if errMsg}<p class="form-error" role="alert">{errMsg}</p>{/if}
				<button class="submit-btn" type="submit" disabled={isSending}>{isSending ? '送信中…' : '申請する'}</button>
				<p class="note">送信いただいた内容は、場所提供のご相談のためにだけ使います。</p>
			</form>
		{/if}
	</div>
</div>

<style>
	.page { min-height: 60vh; padding: 48px 16px 80px; background: var(--surface-sunk); }
	.page-inner { max-width: 560px; margin: 0 auto; }
	.back-link { display: inline-block; font-size: 0.85rem; color: var(--ink-2); text-decoration: none; margin-bottom: 16px; }
	.page-title { font-size: 1.6rem; font-weight: 500; color: var(--ink); margin: 0 0 12px; }
	.page-desc { font-size: 0.92rem; color: var(--ink-2); line-height: 1.9; margin: 0 0 24px; }
	.steps { list-style: none; counter-reset: step; margin: 0 0 32px; padding: 0; display: flex; flex-direction: column; gap: 10px; }
	.steps li { counter-increment: step; display: grid; grid-template-columns: 2em 1fr; grid-template-rows: auto auto; column-gap: 10px; }
	.steps li::before { content: counter(step); grid-row: 1 / span 2; width: 1.8em; height: 1.8em; border-radius: 50%; background: var(--accent-tint); color: var(--accent-deep); display: grid; place-items: center; font-size: 0.85rem; }
	.step-name { font-size: 0.92rem; color: var(--ink); }
	.step-desc { font-size: 0.8rem; color: var(--ink-2); }
	.form { display: flex; flex-direction: column; gap: 18px; }
	.field-group { display: flex; flex-direction: column; gap: 6px; }
	.field-label { font-size: 0.88rem; color: var(--ink); }
	.req { color: var(--accent); }
	.field-input { padding: 11px 14px; border: 1.5px solid var(--line); border-radius: 10px; font-size: 1rem; font-family: var(--font-gothic); background: var(--surface); color: var(--ink); box-sizing: border-box; width: 100%; }
	.field-input:focus { outline: none; border-color: var(--accent); }
	.hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
	.form-error { margin: 0; padding: 10px 14px; border-radius: 10px; background: #fef2f2; color: #b91c1c; font-size: 0.86rem; }
	.submit-btn { padding: 14px; border-radius: 12px; border: none; background: var(--accent); color: #fff; font-size: 1rem; cursor: pointer; font-family: var(--font-gothic); }
	.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.note { margin: 0; font-size: 0.76rem; color: var(--ink-3); }
	.done { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
	.done-title { margin: 0 0 6px; font-size: 1.05rem; color: var(--ink); }
	.done-text { margin: 0; font-size: 0.88rem; color: var(--ink-2); line-height: 1.7; }
</style>
