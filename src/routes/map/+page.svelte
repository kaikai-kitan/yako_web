<script>
	import { onMount } from 'svelte';
	import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
	import { fade, fly } from 'svelte/transition';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import {
		getActiveStalls,
		getAvailableSpaces,
		getAvailableStallPins,
		getAvailableStallsList,
		createReservation
	} from '$lib/db.js';

	// --- ステート管理 ---
	let mapContainer = $state();
	let mapInstance = $state();
	let markers = $state([]);

	// 'map' | 'reserve' | 'qr' | 'active' | 'return' | 'finish'
	let currentView = $state('map');
	let isDashboardOpen = $state(false);
	let mapMode = $state('available'); // 'available' | 'active'
	let selectedStall = $state(null);
	let currentUser = $state(null);

	// DBデータ
	let availableSpaces = $state([]);
	let activeStalls = $state([]);
	let stallPins = $state([]);          // 屋台提供者がピン登録した屋台
	let availableStallsList = $state([]); // 予約フォーム用ドロップダウン
	let isLoading = $state(true);
	let fetchError = $state('');

	// 販売管理
	let salesData = $state({ beer: 0, yakisoba: 0, oden: 0 });

	// 予約フォーム
	let reservationForm = $state({
		spaceId: null,
		spaceName: '',
		stallId: '',
		startDate: '',
		startTime: '10:00',
		endDate: '',
		endTime: '22:00',
		plannedItems: ''
	});
	let reservationError = $state('');
	let isReserving = $state(false);
	let reservationSuccess = $state(false);

	// ダッシュボード（TODO: Supabaseから取得）
	let dashboardData = $state({
		totalSales: 0, occupancyRate: 0,
		graphData: [0, 0, 0, 0, 0, 0, 0], recentReservations: []
	});

	function getGraphPoints(data) {
		if (!data || data.length < 2) return '';
		const max = Math.max(...data, 1);
		return data.map((val, i) => {
			const x = (i / (data.length - 1)) * 300;
			const y = 100 - (val / max) * 80;
			return `${x},${y}`;
		}).join(' ');
	}

	let isApiInitialized = false;

	onMount(async () => {
		// 認証状態を取得
		const { data: { session } } = await supabase.auth.getSession();
		currentUser = session?.user ?? null;

		// DBデータを取得
		try {
			const [spaces, stalls, stallPinsData, stallsListData] = await Promise.all([
				getAvailableSpaces(),
				getActiveStalls(),
				getAvailableStallPins(),
				getAvailableStallsList()
			]);
			availableSpaces = spaces;
			activeStalls = stalls;
			stallPins = stallPinsData;
			availableStallsList = stallsListData;
		} catch (e) {
			console.error('DB fetch error:', e);
			fetchError = e.message.includes('未設定')
				? 'Supabase 未設定: .env の設定を確認してください'
				: 'データの取得に失敗しました';
		} finally {
			isLoading = false;
		}

		// Google Maps 初期化
		try {
			if (!isApiInitialized) {
				setOptions({
					apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
					version: 'weekly',
					libraries: ['maps', 'marker']
				});
				isApiInitialized = true;
			}
			const { Map } = await importLibrary('maps');
			const { AdvancedMarkerElement } = await importLibrary('marker');
			mapInstance = new Map(mapContainer, {
				center: { lat: 35.009, lng: 135.772 },
				zoom: 16,
				disableDefaultUI: true,
				mapId: 'dc1ab66880d245ef156be95a'
			});
			updateMarkers(mapInstance, AdvancedMarkerElement);
		} catch (e) {
			console.error('Google Maps Load Error:', e);
		}
	});

	// マーカー更新
	async function updateMarkers(map, AdvancedMarkerElement) {
		if (!map) return;
		if (!AdvancedMarkerElement) {
			const lib = await importLibrary('marker');
			AdvancedMarkerElement = lib.AdvancedMarkerElement;
		}

		markers.forEach((m) => m.setMap(null));
		markers = [];

		if (mapMode === 'available') {
			// 青ピン: 予約可能スペース
			availableSpaces.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const icon = document.createElement('img');
				icon.src = 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
				const marker = new AdvancedMarkerElement({
					map, position: { lat: stall.lat, lng: stall.lng },
					title: stall.name, content: icon
				});
				marker.addListener('click', () => { selectedStall = stall; });
				markers.push(marker);
			});

			// 黄ピン: 屋台提供者がピン登録した屋台
			stallPins.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const icon = document.createElement('img');
				icon.src = 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png';
				const marker = new AdvancedMarkerElement({
					map, position: { lat: stall.lat, lng: stall.lng },
					title: stall.name, content: icon
				});
				marker.addListener('click', () => { selectedStall = stall; });
				markers.push(marker);
			});
		} else {
			// 赤ピン: 出店中
			activeStalls.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const icon = document.createElement('img');
				icon.src = 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
				const marker = new AdvancedMarkerElement({
					map, position: { lat: stall.lat, lng: stall.lng },
					title: stall.name, content: icon
				});
				marker.addListener('click', () => { selectedStall = stall; });
				markers.push(marker);
			});
		}
	}

	function toggleMode() {
		mapMode = mapMode === 'available' ? 'active' : 'available';
		selectedStall = null;
		updateMarkers(mapInstance, null);
	}

	// 予約フォームを開く（スペースピンから）
	function goReserve() {
		reservationForm = {
			spaceId: selectedStall?.id ?? null,
			spaceName: selectedStall?.name ?? '',
			stallId: '',
			startDate: '', startTime: '10:00',
			endDate: '', endTime: '22:00',
			plannedItems: ''
		};
		reservationError = '';
		reservationSuccess = false;
		currentView = 'reserve';
	}

	// 予約フォームを開く（屋台ピンから）
	function goReserveFromStall() {
		reservationForm = {
			spaceId: null, spaceName: '',
			stallId: selectedStall?.id ?? '',
			startDate: '', startTime: '10:00',
			endDate: '', endTime: '22:00',
			plannedItems: ''
		};
		reservationError = '';
		reservationSuccess = false;
		currentView = 'reserve';
	}

	async function submitReservation() {
		reservationError = '';
		if (!reservationForm.stallId) {
			reservationError = '使用する屋台を選択してください'; return;
		}
		if (!reservationForm.spaceId) {
			reservationError = '利用するスペースを選択してください'; return;
		}
		if (!reservationForm.startDate || !reservationForm.endDate) {
			reservationError = '利用日を入力してください'; return;
		}

		isReserving = true;
		try {
			const startDatetime = `${reservationForm.startDate}T${reservationForm.startTime}:00`;
			const endDatetime = `${reservationForm.endDate}T${reservationForm.endTime}:00`;
			await createReservation(currentUser.id, {
				rentalSpaceId: reservationForm.spaceId,
				stallId: reservationForm.stallId,
				startDatetime, endDatetime,
				plannedItems: reservationForm.plannedItems
			});
			reservationSuccess = true;
			setTimeout(() => {
				currentView = 'map';
				selectedStall = null;
				reservationSuccess = false;
			}, 2000);
		} catch (e) {
			reservationError = '予約に失敗しました: ' + e.message;
		} finally {
			isReserving = false;
		}
	}

	function unlockStall() {
		setTimeout(() => { currentView = 'active'; }, 1000);
	}

	function startReturn() { currentView = 'return'; }

	function finishReturn() {
		currentView = 'finish';
		setTimeout(() => {
			currentView = 'map';
			selectedStall = null;
			salesData = { beer: 0, yakisoba: 0, oden: 0 };
		}, 3000);
	}

	function closeDetail() { selectedStall = null; }
</script>

<div class="app-container">
	<!-- ヘッダー（マップ画面のみ） -->
	{#if currentView === 'map'}
		<header class="app-header">
			<div class="toggle-switch" onclick={toggleMode} role="button" tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && toggleMode()}>
				<div class="toggle-bg" style="left: {mapMode === 'available' ? '2px' : '50%'};"></div>
				<span class:active={mapMode === 'available'}>予約可能</span>
				<span class:active={mapMode === 'active'}>出店中</span>
			</div>
		</header>
	{/if}

	<main class="app-main">
		<!-- マップレイヤー -->
		<div class="map-layer" class:hidden={currentView !== 'map'}>
			<div class="map-canvas" bind:this={mapContainer}></div>

			{#if isLoading}
				<div class="map-overlay">
					<div class="loading-spinner"></div>
					<p>データを読み込み中…</p>
				</div>
			{:else if fetchError}
				<div class="map-overlay error"><p>{fetchError}</p></div>
			{:else if mapMode === 'available' && availableSpaces.length === 0 && stallPins.length === 0}
				<div class="map-overlay info"><p>現在登録されているスペース・屋台はありません</p></div>
			{:else if mapMode === 'active' && activeStalls.length === 0}
				<div class="map-overlay info"><p>現在出店中の屋台はありません</p></div>
			{/if}

			<!-- ピン凡例 -->
			{#if currentView === 'map' && mapMode === 'available'}
				<div class="legend">
					<span class="legend-item">🔵 スペース</span>
					<span class="legend-item">🟡 屋台</span>
				</div>
			{/if}
		</div>

		<!-- 詳細パネル（Bottom Sheet） -->
		{#if currentView === 'map' && selectedStall}
			<div class="bottom-sheet" transition:fly={{ y: 300, duration: 300 }}>
				<button class="close-btn" onclick={closeDetail}>×</button>
				<div class="sheet-content">
					{#if selectedStall.image}
						<img src={selectedStall.image} alt={selectedStall.name} class="stall-thumb" />
					{:else}
						<div class="stall-thumb no-image">
							{selectedStall.status === 'stall' ? '🏮' : '📍'}
						</div>
					{/if}
					<div class="stall-info">
						<h3>{selectedStall.name}</h3>

						{#if selectedStall.status === 'stall'}
							<!-- 屋台ピン -->
							<p class="specs">提供者: {selectedStall.owner}</p>
							<p class="specs">{selectedStall.specs}</p>
							<p class="price">¥{(selectedStall.price ?? 0).toLocaleString()} / 日</p>
							{#if currentUser}
								<button class="action-btn primary" onclick={goReserveFromStall}>この屋台で予約する</button>
							{:else}
								<a href="{base}/auth" class="action-btn primary link-btn">ログインして予約する</a>
							{/if}

						{:else if mapMode === 'available'}
							<!-- スペースピン -->
							<p class="specs">{selectedStall.specs}</p>
							{#if selectedStall.address}
								<p class="specs">📍 {selectedStall.address}</p>
							{/if}
							<p class="price">¥{(selectedStall.price ?? 0).toLocaleString()} / 泊</p>
							{#if currentUser}
								<button class="action-btn primary" onclick={goReserve}>予約する</button>
							{:else}
								<a href="{base}/auth" class="action-btn primary link-btn">ログインして予約する</a>
							{/if}

						{:else}
							<!-- 出店中ピン -->
							<p class="owner">店主: {selectedStall.owner}</p>
							<p class="genre">ジャンル: {selectedStall.genre}</p>
							<button class="action-btn secondary">プロフィールを見る</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- 予約フォーム -->
		{#if currentView === 'reserve'}
			<div class="full-screen-modal reserve-modal" transition:fly={{ y: '100%', duration: 300 }}>
				<div class="reserve-header">
					<button class="back-text-btn" onclick={() => { currentView = 'map'; }}>← 戻る</button>
					<h2>予約する</h2>
				</div>

				{#if reservationSuccess}
					<div class="reserve-success">
						<div class="success-icon">✓</div>
						<p>予約が完了しました！</p>
					</div>
				{:else}
					<div class="reserve-form">
						<!-- スペース選択 -->
						<div class="form-section">
							<label class="form-label" for="space-select">
								利用するスペース <span class="req">*</span>
							</label>
							{#if reservationForm.spaceId}
								<div class="form-value">📍 {reservationForm.spaceName}</div>
							{:else}
								<select id="space-select" bind:value={reservationForm.spaceId} class="form-select">
									<option value={null}>スペースを選択してください</option>
									{#each availableSpaces as space}
										<option value={space.id}>{space.name}（{space.address ?? '住所未設定'}）</option>
									{/each}
								</select>
							{/if}
						</div>

						<!-- 屋台選択 -->
						<div class="form-section">
							<label class="form-label" for="stall-select">
								使用する屋台 <span class="req">*</span>
							</label>
							{#if reservationForm.stallId && selectedStall?.status === 'stall'}
								<div class="form-value">🏮 {selectedStall.name}</div>
							{:else}
								<select id="stall-select" bind:value={reservationForm.stallId} class="form-select">
									<option value="">屋台を選択してください</option>
									{#each availableStallsList as stall}
										<option value={stall.id}>
											{stall.stall_name}（{stall.operators?.business_name ?? ''}）
											— ¥{(stall.rental_fee ?? 0).toLocaleString()}/日
										</option>
									{/each}
								</select>
							{/if}
						</div>

						<!-- 利用開始 -->
						<div class="form-section">
							<label class="form-label">利用開始 <span class="req">*</span></label>
							<div class="date-row">
								<input type="date" bind:value={reservationForm.startDate} class="form-input" />
								<input type="time" bind:value={reservationForm.startTime} class="form-input time-input" />
							</div>
						</div>

						<!-- 利用終了 -->
						<div class="form-section">
							<label class="form-label">利用終了 <span class="req">*</span></label>
							<div class="date-row">
								<input type="date" bind:value={reservationForm.endDate} class="form-input" />
								<input type="time" bind:value={reservationForm.endTime} class="form-input time-input" />
							</div>
						</div>

						<!-- 提供品目 -->
						<div class="form-section">
							<label class="form-label" for="items-input">提供品目</label>
							<textarea
								id="items-input"
								bind:value={reservationForm.plannedItems}
								class="form-input form-textarea"
								placeholder="例: クラフトビール、焼きそば、たこ焼き"
								rows="3"
							></textarea>
						</div>

						{#if reservationError}
							<div class="form-error">{reservationError}</div>
						{/if}

						<button class="reserve-submit-btn" onclick={submitReservation} disabled={isReserving}>
							{isReserving ? '処理中…' : '予約を確定する'}
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<!-- QR解錠画面 -->
		{#if currentView === 'qr'}
			<div class="full-screen-modal" transition:fade>
				<div class="qr-container">
					<h2>屋台のロック解除</h2>
					<p>屋台に付いているQRコードを読み取ってください</p>
					<div class="qr-box">
						<div class="qr-scanner-mock"><div class="scan-line"></div></div>
					</div>
					<button class="action-btn primary" onclick={unlockStall}>(デモ) ロック解除成功</button>
					<button class="text-btn" onclick={() => (currentView = 'map')}>キャンセル</button>
				</div>
			</div>
		{/if}

		<!-- 利用中・販売管理画面 -->
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
							<button onclick={() => (salesData.beer = Math.max(0, salesData.beer - 1))}>-</button>
							<span id="beer-count">{salesData.beer}</span>
							<button onclick={() => salesData.beer++}>+</button>
						</div>
					</div>
					<div class="input-group">
						<label for="yakisoba-count">🍝 焼きそば</label>
						<div class="stepper">
							<button onclick={() => (salesData.yakisoba = Math.max(0, salesData.yakisoba - 1))}>-</button>
							<span id="yakisoba-count">{salesData.yakisoba}</span>
							<button onclick={() => salesData.yakisoba++}>+</button>
						</div>
					</div>
					<div class="total-sales">
						推定売上: ¥{(salesData.beer * 800 + salesData.yakisoba * 600).toLocaleString()}
					</div>
				</div>
				<button class="action-btn danger return-btn" onclick={startReturn}>屋台を返却する</button>
			</div>
		{/if}

		<!-- 返却・写真撮影画面 -->
		{#if currentView === 'return'}
			<div class="full-screen-modal" transition:fade>
				<h2>返却確認</h2>
				<p>元の位置に戻し、写真を撮影してください。</p>
				<div class="camera-mock">
					<div class="shutter-btn" onclick={finishReturn} role="button" tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && finishReturn()}></div>
				</div>
				<p class="note">撮影すると自動で決済されます</p>
			</div>
		{/if}

		<!-- 完了画面 -->
		{#if currentView === 'finish'}
			<div class="full-screen-modal finish-screen" transition:fade>
				<div class="success-icon">✓</div>
				<h2>ご利用ありがとうございました</h2>
				<p>決済が完了しました。</p>
			</div>
		{/if}

		<!-- ダッシュボードモーダル -->
		{#if isDashboardOpen}
			<div class="modal-overlay" transition:fade onclick={() => (isDashboardOpen = false)}
				role="button" tabindex="0" onkeydown={(e) => e.key === 'Escape' && (isDashboardOpen = false)}>
				<div class="modal-content dashboard-modal" onclick={(e) => e.stopPropagation()} role="document">
					<button class="close-btn" onclick={() => (isDashboardOpen = false)}>×</button>
					<h2 class="dashboard-title">オーナーダッシュボード</h2>
					<div class="kpi-container">
						<div class="kpi-card highlight">
							<span class="kpi-label">今月の売上</span>
							<span class="kpi-value">¥{dashboardData.totalSales.toLocaleString()}</span>
						</div>
						<div class="kpi-card">
							<span class="kpi-label">稼働率</span>
							<span class="kpi-value">{dashboardData.occupancyRate}%</span>
						</div>
					</div>
					<div class="chart-container">
						<h3>売上推移 (直近7日間)</h3>
						<svg viewBox="0 0 300 100" class="sales-chart">
							<line x1="0" y1="20" x2="300" y2="20" stroke="#e2e8f0" stroke-width="1" />
							<line x1="0" y1="60" x2="300" y2="60" stroke="#e2e8f0" stroke-width="1" />
							<polyline points={getGraphPoints(dashboardData.graphData)}
								fill="none" stroke="#facc15" stroke-width="3"
								stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</div>
					<div class="history-list">
						<h3>最近の利用履歴</h3>
						{#if dashboardData.recentReservations.length === 0}
							<p class="empty-history">利用履歴はありません</p>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</main>

	<!-- ボトムナビゲーション -->
	{#if currentView === 'map'}
		<nav class="bottom-nav">
			<button class="nav-item" class:active={!isDashboardOpen}
				onclick={() => { currentView = 'map'; isDashboardOpen = false; }}>
				<img src="{base}/images/map_icon/calendar.jpg" alt="予約確認" class="nav-icon" />
				<span>予約確認</span>
			</button>
			<a href="{base}/mypage" class="nav-item">
				<img src="{base}/images/map_icon/yatainin.jpg" alt="マイページ" class="nav-icon" />
				<span>マイページ</span>
			</a>
			<button class="nav-item" class:active={isDashboardOpen} onclick={() => (isDashboardOpen = true)}>
				<img src="{base}/images/map_icon/earn_money.jpg" alt="今月の売上" class="nav-icon" />
				<span>今月の売上</span>
			</button>
		</nav>
	{/if}
</div>

<style>
	:global(body) { margin: 0; padding: 0; font-family: sans-serif; }

	.app-container {
		width: 100%; height: 100vh;
		display: flex; flex-direction: column;
		background: #f1f5f9; position: relative; overflow: hidden;
	}

	.app-header {
		position: absolute; top: 80px; right: 20px; z-index: 10;
	}

	.toggle-switch {
		background: white; border-radius: 30px; padding: 4px;
		display: flex; position: relative;
		box-shadow: 0 4px 12px rgba(0,0,0,0.15);
		cursor: pointer; width: 200px; height: 40px; align-items: center;
	}
	.toggle-bg {
		position: absolute; width: 50%; height: 80%;
		background: #0f172a; border-radius: 25px; transition: left 0.3s ease;
	}
	.toggle-switch span {
		flex: 1; text-align: center; z-index: 1;
		font-size: 0.85rem; font-weight: bold; color: #64748b; transition: color 0.3s;
	}
	.toggle-switch span.active { color: white; }

	.app-main { flex: 1; position: relative; }
	.map-layer { width: 100%; height: 100%; }
	.map-canvas { width: 100%; height: 100%; }

	/* 凡例 */
	.legend {
		position: absolute; bottom: 100px; left: 12px;
		background: white; border-radius: 10px; padding: 8px 12px;
		display: flex; gap: 12px; font-size: 0.75rem; color: #475569;
		box-shadow: 0 2px 8px rgba(0,0,0,0.12); z-index: 15;
	}

	/* マップオーバーレイ */
	.map-overlay {
		position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
		background: white; border-radius: 12px; padding: 12px 20px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.15);
		display: flex; align-items: center; gap: 10px;
		font-size: 0.9rem; color: #475569; z-index: 15;
	}
	.map-overlay.error { background: #fee2e2; color: #dc2626; }
	.loading-spinner {
		width: 18px; height: 18px; border: 2px solid #e2e8f0;
		border-top-color: #facc15; border-radius: 50%; animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Bottom Sheet */
	.bottom-sheet {
		position: absolute; bottom: 90px; left: 10px; right: 10px;
		background: white; border-radius: 16px; padding: 20px;
		box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 20;
	}
	.close-btn {
		position: absolute; top: 10px; right: 10px;
		background: none; border: none; font-size: 1.5rem; cursor: pointer;
	}
	.sheet-content { display: flex; gap: 15px; }
	.stall-thumb { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.stall-thumb.no-image {
		background: #fef9c3; display: flex; align-items: center;
		justify-content: center; font-size: 2rem;
	}
	.stall-info { flex: 1; }
	.stall-info h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
	.specs, .owner, .genre { font-size: 0.8rem; color: #64748b; margin: 2px 0; }
	.price { font-weight: bold; font-size: 1.1rem; margin: 5px 0; }

	.action-btn {
		width: 100%; padding: 10px; border: none; border-radius: 8px;
		font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 0.9rem;
	}
	.action-btn.primary { background: #facc15; color: #0f172a; }
	.action-btn.secondary { background: #e2e8f0; color: #0f172a; }
	.action-btn.danger { background: #ef4444; color: white; }
	.link-btn { display: block; text-decoration: none; text-align: center; }

	/* 予約フォーム */
	.reserve-modal {
		background: white; overflow-y: auto;
		flex-direction: column; align-items: stretch;
		padding: 0; justify-content: flex-start;
	}
	.reserve-header {
		display: flex; align-items: center; gap: 12px;
		padding: 16px 20px; border-bottom: 1px solid #e2e8f0;
		background: white; position: sticky; top: 0; z-index: 1;
	}
	.reserve-header h2 { margin: 0; font-size: 1.1rem; color: #0f172a; }
	.back-text-btn {
		background: none; border: none; color: #64748b;
		font-size: 0.9rem; cursor: pointer; padding: 0;
	}
	.reserve-form { padding: 20px; }
	.form-section { margin-bottom: 18px; }
	.form-label {
		display: block; font-size: 0.85rem; color: #475569; margin-bottom: 6px; font-weight: bold;
	}
	.req { color: #ef4444; }
	.form-value {
		background: #f1f5f9; border-radius: 8px; padding: 10px 12px;
		font-size: 0.9rem; color: #334155;
	}
	.form-select, .form-input {
		width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0;
		border-radius: 8px; font-size: 0.9rem; box-sizing: border-box;
		background: white; font-family: inherit;
	}
	.form-select:focus, .form-input:focus { outline: none; border-color: #facc15; }
	.date-row { display: flex; gap: 8px; }
	.time-input { width: 110px; flex-shrink: 0; }
	.form-textarea { resize: vertical; min-height: 70px; }
	.form-error {
		background: #fee2e2; color: #dc2626; border-radius: 8px;
		padding: 10px 12px; font-size: 0.85rem; margin-bottom: 12px;
	}
	.reserve-submit-btn {
		width: 100%; padding: 14px; background: #facc15; color: #0f172a;
		border: none; border-radius: 10px; font-size: 1rem; font-weight: bold;
		cursor: pointer;
	}
	.reserve-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.reserve-success {
		flex: 1; display: flex; flex-direction: column;
		align-items: center; justify-content: center; padding: 40px;
	}
	.reserve-success .success-icon { font-size: 4rem; color: #22c55e; margin-bottom: 16px; }

	/* Full Screen Modals */
	.full-screen-modal {
		position: absolute; top: 0; left: 0; width: 100%; height: 100%;
		background: #0f172a; color: white; z-index: 100;
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; padding: 20px; box-sizing: border-box;
	}
	.text-btn {
		background: none; border: none; color: white;
		text-decoration: underline; cursor: pointer; margin-top: 15px;
	}
	.qr-container { text-align: center; }
	.qr-box {
		width: 250px; height: 250px; border: 4px solid #facc15;
		margin: 30px auto; position: relative; background: rgba(255,255,255,0.1);
	}
	.scan-line {
		width: 100%; height: 2px; background: #facc15;
		position: absolute; top: 0; animation: scan 2s infinite;
	}
	@keyframes scan { 0% { top: 0; } 100% { top: 100%; } }

	.active-dashboard {
		position: absolute; top: 0; left: 0; width: 100%; height: 100%;
		background: white; z-index: 50; padding: 20px; padding-top: 80px;
		box-sizing: border-box; display: flex; flex-direction: column;
	}
	.status-bar {
		background: #dcfce7; color: #166534; padding: 10px; border-radius: 8px;
		font-weight: bold; text-align: center; margin-bottom: 30px;
	}
	.blinking { animation: blink 1s infinite; }
	@keyframes blink { 50% { opacity: 0; } }
	.input-group {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 12px;
	}
	.stepper { display: flex; align-items: center; gap: 15px; }
	.stepper button {
		width: 30px; height: 30px; border-radius: 50%;
		border: 1px solid #cbd5e1; background: white; cursor: pointer;
	}
	.total-sales {
		font-size: 1.5rem; font-weight: bold; text-align: right;
		margin-top: 20px; border-top: 2px solid #f1f5f9; padding-top: 20px;
	}
	.return-btn { margin-top: auto; }

	.camera-mock {
		width: 100%; height: 60%; background: #334155;
		margin: 20px 0; border-radius: 12px;
		display: flex; align-items: flex-end; justify-content: center; padding-bottom: 20px;
	}
	.shutter-btn {
		width: 60px; height: 60px; border-radius: 50%;
		background: white; border: 4px solid #94a3b8; cursor: pointer;
	}
	.finish-screen { background: #10b981; }
	.success-icon { font-size: 4rem; margin-bottom: 20px; }

	/* Bottom Nav */
	.bottom-nav {
		height: 70px; background: white; display: flex;
		justify-content: space-around; align-items: center;
		border-top: 1px solid #e2e8f0; z-index: 30;
	}
	.nav-item {
		background: none; border: none; display: flex; flex-direction: column;
		align-items: center; color: #94a3b8; font-size: 0.7rem; gap: 4px;
		cursor: pointer; text-decoration: none;
	}
	.nav-item.active { color: #0f172a; }
	.nav-icon { width: 24px; height: 24px; object-fit: contain; }

	/* Dashboard Modal */
	.modal-overlay {
		position: absolute; top: 0; left: 0; width: 100%; height: 100%;
		background: rgba(0,0,0,0.5); z-index: 60;
		display: flex; align-items: flex-end; justify-content: center;
	}
	.modal-content {
		background: #f8fafc; width: 100%; height: 90%;
		border-radius: 20px 20px 0 0; padding: 20px; box-sizing: border-box;
		overflow-y: auto; position: relative; box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
	}
	.dashboard-title { margin-top: 0; color: #0f172a; font-size: 1.5rem; }
	.kpi-container { display: flex; gap: 15px; margin-bottom: 25px; }
	.kpi-card {
		flex: 1; background: white; padding: 15px; border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column;
	}
	.kpi-card.highlight { background: #0f172a; color: white; }
	.kpi-card.highlight .kpi-label { color: #94a3b8; }
	.kpi-label { font-size: 0.8rem; color: #64748b; margin-bottom: 5px; }
	.kpi-value { font-size: 1.4rem; font-weight: bold; }
	.chart-container {
		background: white; padding: 20px; border-radius: 16px;
		margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);
	}
	.chart-container h3 { margin: 0 0 15px 0; font-size: 1rem; color: #334155; }
	.sales-chart { width: 100%; height: auto; overflow: visible; }
	.history-list h3 { font-size: 1rem; color: #334155; margin-bottom: 15px; }
	.empty-history { color: #94a3b8; text-align: center; padding: 20px; }
</style>
