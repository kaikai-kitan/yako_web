<script>
	import { onMount } from 'svelte';
	import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
	import { fade, fly } from 'svelte/transition';
	import { base } from '$app/paths';

	// --- ステート管理 (Svelte 5) ---
	let mapContainer = $state();
	let mapInstance = $state();
	let markers = $state([]);
	
	// アプリの現在の画面状態
	// 'map': マップ探索, 'detail': 詳細確認, 'qr': 解錠QR, 'active': 利用中(販売管理), 'return': 返却・撮影, 'finish': 完了, 'dashboard': オーナーダッシュボード
	let currentView = $state('map');
	
	// マップのフィルターモード ('available': 予約可能, 'active': 出店中)
	let mapMode = $state('available');
	
	// 選択中の屋台データ
	let selectedStall = $state(null);
	
	// 販売管理用データ
	let salesData = $state({
		beer: 0,
		yakisoba: 0,
		oden: 0
	});

	// --- モックデータ ---
	const stalls = [
		{ id: 1, name: '屋台壱号 (木製)', lat: 35.009, lng: 135.772, status: 'available', price: 3000, image: 'https://images.unsplash.com/photo-1565610222536-ef125c59da2e?w=400', specs: '幅1.8m / 電源あり / 提灯付き' },
		{ id: 2, name: '屋台弐号 (軽量)', lat: 35.010, lng: 135.771, status: 'available', price: 2500, image: 'https://images.unsplash.com/photo-1590554067425-961099e2329e?w=400', specs: '幅1.5m / 電源なし / リヤカー牽引可' },
		{ id: 3, name: '鴨川珈琲 (出店中)', lat: 35.008, lng: 135.773, status: 'active', owner: '田中 太郎', genre: 'カフェ', image: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=400' }
	];

	// --- ダッシュボード用データ ---
	const dashboardData = {
		totalSales: 328000,
		lastMonthSales: 290000,
		occupancyRate: 85,
		graphData: [12000, 18000, 15000, 22000, 28000, 25000, 35000], // 直近7日間の売上推移
		recentReservations: [
			{ id: 1, user: '鈴木 花子', date: '2023-10-25', stall: '屋台壱号', amount: 15000 },
			{ id: 2, user: '佐藤 健', date: '2023-10-24', stall: '屋台弐号', amount: 12000 },
		]
	};

	// グラフのポイント計算
	function getGraphPoints(data) {
		const max = Math.max(...data, 1);
		
		return data.map((val, i) => {
			const x = (i / (data.length - 1)) * 300; // viewBox width 300
			const y = 100 - (val / max) * 80; // 下余白を残して反転
			return `${x},${y}`;
		}).join(' ');
	}

	// --- マップ初期化 ---
	onMount(async () => {
		setOptions({
			apiKey: "AIzaSyD9qThdWskVygclntIA6Elzm3tE_tc0JW4", // ★★★ ここにAPIキーを設定してください ★★★
			version: "weekly",
			libraries: ["maps", "marker"]
		});

		try {
			const { Map } = await importLibrary("maps");
			// マーカーライブラリも読み込んでおく
			await importLibrary("marker");

			mapInstance = new Map(mapContainer, {
				center: { lat: 35.009, lng: 135.772 },
				zoom: 16,
				disableDefaultUI: true, // アプリっぽくするためにUIを消す
				mapId: "dc1ab66880d245ef156be95a", // ★★★ ここにマップIDを設定してください ★★★
				styles: [
					{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
				]
			});

			updateMarkers(mapInstance);
		} catch (e) {
			console.error("Google Maps Load Error:", e);
		}
	});

	// マーカーの更新処理
	function updateMarkers(map) {
		if (!map) return;

		// 既存マーカー削除
		markers.forEach(m => m.setMap(null));
		markers = [];

		const filteredStalls = stalls.filter(s => s.status === mapMode);

		filteredStalls.forEach(stall => {
			// google.maps.Marker はレガシーですが、ここではシンプルさのために使用します。
			// AdvancedMarkerElement を使う場合は mapId が必須です。
			const marker = new google.maps.Marker({
				position: { lat: stall.lat, lng: stall.lng },
				map: map,
				title: stall.name,
				icon: {
					url: mapMode === 'available' 
						? 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' 
						: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
				}
			});

			marker.addListener('click', () => {
				selectedStall = stall;
				// マップの中心をマーカーに合わせるなどの演出も可能
				// map.panTo(marker.getPosition());
			});

			markers.push(marker);
		});
	}

	// モード切り替え
	function toggleMode() {
		mapMode = mapMode === 'available' ? 'active' : 'available';
		selectedStall = null;
		updateMarkers(mapInstance);
	}

	// --- アクションハンドラー ---

	function goReserve() {
		currentView = 'qr';
	}

	function unlockStall() {
		// QR解錠シミュレーション
		setTimeout(() => {
			currentView = 'active';
		}, 1000);
	}

	function startReturn() {
		currentView = 'return';
	}

	function finishReturn() {
		// 写真撮影・決済・完了シミュレーション
		currentView = 'finish';
		setTimeout(() => {
			// リセットしてマップへ
			currentView = 'map';
			selectedStall = null;
			salesData = { beer: 0, yakisoba: 0, oden: 0 };
		}, 3000);
	}

	function closeDetail() {
		selectedStall = null;
	}
</script>

<div class="app-container">
	<!-- ヘッダー (マップ画面のみ表示) -->
	{#if currentView === 'map'}
		<header class="app-header">
			<div class="toggle-switch" onclick={toggleMode} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleMode()}>
				<div class="toggle-bg" style="left: {mapMode === 'available' ? '2px' : '50%'};"></div>
				<span class:active={mapMode === 'available'}>予約可能</span>
				<span class:active={mapMode === 'active'}>出店中</span>
			</div>
		</header>
	{/if}

	<!-- メインコンテンツエリア -->
	<main class="app-main">
		<!-- マップレイヤー (常に裏にいるが、Viewによって隠れる) -->
		<div class="map-layer" class:hidden={currentView !== 'map'}>
			<div class="map-canvas" bind:this={mapContainer}></div>
		</div>

		<!-- 1. 詳細パネル (Bottom Sheet) -->
		{#if currentView === 'map' && selectedStall}
			<div class="bottom-sheet" transition:fly={{ y: 300, duration: 300 }}>
				<button class="close-btn" onclick={closeDetail}>×</button>
				<div class="sheet-content">
					<img src={selectedStall.image} alt={selectedStall.name} class="stall-thumb">
					<div class="stall-info">
						<h3>{selectedStall.name}</h3>
						{#if mapMode === 'available'}
							<p class="specs">{selectedStall.specs}</p>
							<p class="price">¥{selectedStall.price.toLocaleString()} / 泊</p>
							<button class="action-btn primary" onclick={goReserve}>予約へ進む</button>
						{:else}
							<p class="owner">店主: {selectedStall.owner}</p>
							<p class="genre">ジャンル: {selectedStall.genre}</p>
							<button class="action-btn secondary">プロフィールを見る</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- 2. QR解錠画面 -->
		{#if currentView === 'qr'}
			<div class="full-screen-modal" transition:fade>
				<div class="qr-container">
					<h2>屋台のロック解除</h2>
					<p>屋台に付いているQRコードを読み取ってください</p>
					<div class="qr-box">
						<!-- カメラ映像のモック -->
						<div class="qr-scanner-mock">
							<div class="scan-line"></div>
						</div>
					</div>
					<button class="action-btn primary" onclick={unlockStall}>
						(デモ) ロック解除成功
					</button>
					<button class="text-btn" onclick={() => currentView = 'map'}>キャンセル</button>
				</div>
			</div>
		{/if}

		<!-- 3. 利用中・販売管理画面 -->
		{#if currentView === 'active'}
			<div class="active-dashboard" transition:fly={{ x: 300, duration: 300 }}>
				<div class="status-bar">
					<span class="blinking">●</span> 貸出中: {selectedStall?.name}
				</div>
				
				<div class="sales-form">
					<h3>本日の売上入力</h3>
					<div class="input-group">
						<label for="beer-count">🍺 クラフトビール</label>
						<div class="stepper">
							<button onclick={() => salesData.beer = Math.max(0, salesData.beer - 1)}>-</button>
							<span id="beer-count">{salesData.beer}</span>
							<button onclick={() => salesData.beer++}>+</button>
						</div>
					</div>
					<div class="input-group">
						<label for="yakisoba-count">🍝 焼きそば</label>
						<div class="stepper">
							<button onclick={() => salesData.yakisoba = Math.max(0, salesData.yakisoba - 1)}>-</button>
							<span id="yakisoba-count">{salesData.yakisoba}</span>
							<button onclick={() => salesData.yakisoba++}>+</button>
						</div>
					</div>
					
					<div class="total-sales">
						推定売上: ¥{(salesData.beer * 800 + salesData.yakisoba * 600).toLocaleString()}
					</div>
				</div>

				<button class="action-btn danger return-btn" onclick={startReturn}>
					屋台を返却する
				</button>
			</div>
		{/if}

		<!-- 4. 返却・写真撮影画面 -->
		{#if currentView === 'return'}
			<div class="full-screen-modal" transition:fade>
				<h2>返却確認</h2>
				<p>元の位置に戻し、写真を撮影してください。</p>
				<div class="camera-mock">
					<div class="shutter-btn" onclick={finishReturn} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && finishReturn()}></div>
				</div>
				<p class="note">撮影すると自動で決済されます</p>
			</div>
		{/if}

		<!-- 5. 完了画面 -->
		{#if currentView === 'finish'}
			<div class="full-screen-modal finish-screen" transition:fade>
				<div class="success-icon">✓</div>
				<h2>ご利用ありがとうございました</h2>
				<p>決済が完了しました。</p>
				<p>またのご利用をお待ちしております。</p>
			</div>
		{/if}

		<!-- 6. オーナーダッシュボード -->
		{#if currentView === 'dashboard'}
			<div class="dashboard-screen" transition:fade>
				<h2 class="dashboard-title">オーナーダッシュボード</h2>
				
				<!-- KPIカード -->
				<div class="kpi-container">
					<div class="kpi-card highlight">
						<span class="kpi-label">今月の売上</span>
						<span class="kpi-value">¥{dashboardData.totalSales.toLocaleString()}</span>
						<span class="kpi-diff">先月比 +13% ↗</span>
					</div>
					<div class="kpi-card">
						<span class="kpi-label">稼働率</span>
						<span class="kpi-value">{dashboardData.occupancyRate}%</span>
					</div>
				</div>

				<!-- 売上推移グラフ -->
				<div class="chart-container">
					<h3>売上推移 (直近7日間)</h3>
					<div class="chart-wrapper">
						<svg viewBox="0 0 300 100" class="sales-chart">
							<!-- グリッド線 -->
							<line x1="0" y1="20" x2="300" y2="20" stroke="#e2e8f0" stroke-width="1" />
							<line x1="0" y1="60" x2="300" y2="60" stroke="#e2e8f0" stroke-width="1" />
							<line x1="0" y1="100" x2="300" y2="100" stroke="#e2e8f0" stroke-width="1" />
							
							<!-- 折れ線 -->
							<polyline 
								points={getGraphPoints(dashboardData.graphData)} 
								fill="none" 
								stroke="#facc15" 
								stroke-width="3" 
								stroke-linecap="round" 
								stroke-linejoin="round"
							/>
							
							<!-- データポイント -->
							{#each dashboardData.graphData as val, i}
								{@const max = Math.max(...dashboardData.graphData)}
								{@const x = (i / (dashboardData.graphData.length - 1)) * 300}
								{@const y = 100 - (val / max) * 80}
								<circle cx={x} cy={y} r="4" fill="#0f172a" stroke="#facc15" stroke-width="2" />
							{/each}
						</svg>
					</div>
				</div>

				<!-- 最近の履歴 -->
				<div class="history-list">
					<h3>最近の利用履歴</h3>
					{#each dashboardData.recentReservations as item}
						<div class="history-item">
							<div class="history-icon">🏮</div>
							<div class="history-info">
								<div class="history-main">{item.stall}</div>
								<div class="history-sub">{item.date} - {item.user}</div>
							</div>
							<div class="history-amount">+¥{item.amount.toLocaleString()}</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</main>

	<!-- ボトムナビゲーション (マップとダッシュボードで表示) -->
	{#if ['map', 'dashboard'].includes(currentView)}
		<nav class="bottom-nav">
			<button class="nav-item" class:active={currentView === 'map'} onclick={() => currentView = 'map'}>
				<img src="{base}/images/map_icon/calendar.jpg" alt="予約確認" class="nav-icon" />
				<span>予約確認</span>
			</button>
			<button class="nav-item">
				<img src="{base}/images/map_icon/yatainin.jpg" alt="プロフィール" class="nav-icon" />
				<span>プロフィール</span>
			</button>
			<button class="nav-item" class:active={currentView === 'dashboard'} onclick={() => currentView = 'dashboard'}>
				<img src="{base}/images/map_icon/earn_money.jpg" alt="今月の売上" class="nav-icon" />
				<span>今月の売上</span>
			</button>
		</nav>
	{/if}
</div>

<style>
	:global(body) { margin: 0; padding: 0; font-family: sans-serif; }

	.app-container {
		width: 100%;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #f1f5f9;
		position: relative;
		overflow: hidden;
	}

	/* Header */
	.app-header {
		position: absolute;
		top: 80px; /* ナビゲーションバーの下に来るように調整 */
		right: 20px;
		z-index: 10;
	}

	.toggle-switch {
		background: white;
		border-radius: 30px;
		padding: 4px;
		display: flex;
		position: relative;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		cursor: pointer;
		width: 200px;
		height: 40px;
		align-items: center;
	}

	.toggle-bg {
		position: absolute;
		width: 50%;
		height: 80%;
		background: #0f172a;
		border-radius: 25px;
		transition: left 0.3s ease;
	}

	.toggle-switch span {
		flex: 1;
		text-align: center;
		z-index: 1;
		font-size: 0.85rem;
		font-weight: bold;
		color: #64748b;
		transition: color 0.3s;
	}

	.toggle-switch span.active { color: white; }

	/* Main Map */
	.app-main { flex: 1; position: relative; }
	.map-layer { width: 100%; height: 100%; }
	.map-canvas { width: 100%; height: 100%; }

	/* Bottom Sheet */
	.bottom-sheet {
		position: absolute;
		bottom: 90px; /* Nav height + margin */
		left: 10px;
		right: 10px;
		background: white;
		border-radius: 16px;
		padding: 20px;
		box-shadow: 0 10px 25px rgba(0,0,0,0.2);
		z-index: 20;
	}

	.close-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
	}

	.sheet-content { display: flex; gap: 15px; }
	.stall-thumb { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; }
	.stall-info { flex: 1; }
	.stall-info h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
	.specs, .owner { font-size: 0.8rem; color: #64748b; margin: 0; }
	.price { font-weight: bold; font-size: 1.1rem; margin: 5px 0; }

	.action-btn {
		width: 100%;
		padding: 10px;
		border: none;
		border-radius: 8px;
		font-weight: bold;
		cursor: pointer;
		margin-top: 10px;
	}
	.action-btn.primary { background: #facc15; color: #0f172a; }
	.action-btn.secondary { background: #e2e8f0; color: #0f172a; }
	.action-btn.danger { background: #ef4444; color: white; }

	.text-btn {
		background: none; border: none; color: white;
		text-decoration: underline; cursor: pointer; margin-top: 15px;
	}

	/* Full Screen Modals (QR, Return, Finish) */
	.full-screen-modal {
		position: absolute;
		top: 0; left: 0; width: 100%; height: 100%;
		background: #0f172a;
		color: white;
		z-index: 100;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 20px;
		box-sizing: border-box;
	}

	.qr-container { text-align: center; }

	.qr-box {
		width: 250px; height: 250px;
		border: 4px solid #facc15;
		margin: 30px auto;
		position: relative;
		background: rgba(255,255,255,0.1);
	}

	.scan-line {
		width: 100%; height: 2px; background: #facc15;
		position: absolute; top: 0;
		animation: scan 2s infinite;
	}

	@keyframes scan { 0% {top: 0;} 100% {top: 100%;} }

	/* Active Dashboard */
	.active-dashboard {
		position: absolute;
		top: 0; left: 0; width: 100%; height: 100%;
		background: white;
		z-index: 50;
		padding: 20px;
		padding-top: 80px; /* Header space */
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.status-bar {
		background: #dcfce7; color: #166534;
		padding: 10px; border-radius: 8px;
		font-weight: bold; text-align: center;
		margin-bottom: 30px;
	}
	.blinking { animation: blink 1s infinite; }
	@keyframes blink { 50% { opacity: 0; } }

	.input-group {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 20px; padding: 15px;
		background: #f8fafc; border-radius: 12px;
	}
	.stepper { display: flex; align-items: center; gap: 15px; }
	.stepper button {
		width: 30px; height: 30px; border-radius: 50%;
		border: 1px solid #cbd5e1; background: white;
		cursor: pointer;
	}
	.total-sales {
		font-size: 1.5rem; font-weight: bold; text-align: right;
		margin-top: 20px; border-top: 2px solid #f1f5f9; padding-top: 20px;
	}
	.return-btn { margin-top: auto; }

	/* Camera Mock */
	.camera-mock {
		width: 100%; height: 60%; background: #334155;
		margin: 20px 0; border-radius: 12px;
		display: flex; align-items: flex-end; justify-content: center;
		padding-bottom: 20px;
	}
	.shutter-btn {
		width: 60px; height: 60px; border-radius: 50%;
		background: white; border: 4px solid #94a3b8;
		cursor: pointer;
	}

	/* Finish Screen */
	.finish-screen { background: #10b981; }
	.success-icon { font-size: 4rem; margin-bottom: 20px; }

	/* Bottom Nav */
	.bottom-nav {
		height: 70px;
		background: white;
		display: flex;
		justify-content: space-around;
		align-items: center;
		border-top: 1px solid #e2e8f0;
		z-index: 30;
	}

	.nav-item {
		background: none; border: none;
		display: flex; flex-direction: column; align-items: center;
		color: #94a3b8; font-size: 0.7rem; gap: 4px;
		cursor: pointer;
	}
	.nav-item.active { color: #0f172a; }
	.nav-icon {
		width: 24px;
		height: 24px;
		object-fit: contain;
	}

	/* Dashboard Styles */
	.dashboard-screen {
		width: 100%;
		height: 100%;
		background: #f8fafc;
		padding: 20px;
		padding-top: 80px; /* Header space */
		box-sizing: border-box;
		overflow-y: auto;
		padding-bottom: 80px; /* Nav space */
	}

	.dashboard-title { margin-top: 0; color: #0f172a; font-size: 1.5rem; }

	.kpi-container {
		display: flex; gap: 15px; margin-bottom: 25px;
	}
	.kpi-card {
		flex: 1; background: white; padding: 15px;
		border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
		display: flex; flex-direction: column;
	}
	.kpi-card.highlight { background: #0f172a; color: white; }
	.kpi-card.highlight .kpi-label { color: #94a3b8; }
	.kpi-card.highlight .kpi-diff { color: #facc15; font-size: 0.8rem; margin-top: 5px; }
	
	.kpi-label { font-size: 0.8rem; color: #64748b; margin-bottom: 5px; }
	.kpi-value { font-size: 1.4rem; font-weight: bold; }

	.chart-container {
		background: white; padding: 20px; border-radius: 16px;
		margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
	}
	.chart-container h3 { margin: 0 0 15px 0; font-size: 1rem; color: #334155; }
	.chart-wrapper { width: 100%; }
	.sales-chart { width: 100%; height: auto; overflow: visible; }

	.history-list h3 { font-size: 1rem; color: #334155; margin-bottom: 15px; }
	.history-item {
		display: flex; align-items: center; gap: 15px;
		background: white; padding: 15px; border-radius: 12px;
		margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
	}
	.history-icon {
		width: 40px; height: 40px; background: #fef9c3;
		border-radius: 50%; display: flex; align-items: center; justify-content: center;
		font-size: 1.2rem;
	}
	.history-info { flex: 1; }
	.history-main { font-weight: bold; font-size: 0.95rem; }
	.history-sub { font-size: 0.8rem; color: #64748b; }
	.history-amount { font-weight: bold; color: #166534; }
</style>
