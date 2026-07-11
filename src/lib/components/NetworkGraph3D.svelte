<!--
	夜行人ネットワーク 3D 可視化
	友人の O_noder（three.js + 3d-force-graph）のデザインに寄せた版。
	白背景・円形アイコン・細い黒リンク・全方位オービット回転。

	props:
	  data        : { nodes: [{ id, name, img, roles, degree, type }], links: [{ source, target, origin }] }
	  onNodeClick : (node) => void
	  height      : CSS 高さ（既定 '60vh'。/network ではフルスクリーン）
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';

	let { data, onNodeClick, height = '60vh', highlightRole = null } = $props();

	let container = $state();
	let graph = null;
	let resizeObs = null;
	let mounted = false;
	let ready = false;
	let resumeTimer = null;
	let prepared = null;
	let currentHighlight = null;
	let roamRAF = null;        // 放浪者（契約中法人）の周回アニメーション
	let roamStarted = false;
	let roamNodes = [];
	let roamRadius = 260;

	const ROLE_COLOR = {
		'屋台営業者': '#b85c2b',
		'屋台オーナー': '#b5892e',
		'土地オーナー': '#5f7a52',
		'流浪人': '#6b7688'
	};
	const DEFAULT_RING = '#6b7688';

	const BG = '#ece4d6'; // 立体感を出すためのわずかに暖色グレー（和紙）

	// つながり数 → アイコン倍率（依頼の例に沿った区分線形補間）
	const SIZE_STOPS = [[0, 1], [5, 1.5], [30, 3], [70, 5], [100, 8], [300, 20]];
	function sizeMultiplier(deg) {
		if (!deg || deg <= 0) return 1;
		for (let i = 1; i < SIZE_STOPS.length; i++) {
			const [d0, m0] = SIZE_STOPS[i - 1];
			const [d1, m1] = SIZE_STOPS[i];
			if (deg <= d1) return m0 + ((deg - d0) / (d1 - d0)) * (m1 - m0);
		}
		return SIZE_STOPS[SIZE_STOPS.length - 1][1];
	}
	const BASE = 18;

	function computeDegrees(nodes, links) {
		const deg = {};
		for (const n of nodes) deg[n.id] = 0;
		for (const l of links) {
			if (l.origin === 'stall') continue;
			const s = typeof l.source === 'object' ? l.source.id : l.source;
			const t = typeof l.target === 'object' ? l.target.id : l.target;
			if (s in deg) deg[s]++;
			if (t in deg) deg[t]++;
		}
		return deg;
	}

	const TEX = 320;      // テクスチャ解像度
	const R = TEX * 0.46; // 半径（端に余白を残しリングの見切れを防ぐ）

	// 買い切りアイコン形状（circle 既定）。中心 c・半径 R のパスを ctx に描く（塗り/クリップ/線は呼び出し側）
	function traceShape(ctx, shape, c, R) {
		ctx.beginPath();
		if (shape === 'diamond') {
			ctx.moveTo(c, c - R); ctx.lineTo(c + R, c); ctx.lineTo(c, c + R); ctx.lineTo(c - R, c); ctx.closePath();
		} else if (shape === 'hexagon') {
			for (let i = 0; i < 6; i++) {
				const a = (Math.PI / 180) * (60 * i - 30);
				const x = c + R * Math.cos(a), y = c + R * Math.sin(a);
				i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
			}
			ctx.closePath();
		} else if (shape === 'star') {
			const spikes = 5, outer = R, inner = R * 0.46, rot = -Math.PI / 2;
			for (let i = 0; i < spikes * 2; i++) {
				const rr = i % 2 ? inner : outer;
				const a = rot + (i * Math.PI) / spikes;
				const x = c + rr * Math.cos(a), y = c + rr * Math.sin(a);
				i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
			}
			ctx.closePath();
		} else if (shape === 'heart') {
			ctx.moveTo(c, c + R * 0.42);
			ctx.bezierCurveTo(c + R * 1.05, c - R * 0.35, c + R * 0.5, c - R * 1.02, c, c - R * 0.30);
			ctx.bezierCurveTo(c - R * 0.5, c - R * 1.02, c - R * 1.05, c - R * 0.35, c, c + R * 0.42);
			ctx.closePath();
		} else {
			ctx.arc(c, c, R, 0, 2 * Math.PI);
		}
	}

	// アイコン画像（＋ロール色の細いリング）。中央を正方形 cover クロップし、形状でクリップ。
	function circleTexture(THREE, img, ringColor, shape = 'circle') {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = TEX;
		const ctx = canvas.getContext('2d');
		const cx = TEX / 2;
		ctx.save();
		traceShape(ctx, shape, cx, R);
		ctx.clip();
		const m = Math.min(img.width, img.height);        // 短辺で正方形に切り出す
		const sx = (img.width - m) / 2;
		const sy = (img.height - m) / 2;
		ctx.drawImage(img, sx, sy, m, m, cx - R, cx - R, R * 2, R * 2);
		ctx.restore();
		traceShape(ctx, shape, cx, R);
		ctx.lineWidth = TEX * 0.05;
		ctx.strokeStyle = ringColor;
		ctx.lineJoin = 'round';
		ctx.stroke();
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	// 画像なしのプレースホルダ（頭文字＋ロール色リング）
	function placeholderTexture(THREE, name, ringColor, shape = 'circle') {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = TEX;
		const ctx = canvas.getContext('2d');
		const cx = TEX / 2;
		traceShape(ctx, shape, cx, R);
		ctx.fillStyle = '#efe7da';
		ctx.fill();
		ctx.lineWidth = TEX * 0.05;
		ctx.strokeStyle = ringColor;
		ctx.lineJoin = 'round';
		ctx.stroke();
		ctx.fillStyle = '#8a7a5c';
		ctx.font = `bold ${TEX * 0.36}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText((name || '?').charAt(0), cx, cx + TEX * 0.02);
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	// ロールハイライト：該当ロールのノードだけ強調、他を減光
	function nodeMatches(n, role) {
		return n && n.type !== 'stall' && (n.roles || []).includes(role);
	}
	function applyHighlight(role) {
		currentHighlight = role || null;
		if (!prepared) return;
		for (const n of prepared.nodes) {
			const op = !role ? 1 : nodeMatches(n, role) ? 1 : 0.1;
			if (n.__sprite) { n.__sprite.material.transparent = true; n.__sprite.material.opacity = op; }
			if (n.__label) { n.__label.material.transparent = true; n.__label.material.opacity = op; }
		}
		if (graph) {
			graph.linkOpacity((l) => {
				if (!currentHighlight) return 0.5;
				const s = typeof l.source === 'object' ? l.source : null;
				const t = typeof l.target === 'object' ? l.target : null;
				return nodeMatches(s, currentHighlight) || nodeMatches(t, currentHighlight) ? 0.6 : 0.04;
			});
		}
	}

	$effect(() => {
		const role = highlightRole; // 依存にする
		if (ready) applyHighlight(role);
	});

	onMount(async () => {
		mounted = true;

		const [{ default: ForceGraph3D }, THREE, { default: SpriteText }, d3force] = await Promise.all([
			import('3d-force-graph'),
			import('three'),
			import('three-spritetext'),
			import('d3-force-3d')
		]);
		if (!mounted || !container) return;

		// JSON ディープクローン（Svelte 5 の $state プロキシは structuredClone 不可）
		prepared = JSON.parse(JSON.stringify(data));
		const deg = computeDegrees(prepared.nodes, prepared.links);
		let isolatedCount = 0;
		for (const n of prepared.nodes) {
			const d = deg[n.id] ?? n.degree ?? 0;
			n.__deg = d;
			n.__isolated = n.type !== 'stall' && d === 0;
			n.__mult = n.type === 'stall' ? 1 : sizeMultiplier(d);
			if (n.__isolated) isolatedCount++;
		}
		const ringRadius = Math.max(180, 110 + isolatedCount * 10);

		// 契約中の法人（adActive）は「放浪者」として外周を周回させる
		roamNodes = prepared.nodes.filter((n) => n.type === 'person' && n.adActive);
		roamRadius = Math.max(ringRadius + 90, 240);

		graph = new ForceGraph3D(container)
			.backgroundColor(BG)
			.showNavInfo(false)
			.enableNodeDrag(false)
			.nodeLabel((n) => (n.type === 'stall' ? `🏮 ${n.name}` : n.name))
			.linkColor((l) => (l.origin === 'stall' ? '#b9a888' : '#3a3128'))
			.linkOpacity(0.5)
			.linkWidth(0.5)
			.nodeThreeObject((node) => {
				const group = new THREE.Group();
				const scale = BASE * (node.__mult ?? 1);

				if (node.type === 'stall') {
					const label = new SpriteText(`🏮 ${node.name}`);
					label.color = '#8a5a12';
					label.textHeight = 6;
					group.add(label);
					return group;
				}

				const ringColor = node.adActive ? '#b5892e' : (ROLE_COLOR[node.roles?.[0]] ?? DEFAULT_RING);
				const shape = node.shape || 'circle';
				const material = new THREE.SpriteMaterial({
					map: placeholderTexture(THREE, node.name, ringColor, shape),
					transparent: true
				});
				const sprite = new THREE.Sprite(material);
				sprite.scale.set(scale, scale, 1);
				group.add(sprite);
				node.__sprite = sprite;
				node.__group = group;

				if (node.img) {
					const image = new Image();
					image.crossOrigin = 'Anonymous';
					image.onload = () => {
						sprite.material.map = circleTexture(THREE, image, ringColor, shape);
						sprite.material.needsUpdate = true;
					};
					image.src = node.img.startsWith('http') ? node.img : base + node.img;
				}

				const label = new SpriteText(node.name);
				label.color = '#26201a';
				label.material.transparent = true;
				label.textHeight = Math.max(4, scale * 0.2);
				label.position.set(0, -(scale / 2 + label.textHeight), 0);
				group.add(label);
				node.__label = label;

				return group;
			})
			.onNodeClick((node) => {
				const dist = 60 + (node.__mult ?? 1) * 30;
				const h = Math.hypot(node.x || 0, node.y || 0, node.z || 0) || 1;
				const r = 1 + dist / h;
				graph.cameraPosition(
					{ x: (node.x || 0) * r, y: (node.y || 0) * r, z: (node.z || 0) * r },
					node,
					900
				);
				onNodeClick?.(node);
			});

		graph.graphData(prepared);

		// 立体感を出すフォグ（遠いノードが背景に溶ける＝奥行き知覚）
		try {
			const scene = graph.scene();
			scene.fog = new THREE.Fog(BG, 240, 1100);
		} catch { /* noop */ }

		// 孤立ノード（流浪人）を安定した radial 力で外周へ（土星の環）
		if (isolatedCount > 0 && d3force?.forceRadial) {
			graph.d3Force(
				'isolatedRadial',
				d3force.forceRadial(ringRadius, 0, 0, 0).strength((n) => (n.__isolated ? 0.35 : 0))
			);
		}

		syncSize();

		// 自動回転（操作中は一時停止 → 数秒後に再開）。全方位オービットは既定で可能。
		const controls = graph.controls();
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.6;
		controls.addEventListener('start', () => {
			controls.autoRotate = false;
			if (resumeTimer) clearTimeout(resumeTimer);
		});
		controls.addEventListener('end', () => {
			if (resumeTimer) clearTimeout(resumeTimer);
			resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 4000);
		});

		graph.onEngineStop(() => {
			startRoaming(); // レイアウト確定後に放浪者の周回を開始
			try { graph.zoomToFit(700, 80); } catch { /* noop */ }
			// 単一・少数ノードでカメラが寄りすぎて見切れるのを防ぐ（最小距離）
			try {
				const cam = graph.cameraPosition();
				const dist = Math.hypot(cam.x || 0, cam.y || 0, cam.z || 0);
				const MIN = 160;
				if (isFinite(dist) && dist < MIN) {
					if (dist < 1) graph.cameraPosition({ x: 0, y: 0, z: MIN });
					else {
						const k = MIN / dist;
						graph.cameraPosition({ x: cam.x * k, y: cam.y * k, z: cam.z * k });
					}
				}
			} catch { /* noop */ }
		});

		ready = true;
		// スプライトはレンダリングループで後から生成されるため、少し遅延して初期ハイライトを適用
		setTimeout(() => applyHighlight(highlightRole), 400);

		resizeObs = new ResizeObserver(syncSize);
		resizeObs.observe(container);
	});

	// 放浪者（契約中法人）を外周でゆっくり周回させる。各ノードで半径・位相・上下動を変える。
	function startRoaming() {
		if (roamStarted || roamNodes.length === 0) return;
		roamStarted = true;
		const t0 = performance.now();
		const step = (now) => {
			const t = (now - t0) * 0.00016;
			for (let i = 0; i < roamNodes.length; i++) {
				const n = roamNodes[i];
				const rad = roamRadius + i * 26;
				const phase = i * 2.3999; // 黄金角で分散
				const a = t + phase;
				const x = rad * Math.cos(a);
				const z = rad * Math.sin(a);
				const y = (50 + i * 8) * Math.sin(a * 0.7 + phase);
				// node座標とThreeオブジェクトの両方を更新（エンジン停止後も動かすため）
				n.x = n.fx = x; n.y = n.fy = y; n.z = n.fz = z;
				if (n.__group) n.__group.position.set(x, y, z);
			}
			roamRAF = requestAnimationFrame(step);
		};
		roamRAF = requestAnimationFrame(step);
	}

	function syncSize() {
		if (!graph || !container) return;
		const w = container.clientWidth || 300;
		const h = container.clientHeight || 300;
		graph.width(w).height(h);
	}

	onDestroy(() => {
		mounted = false;
		if (resumeTimer) clearTimeout(resumeTimer);
		if (roamRAF) cancelAnimationFrame(roamRAF);
		resizeObs?.disconnect();
		if (graph) {
			graph._destructor?.();
			graph = null;
		}
	});
</script>

<div class="graph-host" bind:this={container} style="height: {height};"></div>

<style>
	.graph-host {
		width: 100%;
		min-height: 320px;
		background: #ece4d6;
		touch-action: none;
	}
	.graph-host :global(canvas) {
		display: block;
	}
</style>
