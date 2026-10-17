<!--
	屋台の空き状況（30分ごと）。○を選んで予約へ進む。
	○ 予約できる ／ × 他の人が使用中（前後30分のゆとりを含む）／ ー 貸し出し不可
-->
<script>
	import { rentalCharge } from '$lib/rental-pricing.js';
	import { applyMultiplier } from '$lib/rental-price-rules.js';
	import { jstParts } from '$lib/rental-availability.js';
	import { nextSelection, isSelected, formatRange, formatDayTab } from '$lib/slot-selection.js';

	let {
		stallId,
		onProceed,
		proceedLabel = 'この時間で予約へ進む',
		blockedMessage = '',
		loginHref = ''
	} = $props();

	let data = $state(null);
	let loading = $state(true);
	let loadError = $state('');
	let dayIndex = $state(0);
	let selection = $state(null);
	let message = $state('');

	const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

	async function load(id) {
		loading = true; loadError = ''; data = null; selection = null; message = ''; dayIndex = 0;
		try {
			const res = await fetch(`/api/stalls/${id}/availability`);
			if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? '');
			data = await res.json();
		} catch (e) {
			loadError = e?.message || '空き状況を読み込めませんでした。時間をおいて再度お試しください。';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (stallId) load(stallId);
	});

	let statusByStart = $derived(
		new Map((data?.days ?? []).flatMap((d) => d.slots.map((s) => [Date.parse(s.start), s.status])))
	);
	let day = $derived(data?.days?.[dayIndex] ?? null);
	// 1日分を「0〜7時 / 8〜15時 / 16〜23時」の3列 × 8行に並べる
	let hourRows = $derived(
		day
			? Array.from({ length: 8 }, (_, r) =>
					[0, 8, 16].map((offset) => {
						const hour = r + offset;
						return { hour, slots: [day.slots[hour * 2], day.slots[hour * 2 + 1]] };
					})
				)
			: []
	);
	let freeCount = (d) => d.slots.filter((s) => s.status === 'free').length;

	// 予約の開始日に当てはまる割増率（土日・イベントなど）
	let startDay = $derived(
		selection && data ? data.days.find((d) => d.date === jstParts(selection.start).date) ?? null : null
	);
	let effectiveFees = $derived(data ? applyMultiplier(data.fees, startDay?.multiplier ?? 1) : null);
	let charge = $derived(
		selection && !selection.open && effectiveFees
			? rentalCharge({ start: selection.start, end: selection.end, fees: effectiveFees })
			: null
	);

	function tap(slot) {
		const ms = Date.parse(slot.start);
		const r = nextSelection(selection, ms, (t) => statusByStart.get(t));
		selection = r.selection;
		message = r.error;
	}

	function proceed() {
		if (!selection || selection.open || !data) return;
		onProceed?.({
			start: selection.start,
			end: selection.end,
			stall: data.stall,
			space: data.space,
			fees: effectiveFees,
			multiplier: startDay?.multiplier ?? 1,
			priceLabel: startDay?.priceLabel ?? null,
			charge
		});
	}

	const glyph = { free: '○', busy: '×', blocked: 'ー', past: '' };
	const label = { free: '予約できる', busy: '使用中', blocked: '貸し出し不可', past: '過ぎた時間' };
</script>

<div class="ap">
	<div class="ap-head">
		<span class="ap-title">空き状況</span>
		<span class="ap-legend"><b class="g free">○</b>予約できる <b class="g busy">×</b>使用中 <b class="g blocked">ー</b>貸し出し不可</span>
	</div>

	{#if loading}
		<p class="ap-note">読み込み中…</p>
	{:else if loadError}
		<p class="ap-note ap-error" role="alert">{loadError}</p>
		<button class="ap-retry" onclick={() => load(stallId)}>再読み込み</button>
	{:else if data}
		<div class="ap-days" role="tablist" aria-label="日付">
			{#each data.days as d, i}
				<button
					role="tab"
					aria-selected={i === dayIndex}
					class="ap-day"
					class:on={i === dayIndex}
					class:sun={d.weekday === 0}
					class:sat={d.weekday === 6}
					onclick={() => (dayIndex = i)}
				>
					<span class="ap-day-date">{formatDayTab(d.date).replace(/\(.\)/, '')}</span>
					<span class="ap-day-wd">{WEEKDAY[d.weekday]}</span>
					<span class="ap-day-free">{freeCount(d) > 0 ? '○' : '×'}</span>
					{#if d.multiplier && d.multiplier !== 1}<span class="ap-day-rate" title={d.priceLabel ?? ''}>×{d.multiplier}</span>{/if}
				</button>
			{/each}
		</div>

		<div class="ap-grid" role="grid" aria-label="{day ? formatDayTab(day.date) : ''}の空き状況">
			{#each hourRows as row}
				<div class="ap-row" role="row">
					{#each row as cell}
						<div class="ap-cell-group">
							<span class="ap-hour">{cell.hour}時</span>
							{#each cell.slots as slot, k}
								{@const ms = Date.parse(slot.start)}
								<button
									class="ap-slot {slot.status}"
									class:sel={isSelected(selection, ms)}
									class:anchor={selection?.open && selection.start === ms}
									disabled={slot.status !== 'free'}
									aria-label="{cell.hour}時{k ? '30' : '00'}分 {label[slot.status]}"
									onclick={() => tap(slot)}
								>{glyph[slot.status]}</button>
							{/each}
						</div>
					{/each}
				</div>
			{/each}
		</div>

		<div class="ap-foot" aria-live="polite">
			{#if message}
				<p class="ap-note ap-error">{message}</p>
			{:else if !selection}
				<p class="ap-note">開始の○をタップし、続けて終了の○をタップしてください（30分単位・日付をまたいでも選べます）。</p>
			{:else if selection.open}
				<p class="ap-note">終了の○をタップしてください。開始時刻 1 枠だけ使う場合は、同じ○をもう一度タップします。</p>
			{:else}
				<p class="ap-range">{formatRange(selection.start, selection.end)}</p>
				{#if charge}
					<p class="ap-price">
						料金の目安 <b>¥{charge.total.toLocaleString()}</b>
						{#if startDay?.multiplier && startDay.multiplier !== 1}<span class="ap-rate-note">{startDay.priceLabel ?? '特別料金'} ×{startDay.multiplier}</span>{/if}
						<span class="ap-price-sub">（基本 ¥{charge.base.toLocaleString()}{charge.extensionSlots ? ` ＋ 延長 30分×${charge.extensionSlots} ¥${charge.extension.toLocaleString()}` : ''}）</span>
					</p>
				{/if}
			{/if}

			{#if blockedMessage}
				<div class="ap-blocked">{blockedMessage}</div>
			{:else if loginHref}
				<a class="ap-btn" href={loginHref}>ログインして予約する</a>
			{:else}
				<button class="ap-btn" disabled={!selection || selection.open} onclick={proceed}>{proceedLabel}</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.ap { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
	.ap-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
	.ap-title { font-size: 0.9rem; font-weight: 500; color: var(--ink); }
	.ap-legend { font-size: 0.68rem; color: var(--ink-3); display: flex; gap: 6px; align-items: center; }
	.g { font-weight: 500; margin-right: 1px; }
	.g.free { color: var(--accent); }
	.g.busy { color: var(--ink-2); }
	.g.blocked { color: var(--ink-3); }

	.ap-days { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; }
	.ap-day {
		flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1px;
		min-width: 46px; padding: 6px 4px; border-radius: 10px;
		border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); cursor: pointer;
	}
	.ap-day.on { border-color: var(--accent); background: var(--accent-tint); color: var(--ink); }
	.ap-day-date { font-size: 0.78rem; font-variant-numeric: tabular-nums; }
	.ap-day-wd { font-size: 0.66rem; }
	.ap-day.sun .ap-day-wd { color: #b4413a; }
	.ap-day.sat .ap-day-wd { color: #3a5fb4; }
	.ap-day-free { font-size: 0.7rem; color: var(--accent); }
	.ap-day-rate { font-size: 0.6rem; color: var(--accent-deep); background: var(--surface-sunk); border-radius: 4px; padding: 0 3px; }
	.ap-rate-note { font-size: 0.7rem; color: var(--accent-deep); margin-left: 6px; }

	.ap-grid { display: flex; flex-direction: column; gap: 3px; }
	.ap-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
	.ap-cell-group { display: grid; grid-template-columns: 2.4em 1fr 1fr; gap: 3px; align-items: center; }
	.ap-hour { font-size: 0.68rem; color: var(--ink-3); text-align: right; font-variant-numeric: tabular-nums; }
	.ap-slot {
		height: 30px; border-radius: 6px; border: 1px solid var(--line);
		background: var(--surface); font-size: 0.85rem; line-height: 1; cursor: pointer; padding: 0;
		color: var(--accent); font-family: var(--font-gothic);
	}
	.ap-slot.busy { color: var(--ink-2); background: var(--surface-sunk); cursor: not-allowed; }
	.ap-slot.blocked { color: var(--ink-3); background: var(--surface-sunk); cursor: not-allowed; }
	.ap-slot.past { background: transparent; border-style: dashed; cursor: default; }
	.ap-slot.sel { background: var(--accent); border-color: var(--accent); color: #fff; }
	.ap-slot.anchor { outline: 2px solid var(--accent-deep); outline-offset: 1px; }
	.ap-slot:focus-visible { outline: 2px solid var(--accent-deep); outline-offset: 1px; }

	.ap-foot { display: flex; flex-direction: column; gap: 8px; }
	.ap-note { margin: 0; font-size: 0.78rem; color: var(--ink-2); line-height: 1.6; }
	.ap-error { color: #b91c1c; }
	.ap-range { margin: 0; font-size: 0.95rem; color: var(--ink); font-variant-numeric: tabular-nums; }
	.ap-price { margin: 0; font-size: 0.85rem; color: var(--ink-2); }
	.ap-price b { font-size: 1.05rem; color: var(--ink); font-weight: 500; }
	.ap-price-sub { font-size: 0.72rem; color: var(--ink-3); }
	.ap-btn {
		display: block; width: 100%; box-sizing: border-box; text-align: center; text-decoration: none;
		padding: 12px; border-radius: 12px; border: none; cursor: pointer;
		background: var(--accent); color: #fff; font-size: 0.92rem; font-family: var(--font-gothic);
	}
	.ap-btn:disabled { opacity: 0.45; cursor: not-allowed; }
	.ap-blocked { padding: 10px 12px; border-radius: 10px; background: var(--surface-sunk); color: var(--ink-2); font-size: 0.82rem; text-align: center; }
	.ap-retry { align-self: flex-start; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--surface); cursor: pointer; font-family: var(--font-gothic); }
</style>
