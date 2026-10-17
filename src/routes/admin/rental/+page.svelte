<svelte:head><title>屋台と場所の設定 | 管理者</title></svelte:head>

<script>
	import { DAY_SETS } from '$lib/rental-price-rules.js';
	import { jpHolidayName } from '$lib/jp-holidays.js';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
	// 30分刻みの時刻（開始 00:00〜23:30、終了 00:30〜24:00）
	const HALF_HOURS = Array.from({ length: 49 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
	const START_TIMES = HALF_HOURS.slice(0, 48);
	const END_TIMES = HALF_HOURS.slice(1);

	let stalls = $state([]);
	let spaces = $state([]);
	let blackouts = $state([]);
	let rules = $state([]);
	let isLoading = $state(true);
	let msg = $state('');
	let errMsg = $state('');
	let busy = $state('');

	let newBlackout = $state({ target: '', kind: 'daily', weekday: '1', onDate: '', startTime: '00:00', endTime: '08:00', note: '' });
	let newRule = $state({ label: '土日祝料金', multiplier: '1.2', kind: 'weekend_holiday', weekday: '6', startDate: '', endDate: '', target: '' });

	onMount(load);

	async function load() {
		isLoading = true;
		const res = await fetch('/api/admin/rental-setup');
		if (res.status === 403) { goto(`${base}/admin/login`); return; }
		if (res.ok) {
			const d = await res.json();
			stalls = (d.stalls ?? []).map((s) => ({ ...s, _space: s.space_id ?? '' }));
			spaces = d.spaces ?? [];
			blackouts = d.blackouts ?? [];
			rules = d.rules ?? [];
		} else {
			errMsg = '読み込めませんでした。v29・v31 のマイグレーションが適用されているか確認してください。';
		}
		isLoading = false;
	}

	async function post(payload, key, okText = '保存しました') {
		busy = key; errMsg = '';
		const res = await fetch('/api/admin/rental-setup', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
		});
		busy = '';
		if (res.ok) {
			msg = okText; setTimeout(() => (msg = ''), 2500);
			await load();
			return true;
		}
		const d = await res.json().catch(() => ({}));
		errMsg = d.message ?? '保存に失敗しました';
		return false;
	}

	const spaceName = (id) => spaces.find((s) => s.id === id)?.name ?? '';
	const stallName = (id) => stalls.find((s) => s.id === id)?.stall_name ?? '';
	const targetLabel = (r) =>
		r.stall_id ? `屋台：${stallName(r.stall_id)}` : r.rental_space_id ? `場所：${spaceName(r.rental_space_id)}` : '全体';
	const blackoutWhen = (b) =>
		b.on_date ? b.on_date : b.weekday != null ? `毎週${WEEKDAYS[b.weekday]}曜` : '毎日';
	const ruleWhen = (r) => {
		const parts = [];
		if (r.day_set) parts.push(DAY_SETS[r.day_set] ?? r.day_set);
		if (r.weekday != null) parts.push(`毎週${WEEKDAYS[r.weekday]}曜`);
		if (r.start_date) parts.push(r.end_date && r.end_date !== r.start_date ? `${r.start_date}〜${r.end_date}` : r.start_date);
		return parts.join('・');
	};
	const t = (v) => String(v ?? '').slice(0, 5);

	function preview(stall) {
		const sp = spaces.find((x) => x.id === stall._space);
		const baseFee = Number(stall.rental_fee || 0) + Number(sp?.space_fee || 0);
		const extFee = Number(stall.extension_fee || 0) + Number(sp?.extension_fee || 0);
		return `利用者に表示：3時間 ¥${baseFee.toLocaleString()}／延長30分 ¥${extFee.toLocaleString()}（4時間なら ¥${(baseFee + extFee * 2).toLocaleString()}）`;
	}
	const noExtFee = (stall) => {
		const sp = spaces.find((x) => x.id === stall._space);
		return Number(stall.extension_fee || 0) + Number(sp?.extension_fee || 0) === 0;
	};
	// これから60日間の祝日（割増の確認用）
	const upcomingHolidays = (() => {
		const out = [];
		const start = Date.now();
		for (let i = 0; i < 60; i++) {
			const d = new Date(start + i * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
			const name = jpHolidayName(d);
			if (name) out.push(`${d.slice(5).replace('-', '/')} ${name}`);
		}
		return out;
	})();

	async function addBlackout() {
		const [kind, id] = newBlackout.target.split(':');
		const ok = await post({
			action: 'addBlackout',
			stallId: kind === 'stall' ? id : null,
			spaceId: kind === 'space' ? id : null,
			weekday: newBlackout.kind === 'weekday' ? newBlackout.weekday : null,
			onDate: newBlackout.kind === 'date' ? newBlackout.onDate : null,
			startTime: newBlackout.startTime, endTime: newBlackout.endTime, note: newBlackout.note
		}, 'blackout', '貸し出し不可の時間帯を追加しました');
		if (ok) newBlackout = { ...newBlackout, note: '' };
	}

	async function addRule() {
		const [kind, id] = newRule.target.split(':');
		const ok = await post({
			action: 'addRule', label: newRule.label, multiplier: newRule.multiplier,
			weekday: newRule.kind === 'weekday' ? newRule.weekday : null,
			daySet: newRule.kind in DAY_SETS ? newRule.kind : null,
			startDate: newRule.kind === 'period' ? newRule.startDate : null,
			endDate: newRule.kind === 'period' ? newRule.endDate : null,
			stallId: kind === 'stall' ? id : null,
			spaceId: kind === 'space' ? id : null
		}, 'rule', '割増率を追加しました');
		if (ok) newRule = { ...newRule, label: '' };
	}
</script>

<div class="page">
	<header class="top-bar">
		<a href="{base}/admin" class="back-link">← 管理ダッシュボード</a>
		<h1 class="page-title">屋台と場所の設定</h1>
	</header>

	{#if msg}<div class="toast success" role="status">{msg}</div>{/if}
	{#if errMsg}<div class="toast error" role="alert">{errMsg}</div>{/if}

	<div class="content">
		{#if isLoading}
			<div class="empty">読み込み中…</div>
		{:else}
			<section class="block">
				<h2 class="block-title">屋台と設置場所・料金</h2>
				<p class="lead">屋台ごとに設置場所を紐づけ、屋台代を設定します。利用者には屋台代と場所代の合計を表示し、振込は屋台代・場所代を分けて集計します。</p>
				{#if stalls.length === 0}<div class="empty">屋台が登録されていません。</div>{/if}
				{#each stalls as s (s.id)}
					<div class="card">
						<div class="card-head">
							<span class="name">{s.stall_name ?? '屋台'}</span>
							<span class="sub">{s.operators?.business_name ?? '提供者未設定'}</span>
						</div>
						<label class="field">
							<span class="label">設置場所</span>
							<select id="space-{s.id}" bind:value={s._space}>
								<option value="">未設定</option>
								{#each spaces as sp}<option value={sp.id}>{sp.name}</option>{/each}
							</select>
						</label>
						<div class="row">
							<label class="field"><span class="label">屋台代（3時間）</span><input id="sb-{s.id}" type="number" min="0" bind:value={s.rental_fee} /></label>
							<label class="field"><span class="label">屋台代の延長（30分）</span><input id="se-{s.id}" type="number" min="0" bind:value={s.extension_fee} /></label>
						</div>
						<p class="preview">{preview(s)}</p>
						{#if noExtFee(s)}<p class="warn">延長料が0円のため、3時間を超えても料金は増えません。</p>{/if}
						<div class="actions">
							<button class="btn" disabled={busy === `stall-${s.id}`} onclick={async () => {
								const ok = await post({ action: 'fees', kind: 'stall', id: s.id, base: s.rental_fee, ext: s.extension_fee }, `stall-${s.id}`);
								if (ok && (s._space || null) !== (s.space_id || null)) await post({ action: 'link', stallId: s.id, spaceId: s._space || null }, `stall-${s.id}`);
							}}>保存</button>
						</div>
					</div>
				{/each}
			</section>

			<section class="block">
				<h2 class="block-title">場所代</h2>
				<p class="lead">場所ごとの料金です。同じ場所に置いた屋台すべてに加算されます。</p>
				{#if spaces.length === 0}<div class="empty">場所が登録されていません。</div>{/if}
				{#each spaces as sp (sp.id)}
					<div class="card">
						<div class="card-head">
							<span class="name">{sp.name}</span>
							<span class="sub">{sp.owners?.owner_name ?? '提供者未設定'}</span>
						</div>
						<div class="row">
							<label class="field"><span class="label">場所代（3時間）</span><input id="pb-{sp.id}" type="number" min="0" bind:value={sp.space_fee} /></label>
							<label class="field"><span class="label">場所代の延長（30分）</span><input id="pe-{sp.id}" type="number" min="0" bind:value={sp.extension_fee} /></label>
						</div>
						<div class="actions">
							<button class="btn" disabled={busy === `space-${sp.id}`} onclick={() => post({ action: 'fees', kind: 'space', id: sp.id, base: sp.space_fee, ext: sp.extension_fee }, `space-${sp.id}`)}>保存</button>
						</div>
					</div>
				{/each}
			</section>

			<section class="block">
				<h2 class="block-title">貸し出し不可の時間帯</h2>
				<p class="lead">現地でのヒアリングで決めた、貸し出さない時間帯です。空き状況に「ー」で表示され、予約できなくなります（日本時間）。</p>
				{#if blackouts.length === 0}<p class="none">まだありません。</p>{/if}
				<ul class="list">
					{#each blackouts as b (b.id)}
						<li class="list-item">
							<span class="li-main">{b.stall_id ? `屋台：${stallName(b.stall_id)}` : `場所：${spaceName(b.rental_space_id)}`}</span>
							<span class="li-sub">{blackoutWhen(b)} {t(b.start_time)}〜{t(b.end_time)}{b.note ? `（${b.note}）` : ''}</span>
							<button class="btn-ghost" disabled={busy === `bo-${b.id}`} onclick={() => post({ action: 'deleteBlackout', id: b.id }, `bo-${b.id}`, '削除しました')}>削除</button>
						</li>
					{/each}
				</ul>
				<div class="card form">
					<label class="field">
						<span class="label">対象</span>
						<select id="bo-target" bind:value={newBlackout.target}>
							<option value="">選択してください</option>
							<optgroup label="場所">{#each spaces as sp}<option value="space:{sp.id}">{sp.name}</option>{/each}</optgroup>
							<optgroup label="屋台">{#each stalls as s}<option value="stall:{s.id}">{s.stall_name}</option>{/each}</optgroup>
						</select>
					</label>
					<div class="row">
						<label class="field">
							<span class="label">いつ</span>
							<select id="bo-kind" bind:value={newBlackout.kind}>
								<option value="daily">毎日</option>
								<option value="weekend_holiday">土日・祝日</option>
								<option value="holiday">祝日だけ</option>
								<option value="weekday">毎週の曜日</option>
								<option value="date">特定の日</option>
							</select>
						</label>
						{#if newBlackout.kind === 'weekday'}
							<label class="field"><span class="label">曜日</span>
								<select id="bo-wd" bind:value={newBlackout.weekday}>{#each WEEKDAYS as w, i}<option value={String(i)}>{w}曜</option>{/each}</select>
							</label>
						{:else if newBlackout.kind === 'date'}
							<label class="field"><span class="label">日付</span><input id="bo-date" type="date" bind:value={newBlackout.onDate} /></label>
						{/if}
					</div>
					<div class="row">
						<label class="field"><span class="label">開始</span>
							<select id="bo-start" bind:value={newBlackout.startTime}>{#each START_TIMES as tm}<option value={tm}>{tm}</option>{/each}</select>
						</label>
						<label class="field"><span class="label">終了（終日なら 00:00〜24:00）</span>
							<select id="bo-end" bind:value={newBlackout.endTime}>{#each END_TIMES as tm}<option value={tm}>{tm}</option>{/each}</select>
						</label>
					</div>
					<label class="field"><span class="label">メモ（任意）</span><input id="bo-note" type="text" placeholder="例：近隣への配慮のため" bind:value={newBlackout.note} /></label>
					<div class="actions"><button class="btn" disabled={!newBlackout.target || busy === 'blackout'} onclick={addBlackout}>追加</button></div>
				</div>
			</section>

			<section class="block">
				<h2 class="block-title">割増率（土日・イベント）</h2>
				<p class="lead">予約の開始日に当てはまる倍率を、屋台代・場所代のそれぞれに掛けます。複数当てはまる場合は一番高い倍率を使います。</p>
				{#if rules.length === 0}<p class="none">まだありません。</p>{/if}
				<ul class="list">
					{#each rules as r (r.id)}
						<li class="list-item" class:off={!r.active}>
							<span class="li-main">{r.label} ×{Number(r.multiplier)}</span>
							<span class="li-sub">{ruleWhen(r)}／{targetLabel(r)}{r.active ? '' : '（停止中）'}</span>
							<span class="li-actions">
								<button class="btn-ghost" disabled={busy === `rule-${r.id}`} onclick={() => post({ action: 'toggleRule', id: r.id, active: !r.active }, `rule-${r.id}`, r.active ? '停止しました' : '再開しました')}>{r.active ? '停止' : '再開'}</button>
								<button class="btn-ghost" disabled={busy === `rule-${r.id}`} onclick={() => post({ action: 'deleteRule', id: r.id }, `rule-${r.id}`, '削除しました')}>削除</button>
							</span>
						</li>
					{/each}
				</ul>
				<div class="card form">
					<div class="row">
						<label class="field"><span class="label">名前</span><input id="rule-label" type="text" placeholder="例：土日料金、鴨川まつり" bind:value={newRule.label} /></label>
						<label class="field narrow"><span class="label">倍率</span><input id="rule-mult" type="number" min="0.1" max="10" step="0.05" bind:value={newRule.multiplier} /></label>
					</div>
					<div class="row">
						<label class="field">
							<span class="label">いつ</span>
							<select id="rule-kind" bind:value={newRule.kind}>
								<option value="weekday">毎週の曜日</option>
								<option value="period">期間（イベントなど）</option>
							</select>
						</label>
						{#if newRule.kind === 'weekday'}
							<label class="field"><span class="label">曜日</span>
								<select id="rule-wd" bind:value={newRule.weekday}>{#each WEEKDAYS as w, i}<option value={String(i)}>{w}曜</option>{/each}</select>
							</label>
						{:else if newRule.kind === 'period'}
							<label class="field"><span class="label">開始日</span><input id="rule-from" type="date" bind:value={newRule.startDate} /></label>
							<label class="field"><span class="label">終了日</span><input id="rule-to" type="date" bind:value={newRule.endDate} /></label>
						{/if}
					</div>
					<label class="field">
						<span class="label">対象</span>
						<select id="rule-target" bind:value={newRule.target}>
							<option value="">全体（すべての屋台・場所）</option>
							<optgroup label="場所">{#each spaces as sp}<option value="space:{sp.id}">{sp.name}</option>{/each}</optgroup>
							<optgroup label="屋台">{#each stalls as s}<option value="stall:{s.id}">{s.stall_name}</option>{/each}</optgroup>
						</select>
					</label>
					<p class="hint">祝日は振替休日・国民の休日も含めて自動で判定します。{#if upcomingHolidays.length}これからの祝日：{upcomingHolidays.join('、')}{/if}</p>
					<div class="actions"><button class="btn" disabled={!newRule.label || busy === 'rule'} onclick={addRule}>追加</button></div>
				</div>
			</section>
		{/if}
	</div>
</div>

<style>
	.page { min-height: 100svh; background: var(--surface-sunk); font-family: var(--font-gothic); padding-bottom: 60px; }
	.top-bar { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--line); display: flex; align-items: center; gap: 16px; padding: 12px max(20px, env(safe-area-inset-right, 0px)) 12px max(20px, env(safe-area-inset-left, 0px)); }
	.back-link { font-size: 0.82rem; color: var(--ink-2); text-decoration: none; }
	.page-title { font-size: 1rem; font-weight: 500; color: var(--ink); margin: 0; }
	.toast { margin: 12px 20px; padding: 10px 16px; border-radius: 10px; font-size: 0.88rem; }
	.toast.success { background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0; }
	.toast.error { background: #fef2f2; color: var(--accent-deep); border: 1px solid #fecaca; }
	.content { padding: 16px 20px; max-width: 720px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
	.empty, .none { color: var(--ink-3); font-size: 0.86rem; }
	.empty { text-align: center; padding: 40px 0; }
	.block { display: flex; flex-direction: column; gap: 10px; }
	.block-title { font-size: 1rem; font-weight: 500; margin: 0; }
	.lead { margin: 0; font-size: 0.82rem; color: var(--ink-2); line-height: 1.6; }
	.card { background: var(--surface); border-radius: 14px; border: 1px solid var(--line); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
	.card-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
	.name { font-size: 0.95rem; font-weight: 500; color: var(--ink); }
	.sub { font-size: 0.78rem; color: var(--ink-3); }
	.row { display: flex; gap: 10px; flex-wrap: wrap; }
	.row .field { flex: 1 1 140px; min-width: 0; }
	.field.narrow { flex: 0 1 100px; }
	.field { display: flex; flex-direction: column; gap: 4px; }
	.label { font-size: 0.74rem; color: var(--ink-2); }
	.field input, .field select { padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 0.92rem; background: var(--surface); font-family: var(--font-gothic); color: var(--ink); min-width: 0; }
	.warn { margin: 4px 0 0; font-size: 0.8rem; color: #b45309; }
	.preview { margin: 0; font-size: 0.8rem; color: var(--accent-deep); font-variant-numeric: tabular-nums; }
	.hint { margin: 0; font-size: 0.74rem; color: var(--ink-3); }
	.actions { display: flex; justify-content: flex-end; }
	.btn { padding: 8px 18px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-size: 0.86rem; cursor: pointer; font-family: var(--font-gothic); }
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-ghost { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--line-strong); background: var(--surface); color: var(--ink-2); font-size: 0.78rem; cursor: pointer; font-family: var(--font-gothic); }
	.list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
	.list-item { display: grid; grid-template-columns: 1fr auto; gap: 2px 10px; align-items: center; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; }
	.list-item.off { opacity: 0.55; }
	.li-main { font-size: 0.88rem; color: var(--ink); }
	.li-sub { font-size: 0.76rem; color: var(--ink-2); grid-column: 1; }
	.list-item > .btn-ghost, .li-actions { grid-column: 2; grid-row: 1 / span 2; display: flex; gap: 6px; }
	.form { background: var(--surface); }
</style>
