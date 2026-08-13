<!-- 夜行人ネットワーク（フルスクリーン 3D） -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import seedNetwork from '$lib/assets/data/network.json';
	import NetworkGraph3D from '$lib/components/NetworkGraph3D.svelte';

	let graphData = $state(null);
	let usingSeed = $state(false);
	let selected = $state(null); // クリックされた人物ノード
	let fabOpen = $state(false); // 「+」メニューの開閉

	// QR スキャナ
	let scanning = $state(false);
	let scanError = $state('');
	let html5QrCode = null;

	// マイQR（自分の接続QR）
	let showMyQr = $state(false);
	let myQrDataUrl = $state('');
	let myHandle = $state('');
	let hasYakonin = $state(false);

	async function loadMyQr() {
		try {
			const { data: { session } } = await supabase.auth.getSession();
			if (!session) return;
			const { data } = await supabase
				.from('yakonin_profiles')
				.select('connect_code, handle')
				.eq('user_id', session.user.id)
				.maybeSingle();
			if (data?.connect_code) {
				hasYakonin = true;
				myHandle = data.handle ?? '';
				const url = `${window.location.origin}${base}/connect?u=${data.connect_code}`;
				const QRCode = (await import('qrcode')).default;
				myQrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
			}
		} catch { /* noop */ }
	}


	// 法人広告のアクセス計測（fire-and-forget）
	function trackAd(node, kind) {
		if (!node?.adActive || !node.id?.startsWith('u:')) return;
		fetch('/api/corporate/track', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId: node.id.slice(2), kind })
		}).catch(() => {});
	}

	onMount(async () => {
		try {
			const res = await fetch('/api/network/graph');
			const data = res.ok ? await res.json() : { nodes: [] };
			const persons = (data.nodes ?? []).filter((n) => n.type !== 'stall');
			// 2人以上登録されていればライブ表示、それ未満はデモ（seed）
			if (persons.length >= 2) {
				graphData = data;
				// 表示計測: 広告有効な法人ノードを1回ずつカウント
				for (const n of persons) trackAd(n, 'view');
			} else {
				graphData = seedNetwork;
				usingSeed = true;
			}
		} catch {
			graphData = seedNetwork;
			usingSeed = true;
		}
		loadMyQr();
	});

	onDestroy(() => stopScan());

	let selectedStalls = $state([]);

	async function handleNodeClick(node) {
		if (node.type === 'stall') { selected = null; return; }
		selected = node;
		selectedStalls = [];
		trackAd(node, 'click'); // クリック計測（広告有効な法人のみ加算）
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
		showMyQr = false;
		startScanCamera();
	}

	function startScanCamera() {
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

	function stopCamera() {
		if (html5QrCode?.isScanning) {
			html5QrCode.stop().catch(() => {});
			html5QrCode = null;
		}
	}

	function stopScan() {
		stopCamera();
		scanning = false;
		showMyQr = false;
	}

	// カメラ ⇄ マイQR の切り替え
	function showMine() { stopCamera(); showMyQr = true; }
	function backToScan() { showMyQr = false; startScanCamera(); }

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
		<NetworkGraph3D data={graphData} onNodeClick={handleNodeClick} height="100%" />
	{:else}
		<div class="loading"><div class="spinner"></div></div>
	{/if}

	<!-- 上部バー -->
	<div class="topbar">
		<div class="legend">
			<span class="lg-static"><i style="background:#b5892e"></i>法人</span>
			<span class="lg-static"><i style="background:#8a94ab"></i>夜行人</span>
		</div>
	</div>

	{#if usingSeed}
		<div class="seed-note">デモ表示中（登録が2人以上になると実データに切り替わります）</div>
	{/if}

	<!-- 「+」メニュー（QRで繋がる / プライベートネットワーク作成） -->
	{#if fabOpen}
		<div class="fab-overlay" onclick={() => (fabOpen = false)} role="presentation"></div>
		<div class="fab-menu" role="menu">
			<button class="fab-item" role="menuitem" onclick={() => { fabOpen = false; startScan(); }}>
				<Icon name="qr-code" size={18} /> QRコードで繋がる
			</button>
			<a class="fab-item" role="menuitem" href="{base}/groups" onclick={() => (fabOpen = false)}>
				<Icon name="share" size={18} /> プライベートネットワークを作成
			</a>
		</div>
	{/if}
	<button class="connect-fab" class:open={fabOpen} onclick={() => (fabOpen = !fabOpen)} aria-label="メニュー" aria-haspopup="menu" aria-expanded={fabOpen}>＋</button>

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
					<h2 class="detail-name">
					{selected.name}
					{#if selected.adActive}<span class="corp-badge" title="法人アカウント"><Icon name="badge-check" size={16} /></span>{/if}
				</h2>
					<p class="detail-deg">{connectLabel(selected.__deg ?? selected.degree ?? 0)}</p>
				</div>
			</div>

			{#if selected.adActive}
				<div class="roles"><span class="role-chip corp">法人</span></div>
			{/if}
			{#if selected.status}<p class="detail-status">{selected.status}</p>{/if}
			{#if selected.message && selected.message.replace(/[「」\s]/g, '')}<p class="detail-msg">{selected.message}</p>{/if}

			{#if selected.adActive && selected.ad}
				<div class="detail-ad">
					<span class="ad-label"><Icon name="badge-check" size={12} /> PR</span>
					{#if selected.ad.image}
						<img src={selected.ad.image} alt="広告" class="ad-image" />
					{/if}
					{#if selected.ad.headline}<p class="ad-headline">{selected.ad.headline}</p>{/if}
					<div class="ad-links">
						{#if selected.ad.storeUrl}
							<a href={selected.ad.storeUrl} target="_blank" rel="noopener noreferrer" class="ad-link store">
								<Icon name="store" size={14} /> オンラインストア
							</a>
						{/if}
						{#if selected.ad.recruitUrl}
							<a href={selected.ad.recruitUrl} target="_blank" rel="noopener noreferrer" class="ad-link recruit">
								<Icon name="clipboard-list" size={14} /> 採用情報
							</a>
						{/if}
					</div>
				</div>
			{/if}

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
				{#if showMyQr}
					<!-- 自分のQRを表示 -->
					<h2>あなたの接続QR</h2>
					<p class="scan-hint">相手にこのQRを読み取ってもらうと繋がれます</p>
					{#if myQrDataUrl}
						<img class="my-qr-img" src={myQrDataUrl} alt="あなたの接続QR" />
						{#if myHandle}<p class="my-qr-name">{myHandle}</p>{/if}
					{:else}
						<p class="scan-hint">まだ夜行人プロフィールがありません。<br />作成すると接続QRが発行されます。</p>
						<a href="{base}/yakonin/setup" class="my-qr-cta">夜行人プロフィールを作る →</a>
					{/if}
					<button class="scan-toggle" onclick={backToScan}>← カメラに戻る</button>
				{:else}
					<!-- カメラでスキャン -->
					<h2>接続QRを読み取る</h2>
					<p class="scan-hint">相手のプロフィールQR、または屋台のQRをかざしてください</p>
					<div id="net-qr-reader"></div>
					{#if scanError}<p class="scan-err">{scanError}</p>{/if}
					<button class="scan-toggle" onclick={showMine}>マイQRを表示</button>
					<button class="scan-cancel" onclick={stopScan}>キャンセル</button>
				{/if}
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
	.legend { display: flex; gap: 7px; flex-wrap: wrap; justify-content: flex-end; pointer-events: auto; }
	.lg-static {
		display: inline-flex; align-items: center; gap: 6px; font-size: 0.7rem; color: var(--ink-2);
		background: rgba(255,253,247,0.92); box-shadow: var(--shadow-1);
		padding: 6px 12px; border-radius: 100px; border: 1px solid var(--line); letter-spacing: 0.04em;
	}
	.lg-static i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

	.seed-note {
		position: absolute; top: 58px; left: 50%; transform: translateX(-50%); z-index: 5;
		background: rgba(43,51,64,0.9); color: #efe7d8; font-size: 0.72rem;
		padding: 6px 13px; border-radius: 100px; white-space: nowrap; letter-spacing: 0.03em;
	}

	/* 「+」FAB＋メニュー */
	.connect-fab {
		position: absolute; right: 16px; z-index: 8;
		bottom: calc(20px + 64px + env(safe-area-inset-bottom, 0));
		width: 56px; height: 56px; border-radius: 50%;
		background: var(--night); color: #f3ece0; border: none;
		font-size: 1.7rem; line-height: 1; cursor: pointer; box-shadow: var(--shadow-2);
		display: flex; align-items: center; justify-content: center;
		transition: transform 0.2s, background 0.15s;
	}
	.connect-fab:hover { background: var(--night-2); }
	.connect-fab.open { transform: rotate(45deg); }
	.fab-overlay { position: absolute; inset: 0; z-index: 7; }
	.fab-menu {
		position: absolute; right: 16px; z-index: 9;
		bottom: calc(86px + 64px + env(safe-area-inset-bottom, 0));
		background: var(--surface); border: 1px solid var(--line); border-radius: 14px;
		box-shadow: var(--shadow-2); padding: 6px; display: flex; flex-direction: column; min-width: 240px;
	}
	.fab-item {
		display: flex; align-items: center; gap: 10px; padding: 13px 15px; border-radius: 10px;
		font-size: 0.9rem; font-weight: 600; color: var(--ink); text-decoration: none;
		background: none; border: none; cursor: pointer; font-family: inherit; text-align: left; width: 100%;
	}
	.fab-item:hover { background: var(--surface-sunk); }
	.fab-item :global(.icon) { color: var(--accent); }

	/* マイQR / 切り替え */
	.my-qr-img {
		width: 100%; max-width: 240px; aspect-ratio: 1 / 1;
		display: block; margin: 4px auto 8px; border-radius: 12px;
		border: 1px solid var(--line);
	}
	.my-qr-name {
		font-family: "Zen Antique", serif; font-size: 0.95rem;
		color: var(--ink); letter-spacing: 0.06em; margin: 0 0 6px; text-align: center;
	}
	.my-qr-cta {
		display: inline-block; margin: 8px 0; color: var(--accent);
		font-size: 0.86rem; text-decoration: none; font-weight: 600;
	}
	.my-qr-cta:hover { text-decoration: underline; }
	.scan-toggle {
		margin-top: 12px; width: 100%;
		background: var(--accent); color: #fff; border: none;
		border-radius: var(--r-md); padding: 11px 20px; font-size: 0.86rem;
		letter-spacing: 0.06em; cursor: pointer; font-family: "Zen Antique", serif;
		transition: background 0.15s;
	}
	.scan-toggle:hover { background: var(--accent-deep); }

	/* 詳細パネル */
	.detail {
		position: absolute; left: 14px; right: 14px; bottom: calc(82px + 64px + env(safe-area-inset-bottom, 0)); z-index: 7;
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
	.detail-name { font-family: "Zen Antique", serif; font-size: 1.15rem; letter-spacing: 0.06em; color: var(--ink); margin: 0; display: inline-flex; align-items: center; gap: 6px; }
	.corp-badge { display: inline-flex; color: #b5892e; }
	.detail-deg { font-size: 0.76rem; color: var(--ink-3); margin: 4px 0 0; letter-spacing: 0.03em; }
	.roles { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; }
	.role-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 0.74rem; color: var(--ink-2); letter-spacing: 0.05em; }
	.role-chip::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--dot, #6b7688); }
	.role-chip.corp { --dot: #b5892e; color: #8a6a1e; font-weight: 700; }
	.detail-status { font-size: 0.85rem; color: var(--ink-2); margin: 14px 0 0; letter-spacing: 0.03em; }
	.detail-msg { font-size: 0.9rem; color: var(--ink-2); margin: 8px 0 0; line-height: 1.7; font-style: italic; }

	/* 法人広告（PR） */
	.detail-ad { margin-top: 16px; padding: 14px; border-radius: 12px; background: rgba(181,137,46,0.08); border: 1px solid rgba(181,137,46,0.3); }
	.ad-label { display: inline-flex; align-items: center; gap: 4px; font-size: 0.62rem; font-weight: 700; letter-spacing: 0.08em; color: #8a6a1e; background: rgba(181,137,46,0.16); padding: 2px 8px; border-radius: 20px; }
	.ad-image { display: block; width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; margin: 10px 0 0; }
	.ad-headline { font-size: 0.92rem; color: var(--ink); font-weight: 600; line-height: 1.6; margin: 10px 0 0; }
	.ad-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
	.ad-link { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; text-decoration: none; padding: 7px 12px; border-radius: 8px; }
	.ad-link.store { background: var(--accent); color: #fff; }
	.ad-link.store:hover { background: var(--accent-deep); }
	.ad-link.recruit { background: none; color: var(--ink); border: 1px solid var(--line-strong); }
	.ad-link.recruit:hover { border-color: var(--accent); color: var(--accent); }
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
		position: fixed; inset: 0; z-index: 1600; background: rgba(38,32,25,0.72);
		display: flex; align-items: flex-start; justify-content: center;
		padding: 20px 20px calc(20px + env(safe-area-inset-bottom, 0));
		overflow-y: auto; -webkit-overflow-scrolling: touch;
	}
	.scan-card {
		background: var(--surface); border-radius: var(--r-lg); padding: 22px; width: 100%; max-width: 360px;
		margin: auto; text-align: center;
	}
	.scan-card h2 { font-family: "Zen Antique", serif; font-size: 1.05rem; letter-spacing: 0.08em; color: var(--ink); margin: 0 0 6px; }
	.scan-hint { font-size: 0.8rem; color: var(--ink-3); margin: 0 0 14px; line-height: 1.6; }
	#net-qr-reader { width: 100%; border-radius: 12px; overflow: hidden; }
	.scan-err { color: #b0402c; font-size: 0.82rem; margin: 10px 0 0; }
	.scan-cancel { margin-top: 14px; background: none; border: 1px solid var(--line-strong); color: var(--ink-2); border-radius: var(--r-md); padding: 11px 20px; font-size: 0.86rem; letter-spacing: 0.06em; cursor: pointer; width: 100%; font-family: "Zen Antique", serif; }
</style>
