<!-- 夜行人図鑑 -->
<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import seedNetwork from '$lib/assets/data/network.json';
	import DirectoryListView from '$lib/components/DirectoryListView.svelte';
	import NetworkGraph3D from '$lib/components/NetworkGraph3D.svelte';

	let graphData = $state(null);      // { nodes, links }
	let selectedId = $state(null);
	let usingSeed = $state(false);

	// グラフの人ノードから図鑑カードを組み立てる（データ源を一本化）
	let people = $derived(
		(graphData?.nodes ?? [])
			.filter((n) => n.type !== 'stall')
			.map((n) => ({
				id: n.id,
				name: n.name,
				age: n.age ?? '',
				status: n.status ?? '',
				image: n.img ?? '',
				message: n.message ?? ''
			}))
	);

	onMount(async () => {
		try {
			const res = await fetch('/api/network/graph');
			const data = res.ok ? await res.json() : { nodes: [] };
			if (data.nodes && data.nodes.length > 0) {
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

	function handleNodeClick(node) {
		if (node.type === 'stall') return; // 屋台ノードはカードなし
		selectedId = node.id;
		const el = document.getElementById(`yakonin-${node.id}`);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
</script>

<svelte:head><title>夜行人図鑑 | 微小夜行電灯</title></svelte:head>

<main>
	<h1 class="directory-title">夜行人図鑑</h1>
	<span class="separator"></span>
	<p class="directory-description">
		夜行人図鑑とは屋台に集まったちょっと変わったところのある人が発する迷言や名言を図鑑にして残していくものです。
	</p>

	<!-- 3D 人脈ネットワーク -->
	<section class="network-section">
		<h2 class="network-heading">夜行人ネットワーク</h2>
		<p class="network-hint">🖱 ドラッグで回転・ピンチで拡大・ノードをタップで詳細へ</p>
		{#if graphData}
			<NetworkGraph3D data={graphData} onNodeClick={handleNodeClick} />
		{:else}
			<div class="graph-skeleton"><div class="spinner"></div></div>
		{/if}
		<div class="join-cta">
			<a href="{base}/yakonin/setup" class="join-btn">＋ 自分も夜行人ネットワークに参加する</a>
		</div>
	</section>

	{#if people.length > 0}
		<DirectoryListView directoryList={people} {selectedId} />
	{/if}
	<span class="separator"></span>
</main>

<style>
	main {
		max-width: 15cm;
		margin: auto;
		display: flex;
		flex-direction: column;
		padding: 0 16px;
		box-sizing: border-box;
	}

	.directory-title {
		text-align: center;
		color: #26201a;
		margin-bottom: 1rem;
		margin-top: 2rem;
	}

	.directory-description {
		margin-bottom: 2rem;
		line-height: 1.75;
		color: #4a3f38;
		font-size: 0.95rem;
	}

	.network-section { margin-bottom: 2.5rem; }
	.network-heading { font-size: 1.05rem; color: #26201a; margin-bottom: 0.4rem; letter-spacing: 0.04em; }
	.network-hint { font-size: 0.78rem; color: #9e8f7a; margin-bottom: 0.8rem; }

	.graph-skeleton {
		width: 100%; height: 60vh; min-height: 340px; border-radius: 16px;
		border: 1px solid #ede4d5; background: #faf8f5;
		display: flex; align-items: center; justify-content: center;
	}
	.spinner {
		width: 40px; height: 40px; border: 4px solid #ece3d6; border-top-color: #d56d04;
		border-radius: 50%; animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	.join-cta { text-align: center; margin-top: 14px; }
	.join-btn {
		display: inline-block; padding: 11px 22px; border-radius: 100px;
		background: #fff; border: 1.5px solid #d56d04; color: #d56d04;
		font-size: 0.85rem; font-weight: 700; text-decoration: none; transition: all 0.15s;
	}
	.join-btn:hover { background: #d56d04; color: #fff; }

	.separator {
		display: block;
		background-color: #d56d04;
		width: 60px;
		height: 1px;
		margin: 16px 0;
	}
</style>
