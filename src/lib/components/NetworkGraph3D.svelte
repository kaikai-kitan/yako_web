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

	let { data, onNodeClick, height = '60vh' } = $props();

	let container = $state();
	let graph = null;
	let resizeObs = null;
	let mounted = false;
	let resumeTimer = null;

	const ROLE_COLOR = {
		'屋台営業者': '#d56d04',
		'屋台オーナー': '#e0a72e',
		'土地オーナー': '#22a06b'
	};
	const DEFAULT_RING = '#cbb48f';

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

	// 円形アイコン（＋ロール色の細いリング）
	function circleTexture(THREE, img, ringColor) {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.save();
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.clip();
		const m = Math.min(img.width, img.height);
		ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
		ctx.restore();
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - size * 0.03, 0, 2 * Math.PI);
		ctx.lineWidth = size * 0.06;
		ctx.strokeStyle = ringColor;
		ctx.stroke();
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	// 画像なしのプレースホルダ（頭文字＋ロール色リング）
	function placeholderTexture(THREE, name, ringColor) {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.fillStyle = '#efe7da';
		ctx.fill();
		ctx.lineWidth = size * 0.06;
		ctx.strokeStyle = ringColor;
		ctx.stroke();
		ctx.fillStyle = '#8a7a5c';
		ctx.font = `bold ${size * 0.4}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText((name || '?').charAt(0), size / 2, size / 2 + size * 0.02);
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

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
		const prepared = JSON.parse(JSON.stringify(data));
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

		graph = new ForceGraph3D(container)
			.backgroundColor('#ffffff')
			.showNavInfo(false)
			.enableNodeDrag(false)
			.nodeLabel((n) => (n.type === 'stall' ? `🏮 ${n.name}` : n.name))
			.linkColor((l) => (l.origin === 'stall' ? '#c9b48f' : '#111111'))
			.linkOpacity(0.5)
			.linkWidth(0.4)
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

				const ringColor = ROLE_COLOR[node.roles?.[0]] ?? DEFAULT_RING;
				const material = new THREE.SpriteMaterial({
					map: placeholderTexture(THREE, node.name, ringColor)
				});
				const sprite = new THREE.Sprite(material);
				sprite.scale.set(scale, scale, 1);
				group.add(sprite);

				if (node.img) {
					const image = new Image();
					image.crossOrigin = 'Anonymous';
					image.onload = () => {
						sprite.material.map = circleTexture(THREE, image, ringColor);
						sprite.material.needsUpdate = true;
					};
					image.src = node.img.startsWith('http') ? node.img : base + node.img;
				}

				const label = new SpriteText(node.name);
				label.color = '#26201a';
				label.textHeight = Math.max(4, scale * 0.2);
				label.position.set(0, -(scale / 2 + label.textHeight), 0);
				group.add(label);

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
			try { graph.zoomToFit(700, 60); } catch { /* noop */ }
		});

		resizeObs = new ResizeObserver(syncSize);
		resizeObs.observe(container);
	});

	function syncSize() {
		if (!graph || !container) return;
		const w = container.clientWidth || 300;
		const h = container.clientHeight || 300;
		graph.width(w).height(h);
	}

	onDestroy(() => {
		mounted = false;
		if (resumeTimer) clearTimeout(resumeTimer);
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
		background: #ffffff;
		touch-action: none;
	}
	.graph-host :global(canvas) {
		display: block;
	}
</style>
