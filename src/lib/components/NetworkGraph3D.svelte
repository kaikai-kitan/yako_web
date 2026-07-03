<!--
	夜行人ネットワーク 3D 可視化
	友人の O_noder（Python/Flask + Google Sheets）の 3d-force-graph 描画部を
	SvelteKit + クライアントサイド完結型に移植したもの。
	レイアウト計算はブラウザ内（three.js）で行うため、バックエンドは {nodes, links} を返すだけでよい。

	props:
	  data       : { nodes: [{ id, name, img, ... }], links: [{ source, target }] }
	  onNodeClick: (node) => void   ノードタップ時のコールバック
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';

	let { data, onNodeClick } = $props();

	let container = $state();
	let graph = null;
	let resizeObs = null;
	let mounted = false;

	// name の頭文字プレースホルダ円を描く
	function placeholderTexture(THREE, name) {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.fillStyle = '#e9dcc8';
		ctx.fill();
		ctx.fillStyle = '#8a7a5c';
		ctx.font = `bold ${size * 0.42}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText((name || '?').charAt(0), size / 2, size / 2 + size * 0.02);
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	// 画像を円形にクリップしたテクスチャを作る（O_noder の実装を踏襲）
	function circleTexture(THREE, img) {
		const size = 256;
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d');
		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.clip();
		const m = Math.min(img.width, img.height);
		ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
		const tex = new THREE.Texture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.needsUpdate = true;
		return tex;
	}

	onMount(async () => {
		mounted = true;

		// SSR を避けるため onMount 内で動的 import（three.js はブラウザ専用）
		const [{ default: ForceGraph3D }, THREE, { default: SpriteText }] = await Promise.all([
			import('3d-force-graph'),
			import('three'),
			import('three-spritetext')
		]);

		if (!mounted || !container) return;

		graph = new ForceGraph3D(container)
			.backgroundColor('#faf8f5')
			.showNavInfo(false)
			.nodeRelSize(6)
			.nodeLabel((n) => n.name)
			.linkColor(() => '#d56d04')
			.linkOpacity(0.45)
			.linkWidth(0.6)
			.linkDirectionalParticles(2)
			.linkDirectionalParticleWidth(1.2)
			.linkDirectionalParticleColor(() => '#e8b06a')
			.nodeThreeObject((node) => {
				const group = new THREE.Group();

				const material = new THREE.SpriteMaterial({ map: placeholderTexture(THREE, node.name) });
				const sprite = new THREE.Sprite(material);
				sprite.scale.set(22, 22, 1);
				group.add(sprite);

				// 画像があれば非同期で差し替え
				if (node.img) {
					const image = new Image();
					image.crossOrigin = 'Anonymous';
					image.onload = () => {
						sprite.material.map = circleTexture(THREE, image);
						sprite.material.needsUpdate = true;
					};
					image.src = node.img.startsWith('http') ? node.img : base + node.img;
				}

				const label = new SpriteText(node.name);
				label.color = '#26201a';
				label.textHeight = 4.5;
				label.fontWeight = '600';
				label.position.set(0, -16, 0);
				group.add(label);

				return group;
			})
			.onNodeClick((node) => {
				// クリックしたノードへカメラを寄せる
				const dist = 90;
				const ratio = 1 + dist / Math.hypot(node.x || 1, node.y || 1, node.z || 1);
				graph.cameraPosition(
					{ x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
					node,
					900
				);
				onNodeClick?.(node);
			});

		graph.graphData(structuredClone(data));

		// 初期サイズ
		syncSize();

		// 自動回転（OrbitControls 内蔵機能）
		const controls = graph.controls();
		controls.autoRotate = true;
		controls.autoRotateSpeed = 0.8;

		// レイアウト収束後に全体が収まるようズーム
		graph.onEngineStop(() => graph.zoomToFit(600, 30));

		// コンテナのリサイズに追従
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

<div class="graph-host" bind:this={container}></div>

<style>
	.graph-host {
		width: 100%;
		height: 60vh;
		min-height: 340px;
		border-radius: 16px;
		overflow: hidden;
		background: #faf8f5;
		border: 1px solid #ede4d5;
		touch-action: none; /* 3D ドラッグ操作を優先 */
	}
	.graph-host :global(canvas) {
		display: block;
	}
</style>
