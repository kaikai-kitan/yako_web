<!-- 夜行人図鑑（説明 + 今日の話題の夜行人） -->
<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import seedNetwork from '$lib/assets/data/network.json';

	const ROLE_COLOR = {
		'屋台営業者': '#d56d04',
		'屋台オーナー': '#e0a72e',
		'土地オーナー': '#22a06b',
		'流浪人': '#7d8aa5'
	};

	let featured = $state([]); // 今日の話題の夜行人

	// 日付シードの簡易乱数（毎日同じ並び、日が変わると変わる）
	function seededPick(people, n) {
		const today = new Date();
		const seedBase = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
		const scored = people.map((p) => {
			let h = seedBase;
			const s = String(p.id);
			for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000007;
			// つながりが多い人ほど「話題」になりやすいよう軽く加点
			return { p, score: (h % 1000) + (p.degree ?? 0) * 3 };
		});
		scored.sort((a, b) => b.score - a.score);
		return scored.slice(0, n).map((x) => x.p);
	}

	onMount(async () => {
		let persons = [];
		try {
			const res = await fetch('/api/network/graph');
			const data = res.ok ? await res.json() : { nodes: [] };
			persons = (data.nodes ?? []).filter((n) => n.type !== 'stall');
		} catch { /* noop */ }

		if (persons.length < 2) {
			persons = seedNetwork.nodes.filter((n) => n.type !== 'stall');
		}
		featured = seededPick(persons, Math.min(3, persons.length));
	});
</script>

<svelte:head><title>夜行人図鑑 | 微小夜行電灯</title></svelte:head>

<main>
	<h1 class="title">夜行人図鑑</h1>
	<span class="sep"></span>
	<p class="lead">
		夜行人図鑑とは、屋台に集まった<strong>ちょっと変わったところのある人</strong>たちが発する
		迷言や名言を図鑑として残していく試みです。<br />
		屋台をきっかけに生まれた縁は、夜ごと少しずつ広がっていきます。
		その繋がりを 3D の星図のように可視化したのが「夜行人ネットワーク」です。
	</p>

	<a href="{base}/network" class="network-cta">🕸 夜行人ネットワークを見る（3D）</a>

	<!-- 今日の話題の夜行人 -->
	<section class="featured">
		<h2 class="featured-title">✨ 今日の話題の夜行人</h2>
		<p class="featured-sub">毎日入れ替わる、注目の夜行人たち</p>

		{#if featured.length === 0}
			<p class="muted">まだ登録された夜行人がいません。</p>
		{:else}
			<div class="cards">
				{#each featured as p}
					<a href="{base}/network" class="card">
						{#if p.img}
							<img src={p.img.startsWith('http') ? p.img : base + p.img} alt={p.name} class="avatar" />
						{:else}
							<div class="avatar placeholder">{p.name?.charAt(0) ?? '?'}</div>
						{/if}
						<div class="card-body">
							<span class="card-name">{p.name}</span>
							{#if p.roles?.length}
								<span class="card-roles">
									{#each p.roles as r}
										<span class="rc" style="border-color:{ROLE_COLOR[r] ?? '#b9ab97'};color:{ROLE_COLOR[r] ?? '#b9ab97'}">{r}</span>
									{/each}
								</span>
							{/if}
							{#if p.message}<span class="card-msg">{p.message}</span>{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<div class="join">
		<p>あなたも夜行人として星図に加わりませんか？</p>
		<a href="{base}/yakonin/setup" class="join-btn">＋ 夜行人ネットワークに参加する</a>
	</div>
	<span class="sep"></span>
</main>

<style>
	main { max-width: 15cm; margin: auto; padding: 2rem 16px 3rem; box-sizing: border-box; display: flex; flex-direction: column; }
	.title { text-align: center; color: #26201a; margin: 0 0 1rem; }
	.lead { line-height: 1.85; color: #4a3f38; font-size: 0.95rem; margin: 0 0 1.6rem; }
	.muted { color: #9e8f7a; font-size: 0.85rem; text-align: center; }
	.sep { display: block; background: #d56d04; width: 60px; height: 1px; margin: 16px 0; }

	.network-cta {
		display: block; text-align: center; text-decoration: none;
		background: #1a1410; color: #e8c97a; font-weight: 700; font-size: 0.95rem;
		padding: 15px; border-radius: 14px; letter-spacing: 0.04em; margin-bottom: 2.4rem;
		transition: background 0.15s;
	}
	.network-cta:hover { background: #26201a; }

	.featured-title { font-size: 1.05rem; color: #26201a; margin: 0 0 0.2rem; }
	.featured-sub { font-size: 0.78rem; color: #9e8f7a; margin: 0 0 1rem; }
	.cards { display: flex; flex-direction: column; gap: 12px; }
	.card {
		display: flex; align-items: center; gap: 14px; padding: 14px;
		background: #fff; border: 1px solid #ede4d5; border-radius: 14px;
		text-decoration: none; transition: border-color 0.15s, transform 0.15s;
	}
	.card:hover { border-color: #d56d04; transform: translateY(-2px); }
	.avatar { width: 54px; height: 54px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
	.avatar.placeholder { display: flex; align-items: center; justify-content: center; background: #e9dcc8; color: #7a6a4c; font-weight: 700; font-size: 1.4rem; }
	.card-body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
	.card-name { font-size: 0.95rem; font-weight: 700; color: #26201a; }
	.card-roles { display: flex; gap: 5px; flex-wrap: wrap; }
	.rc { font-size: 0.66rem; font-weight: 700; padding: 1px 7px; border: 1px solid; border-radius: 100px; }
	.card-msg { font-size: 0.8rem; color: #6b5f54; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.join { text-align: center; margin-top: 2.4rem; }
	.join p { font-size: 0.88rem; color: #6b5f54; margin: 0 0 12px; }
	.join-btn {
		display: inline-block; padding: 12px 24px; border-radius: 100px;
		background: #fff; border: 1.5px solid #d56d04; color: #d56d04;
		font-size: 0.88rem; font-weight: 700; text-decoration: none; transition: all 0.15s;
	}
	.join-btn:hover { background: #d56d04; color: #fff; }
</style>
