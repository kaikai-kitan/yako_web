<svelte:head>
	<title>出店者ダッシュボード | 微小夜行電灯</title>
</svelte:head>

<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';

	let user = $state(null);
	let isLoading = $state(true);
	let orders = $state([]);
	let monthSales = $state(0);
	let monthFee = $state(0);
	let monthPayout = $state(0);

	// 発送処理
	let shippingOrderId = $state(null);
	let trackingNumber = $state('');
	let isShipping = $state(false);
	let shipError = $state('');

	// 銀行口座
	let bankAccount = $state(null);
	let bankForm = $state({ bank_name: '', branch_name: '', account_type: '普通', account_number: '', account_holder: '' });
	let isSavingBank = $state(false);
	let bankSaveMsg = $state('');
	let bankSaveError = $state('');

	// メールアドレス
	let operatorEmail = $state('');
	let isSavingEmail = $state(false);
	let emailSaveMsg = $state('');

	// 表示月
	const now = new Date();
	let selectedMonth = $state(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

	onMount(async () => {
		const { data: { session } } = await supabase.auth.getSession();
		if (!session) {
			goto(`${base}/auth`);
			return;
		}
		user = session.user;

		await Promise.all([loadOrders(), loadBankAccount(), loadOperatorEmail()]);
		isLoading = false;
	});

	async function loadOrders() {
		const { data } = await supabase
			.from('shop_orders')
			.select('id, items, total_amount, shipping_status, tracking_number, settlement_status, shipping_address, customer_email, created_at')
			.eq('operator_id', user.id)
			.order('created_at', { ascending: false });

		orders = data ?? [];
		calcMonthStats();
	}

	function calcMonthStats() {
		const [y, m] = selectedMonth.split('-').map(Number);
		const monthOrders = orders.filter((o) => {
			const d = new Date(o.created_at);
			return d.getFullYear() === y && d.getMonth() + 1 === m;
		});
		monthSales = monthOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
		monthFee = Math.floor(monthSales * 0.1);
		monthPayout = monthSales - monthFee;
	}

	$effect(() => {
		selectedMonth;
		calcMonthStats();
	});

	async function loadBankAccount() {
		const { data } = await supabase
			.from('operator_bank_accounts')
			.select('*')
			.eq('user_id', user.id)
			.maybeSingle();
		bankAccount = data;
		if (data) {
			bankForm = {
				bank_name: data.bank_name,
				branch_name: data.branch_name,
				account_type: data.account_type,
				account_number: data.account_number,
				account_holder: data.account_holder
			};
		}
	}

	async function loadOperatorEmail() {
		const { data } = await supabase
			.from('operators')
			.select('email')
			.eq('user_id', user.id)
			.maybeSingle();
		operatorEmail = data?.email ?? '';
	}

	async function saveEmail() {
		isSavingEmail = true;
		emailSaveMsg = '';
		const { error } = await supabase
			.from('operators')
			.update({ email: operatorEmail.trim() })
			.eq('user_id', user.id);
		isSavingEmail = false;
		emailSaveMsg = error ? 'エラーが発生しました' : '保存しました';
	}

	async function saveBankAccount() {
		isSavingBank = true;
		bankSaveMsg = '';
		bankSaveError = '';

		const payload = { ...bankForm, user_id: user.id };
		const { error } = bankAccount
			? await supabase.from('operator_bank_accounts').update(bankForm).eq('user_id', user.id)
			: await supabase.from('operator_bank_accounts').insert(payload);

		isSavingBank = false;
		if (error) {
			bankSaveError = 'エラー: ' + error.message;
		} else {
			bankSaveMsg = '保存しました';
			bankAccount = payload;
		}
	}

	async function markShipped(orderId) {
		isShipping = true;
		shipError = '';

		const { data: { session } } = await supabase.auth.getSession();
		const res = await fetch('/api/operator/mark-shipped', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${session?.access_token}`
			},
			body: JSON.stringify({ orderId, trackingNumber: trackingNumber.trim() || null })
		});

		isShipping = false;
		if (res.ok) {
			shippingOrderId = null;
			trackingNumber = '';
			await loadOrders();
		} else {
			const text = await res.text();
			shipError = 'エラー: ' + text;
		}
	}

	const STATUS_LABEL = { pending: '未発送', shipped: '発送済み', delivered: '受取完了' };
	const STATUS_COLOR = { pending: '#d56d04', shipped: '#0077cc', delivered: '#2d8a4e' };
	const SETTLEMENT_LABEL = { unsettled: '未精算', settled: '精算済み' };

	function formatDate(iso) {
		return new Date(iso).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	const filteredOrders = $derived(
		orders.filter((o) => {
			const d = new Date(o.created_at);
			const [y, m] = selectedMonth.split('-').map(Number);
			return d.getFullYear() === y && d.getMonth() + 1 === m;
		})
	);
</script>

{#if isLoading}
	<div class="loading">読み込み中...</div>
{:else}
<div class="page">
	<h1 class="page-title">出店者ダッシュボード</h1>

	<!-- 月選択 -->
	<div class="month-bar">
		<label>
			<span>表示月</span>
			<input type="month" bind:value={selectedMonth} />
		</label>
	</div>

	<!-- 売上サマリー -->
	<section class="section">
		<h2 class="section-title">📊 {selectedMonth} の売上</h2>
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-label">総売上</span>
				<span class="stat-value">¥{monthSales.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">プラットフォーム手数料 (10%)</span>
				<span class="stat-value fee">¥{monthFee.toLocaleString()}</span>
			</div>
			<div class="stat-card highlight">
				<span class="stat-label">次回振込予定額 (90%)</span>
				<span class="stat-value payout">¥{monthPayout.toLocaleString()}</span>
			</div>
		</div>
		<p class="note">※ 振込手数料はお客様負担です。振込額が1,000円未満の場合は翌月以降に繰り越しとなります。</p>
	</section>

	<!-- 受注一覧 -->
	<section class="section">
		<h2 class="section-title">📦 受注一覧</h2>
		{#if filteredOrders.length === 0}
			<p class="empty">この月の受注はありません。</p>
		{:else}
			<div class="orders">
				{#each filteredOrders as order (order.id)}
					<div class="order-card">
						<div class="order-header">
							<div class="order-meta">
								<span class="order-date">{formatDate(order.created_at)}</span>
								<span class="order-id">#{order.id.slice(-8).toUpperCase()}</span>
							</div>
							<div class="badges">
								<span class="badge" style="color:{STATUS_COLOR[order.shipping_status]}">
									{STATUS_LABEL[order.shipping_status]}
								</span>
								<span class="badge settlement" class:settled={order.settlement_status === 'settled'}>
									{SETTLEMENT_LABEL[order.settlement_status]}
								</span>
							</div>
						</div>

						<div class="order-items">
							{#each order.items ?? [] as item}
								<div class="item-row">
									<span>{item.name} × {item.quantity}</span>
									<span>¥{(item.price * item.quantity).toLocaleString()}</span>
								</div>
							{/each}
							<div class="item-total">
								<span>合計</span>
								<strong>¥{(order.total_amount ?? 0).toLocaleString()}</strong>
							</div>
						</div>

						{#if order.shipping_address}
							<div class="shipping-address">
								<span class="addr-label">配送先</span>
								〒{order.shipping_address.postal_code}
								{order.shipping_address.state}{order.shipping_address.city}{order.shipping_address.line1}{order.shipping_address.line2 ? ' ' + order.shipping_address.line2 : ''}
								／ {order.shipping_address.name}
							</div>
						{/if}

						{#if order.tracking_number}
							<div class="tracking">追跡番号: {order.tracking_number}</div>
						{/if}

						{#if order.shipping_status === 'pending'}
							{#if shippingOrderId === order.id}
								<div class="ship-form">
									<input
										type="text"
										placeholder="追跡番号（任意）"
										bind:value={trackingNumber}
									/>
									<button class="btn-ship" onclick={() => markShipped(order.id)} disabled={isShipping}>
										{isShipping ? '処理中...' : '発送済みにする'}
									</button>
									<button class="btn-cancel-ship" onclick={() => { shippingOrderId = null; trackingNumber = ''; }}>
										キャンセル
									</button>
									{#if shipError}<p class="error">{shipError}</p>{/if}
								</div>
							{:else}
								<button class="btn-ship-open" onclick={() => { shippingOrderId = order.id; trackingNumber = ''; shipError = ''; }}>
									発送済みにする
								</button>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- 通知メールアドレス -->
	<section class="section">
		<h2 class="section-title">📧 受注通知メール</h2>
		<div class="form-row">
			<input type="email" placeholder="通知を受け取るメールアドレス" bind:value={operatorEmail} />
			<button class="btn-save" onclick={saveEmail} disabled={isSavingEmail}>
				{isSavingEmail ? '保存中...' : '保存'}
			</button>
		</div>
		{#if emailSaveMsg}<p class="success-msg">{emailSaveMsg}</p>{/if}
	</section>

	<!-- 銀行口座情報 -->
	<section class="section">
		<h2 class="section-title">🏦 振込先口座</h2>
		<p class="note security-note">
			銀行口座情報はあなた自身のみ閲覧できます。プラットフォームへの月次振込確認に使用します。
		</p>
		<div class="bank-form">
			<div class="form-group">
				<label>銀行名</label>
				<input type="text" placeholder="例: 三菱UFJ銀行" bind:value={bankForm.bank_name} />
			</div>
			<div class="form-group">
				<label>支店名</label>
				<input type="text" placeholder="例: 京都支店" bind:value={bankForm.branch_name} />
			</div>
			<div class="form-group">
				<label>口座種別</label>
				<select bind:value={bankForm.account_type}>
					<option>普通</option>
					<option>当座</option>
				</select>
			</div>
			<div class="form-group">
				<label>口座番号</label>
				<input type="text" placeholder="7桁の数字" bind:value={bankForm.account_number} maxlength="8" />
			</div>
			<div class="form-group">
				<label>口座名義（カタカナ）</label>
				<input type="text" placeholder="例: ヤマダ タロウ" bind:value={bankForm.account_holder} />
			</div>
			<button class="btn-save" onclick={saveBankAccount} disabled={isSavingBank}>
				{isSavingBank ? '保存中...' : '口座情報を保存'}
			</button>
			{#if bankSaveMsg}<p class="success-msg">{bankSaveMsg}</p>{/if}
			{#if bankSaveError}<p class="error">{bankSaveError}</p>{/if}
		</div>
	</section>
</div>
{/if}

<style>
	.loading {
		text-align: center;
		padding: 80px 20px;
		color: #7a6f67;
	}
	.page {
		max-width: 760px;
		margin: 0 auto;
		padding: 32px 16px 80px;
		color: #26201a;
	}
	.page-title {
		font-size: 1.3rem;
		font-weight: 700;
		margin: 0 0 24px;
		padding-bottom: 12px;
		border-bottom: 2px solid #e8e0d8;
	}
	.month-bar {
		margin-bottom: 24px;
	}
	.month-bar label {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 0.9rem;
	}
	.month-bar input[type="month"] {
		padding: 6px 10px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.9rem;
	}
	.section {
		margin-bottom: 40px;
	}
	.section-title {
		font-size: 1rem;
		font-weight: 700;
		margin: 0 0 16px;
		padding-bottom: 6px;
		border-bottom: 1px solid #e8e0d8;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
		margin-bottom: 12px;
	}
	.stat-card {
		background: #faf8f5;
		border: 1px solid #e8e0d8;
		border-radius: 12px;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.stat-card.highlight {
		background: #fbf3ea;
		border-color: #d56d04;
	}
	.stat-label {
		font-size: 0.78rem;
		color: #7a6f67;
	}
	.stat-value {
		font-size: 1.3rem;
		font-weight: 700;
		color: #26201a;
	}
	.stat-value.fee {
		color: #c0392b;
	}
	.stat-value.payout {
		color: #d56d04;
	}
	.note {
		font-size: 0.78rem;
		color: #94a3b8;
		margin: 0;
	}
	.security-note {
		background: #f0f7ff;
		border: 1px solid #bfdbfe;
		border-radius: 8px;
		padding: 10px 14px;
		color: #1e40af;
		margin-bottom: 16px;
	}
	.empty {
		color: #9e9289;
		font-size: 0.9rem;
	}
	.orders {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.order-card {
		background: #fff;
		border: 1px solid #e8e0d8;
		border-radius: 14px;
		padding: 16px;
	}
	.order-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
		flex-wrap: wrap;
		gap: 8px;
	}
	.order-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.order-date {
		font-size: 0.82rem;
		color: #7a6f67;
	}
	.order-id {
		font-size: 0.78rem;
		color: #bbb;
		font-family: monospace;
	}
	.badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.badge {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 3px 10px;
		border-radius: 20px;
		background: #f8f5f0;
		border: 1px solid #e8e0d8;
	}
	.badge.settlement {
		color: #7a6f67;
	}
	.badge.settlement.settled {
		color: #2d8a4e;
		background: #e8f7ed;
		border-color: #a3d9b5;
	}
	.order-items {
		background: #faf8f5;
		border-radius: 8px;
		padding: 10px 14px;
		margin-bottom: 10px;
	}
	.item-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.88rem;
		color: #3a3028;
		padding: 4px 0;
		border-bottom: 1px solid #f0ede8;
	}
	.item-total {
		display: flex;
		justify-content: space-between;
		font-size: 0.9rem;
		padding-top: 8px;
		margin-top: 4px;
	}
	.shipping-address {
		font-size: 0.82rem;
		color: #4a3f38;
		background: #f8f5f0;
		border-radius: 8px;
		padding: 8px 12px;
		margin-bottom: 10px;
	}
	.addr-label {
		font-weight: 600;
		margin-right: 6px;
	}
	.tracking {
		font-size: 0.82rem;
		color: #0077cc;
		margin-bottom: 10px;
	}
	.ship-form {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		margin-top: 8px;
	}
	.ship-form input {
		flex: 1;
		min-width: 160px;
		padding: 8px 12px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.88rem;
	}
	.btn-ship {
		padding: 8px 16px;
		background: #d56d04;
		color: #fff;
		border: none;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-ship:disabled {
		opacity: 0.6;
	}
	.btn-cancel-ship {
		padding: 8px 14px;
		background: #f0ede8;
		color: #4a3f38;
		border: none;
		border-radius: 8px;
		font-size: 0.88rem;
		cursor: pointer;
	}
	.btn-ship-open {
		margin-top: 8px;
		padding: 8px 18px;
		background: #fff;
		color: #d56d04;
		border: 1.5px solid #d56d04;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 600;
		cursor: pointer;
	}
	.btn-ship-open:hover {
		background: #fbf3ea;
	}
	.form-row {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.form-row input {
		flex: 1;
		min-width: 220px;
		padding: 10px 14px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.9rem;
	}
	.bank-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.form-group label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #4a3f38;
	}
	.form-group input,
	.form-group select {
		padding: 10px 14px;
		border: 1px solid #ddd;
		border-radius: 8px;
		font-size: 0.9rem;
		max-width: 360px;
	}
	.btn-save {
		padding: 10px 24px;
		background: #26201a;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		align-self: flex-start;
	}
	.btn-save:disabled {
		opacity: 0.6;
	}
	.success-msg {
		font-size: 0.85rem;
		color: #2d8a4e;
		margin: 0;
	}
	.error {
		font-size: 0.85rem;
		color: #c0392b;
		margin: 0;
	}
</style>
