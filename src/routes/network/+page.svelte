<!-- 夜行人ネットワーク（フルスクリーン 3D） -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
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
		'屋台営業者': '#d56d04',
		'屋台オーナー': '#e0a72e',
		'土地オーナー': '#22a06b',
		'流浪人': '#7d8aa5'
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

	function handleNodeClick(node) {
		if (node.type === 'stall') { selected = null; return; }
		selected = node;
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
						<span class="role-chip" style="border-color:{ROLE_COLOR[r] ?? '#b9ab97'};color:{ROLE_COLOR[r] ?? '#b9ab97'}">{r}</span>
					{/each}
				</div>
			{/if}
			{#if selected.status}<p class="detail-status">{selected.status}</p>{/if}
			{#if selected.message}<p class="detail-msg">{selected.message}</p>{/if}
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
		background: #ffffff;
	}
	.loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
	.spinner { width: 44px; height: 44px; border: 4px solid #ece3d6; border-top-color: #d56d04; border-radius: 50%; animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	.topbar {
		position: absolute; top: 12px; left: 12px; right: 12px; z-index: 5;
		display: flex; align-items: center; justify-content: space-between; gap: 10px;
		pointer-events: none;
	}
	.chip {
		pointer-events: auto;
		background: rgba(255,255,255,0.92); color: #26201a; text-decoration: none;
		font-size: 0.82rem; font-weight: 700; padding: 8px 14px; border-radius: 100px;
		box-shadow: 0 2px 10px rgba(0,0,0,0.3);
	}
	.legend { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; pointer-events: auto; }
	.lg {
		display: flex; align-items: center; gap: 5px; font-size: 0.7rem; color: #5a4f45;
		background: rgba(255,255,255,0.92); box-shadow: 0 1px 6px rgba(0,0,0,0.12);
		padding: 5px 11px; border-radius: 100px; border: 1.5px solid transparent;
		cursor: pointer; font-family: inherit; transition: all 0.15s;
	}
	.lg i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
	.lg.active { border-color: #26201a; background: #fff; font-weight: 700; }
	.lg.dimmed { opacity: 0.45; }
	.lg:hover { opacity: 1; }

	.hl-note {
		position: absolute; top: 52px; right: 12px; z-index: 6;
		background: rgba(38,32,26,0.85); color: #fff; font-size: 0.72rem;
		padding: 5px 12px; border-radius: 100px;
	}

	.seed-note {
		position: absolute; top: 54px; left: 50%; transform: translateX(-50%); z-index: 5;
		background: rgba(213,109,4,0.9); color: #fff; font-size: 0.72rem;
		padding: 5px 12px; border-radius: 100px; white-space: nowrap;
	}

	.connect-fab {
		position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 6;
		background: #d56d04; color: #fff; border: none; border-radius: 100px;
		padding: 13px 26px; font-size: 0.92rem; font-weight: 700; cursor: pointer;
		box-shadow: 0 6px 20px rgba(213,109,4,0.5); font-family: inherit;
	}
	.connect-fab:hover { background: #b85d03; }

	/* 詳細パネル */
	.detail {
		position: absolute; left: 12px; right: 12px; bottom: 78px; z-index: 7;
		max-width: 420px; margin: 0 auto;
		background: #fff; border-radius: 18px; padding: 20px;
		box-shadow: 0 10px 40px rgba(0,0,0,0.5);
	}
	.detail-close {
		position: absolute; top: 10px; right: 12px; width: 30px; height: 30px;
		border: none; background: #f0ede8; border-radius: 50%; font-size: 1.1rem;
		cursor: pointer; color: #7a6f67;
	}
	.detail-head { display: flex; align-items: center; gap: 14px; }
	.detail-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
	.detail-avatar.placeholder { display: flex; align-items: center; justify-content: center; background: #e9dcc8; color: #7a6a4c; font-weight: 700; font-size: 1.5rem; }
	.detail-name { font-size: 1.15rem; color: #26201a; margin: 0; }
	.detail-deg { font-size: 0.78rem; color: #9e8f7a; margin: 3px 0 0; }
	.roles { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; }
	.role-chip { font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border: 1.5px solid; border-radius: 100px; }
	.detail-status { font-size: 0.85rem; color: #5a4f45; margin: 12px 0 0; font-weight: 600; }
	.detail-msg { font-size: 0.88rem; color: #4a3f38; margin: 8px 0 0; line-height: 1.6; font-style: italic; }

	/* スキャナ */
	.scan-modal {
		position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,0.75);
		display: flex; align-items: center; justify-content: center; padding: 20px;
	}
	.scan-card {
		background: #fff; border-radius: 18px; padding: 24px; width: 100%; max-width: 360px;
		text-align: center;
	}
	.scan-card h2 { font-size: 1.05rem; color: #26201a; margin: 0 0 6px; }
	.scan-hint { font-size: 0.8rem; color: #7a6f67; margin: 0 0 14px; line-height: 1.5; }
	#net-qr-reader { width: 100%; border-radius: 12px; overflow: hidden; }
	.scan-err { color: #c0392b; font-size: 0.82rem; margin: 10px 0 0; }
	.scan-cancel { margin-top: 14px; background: none; border: 1.5px solid #ded3c4; color: #5a4f45; border-radius: 10px; padding: 10px 20px; font-size: 0.88rem; font-weight: 700; cursor: pointer; width: 100%; }
</style>
