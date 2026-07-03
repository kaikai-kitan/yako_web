<!--
	夜行人ネットワーク 3D 可視化
	友人の O_noder（Python/Flask + Google Sheets）の 3d-force-graph 描画部を
	SvelteKit + クライアントサイド完結型に移植・拡張したもの。

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

	// ロール → 色（ハロー表示用）
	const ROLE_COLOR = {
		'屋台営業者': '#d56d04',
		'屋台オーナー': '#e0a72e',
		'土地オーナー': '#22a06b'
	};
	const DEFAULT_COLOR = '#b9ab97';

	// つながり数 → アイコン倍率（依頼の例に沿った区分線形補間）
	const SIZE_STOPS = [[0, 1], [5, 1.5], [30, 3], [70, 5], [100, 8], [300, 20]];
	function sizeMultiplier(deg) {
		if (deg <= 0) return 1;
		for (let i = 1; i < SIZE_STOPS.length; i++) {
			const [d0, m0] = SIZE_STOPS[i - 1];
			const [d1, m1] = SIZE_STOPS[i];
			if (deg <= d1) return m0 + ((deg - d0) / (d1 - d0)) * (m1 - m0);
		}
		return SIZE_STOPS[SIZE_STOPS.length - 1][1]; // 300+ は 20x で頭打ち
	}
	const BASE = 12;

	// links から「人とのつながり数」を数える（屋台リンクは除外）
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

	function placeholderTexture(THREE, name, ringColor) {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.fillStyle = '#e9dcc8';
		ctx.fill();
		ctx.lineWidth = size * 0.08;
		ctx.strokeStyle = ringColor;
		ctx.stroke();
		ctx.fillStyle = '#7a6a4c';
		ctx.font = `bold ${size * 0.42}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText((name || '?').charAt(0), size / 2, size / 2 + size * 0.02);
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

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
		// ロール色のリング
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2 - size * 0.04, 0, 2 * Math.PI);
		ctx.lineWidth = size * 0.08;
		ctx.strokeStyle = ringColor;
		ctx.stroke();
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	// 孤立ノードを半径 R の球殻へ寄せるカスタムフォース（土星の環）
	function isolatedRingForce(radius, strength) {
		let nodes = [];
		function force() {
			for (const n of nodes) {
				if (!n.__isolated) continue;
				const d = Math.hypot(n.x || 0, n.y || 0, n.z || 0) || 1e-6;
				const k = ((radius - d) / d) * strength;
				n.vx = (n.vx || 0) + (n.x || 0) * k;
				n.vy = (n.vy || 0) + (n.y || 0) * k;
				n.vz = (n.vz || 0) + (n.z || 0) * k;
			}
		}
		force.initialize = (n) => { nodes = n; };
		return force;
	}

	onMount(async () => {
		mounted = true;

		const [{ default: ForceGraph3D }, THREE, { default: SpriteText }] = await Promise.all([
			import('3d-force-graph'),
			import('three'),
			import('three-spritetext')
		]);
		if (!mounted || !container) return;

		// データ準備：degree/isolated/サイズを各ノードへ付与
		const prepared = structuredClone(data);
		const deg = computeDegrees(prepared.nodes, prepared.links);
		const isolatedCount = prepared.nodes.filter(
			(n) => n.type !== 'stall' && (deg[n.id] ?? 0) === 0
		).length;
		const ringRadius = Math.max(220, 120 + isolatedCount * 12);

		for (const n of prepared.nodes) {
			const d = deg[n.id] ?? n.degree ?? 0;
			n.__deg = d;
			n.__isolated = n.type !== 'stall' && d === 0;
			n.__mult = n.type === 'stall' ? 1.2 : sizeMultiplier(d);
		}

		graph = new ForceGraph3D(container)
			.backgroundColor('#0f0b07')
			.showNavInfo(false)
			.nodeLabel((n) => (n.type === 'stall' ? `🏮 ${n.name}` : n.name))
			.linkColor((l) => (l.origin === 'stall' ? '#5b4a33' : '#d56d04'))
			.linkOpacity(0.4)
			.linkWidth(0.5)
			.linkDirectionalParticles((l) => (l.origin === 'covisit' ? 0 : 2))
			.linkDirectionalParticleWidth(1.1)
			.linkDirectionalParticleColor(() => '#e8b06a')
			.nodeThreeObject((node) => {
				const group = new THREE.Group();
				const scale = BASE * (node.__mult ?? 1);

				if (node.type === 'stall') {
					const label = new SpriteText(`🏮 ${node.name}`);
					label.color = '#e0c070';
					label.backgroundColor = 'rgba(40,30,15,0.6)';
					label.padding = 2;
					label.textHeight = 6;
					group.add(label);
					return group;
				}

				const ringColor = ROLE_COLOR[node.roles?.[0]] ?? DEFAULT_COLOR;
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
				label.color = '#f3ece0';
				label.textHeight = Math.max(4, scale * 0.22);
				label.position.set(0, -(scale / 2 + label.textHeight), 0);
				group.add(label);

				return group;
			})
			.onNodeClick((node) => {
				const dist = 40 + (node.__mult ?? 1) * 30;
				const r = 1 + dist / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
				graph.cameraPosition(
					{ x: (node.x || 0) * r, y: (node.y || 0) * r, z: (node.z || 0) * r },
					node,
					900
				);
				onNodeClick?.(node);
			});

		graph.graphData(prepared);

		// 孤立ノードを外周リングへ
		graph.d3Force('isolatedRing', isolatedRingForce(ringRadius, 0.06));

		syncSize();

		const controls = graph.controls();
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.7;

		graph.onEngineStop(() => graph.zoomToFit(700, 60));

		resizeObs = new ResizeObserver(syncSize);
		resizeObs.observe(container);
	});

	function syncSize() {
		if (!graph || !container) return;
		graph.width(container.clientWidth).height(container.clientHeight);
	}

	onDestroy(() => {
		mounted = false;
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
		background: #0f0b07;
		touch-action: none;
	}
	.graph-host :global(canvas) {
		display: block;
	}
</style>
