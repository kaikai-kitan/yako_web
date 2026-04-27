<script>
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { base } from '$app/paths';
	import { supabase } from '$lib/supabase.js';
	import {
		getActiveStalls,
		getAvailableSpaces,
		getAvailableStallPins,
		getAvailableStallsList,
		createReservation,
		getUserReservations,
		getMyReservations,
		cancelReservation,
		startRental,
		completeRental,
		getMyProfile,
		getMySalesThisMonth,
		getMyProviderMonthlyStats,
		getBookedStallIds,
		getMyMenuItems
	} from '$lib/db.js';

	// --- ステート管理 ---
	let mapContainer = $state();
	let mapInstance = $state();
	let markers = $state([]);
	let leafletLib = null;

	let currentView = $state('map'); // 'map'|'reserve'|'qr'|'active'|'return'|'finish'

	let isDashboardOpen = $state(false);
	let mapMode = $state('active'); // 'available'|'active'
	let selectedStall = $state(null);
	let currentUser = $state(null);
	let userProfile = $state(null);

	// DBデータ
	let availableSpaces = $state([]);
	let activeStalls = $state([]);
	let stallPins = $state([]);
	let availableStallsList = $state([]);
	let isLoading = $state(true);
	let fetchError = $state('');

	// 予約済み屋台IDセット（全ユーザー共通のブッキング確認）
	let bookedStallIds = $state(new Set());

	// 販売管理（{ '品目名': { count: 0, price: 0 } }）
	let salesData = $state({});
	let plannedItemsList = $state([]); // [{ name, price }]

	// ユーザーの進行中予約
	let myUserReservations = $state([]);
	let currentReservationId = $state(null);

	let myReservedSpaceIds = $derived(
		new Set(myUserReservations.map((r) => r.rental_space_id).filter(Boolean))
	);

	// ダッシュボードデータ（役割別）
	let monthlySalesItems = $state({});
	let providerStats = $state({ count: 0, grossRevenue: 0, netRevenue: 0 });

	// 予約確認パネル
	let isReservationOpen = $state(false);
	let allReservations = $state([]);
	let isCancellingRes = $state('');
	let isReturningRes = $state('');

	// 売上集計（derived）
	let salesTotalRevenue = $derived(
		Object.values(salesData).reduce((sum, v) => sum + (v.count || 0) * (v.price || 0), 0)
	);
	let salesTotalCount = $derived(
		Object.values(salesData).reduce((sum, v) => sum + (v.count || 0), 0)
	);

	// 予約フォーム 品目リスト（構造化: { name, price }[]）
	let reservationItems = $state([{ name: '', price: '' }]);

	// マイメニュー（登録済み商品一覧）
	let myMenuItems = $state([]);

	// QRスキャナー
	let qrScanPhase = $state('idle'); // 'idle'|'scanning'|'verifying'|'error'
	let qrErrorMsg = $state('');
	let html5QrCode = null;

	// 画像拡大表示
	let enlargedImageUrl = $state('');

	onMount(async () => {
		const {
			data: { session }
		} = await supabase.auth.getSession();
		currentUser = session?.user ?? null;

		try {
			// getBookedStallIds はログイン不要なので base fetches に含める
			const fetches = [
				getAvailableSpaces(),
				getActiveStalls(),
				getAvailableStallPins(),
				getAvailableStallsList(),
				getBookedStallIds()
			];
			if (currentUser) {
				fetches.push(getUserReservations(currentUser.id)); // index 5
				fetches.push(getMyProfile(currentUser.id));        // index 6
				fetches.push(getMyMenuItems(currentUser.id));      // index 7
			}
			const results = await Promise.all(fetches);
			availableSpaces = results[0];
			activeStalls   = results[1];
			stallPins      = results[2];
			availableStallsList = results[3];
			bookedStallIds = results[4] ?? new Set();

			if (currentUser) {
				myUserReservations = results[5] ?? [];
				userProfile = results[6];
				myMenuItems = results[7] ?? [];
				allReservations = await getMyReservations(currentUser.id);

				if (userProfile?.owners || userProfile?.operators) {
					providerStats = await getMyProviderMonthlyStats(currentUser.id);
				} else {
					monthlySalesItems = await getMySalesThisMonth(currentUser.id);
				}

				// Stripe決済完了後の返却処理
				const urlParams = new URLSearchParams(window.location.search);
				const rentalDoneId = urlParams.get('rental_done');
				const stripeSessionId = urlParams.get('session_id');

				if (rentalDoneId && stripeSessionId) {
					window.history.replaceState({}, '', '/map');
					try {
						const activateRes = await fetch('/api/activate-rental', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								sessionId: stripeSessionId,
								reservationId: rentalDoneId,
								userId: currentUser.id
							})
						});
						if (activateRes.ok) {
							[myUserReservations, activeStalls] = await Promise.all([
								getUserReservations(currentUser.id),
								getActiveStalls()
							]);
							currentReservationId = rentalDoneId;
							const activatedRes = myUserReservations.find((r) => r.id === rentalDoneId);
							if (activatedRes) {
								plannedItemsList = parsePlannedItems(activatedRes.planned_items);
								salesData = Object.fromEntries(
									plannedItemsList.map((item) => [item.name, { count: 0, price: item.price || 0 }])
								);
							}
							currentView = 'active';
						}
					} catch (e) {
						console.error('activate rental error:', e);
					}
				}
			}
		} catch (e) {
			console.error('DB fetch error:', e);
			fetchError = e.message.includes('未設定')
				? 'Supabase 未設定: .env の設定を確認してください'
				: 'データの取得に失敗しました';
		} finally {
			isLoading = false;
		}

		try {
			const L = (await import('leaflet')).default;
			leafletLib = L;
			mapInstance = L.map(mapContainer, {
				center: KSU_CENTER,
				zoom: 15,
				zoomControl: false,
				attributionControl: false,
				// スマホでの意図しないスクロール対策
				tap: false,
				tapTolerance: 15,
				bounceAtZoomLimits: false
			});
			L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
				subdomains: 'abcd',
				maxZoom: 19
			}).addTo(mapInstance);
			L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
			addExperimentOverlay(L, mapInstance);
			updateMarkers(mapInstance);
		} catch (e) {
			console.error('Map Load Error:', e);
		}

		// ── Supabase Realtime: 屋台ステータス変化を自動反映 ──
		const realtimeChannel = supabase
			.channel('map-realtime')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'stall_specs' }, async () => {
				[activeStalls, stallPins, availableStallsList] = await Promise.all([
					getActiveStalls(),
					getAvailableStallPins(),
					getAvailableStallsList()
				]);
				if (mapInstance) updateMarkers(mapInstance);
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, async () => {
				[activeStalls, bookedStallIds] = await Promise.all([
					getActiveStalls(),
					getBookedStallIds()
				]);
				if (mapInstance) updateMarkers(mapInstance);
			})
			.subscribe();

		return () => { supabase.removeChannel(realtimeChannel); };
	});

	// ── 実証実験エリア（京都産業大学） ──
	const KSU_CENTER = [35.0703, 135.7585];
	const ACTIVE_RADIUS_M = 700;

	function addExperimentOverlay(L, map) {
		const [lat, lng] = KSU_CENTER;
		const dLat = 0.0075, dLng = 0.010;

		// 世界全体を覆う穴あきポリゴン（穴 = 実験エリア）
		L.polygon([
			[[-90, -180], [-90, 180], [90, 180], [90, -180]],
			[
				[lat - dLat, lng - dLng], [lat - dLat, lng + dLng],
				[lat + dLat, lng + dLng], [lat + dLat, lng - dLng]
			]
		], {
			fillColor: '#64748b',
			fillOpacity: 0.48,
			stroke: false,
			interactive: false
		}).addTo(map);

		// 実験エリア境界（点線オレンジ）
		L.circle(KSU_CENTER, {
			radius: ACTIVE_RADIUS_M,
			color: '#d56d04',
			weight: 2.5,
			dashArray: '10, 6',
			fillColor: '#d56d04',
			fillOpacity: 0.04,
			interactive: false
		}).addTo(map);

		// 実証実験エリアバッジ
		L.marker([lat + 0.0056, lng], {
			icon: L.divIcon({
				className: '',
				html: '<div class="ksu-badge-active">🏮 実証実験エリア<br><small>京都産業大学</small></div>',
				iconSize: [160, 44],
				iconAnchor: [80, -6]
			}),
			interactive: false,
			zIndexOffset: 1000
		}).addTo(map);

		// "エリア準備中" ラベル（グレーゾーン内の複数箇所）
		[
			[lat - 0.020, lng + 0.004],
			[lat + 0.004, lng + 0.020],
			[lat + 0.004, lng - 0.020]
		].forEach(([plat, plng]) => {
			L.marker([plat, plng], {
				icon: L.divIcon({
					className: '',
					html: '<div class="ksu-badge-prep">エリア準備中</div>',
					iconSize: [112, 28],
					iconAnchor: [56, 14]
				}),
				interactive: false
			}).addTo(map);
		});
	}

	function makeMarkerEl(type, opts = {}) {
		const el = document.createElement('div');
		el.className = 'lmap-marker';

		if (type === 'space') {
			el.innerHTML = `
				<div class="lmap-bubble lmap-space">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
				</div>
				<div class="lmap-tip lmap-tip-space"></div>`;
		} else if (type === 'stall') {
			const booked = opts.booked;
			el.innerHTML = `
				<div class="lmap-bubble lmap-stall${booked ? ' lmap-booked' : ''}">
					<span>🏮</span>
				</div>
				<div class="lmap-tip lmap-tip-stall${booked ? ' lmap-tip-booked' : ''}"></div>`;
		} else if (type === 'active') {
			const imgSrc = opts.image;
			el.innerHTML = `
				<div class="lmap-active-avatar">
					${imgSrc
						? `<img src="${imgSrc}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'" /><span style="display:none;align-items:center;justify-content:center;width:100%;height:100%;font-size:20px">🏮</span>`
						: `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:20px">🏮</span>`
					}
				</div>
				<div class="lmap-active-caret"></div>`;
		}
		return el;
	}

	function updateMarkers(map) {
		if (!map || !leafletLib) return;
		const L = leafletLib;

		markers.forEach((m) => map.removeLayer(m));
		markers = [];

		if (mapMode === 'available') {
			availableSpaces.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const icon = L.divIcon({
					className: '',
					html: makeMarkerEl('space').outerHTML,
					iconSize: [44, 54],
					iconAnchor: [22, 54]
				});
				const m = L.marker([stall.lat, stall.lng], { icon });
				m.on('click', () => { selectedStall = stall; });
				m.addTo(map);
				markers.push(m);
			});

			stallPins.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const booked = bookedStallIds.has(stall.id);
				const icon = L.divIcon({
					className: '',
					html: makeMarkerEl('stall', { booked }).outerHTML,
					iconSize: [44, 54],
					iconAnchor: [22, 54]
				});
				const m = L.marker([stall.lat, stall.lng], { icon });
				m.on('click', () => { selectedStall = stall; });
				m.addTo(map);
				markers.push(m);
			});
		} else {
			activeStalls.forEach((stall) => {
				if (!stall.lat || !stall.lng) return;
				const icon = L.divIcon({
					className: '',
					html: makeMarkerEl('active', { image: stall.image }).outerHTML,
					iconSize: [52, 62],
					iconAnchor: [26, 62]
				});
				const m = L.marker([stall.lat, stall.lng], { icon });
				m.on('click', () => { selectedStall = stall; });
				m.addTo(map);
				markers.push(m);
			});
		}
	}

	function toggleMode() {
		mapMode = mapMode === 'available' ? 'active' : 'available';
		selectedStall = null;
		updateMarkers(mapInstance);
	}

	// 予約フォーム state
	let reservationMode = $state('space-first'); // 'space-first' | 'stall-first'
	let needsStall = $state(false); // スペース優先フロー: 屋台も必要か
	let reservationForm = $state({
		spaceId: null, spaceName: '',
		stallId: '', stallName: '',
		startDate: '', startTime: '10:00',
		endDate: '', endTime: '22:00'
	});
	let reservationError = $state('');
	let isReserving = $state(false);
	let reservationSuccess = $state(false);

	/** Flow A: スペースから予約 */
	function goReserve() {
		reservationMode = 'space-first';
		needsStall = false;
		reservationForm = {
			spaceId: selectedStall?.id ?? null,
			spaceName: selectedStall?.name ?? '',
			stallId: '', stallName: '',
			startDate: '', startTime: '10:00',
			endDate: '', endTime: '22:00'
		};
		reservationItems = [{ name: '', price: '' }];
		reservationError = '';
		reservationSuccess = false;
		currentView = 'reserve';
	}

	/** Flow B: 屋台から予約（スペース不要） */
	function goReserveFromStall() {
		reservationMode = 'stall-first';
		needsStall = false;
		reservationForm = {
			spaceId: null, spaceName: '',
			stallId: selectedStall?.id ?? '',
			stallName: selectedStall?.name ?? '',
			startDate: '', startTime: '10:00',
			endDate: '', endTime: '22:00'
		};
		reservationItems = [{ name: '', price: '' }];
		reservationError = '';
		reservationSuccess = false;
		currentView = 'reserve';
	}

	function addReservationItem() {
		reservationItems = [...reservationItems, { name: '', price: '' }];
	}

	function removeReservationItem(index) {
		reservationItems = reservationItems.filter((_, i) => i !== index);
	}

	/** マイメニューの商品を品目リストに一括読み込み（既存内容を上書き） */
	function loadFromMyMenu() {
		if (myMenuItems.length === 0) return;
		reservationItems = myMenuItems.map((m) => ({
			name: m.name,
			price: m.price ?? 0,
			description: m.description ?? '',
			photoUrl: m.photo_path ?? ''
		}));
	}

	async function submitReservation() {
		reservationError = '';

		if (reservationMode === 'stall-first') {
			// Flow B: 屋台のみ必須
			if (!reservationForm.stallId) {
				reservationError = '使用する屋台を選択してください'; return;
			}
		} else {
			// Flow A: スペース必須、屋台は「はい」選択時のみ必須
			if (!reservationForm.spaceId) {
				reservationError = '利用するスペースを選択してください'; return;
			}
			if (needsStall && !reservationForm.stallId) {
				reservationError = '使用する屋台を選択してください'; return;
			}
		}

		if (!reservationForm.startDate || !reservationForm.endDate) {
			reservationError = '利用日を入力してください'; return;
		}

		// 品目リストをJSONに変換（空行は除外）
		const validItems = reservationItems.filter((i) => i.name.trim());
		const plannedItemsJson = validItems.length > 0
			? JSON.stringify(validItems.map((i) => ({
				name: i.name.trim(),
				price: parseInt(String(i.price)) || 0,
				description: i.description?.trim() || '',
				photoUrl: i.photoUrl?.trim() || ''
			})))
			: null;

		isReserving = true;
		try {
			const startDatetime = `${reservationForm.startDate}T${reservationForm.startTime}:00`;
			const endDatetime   = `${reservationForm.endDate}T${reservationForm.endTime}:00`;

			// 予約時点の料金をロック（スペース・屋台それぞれ）
			const selectedSpace = availableSpaces.find((s) => s.id === reservationForm.spaceId);
			const selectedStallForRes = availableStallsList.find((s) => s.id === reservationForm.stallId);
			const lockedSpaceFee = selectedSpace?.price ?? 0;
			const lockedStallFee = selectedStallForRes?.rental_fee ?? 0;

			await createReservation(currentUser.id, {
				rentalSpaceId: reservationForm.spaceId || null,
				stallId: (reservationMode === 'space-first' && !needsStall)
					? null
					: (reservationForm.stallId || null),
				startDatetime, endDatetime,
				plannedItems: plannedItemsJson,
				lockedSpaceFee,
				lockedStallFee
			});
			reservationSuccess = true;
			// 予約一覧・予約済み屋台を再取得
			[myUserReservations, bookedStallIds] = await Promise.all([
				getUserReservations(currentUser.id),
				getBookedStallIds()
			]);
			setTimeout(() => {
				currentView = 'map';
				selectedStall = null;
				reservationSuccess = false;
				updateMarkers(mapInstance);
			}, 2000);
		} catch (e) {
			reservationError = '予約に失敗しました: ' + e.message;
		} finally {
			isReserving = false;
		}
	}

	/**
	 * 品目テキスト（旧: 読点区切り / 新: JSON）→ [{ name, price }] に変換
	 */
	function parsePlannedItems(text) {
		if (!text) return [];
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed
					.map((i) =>
						typeof i === 'string'
							? { name: i, price: 0, description: '', photoUrl: '' }
							: {
									name: String(i.name || ''),
									price: Number(i.price) || 0,
									description: String(i.description || ''),
									photoUrl: String(i.photoUrl || '')
								}
					)
					.filter((i) => i.name);
			}
		} catch {
			// 旧フォーマット（読点区切りテキスト）
		}
		return text
			.split(/[、,，\n]/)
			.map((s) => s.trim())
			.filter(Boolean)
			.map((name) => ({ name, price: 0, description: '' }));
	}

	/** 売上カウント更新 */
	function updateSalesCount(name, delta) {
		const current = salesData[name] ?? { count: 0, price: 0 };
		salesData[name] = { ...current, count: Math.max(0, current.count + delta) };
	}

	/** QR解錠成功 → Stripe決済へリダイレクト（無料の場合は直接アクティブ化） */
	async function unlockStall() {
		if (!currentReservationId || !currentUser) return;
		qrScanPhase = 'verifying';

		try {
			const origin = window.location.origin;
			const res = await fetch('/api/create-rental-checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reservationId: currentReservationId,
					userId: currentUser.id,
					successUrl: `${origin}/map?rental_done=${currentReservationId}&session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${origin}/map`
				})
			});

			if (!res.ok) {
				const msg = await res.text();
				qrScanPhase = 'error';
				qrErrorMsg = `決済エラー: ${msg}`;
				return;
			}

			const { url, free } = await res.json();

			if (free) {
				// 無料の場合は直接アクティブ化
				const currentRes = myUserReservations.find((r) => r.id === currentReservationId);
				plannedItemsList = parsePlannedItems(currentRes?.planned_items);
				salesData = Object.fromEntries(
					plannedItemsList.map((item) => [item.name, { count: 0, price: item.price || 0 }])
				);
				myUserReservations = myUserReservations.map((r) =>
					r.id === currentReservationId ? { ...r, status: 'active' } : r
				);
				activeStalls = await getActiveStalls();
				currentView = 'active';
			} else {
				window.location.href = url;
			}
		} catch (e) {
			qrScanPhase = 'error';
			qrErrorMsg = '決済処理に失敗しました: ' + e.message;
		}
	}

	function startReturn() { currentView = 'return'; }

	/** 返却確認 → completed に更新 & 支払い履歴を記録 */
	async function finishReturn() {
		currentView = 'finish';
		if (currentReservationId && currentUser) {
			try {
				// DB には { 品目名: count } 形式で保存
				const salesForDB = Object.fromEntries(
					Object.entries(salesData).map(([name, v]) => [name, v.count || 0])
				);
				await completeRental(currentReservationId, currentUser.id, salesForDB);
				myUserReservations = myUserReservations.filter((r) => r.id !== currentReservationId);
				// 出店中・予約済みを再取得
				[activeStalls, bookedStallIds] = await Promise.all([
					getActiveStalls(),
					getBookedStallIds()
				]);
				// ダッシュボードを更新
				if (userProfile?.owners || userProfile?.operators) {
					providerStats = await getMyProviderMonthlyStats(currentUser.id);
				} else {
					monthlySalesItems = await getMySalesThisMonth(currentUser.id);
				}
			} catch (e) {
				console.error('completeRental error:', e);
			}
		}
		setTimeout(() => {
			currentView = 'map';
			selectedStall = null;
			currentReservationId = null;
			salesData = {};
			plannedItemsList = [];
			updateMarkers(mapInstance);
		}, 3000);
	}

	/** アクティブな予約を再開して売上管理画面へ */
	function resumeActive(reservation) {
		currentReservationId = reservation.id;
		plannedItemsList = parsePlannedItems(reservation.planned_items);
		salesData = Object.fromEntries(
			plannedItemsList.map((item) => [item.name, { count: 0, price: item.price || 0 }])
		);
		selectedStall = null;
		currentView = 'active';
	}

	async function goQR(reservationId) {
		currentReservationId = reservationId;
		qrScanPhase = 'idle';
		qrErrorMsg = '';
		currentView = 'qr';
		// DOM描画後にカメラを起動
		setTimeout(startQrCamera, 100);
	}

	async function startQrCamera() {
		qrScanPhase = 'scanning';
		try {
			const { Html5Qrcode } = await import('html5-qrcode');
			html5QrCode = new Html5Qrcode('qr-reader-map');
			await html5QrCode.start(
				{ facingMode: 'environment' },
				{ fps: 10, qrbox: { width: 220, height: 220 } },
				async (text) => {
					stopQrCamera();
					qrScanPhase = 'verifying';

					// QRコードからスペースIDを抽出
					let scannedSpaceId = null;
					try {
						const url = new URL(text);
						scannedSpaceId = url.searchParams.get('space');
					} catch {
						// URLでない場合はそのままIDとして扱う
						scannedSpaceId = text.trim() || null;
					}

					if (!scannedSpaceId) {
						qrScanPhase = 'error';
						qrErrorMsg = '無効なQRコードです。スペースのQRコードを読み取ってください。';
						return;
					}

					// 予約のスペースIDと照合
					const currentRes = myUserReservations.find((r) => r.id === currentReservationId);
					const expectedSpaceId = currentRes?.rental_space_id;

					if (expectedSpaceId && scannedSpaceId !== expectedSpaceId) {
						qrScanPhase = 'error';
						qrErrorMsg = '予約したスペースのQRコードではありません。正しいスペースのQRコードを読み取ってください。';
						return;
					}

					await unlockStall();
				},
				() => {} // フレームエラーは無視
			);
		} catch (e) {
			qrScanPhase = 'error';
			qrErrorMsg = 'カメラの起動に失敗しました。カメラの使用を許可してください。';
		}
	}

	function stopQrCamera() {
		if (html5QrCode?.isScanning) {
			html5QrCode.stop().catch(() => {});
			html5QrCode = null;
		}
	}

	function cancelQr() {
		stopQrCamera();
		currentView = 'map';
		qrScanPhase = 'idle';
	}

	function closeDetail() { selectedStall = null; }

	// ===== 予約確認パネル用ヘルパー =====
	function formatDate(isoString) {
		return new Date(isoString).toLocaleDateString('ja-JP', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}

	function formatPlannedItems(text) {
		if (!text) return '';
		try {
			const parsed = JSON.parse(text);
			if (Array.isArray(parsed)) {
				return parsed
					.map((i) => (typeof i === 'string' ? i : `${i.name}(¥${(i.price ?? 0).toLocaleString()})`))
					.join('、');
			}
		} catch {}
		return text;
	}

	function resStatusLabel(status) {
		return { pending: '予約中', active: '利用中', completed: '完了', cancelled: 'キャンセル済み' }[status] ?? '予約中';
	}

	function resStatusClass(status) {
		return { pending: 'res-pending', active: 'res-active', completed: 'res-done', cancelled: 'res-cancelled' }[status] ?? 'res-pending';
	}

	function canCancel(startDatetime, status) {
		if (status === 'completed' || status === 'cancelled' || status === 'active') return false;
		const threeDaysBefore = new Date(startDatetime);
		threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
		return new Date() < threeDaysBefore;
	}

	async function handleCancelReservation(reservationId) {
		if (!confirm('予約をキャンセルしますか？')) return;
		isCancellingRes = reservationId;
		try {
			await cancelReservation(reservationId);
			allReservations = allReservations.map((r) =>
				r.id === reservationId ? { ...r, status: 'cancelled' } : r
			);
			myUserReservations = myUserReservations.filter((r) => r.id !== reservationId);
		} catch (e) {
			alert('キャンセルに失敗しました: ' + e.message);
		} finally {
			isCancellingRes = '';
		}
	}

	async function handleReturnReservation(reservationId) {
		if (!confirm('返却手続きを行いますか？\n（売上入力なしで利用を終了します）')) return;
		isReturningRes = reservationId;
		try {
			await completeRental(reservationId, currentUser.id, {});
			allReservations = allReservations.map((r) =>
				r.id === reservationId ? { ...r, status: 'completed' } : r
			);
			myUserReservations = myUserReservations.filter((r) => r.id !== reservationId);
			[activeStalls, bookedStallIds] = await Promise.all([getActiveStalls(), getBookedStallIds()]);
			updateMarkers(mapInstance);
		} catch (e) {
			alert('返却処理に失敗しました: ' + e.message);
		} finally {
			isReturningRes = '';
		}
	}
</script>

<svelte:head>
	<title>YATAKARI マップ | 微小夜行電灯</title>
	<meta name="description" content="京都・鴨川河川敷の屋台・スペースをマップから検索して予約。QRコードで簡単に借り出し開始。" />
	<meta property="og:title" content="YATAKARI マップ | 微小夜行電灯" />
	<meta property="og:description" content="京都・鴨川河川敷の屋台・スペースをマップから検索して予約。" />
</svelte:head>

<div class="app-container">
	<!-- ヘッダー -->
	{#if currentView === 'map'}
		<header class="app-header">
			<div class="toggle-switch" onclick={toggleMode} role="button" tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && toggleMode()}>
				<div class="toggle-bg" style="left: {mapMode === 'active' ? '3px' : 'calc(50% + 1px)'};"></div>
				<span class:active={mapMode === 'active'}>🏮 出店中</span>
				<span class:active={mapMode === 'available'}>📍 予約可能</span>
			</div>
		</header>
	{/if}

	<main class="app-main">
		<!-- マップレイヤー -->
		<div class="map-layer" class:hidden={currentView !== 'map'}>
			<div class="map-canvas" bind:this={mapContainer}></div>
			<!-- スマホ: タッチ操作はLeafletに委譲（touch-action: noneで制御） -->

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

			{#if currentView === 'map' && mapMode === 'available'}
				<div class="legend">
					<span class="legend-item">🔵 スペース</span>
					<span class="legend-item">🟡 屋台</span>
					<span class="legend-item">⚫ 予約済み</span>
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
							{#if selectedStall.specs}<p class="specs">{selectedStall.specs}</p>{/if}
							<p class="price">¥{(selectedStall.price ?? 0).toLocaleString()} / 日</p>
							{#if currentUser}
								{@const activeRes = myUserReservations.find((r) => r.stall_id === selectedStall.id && r.status === 'active')}
								{@const pendingRes = myUserReservations.find((r) => r.stall_id === selectedStall.id && r.status === 'pending')}
								{@const bookedByOther = bookedStallIds.has(selectedStall.id) && !pendingRes && !activeRes}
								{#if activeRes}
									<button class="action-btn primary" onclick={() => resumeActive(activeRes)}>
										🏮 利用中・売上管理へ
									</button>
								{:else if pendingRes}
									<button class="action-btn primary" onclick={() => goQR(pendingRes.id)}>
										📱 QRで受け取りを開始
									</button>
								{:else if bookedByOther}
									<div class="booked-badge">予約済み（利用不可）</div>
								{:else}
									<button class="action-btn primary" onclick={goReserveFromStall}>
										この屋台で予約する
									</button>
								{/if}
							{:else}
								<a href="{base}/auth?redirectTo=/map" class="action-btn primary link-btn">ログインして予約する</a>
							{/if}

						{:else if mapMode === 'available'}
							<!-- スペースピン -->
							<p class="specs">{selectedStall.specs}</p>
							{#if selectedStall.address}
								<p class="specs">📍 {selectedStall.address}</p>
							{/if}
							<div class="space-meta">
								<span>🏮 最大 {selectedStall.maxStalls ?? 1} 台</span>
								<span>👥 {selectedStall.capacity ?? 10} 名まで</span>
							</div>
							<p class="price">¥{(selectedStall.price ?? 0).toLocaleString()} / 泊</p>
							{#if currentUser}
								{@const activeRes = myUserReservations.find((r) => r.rental_space_id === selectedStall.id && r.status === 'active')}
								{@const pendingRes = myUserReservations.find((r) => r.rental_space_id === selectedStall.id && r.status === 'pending')}
								{#if activeRes}
									<button class="action-btn primary" onclick={() => resumeActive(activeRes)}>
										🏮 利用中・売上管理へ
									</button>
								{:else if pendingRes}
									<button class="action-btn primary" onclick={() => goQR(pendingRes.id)}>
										📱 QRで受け取りを開始
									</button>
								{:else if myReservedSpaceIds.has(selectedStall.id)}
									<button class="action-btn secondary" disabled>予約済み</button>
								{:else}
									<button class="action-btn primary" onclick={goReserve}>予約する</button>
								{/if}
							{:else}
								<a href="{base}/auth?redirectTo=/map" class="action-btn primary link-btn">ログインして予約する</a>
							{/if}

						{:else}
							<!-- 出店中ピン -->
							<div class="active-store-info">
								<p class="owner-name">{selectedStall.owner}</p>
								{#if selectedStall.spaceName}
									<p class="specs">📍 {selectedStall.spaceName}</p>
								{/if}
								{#if selectedStall.bio}
									<p class="store-bio">{selectedStall.bio}</p>
								{/if}

								{#each [parsePlannedItems(selectedStall.plannedItems)] as activeItems}
									{#if activeItems.length > 0}
										<div class="active-menu-list">
											<p class="active-menu-label">本日のメニュー</p>
											{#each activeItems as item}
												{@const photoUrl = item.photoUrl || selectedStall.menuPhotoMap?.[item.name] || null}
												<div class="active-menu-item">
													{#if photoUrl}
														<button
															class="active-menu-img-btn"
															onclick={() => (enlargedImageUrl = photoUrl)}
															aria-label="{item.name}の画像を拡大"
														>
															<img src={photoUrl} alt={item.name} class="active-menu-img" />
														</button>
													{/if}
													<div class="active-menu-item-info">
														<span class="active-menu-name">{item.name}</span>
														{#if item.description}
															<span class="active-menu-desc">{item.description}</span>
														{/if}
													</div>
													{#if item.price > 0}
														<span class="active-menu-price">¥{item.price.toLocaleString()}</span>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								{/each}
							</div>
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
					<h2>{reservationMode === 'stall-first' ? '屋台を予約する' : 'スペースを予約する'}</h2>
				</div>

				{#if reservationSuccess}
					<div class="reserve-success">
						<div class="success-icon">✓</div>
						<p>予約が完了しました！</p>
					</div>
				{:else}
					<div class="reserve-form">

						{#if reservationMode === 'space-first'}
							<!-- ===== Flow A: スペース優先 ===== -->
							<div class="form-section">
								<span class="form-label">予約スペース</span>
								<div class="form-value">📍 {reservationForm.spaceName}</div>
							</div>

							<!-- 屋台も必要か？ -->
							<div class="form-section">
								<span class="form-label">屋台も必要ですか？</span>
								<div class="flow-toggle">
									<button
										type="button"
										class="flow-toggle-btn"
										class:selected={!needsStall}
										onclick={() => { needsStall = false; reservationForm.stallId = ''; }}
									>いいえ（スペースのみ）</button>
									<button
										type="button"
										class="flow-toggle-btn"
										class:selected={needsStall}
										onclick={() => (needsStall = true)}
									>はい（屋台も借りる）</button>
								</div>
							</div>

							{#if needsStall}
								<div class="form-section">
									<label class="form-label" for="stall-select">
										使用する屋台 <span class="req">*</span>
									</label>
									<select id="stall-select" bind:value={reservationForm.stallId} class="form-select">
										<option value="">屋台を選択してください</option>
										{#each availableStallsList as stall}
											{@const isBooked = bookedStallIds.has(stall.id) && !myUserReservations.some(r => r.stall_id === stall.id)}
											<option value={stall.id} disabled={isBooked}>
												{stall.stall_name}（{stall.operators?.business_name ?? ''}）
												— ¥{(stall.rental_fee ?? 0).toLocaleString()}/日
												{#if isBooked}（予約済み）{/if}
											</option>
										{/each}
									</select>
								</div>
							{/if}

						{:else}
							<!-- ===== Flow B: 屋台優先 ===== -->
							<div class="form-section">
								<span class="form-label">予約屋台</span>
								<div class="form-value">🏮 {reservationForm.stallName}</div>
							</div>
							<div class="flow-info-box">
								スペースは当日現地で空きを確認して使用してください。スペース予約が必要な場合はマップからスペースピンを選択してください。
							</div>
						{/if}

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

						<!-- 提供品目（構造化入力） -->
						<div class="form-section">
							<div class="items-label-row">
								<span class="form-label" style="margin-bottom:0">提供品目</span>
								<span class="form-hint">売上入力に使用されます</span>
							</div>
							{#if myMenuItems.length > 0}
								<button
									type="button"
									class="load-menu-btn"
									onclick={loadFromMyMenu}
								>
									マイメニューから読み込む（{myMenuItems.length}件）
								</button>
							{/if}
							<div class="items-header">
								<span class="items-col-label">商品名</span>
								<span class="items-col-label">料金（円）</span>
							</div>
							{#each reservationItems as item, i}
								<div class="item-row">
									<input
										type="text"
										bind:value={item.name}
										placeholder="例: クラフトビール"
										class="item-name-input"
									/>
									<div class="item-price-wrapper">
										<span class="yen-sign">¥</span>
										<input
											type="number"
											bind:value={item.price}
											placeholder="800"
											min="0"
											class="item-price-input"
										/>
									</div>
									{#if reservationItems.length > 1}
										<button
											type="button"
											class="remove-item-btn"
											onclick={() => removeReservationItem(i)}
										>×</button>
									{/if}
								</div>
							{/each}
							<button type="button" class="add-item-btn" onclick={addReservationItem}>
								＋ 商品を追加
							</button>
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
					{#if qrScanPhase === 'scanning'}
						<h2>QRコードをスキャン</h2>
						<p>屋台・スペースに貼られたQRコードを<br />カメラに向けてください</p>
						<div id="qr-reader-map"></div>
						<button class="text-btn" onclick={cancelQr}>キャンセル</button>

					{:else if qrScanPhase === 'verifying' || qrScanPhase === 'idle'}
						<div class="qr-loading">
							<div class="qr-spinner"></div>
							<p>{qrScanPhase === 'verifying' ? '確認中…' : '準備中…'}</p>
						</div>

					{:else if qrScanPhase === 'error'}
						<div class="qr-error">
							<div class="qr-error-icon">✕</div>
							<p>{qrErrorMsg}</p>
							<button class="action-btn primary" onclick={startQrCamera}>もう一度スキャン</button>
							<button class="text-btn" onclick={cancelQr}>キャンセル</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- 利用中・販売管理画面 -->
		{#if currentView === 'active'}
			<div class="active-dashboard" transition:fly={{ x: 300, duration: 300 }}>
				<div class="status-bar">
					<span class="blinking">●</span> 貸出中: {selectedStall?.name ?? '屋台'}
				</div>
				<div class="sales-form">
					<h3>本日の売上入力</h3>
					{#if plannedItemsList.length > 0}
						{#each plannedItemsList as item}
							<div class="input-group">
								<div class="item-info">
									<span class="item-label">{item.name}</span>
									{#if item.price > 0}
										<span class="item-unit-price">¥{item.price.toLocaleString()} / 個</span>
									{/if}
								</div>
								<div class="stepper">
									<button onclick={() => updateSalesCount(item.name, -1)}>−</button>
									<span>{salesData[item.name]?.count ?? 0}</span>
									<button onclick={() => updateSalesCount(item.name, 1)}>＋</button>
								</div>
							</div>
						{/each}
						<div class="total-sales">
							{#if salesTotalRevenue > 0}
								売上 ¥{salesTotalRevenue.toLocaleString()}（{salesTotalCount} 個）
							{:else}
								合計: {salesTotalCount} 個
							{/if}
						</div>
					{:else}
						<div class="no-items">
							<p>品目が未登録です</p>
							<small>予約時に「提供品目」を入力すると、ここに表示されます</small>
						</div>
					{/if}
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
				role="button" tabindex="0"
				onkeydown={(e) => e.key === 'Escape' && (isDashboardOpen = false)}>
				<div class="modal-content dashboard-modal" onclick={(e) => e.stopPropagation()} role="document">
					<button class="close-btn" onclick={() => (isDashboardOpen = false)}>×</button>
					<h2 class="dashboard-title">ダッシュボード</h2>

					{#if !currentUser}
						<p class="empty-history">ログインするとデータが表示されます</p>
					{:else if userProfile?.owners || userProfile?.operators}
						<p class="dashboard-role-label">
							{#if userProfile?.owners}📍 土地貸し出し人{:else}🏮 屋台主{/if}
						</p>
						<div class="kpi-container">
							<div class="kpi-card">
								<span class="kpi-label">今月の利用回数</span>
								<span class="kpi-value">{providerStats.count} 回</span>
							</div>
							<div class="kpi-card highlight">
								<span class="kpi-label">今月の収益（手数料30%後）</span>
								<span class="kpi-value">¥{providerStats.netRevenue.toLocaleString()}</span>
							</div>
						</div>
						<p class="fee-note">
							総額 ¥{providerStats.grossRevenue.toLocaleString()} × 70% = ¥{providerStats.netRevenue.toLocaleString()}
						</p>
					{:else}
						<p class="dashboard-role-label">🛒 さすらい屋台人</p>
						<div class="kpi-container">
							<div class="kpi-card highlight">
								<span class="kpi-label">今月の販売個数合計</span>
								<span class="kpi-value">
									{Object.values(monthlySalesItems).reduce((sum, v) => sum + v, 0)} 個
								</span>
							</div>
						</div>
						{#if Object.keys(monthlySalesItems).length > 0}
							<div class="sales-breakdown">
								<h3>品目別合計</h3>
								{#each Object.entries(monthlySalesItems) as [item, count]}
									<div class="breakdown-row">
										<span>{item}</span>
										<span class="breakdown-count">{count} 個</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="empty-history">今月の販売記録はありません</p>
						{/if}
					{/if}
				</div>
			</div>
		{/if}
	</main>

	<!-- ボトムナビゲーション -->
	{#if currentView === 'map'}
		<nav class="bottom-nav">
			<button class="nav-item" class:active={isReservationOpen}
				onclick={() => { isReservationOpen = true; isDashboardOpen = false; }}>
				<img src="{base}/images/map_icon/calendar.jpg" alt="予約確認" class="nav-icon" />
				<span>予約確認</span>
			</button>
			<a href="{base}/mypage" class="nav-item">
				<img src="{base}/images/map_icon/yatainin.jpg" alt="マイページ" class="nav-icon" />
				<span>マイページ</span>
			</a>
			<button class="nav-item" class:active={isDashboardOpen}
				onclick={() => (isDashboardOpen = true)}>
				<img src="{base}/images/map_icon/earn_money.jpg" alt="今月の売上" class="nav-icon" />
				<span>今月の売上</span>
			</button>
		</nav>
	{/if}
</div>

<!-- 予約確認パネル -->
{#if isReservationOpen}
	<div
		class="modal-overlay"
		onclick={(e) => e.target === e.currentTarget && (isReservationOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (isReservationOpen = false)}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div class="modal-content">
			<button class="modal-close-btn" onclick={() => (isReservationOpen = false)}>×</button>
			<h2 class="dashboard-title">📅 予約確認</h2>

			{#if !currentUser}
				<p class="empty-history">ログインすると予約履歴を確認できます</p>
			{:else if allReservations.length === 0}
				<p class="empty-history">予約履歴はありません</p>
				<p class="empty-history" style="margin-top:0">マップから屋台・スペースを予約してみましょう</p>
			{:else}
				<div class="res-list">
					{#each allReservations as res}
						<div class="res-card">
							<div class="res-card-header">
								<span class="res-space-name">{res.rental_spaces?.name ?? '不明'}</span>
								<span class="res-badge {resStatusClass(res.status)}">{resStatusLabel(res.status)}</span>
							</div>
							{#if res.stall_specs?.stall_name}
								<div class="res-detail">🏮 {res.stall_specs.stall_name}</div>
							{/if}
							{#if res.planned_items}
								<div class="res-detail">品目: {formatPlannedItems(res.planned_items)}</div>
							{/if}
							<div class="res-detail">
								{formatDate(res.start_datetime)} 〜 {formatDate(res.end_datetime)}
							</div>
							<div class="res-actions">
								{#if res.status === 'pending' && res.rental_space_id}
									<a href="{base}/scan?space={res.rental_space_id}" class="res-action-btn res-action-scan">
										📷 QRスキャンで借り出し開始
									</a>
								{/if}
								{#if res.status === 'active'}
									<button
										class="res-action-btn res-action-return"
										onclick={() => handleReturnReservation(res.id)}
										disabled={isReturningRes === res.id}
									>
										{isReturningRes === res.id ? '処理中…' : '🔄 返却する'}
									</button>
								{/if}
								{#if canCancel(res.start_datetime, res.status)}
									<button
										class="res-action-btn res-action-cancel"
										onclick={() => handleCancelReservation(res.id)}
										disabled={isCancellingRes === res.id}
									>
										{isCancellingRes === res.id ? 'キャンセル中…' : 'キャンセルする'}
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- 画像拡大ライトボックス -->
{#if enlargedImageUrl}
	<div
		class="lightbox-overlay"
		onclick={() => (enlargedImageUrl = '')}
		onkeydown={(e) => e.key === 'Escape' && (enlargedImageUrl = '')}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<img src={enlargedImageUrl} alt="拡大画像" class="lightbox-img" />
		<button class="lightbox-close" onclick={() => (enlargedImageUrl = '')}>×</button>
	</div>
{/if}

<style>
	:global(body) { margin: 0; padding: 0; }

	/* ── Leaflet マーカー（:global で DOM に直接挿入した要素に適用） ── */
	:global(.lmap-marker) { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
	:global(.lmap-bubble) {
		width: 42px; height: 42px; border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		box-shadow: 0 3px 10px rgba(0,0,0,0.22);
		transition: transform 0.15s;
	}
	:global(.lmap-marker:hover .lmap-bubble) { transform: translateY(-3px) scale(1.08); }
	:global(.lmap-space) { background: #e0f0ff; border: 2.5px solid #3b82f6; color: #2563eb; }
	:global(.lmap-space svg) { width: 20px; height: 20px; }
	:global(.lmap-stall) { background: #fff7e6; border: 2.5px solid #d56d04; font-size: 20px; }
	:global(.lmap-booked) { background: #f1f5f9; border-color: #94a3b8; filter: grayscale(0.6); opacity: 0.65; }
	:global(.lmap-tip) { width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; margin-top: -1px; }
	:global(.lmap-tip-space) { border-top: 9px solid #3b82f6; }
	:global(.lmap-tip-stall) { border-top: 9px solid #d56d04; }
	:global(.lmap-tip-booked) { border-top-color: #94a3b8; }
	:global(.lmap-active-avatar) {
		width: 50px; height: 50px; border-radius: 50%;
		border: 3px solid #ef4444; overflow: hidden;
		box-shadow: 0 3px 12px rgba(0,0,0,0.35);
		background: #fef2f2;
	}
	:global(.lmap-active-avatar img) { width: 100%; height: 100%; object-fit: cover; }
	:global(.lmap-active-caret) {
		width: 0; height: 0;
		border-left: 7px solid transparent; border-right: 7px solid transparent;
		border-top: 10px solid #ef4444; margin-top: -1px;
	}
	/* ── 実証実験エリアバッジ ── */
	:global(.ksu-badge-active) {
		background: #fff7e6;
		border: 2px solid #d56d04;
		color: #b85c03;
		border-radius: 20px;
		padding: 6px 16px;
		font-size: 0.78rem;
		font-weight: 700;
		white-space: nowrap;
		text-align: center;
		line-height: 1.5;
		box-shadow: 0 3px 14px rgba(213, 109, 4, 0.28);
		pointer-events: none;
		letter-spacing: 0.03em;
	}
	:global(.ksu-badge-active small) {
		font-size: 0.66rem;
		font-weight: 500;
		opacity: 0.8;
		display: block;
	}
	:global(.ksu-badge-prep) {
		background: rgba(241, 245, 249, 0.92);
		border: 1.5px solid #94a3b8;
		color: #64748b;
		border-radius: 20px;
		padding: 5px 14px;
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
		pointer-events: none;
		letter-spacing: 0.03em;
	}

	/* Leaflet ズームコントロールのスタイル調整 */
	:global(.leaflet-control-zoom) { border: none !important; box-shadow: 0 2px 10px rgba(0,0,0,0.15) !important; border-radius: 10px !important; overflow: hidden; }
	:global(.leaflet-control-zoom a) { border: none !important; color: #26201a !important; font-weight: 600 !important; width: 36px !important; height: 36px !important; line-height: 36px !important; }
	:global(.leaflet-bottom.leaflet-right) { bottom: 80px !important; right: 10px !important; }

	.app-container {
		width: 100%; height: 100svh;
		display: flex; flex-direction: column;
		background: #f8f5f0; position: relative; overflow: hidden;
	}

	/* z-index はすべて Leaflet のマーカーペイン(600)より高い 800+ に統一 */
	.app-header { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 800; }

	.toggle-switch {
		background: white; border-radius: 30px; padding: 4px;
		display: flex; position: relative;
		box-shadow: 0 4px 16px rgba(0,0,0,0.18);
		cursor: pointer; width: 210px; height: 42px; align-items: center;
	}
	.toggle-bg {
		position: absolute; width: 50%; height: 80%;
		background: #26201a; border-radius: 25px; transition: left 0.3s ease;
	}
	.toggle-switch span {
		flex: 1; text-align: center; z-index: 1;
		font-size: 0.85rem; font-weight: 700; color: #94a3b8; transition: color 0.3s;
		letter-spacing: 0.02em;
	}
	.toggle-switch span.active { color: white; }

	.app-main { flex: 1; position: relative; padding-bottom: 70px; }
	.map-layer { width: 100%; height: 100%; }
	.map-canvas { width: 100%; height: 100%; touch-action: none; }

	.legend {
		position: absolute; bottom: 88px; left: 12px;
		background: white; border-radius: 10px; padding: 7px 12px;
		display: flex; gap: 10px; font-size: 0.72rem; color: #475569;
		box-shadow: 0 2px 8px rgba(0,0,0,0.12); z-index: 800;
	}

	.map-overlay {
		position: absolute; bottom: 96px; left: 50%; transform: translateX(-50%);
		background: white; border-radius: 12px; padding: 12px 20px;
		box-shadow: 0 4px 16px rgba(0,0,0,0.15);
		display: flex; align-items: center; gap: 10px;
		font-size: 0.9rem; color: #475569; z-index: 800; white-space: nowrap;
	}
	.map-overlay.error { background: #fee2e2; color: #dc2626; }
	.loading-spinner {
		width: 18px; height: 18px; border: 2px solid #e2e8f0;
		border-top-color: #d56d04; border-radius: 50%; animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Bottom Sheet */
	.bottom-sheet {
		position: absolute;
		bottom: 82px;
		left: 12px;
		right: 12px;
		max-height: 58svh;
		overflow-y: auto;
		background: white;
		border-radius: 20px;
		padding: 24px 20px 20px;
		box-shadow: 0 -2px 0 rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.18);
		z-index: 800;
		-webkit-overflow-scrolling: touch;
	}
	.close-btn {
		position: absolute; top: 12px; right: 14px;
		background: #f1f5f9; border: none; font-size: 1rem; cursor: pointer;
		width: 28px; height: 28px; border-radius: 50%; display: flex;
		align-items: center; justify-content: center; color: #64748b;
	}
	.sheet-content { display: flex; gap: 15px; }
	.stall-thumb { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
	.stall-thumb.no-image {
		background: #fef9c3; display: flex; align-items: center;
		justify-content: center; font-size: 2rem;
	}
	.stall-info { flex: 1; }
	.stall-info h3 { margin: 0 0 5px 0; font-size: 1.1rem; }
	.specs { font-size: 0.8rem; color: #64748b; margin: 2px 0; }

	/* 出店中パネル */
	.active-store-info { width: 100%; }
	.owner-name { font-weight: bold; font-size: 1rem; color: #0f172a; margin: 0 0 4px; }
	.store-bio {
		font-size: 0.8rem; color: #475569; margin: 2px 0 0;
		line-height: 1.5; white-space: pre-wrap;
	}
	.active-menu-list {
		margin-top: 10px;
		background: #fef9c3;
		border-radius: 8px;
		padding: 10px 12px;
	}
	.active-menu-label {
		font-size: 0.72rem; font-weight: bold; color: #92400e;
		text-transform: uppercase; letter-spacing: 0.04em;
		margin: 0 0 6px;
	}
	.active-menu-item {
		display: flex; justify-content: space-between; align-items: flex-start;
		padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.06); gap: 8px;
	}
	.active-menu-item:last-child { border-bottom: none; }
	.active-menu-item-info {
		display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0;
	}
	.active-menu-img-btn {
		background: none; border: none; padding: 0; cursor: pointer; flex-shrink: 0;
	}
	.active-menu-img {
		width: 56px; height: 56px; border-radius: 8px; object-fit: cover;
		display: block;
	}
	.active-menu-name { font-size: 0.88rem; color: #1e293b; font-weight: 500; }
	.active-menu-desc {
		font-size: 0.75rem; color: #64748b; line-height: 1.4;
	}
	.active-menu-price {
		font-weight: bold; color: #92400e; font-size: 0.88rem;
		flex-shrink: 0; margin-left: 8px; padding-top: 1px;
	}
	.price { font-weight: bold; font-size: 1.1rem; margin: 5px 0; }
	.space-meta {
		display: flex; gap: 10px; font-size: 0.78rem; color: #475569;
		background: #f8fafc; border-radius: 6px; padding: 5px 8px; margin: 4px 0;
	}
	.booked-badge {
		margin-top: 10px; padding: 8px 12px;
		background: #fee2e2; color: #dc2626;
		border-radius: 8px; font-size: 0.82rem; font-weight: bold; text-align: center;
	}

	.action-btn {
		width: 100%; padding: 10px; border: none; border-radius: 8px;
		font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 0.9rem;
	}
	.action-btn.primary { background: #facc15; color: #0f172a; }
	.action-btn.secondary { background: #e2e8f0; color: #0f172a; }
	.action-btn.danger { background: #ef4444; color: white; }
	.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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
	.form-hint { font-size: 0.75rem; color: #94a3b8; font-weight: normal; margin-left: 6px; }
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
	.form-error {
		background: #fee2e2; color: #dc2626; border-radius: 8px;
		padding: 10px 12px; font-size: 0.85rem; margin-bottom: 12px;
	}

	/* 提供品目 構造化入力 */
	.items-label-row {
		display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px;
	}
	.items-header {
		display: grid; grid-template-columns: 1fr 100px 28px;
		gap: 6px; margin-bottom: 4px; padding: 0 2px;
	}
	.items-col-label {
		font-size: 0.75rem; color: #94a3b8; font-weight: bold;
	}
	.item-row {
		display: grid; grid-template-columns: 1fr 100px 28px;
		gap: 6px; margin-bottom: 6px; align-items: center;
	}
	.item-name-input {
		padding: 8px 10px; border: 1.5px solid #e2e8f0;
		border-radius: 8px; font-size: 0.88rem;
		font-family: inherit; box-sizing: border-box; width: 100%;
	}
	.item-price-wrapper {
		display: flex; align-items: center;
		border: 1.5px solid #e2e8f0; border-radius: 8px;
		overflow: hidden; background: white;
	}
	.yen-sign {
		padding: 0 6px; color: #94a3b8;
		font-size: 0.85rem; background: #f8fafc;
		border-right: 1px solid #e2e8f0; line-height: 36px;
	}
	.item-price-input {
		border: none; padding: 8px 6px;
		font-size: 0.88rem; font-family: inherit;
		width: 100%; min-width: 0;
	}
	.item-price-input:focus { outline: none; }
	.item-name-input:focus { outline: none; border-color: #facc15; }
	.remove-item-btn {
		width: 28px; height: 28px; border-radius: 50%;
		border: 1.5px solid #fca5a5; background: white;
		color: #ef4444; cursor: pointer; font-size: 0.9rem;
		display: flex; align-items: center; justify-content: center;
	}
	.add-item-btn {
		width: 100%; padding: 8px; margin-top: 4px;
		background: #f8fafc; border: 1.5px dashed #cbd5e1;
		border-radius: 8px; color: #64748b; font-size: 0.85rem;
		cursor: pointer; font-family: inherit;
	}
	.add-item-btn:hover { border-color: #facc15; color: #0f172a; }

	/* 予約フロー切替トグル */
	.flow-toggle {
		display: flex; gap: 8px; margin-top: 6px;
	}
	.flow-toggle-btn {
		flex: 1; padding: 10px 8px;
		border: 1.5px solid #e2ddd8; border-radius: 8px;
		background: white; color: #64748b;
		font-size: 0.82rem; font-family: inherit; cursor: pointer;
		transition: all 0.15s;
	}
	.flow-toggle-btn.selected {
		border-color: #facc15; background: #fef9c3; color: #0f172a; font-weight: 700;
	}
	.flow-info-box {
		background: #f8fafc; border-radius: 8px;
		padding: 10px 12px; font-size: 0.8rem; color: #64748b;
		line-height: 1.5; margin-bottom: 8px;
	}

	.load-menu-btn {
		width: 100%; padding: 8px 12px; margin-bottom: 8px;
		background: #fef9c3; border: 1.5px solid #facc15;
		border-radius: 8px; color: #92400e; font-size: 0.82rem;
		font-weight: bold; cursor: pointer; font-family: inherit;
		text-align: left;
	}
	.load-menu-btn:hover { background: #facc15; color: #0f172a; }

	.reserve-submit-btn {
		width: 100%; padding: 14px; background: #facc15; color: #0f172a;
		border: none; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer;
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
		background: #0f172a; color: white; z-index: 1000;
		display: flex; flex-direction: column; align-items: center;
		justify-content: center; padding: 20px; box-sizing: border-box;
	}
	.text-btn {
		background: none; border: none; color: white;
		text-decoration: underline; cursor: pointer; margin-top: 15px;
	}
	.qr-container {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 100%;
		max-width: 360px;
	}
	.qr-container h2 { margin: 0; font-size: 1.1rem; }
	.qr-container p { margin: 0; font-size: 0.85rem; opacity: 0.85; line-height: 1.5; }

	#qr-reader-map {
		width: 100%;
		border-radius: 12px;
		overflow: hidden;
	}
	:global(#qr-reader-map video) { border-radius: 12px; }
	:global(#qr-reader-map__scan_region) { background: transparent !important; }

	.qr-loading {
		display: flex; flex-direction: column; align-items: center; gap: 16px;
		color: white;
	}
	.qr-spinner {
		width: 48px; height: 48px;
		border: 4px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.qr-error {
		display: flex; flex-direction: column; align-items: center; gap: 12px;
		color: white;
	}
	.qr-error-icon {
		width: 64px; height: 64px; border-radius: 50%;
		background: rgba(239,68,68,0.3);
		display: flex; align-items: center; justify-content: center;
		font-size: 1.8rem; font-weight: 700;
	}

	/* 利用中ダッシュボード */
	.active-dashboard {
		position: absolute; top: 0; left: 0; width: 100%; height: 100%;
		background: white; z-index: 1000; padding: 20px; padding-top: 80px;
		box-sizing: border-box; display: flex; flex-direction: column; overflow-y: auto;
	}
	.status-bar {
		background: #dcfce7; color: #166534; padding: 10px;
		border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 24px;
	}
	.blinking { animation: blink 1s infinite; }
	@keyframes blink { 50% { opacity: 0; } }
	.sales-form h3 { font-size: 1rem; color: #0f172a; margin: 0 0 16px 0; }
	.input-group {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 10px; padding: 12px 14px;
		background: #f8fafc; border-radius: 12px;
	}
	.item-info { display: flex; flex-direction: column; gap: 2px; }
	.item-label { font-size: 0.9rem; color: #334155; font-weight: 500; }
	.item-unit-price { font-size: 0.75rem; color: #94a3b8; }
	.stepper { display: flex; align-items: center; gap: 12px; }
	.stepper button {
		width: 32px; height: 32px; border-radius: 50%;
		border: 1px solid #cbd5e1; background: white;
		cursor: pointer; font-size: 1rem; color: #334155;
	}
	.stepper span {
		min-width: 28px; text-align: center;
		font-weight: bold; font-size: 1rem;
	}
	.total-sales {
		font-size: 1.15rem; font-weight: bold; text-align: right;
		margin-top: 16px; border-top: 2px solid #f1f5f9;
		padding-top: 16px; color: #0f172a;
	}
	.no-items {
		text-align: center; padding: 24px;
		color: #94a3b8; background: #f8fafc; border-radius: 12px;
	}
	.no-items p { margin: 0 0 6px 0; font-size: 0.9rem; }
	.no-items small { font-size: 0.78rem; }
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
		position: fixed; bottom: 0; left: 0; right: 0;
		height: 70px; background: white; display: flex;
		justify-content: space-around; align-items: stretch;
		border-top: 1px solid #e2e8f0; z-index: 800;
	}
	.nav-item {
		background: none; border: none; display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		color: #94a3b8; font-size: 0.7rem; gap: 4px;
		cursor: pointer; text-decoration: none;
		padding: 0 16px;
		border-bottom: 3px solid transparent;
		transition: color 0.15s, border-color 0.15s;
	}
	.nav-item.active {
		color: #0f172a;
		border-bottom-color: #f97316;
	}
	.nav-icon { width: 24px; height: 24px; object-fit: contain; }

	/* Dashboard Modal */
	.modal-overlay {
		position: absolute; top: 0; left: 0; width: 100%; height: 100%;
		background: rgba(0,0,0,0.5); z-index: 1000;
		display: flex; align-items: flex-end; justify-content: center;
	}
	.modal-content {
		background: #f8fafc; width: 100%; height: 90%;
		border-radius: 20px 20px 0 0; padding: 20px; box-sizing: border-box;
		overflow-y: auto; position: relative; box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
	}
	.dashboard-title { margin-top: 0; color: #0f172a; font-size: 1.5rem; }
	.dashboard-role-label { font-size: 0.85rem; color: #64748b; margin: -8px 0 16px 0; }
	.kpi-container { display: flex; gap: 15px; margin-bottom: 16px; }
	.kpi-card {
		flex: 1; background: white; padding: 15px; border-radius: 12px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; flex-direction: column;
	}
	.kpi-card.highlight { background: #0f172a; color: white; }
	.kpi-card.highlight .kpi-label { color: #94a3b8; }
	.kpi-label { font-size: 0.75rem; color: #64748b; margin-bottom: 5px; }
	.kpi-value { font-size: 1.3rem; font-weight: bold; }
	.fee-note {
		font-size: 0.78rem; color: #64748b; margin-top: 0;
		padding: 8px 12px; background: #f1f5f9; border-radius: 8px;
	}
	.sales-breakdown {
		background: white; border-radius: 12px; padding: 16px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.05);
	}
	.sales-breakdown h3 { font-size: 0.9rem; color: #334155; margin: 0 0 12px 0; }
	.breakdown-row {
		display: flex; justify-content: space-between; align-items: center;
		padding: 8px 0; border-bottom: 1px solid #f1f5f9;
		font-size: 0.9rem; color: #334155;
	}
	.breakdown-row:last-child { border-bottom: none; }
	.breakdown-count { font-weight: bold; color: #0f172a; }
	.empty-history { color: #94a3b8; text-align: center; padding: 20px; }
	/* 予約確認パネル */
	.modal-close-btn {
		position: absolute; top: 16px; right: 16px;
		background: none; border: none; font-size: 1.6rem;
		cursor: pointer; color: #64748b; line-height: 1;
	}
	.res-list { display: flex; flex-direction: column; gap: 12px; }
	.res-card {
		background: white; border-radius: 12px; padding: 14px 16px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.06);
	}
	.res-card-header {
		display: flex; justify-content: space-between; align-items: center;
		margin-bottom: 8px;
	}
	.res-space-name { font-size: 0.95rem; font-weight: 700; color: #0f172a; }
	.res-badge {
		font-size: 0.7rem; font-weight: 700; padding: 3px 10px;
		border-radius: 20px; white-space: nowrap;
	}
	.res-pending  { background: #dbeafe; color: #1d4ed8; }
	.res-active   { background: #dcfce7; color: #15803d; }
	.res-done     { background: #f1f5f9; color: #475569; }
	.res-cancelled { background: #fee2e2; color: #b91c1c; }
	.res-detail { font-size: 0.82rem; color: #475569; margin-bottom: 4px; }
	.res-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
	.res-action-btn {
		width: 100%; padding: 10px; border-radius: 8px;
		font-size: 0.85rem; font-weight: 600; font-family: inherit;
		cursor: pointer; border: none; text-align: center; text-decoration: none;
		display: block;
	}
	.res-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.res-action-scan  { background: #0f172a; color: white; }
	.res-action-return { background: #0f172a; color: white; }
	.res-action-cancel { background: none; border: 1.5px solid #cbd5e1; color: #64748b; }

	/* ライトボックス */
	.lightbox-overlay {
		position: fixed; inset: 0; z-index: 9999;
		background: rgba(0,0,0,0.85);
		display: flex; align-items: center; justify-content: center;
		padding: 20px;
	}
	.lightbox-img {
		max-width: 100%; max-height: 80svh;
		border-radius: 12px; object-fit: contain;
	}
	.lightbox-close {
		position: fixed; top: 16px; right: 16px;
		background: rgba(255,255,255,0.15); border: none;
		color: white; font-size: 1.6rem; width: 40px; height: 40px;
		border-radius: 50%; cursor: pointer; display: flex;
		align-items: center; justify-content: center;
	}
</style>
