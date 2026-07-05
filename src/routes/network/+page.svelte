<!-- 夜行人ネットワーク（フルスクリーン 3D） -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import seedNetwork from '$lib/assets/data/network.json';
	import NetworkGraph3D from '$lib/components/NetworkGraph3D.svelte';

	let graphData = $state(null);
	let usingSeed = $state(false);
	let selected = $state(null); // クリックされた人物ノード
	let highlightRole = $state(null); // 凡例クリックで属性ハイライト

	const ROLES = ['屋台営業者', '屋台オーナー', '土地オーナー', '流浪人'];

	function toggleRole(r) {
		highlightRole = highlightRole === r ? null : r;
	}

	// QR スキャナ
	let scanning = $state(false);
	let scanError = $state('');
	let html5QrCode = null;

	const ROLE_COLOR = {
		'屋台営業者': '#b85c2b',
		'屋台オーナー': '#b5892e',
		'土地オーナー': '#5f7a52',
		'流浪人': '#6b7688'
	};

	onMount(async () => {
		try {
			const res = await fetch('/api/network/graph');
			const data = res.ok ? await res.json() : { nodes: [] };
			const persons = (data.nodes ?? []).filter((n) => n.type !== 'stall');
			// 2人以上登録されていればライブ表示、それ未満はデモ（seed）
			if (persons.length >= 2) {
				graphData = data;
			} else {
				graphData = seedNetwork;
				usingSeed = true;
			}
		} catch {
			graphData = seedNetwork;
			usingSeed = true;
		}
	});

	onDestroy(() => stopScan());

	let selectedStalls = $state([]);

	async function handleNodeClick(node) {
		if (node.type === 'stall') { selected = null; return; }
		selected = node;
		selectedStalls = [];
		// 屋台営業者なら、その人の屋台情報を取得してリンク表示
		if (node.roles?.includes('屋台営業者') && node.id?.startsWith('u:')) {
			const uid = node.id.slice(2);
			const { data } = await supabase
				.from('stall_specs')
				.select('id, stall_name')
				.eq('user_id', uid);
			selectedStalls = data ?? [];
		}
	}

	function connectLabel(deg) {
		return deg > 0 ? `${deg}人とつながっている` : 'まだ誰ともつながっていない流浪人';
	}

	// ---- QR スキャン ----
	async function startScan() {
		scanning = true;
		scanError = '';
		setTimeout(async () => {
			try {
				const { Html5Qrcode } = await import('html5-qrcode');
				html5QrCode = new Html5Qrcode('net-qr-reader');
				await html5QrCode.start(
					{ facingMode: 'environment' },
					{ fps: 10, qrbox: { width: 220, height: 220 } },
					(text) => {
						stopScan();
						routeFromScan(text);
					},
					() => {}
				);
			} catch {
				scanError = 'カメラの起動に失敗しました。カメラの使用を許可してください。';
			}
		}, 80);
	}

	function stopScan() {
		if (html5QrCode?.isScanning) {
			html5QrCode.stop().catch(() => {});
			html5QrCode = null;
		}
		scanning = false;
	}

	// スキャン結果から /connect へ誘導
	function routeFromScan(text) {
		let dest = '';
		try {
			const url = new URL(text);
			const u = url.searchParams.get('u');
			const stall = url.searchParams.get('stall');
			if (u) dest = `${base}/connect?u=${u}`;
			else if (stall) dest = `${base}/connect?stall=${stall}`;
		} catch {
			// URL でなければ素の接続コードとして扱う
			if (text.trim()) dest = `${base}/connect?u=${encodeURIComponent(text.trim())}`;
		}
		if (dest) goto(dest);
		else { scanError = '有効な接続QRではありません。'; scanning = true; }
	}
</script>

<svelte:head><title>夜行人ネットワーク | 微小夜行電灯</title></svelte:head>

<div class="net-wrap">
	{#if graphData}
		<NetworkGraph3D data={graphData} onNodeClick={handleNodeClick} height="100%" {highlightRole} />
	{:else}
		<div class="loading"><div class="spinner"></div></div>
	{/if}

	<!-- 上部バー -->
	<div class="topbar">
		<a href="{base}/directory" class="chip">‹ 夜行人図鑑</a>
		<div class="legend">
			{#each ROLES as r}
				<button
					class="lg"
					class:active={highlightRole === r}
					class:dimmed={highlightRole && highlightRole !== r}
					onclick={() => toggleRole(r)}
				>
					<i style="background:{ROLE_COLOR[r]}"></i>{r}
				</button>
			{/each}
		</div>
	</div>
	{#if highlightRole}
		<div class="hl-note">「{highlightRole}」をハイライト中 — もう一度タップで解除</div>
	{/if}

	{#if usingSeed}
		<div class="seed-note">デモ表示中（登録が2人以上になると実データに切り替わります）</div>
	{/if}

	<!-- 繋がるボタン -->
	<button class="connect-fab" onclick={startScan}>📷 QRで繋がる</button>

	<!-- 詳細パネル -->
	{#if selected}
		<div class="detail" role="dialog" aria-label="{selected.name} の情報">
			<button class="detail-close" onclick={() => (selected = null)} aria-label="閉じる">×</button>
			<div class="detail-head">
				{#if selected.img}
					<img src={selected.img.startsWith('http') ? selected.img : base + selected.img} alt={selected.name} class="detail-avatar" />
				{:else}
					<div class="detail-avatar placeholder">{selected.name?.charAt(0) ?? '?'}</div>
				{/if}
				<div>
					<h2 class="detail-name">{selected.name}</h2>
					<p class="detail-deg">{connectLabel(selected.__deg ?? selected.degree ?? 0)}</p>
				</div>
			</div>

			{#if selected.roles?.length}
				<div class="roles">
					{#each selected.roles as r}
						<span class="role-chip" style="--dot:{ROLE_COLOR[r] ?? '#6b7688'}">{r}</span>
					{/each}
				</div>
			{/if}
			{#if selected.status}<p class="detail-status">{selected.status}</p>{/if}
			{#if selected.message && selected.message.replace(/[「」\s]/g, '')}<p class="detail-msg">{selected.message}</p>{/if}

			{#if selectedStalls.length > 0}
				<div class="detail-stalls">
					<span class="detail-stalls-label">屋台の営業情報</span>
					{#each selectedStalls as st}
						<a href="{base}/yatakari/{st.id}" class="stall-link">
							{st.stall_name ?? '屋台'}<span class="stall-arrow">→</span>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- QR スキャナ -->
	{#if scanning}
		<div class="scan-modal">
			<div class="scan-card">
				<h2>接続QRを読み取る</h2>
				<p class="scan-hint">相手のプロフィールQR、または屋台のQRをかざしてください</p>
				<div id="net-qr-reader"></div>
				{#if scanError}<p class="scan-err">{scanError}</p>{/if}
				<button class="scan-cancel" onclick={stopScan}>キャンセル</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.net-wrap {
		position: relative;
		width: 100%;
		height: calc(100svh - 60px);
		overflow: hidden;
		background: #ece4d6;
	}
	.loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
	.spinner { width: 44px; height: 44px; border: 3px solid #ded3c0; border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.topbar {
		position: absolute; top: 14px; left: 14px; right: 14px; z-index: 5;
		display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
		pointer-events: none;
	}
	.chip {
		pointer-events: auto;
		background: rgba(255,253,247,0.92); color: var(--ink); text-decoration: none;
		font-family: "Zen Antique", serif; font-size: 0.8rem; letter-spacing: 0.08em;
		padding: 8px 15px; border-radius: 100px; border: 1px solid var(--line);
		box-shadow: var(--shadow-1);
		white-space: nowrap; flex-shrink: 0;
	}
	.legend { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; pointer-events: auto; }
	.lg {
		display: flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--ink-2);
		background: rgba(255,253,247,0.92); box-shadow: var(--shadow-1);
		padding: 6px 12px; border-radius: 100px; border: 1px solid var(--line);
		cursor: pointer; font-family: inherit; transition: all 0.15s; letter-spacing: 0.04em;
	}
	.lg i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
	.lg.active { border-color: var(--ink); background: #fff; font-weight: 700; }
	.lg.dimmed { opacity: 0.4; }
	.lg:hover { opacity: 1; }

	.hl-note {
		position: absolute; top: 58px; right: 14px; z-index: 6;
		background: rgba(43,51,64,0.9); color: #efe7d8; font-size: 0.72rem;
		padding: 6px 13px; border-radius: 100px; letter-spacing: 0.04em;
	}

	.seed-note {
		position: absolute; top: 58px; left: 50%; transform: translateX(-50%); z-index: 5;
		background: rgba(43,51,64,0.9); color: #efe7d8; font-size: 0.72rem;
		padding: 6px 13px; border-radius: 100px; white-space: nowrap; letter-spacing: 0.03em;
	}

	.connect-fab {
		position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 6;
		background: var(--night); color: #f3ece0; border: none; border-radius: 100px;
		padding: 13px 28px; font-family: "Zen Antique", serif; font-size: 0.9rem;
		letter-spacing: 0.1em; cursor: pointer; box-shadow: var(--shadow-2);
	}
	.connect-fab:hover { background: var(--night-2); }

	/* 詳細パネル */
	.detail {
		position: absolute; left: 14px; right: 14px; bottom: 82px; z-index: 7;
		max-width: 420px; margin: 0 auto;
		background: var(--surface); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 22px;
		box-shadow: var(--shadow-2);
	}
	.detail-close {
		position: absolute; top: 12px; right: 14px; width: 28px; height: 28px;
		border: none; background: var(--surface-sunk); border-radius: 50%; font-size: 1.05rem;
		cursor: pointer; color: var(--ink-3);
	}
	.detail-head { display: flex; align-items: center; gap: 14px; }
	.detail-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 1px solid var(--line); }
	.detail-avatar.placeholder { display: flex; align-items: center; justify-content: center; background: var(--surface-sunk); color: var(--ink-3); font-family: "Zen Antique", serif; font-size: 1.5rem; }
	.detail-name { font-family: "Zen Antique", serif; font-size: 1.15rem; letter-spacing: 0.06em; color: var(--ink); margin: 0; }
	.detail-deg { font-size: 0.76rem; color: var(--ink-3); margin: 4px 0 0; letter-spacing: 0.03em; }
	.roles { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
	.role-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; color: var(--ink-2); letter-spacing: 0.05em; }
	.role-chip::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--dot, #6b7688); }
	.detail-status { font-size: 0.85rem; color: var(--ink-2); margin: 14px 0 0; letter-spacing: 0.03em; }
	.detail-msg { font-size: 0.9rem; color: var(--ink-2); margin: 8px 0 0; line-height: 1.7; font-style: italic; }
	.detail-stalls { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); display: flex; flex-direction: column; gap: 8px; }
	.detail-stalls-label { font-size: 0.72rem; color: var(--ink-3); letter-spacing: 0.08em; }
	.stall-link {
		display: flex; align-items: center; justify-content: space-between;
		padding: 11px 14px; background: var(--surface-sunk); border-radius: var(--r-md);
		text-decoration: none; color: var(--ink); font-size: 0.9rem; letter-spacing: 0.04em;
		transition: background 0.15s;
	}
	.stall-link:hover { background: var(--line); }
	.stall-arrow { color: var(--accent); }

	/* スキャナ */
	.scan-modal {
		position: fixed; inset: 0; z-index: 50; background: rgba(38,32,25,0.72);
		display: flex; align-items: center; justify-content: center; padding: 20px;
	}
	.scan-card {
		background: var(--surface); border-radius: var(--r-lg); padding: 26px; width: 100%; max-width: 360px;
		text-align: center;
	}
	.scan-card h2 { font-family: "Zen Antique", serif; font-size: 1.05rem; letter-spacing: 0.08em; color: var(--ink); margin: 0 0 6px; }
	.scan-hint { font-size: 0.8rem; color: var(--ink-3); margin: 0 0 14px; line-height: 1.6; }
	#net-qr-reader { width: 100%; border-radius: 12px; overflow: hidden; }
	.scan-err { color: #b0402c; font-size: 0.82rem; margin: 10px 0 0; }
	.scan-cancel { margin-top: 14px; background: none; border: 1px solid var(--line-strong); color: var(--ink-2); border-radius: var(--r-md); padding: 11px 20px; font-size: 0.86rem; letter-spacing: 0.06em; cursor: pointer; width: 100%; font-family: "Zen Antique", serif; }
</style>
