<!-- 夜行人図鑑（説明 + 今日の夜行人） -->
<script>
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import seedNetwork from '$lib/assets/data/network.json';
	import Icon from '$lib/components/Icon.svelte';

	// 抑えた和の配色（グラフと共通）
	const ROLE_COLOR = {
		'屋台営業者': '#b85c2b',
		'屋台オーナー': '#b5892e',
		'土地オーナー': '#5f7a52',
		'流浪人': '#6b7688'
	};

	let featured = $state([]); // 今日の夜行人

	// 日付シードで決定的に並べ替える（1日1回変わる・公平ローテーション）
	function dailySort(people) {
		const today = new Date();
		const seedBase = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
		return people
			.map((p) => {
				let h = seedBase;
				const s = String(p.id);
				for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 1000000007;
				return { p, score: (h % 1000) + (p.degree ?? 0) * 3 };
			})
			.sort((a, b) => b.score - a.score)
			.map((x) => x.p);
	}

	// リコメンド抽出（内部的に 広告有効2 + 無料1。ユーザーには非公開）
	//  - 広告有効ユーザーが2人未満なら、その分は無料ユーザーで埋める（＝全体から）
	//  - 表示順は日付シードで混ぜ、どれが課金枠かは分からないようにする
	//  - 無料枠は毎日入れ替わり、無課金にも露出が回る
	function pickFeatured(persons, total = 3, paidSlots = 2) {
		const paid = dailySort(persons.filter((p) => p.adActive));
		const free = dailySort(persons.filter((p) => !p.adActive));
		const chosen = [];
		for (const p of paid) { if (chosen.length >= paidSlots) break; chosen.push(p); }
		for (const p of free) { if (chosen.length >= total) break; chosen.push(p); }
		for (const p of paid) { if (chosen.length >= total) break; if (!chosen.includes(p)) chosen.push(p); }
		return dailySort(chosen).slice(0, total); // 最終表示順を混ぜる
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
		featured = pickFeatured(persons, Math.min(3, persons.length));
	});
</script>

<svelte:head><title>夜行人図鑑 | 微小夜行電灯</title></svelte:head>

<main>
	<header class="masthead">
		<p class="kicker">夜 行 人 図 鑑</p>
		<h1 class="title">名も無き灯りたち</h1>
		<div class="rule"><span></span></div>
	</header>

	<p class="lead">
		屋台に集まった、ちょっと変わったところのある人たち。
		彼らが夜ごとにこぼす迷言や名言を、そっと図鑑に書き留めています。
		屋台をきっかけに生まれた縁は、夜のあいだに少しずつ広がっていきます。
	</p>

	<!-- ネットワークへの入口 -->
	<a href="{base}/network" class="portal">
		<div class="portal-body">
			<span class="portal-kicker">星図をひらく</span>
			<span class="portal-title">夜行人ネットワーク</span>
			<span class="portal-desc">縁のつながりを立体の星図でたどる</span>
		</div>
		<span class="portal-arrow" aria-hidden="true">→</span>
	</a>

	<!-- イベントグループへの入口 -->
	<a href="{base}/groups" class="portal groups-portal">
		<div class="portal-body">
			<span class="portal-kicker">イベントごとに集う</span>
			<span class="portal-title">イベントグループ</span>
			<span class="portal-desc">その場の縁を、グループの星図に</span>
		</div>
		<span class="portal-arrow" aria-hidden="true">→</span>
	</a>

	<!-- 今日の夜行人 -->
	<section class="today">
		<div class="section-head">
			<span class="section-kicker">今日の夜行人</span>
			<span class="section-line"></span>
		</div>

		{#if featured.length === 0}
			<p class="muted">まだ名を連ねた夜行人はいません。</p>
		{:else}
			<ul class="people">
				{#each featured as p}
					<li>
						<a href="{base}/network" class="person">
							{#if p.img}
								<img src={p.img.startsWith('http') ? p.img : base + p.img} alt={p.name} class="face" />
							{:else}
								<span class="face placeholder">{p.name?.charAt(0) ?? '?'}</span>
							{/if}
							<div class="person-body">
								<span class="person-name">
									{p.name}
									{#if p.adActive}<span class="corp-badge" title="法人アカウント"><Icon name="badge-check" size={15} /></span>{/if}
								</span>
								{#if p.roles?.length}
									<span class="person-roles">
										{#each p.roles as r}
											<span class="role"><i style="background:{ROLE_COLOR[r] ?? '#6b7688'}"></i>{r}</span>
										{/each}
									</span>
								{/if}
								{#if p.message && p.message.replace(/[「」\s]/g, '')}<span class="person-quote">{p.message}</span>{/if}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<div class="join">
		<p class="join-lead">あなたも、この星図に名を連ねませんか。</p>
		<a href="{base}/yakonin/setup" class="join-link">夜行人になる</a>
	</div>
</main>

<style>
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 3.5rem 22px 4rem;
		box-sizing: border-box;
	}

	/* ── 見出し ── */
	.masthead { text-align: center; margin-bottom: 2rem; }
	.kicker {
		font-size: 0.72rem; letter-spacing: 0.5em; color: var(--ink-3);
		margin: 0 0 1rem; padding-left: 0.5em; font-family: "Zen Antique", serif;
	}
	.title {
		font-family: "Zen Antique", "Yu Mincho", serif;
		font-size: clamp(1.7rem, 6vw, 2.3rem); font-weight: 500; color: var(--ink);
		letter-spacing: 0.14em; line-height: 1.4; margin: 0;
	}
	.rule { display: flex; justify-content: center; margin-top: 1.2rem; }
	.rule span { width: 44px; height: 1px; background: var(--accent); opacity: 0.7; }

	.lead {
		font-size: 0.95rem; line-height: 2.05; color: var(--ink-2);
		text-align: justify; margin: 0 0 2.6rem;
	}

	/* ── ネットワーク入口 ── */
	.portal {
		display: flex; align-items: center; gap: 16px;
		background: var(--night); color: #efe7d8; text-decoration: none;
		border-radius: var(--r-lg); padding: 22px 24px; margin-bottom: 3.2rem;
		position: relative; overflow: hidden;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		box-shadow: var(--shadow-2);
	}
	.portal::before {
		content: ''; position: absolute; top: -40%; right: -10%;
		width: 180px; height: 180px; border-radius: 50%;
		background: radial-gradient(circle, rgba(230,170,90,0.28), transparent 70%);
	}
	.portal:hover { transform: translateY(-2px); }
	.groups-portal { margin-top: -1.8rem; background: var(--accent-deep); }
	.groups-portal::before { background: radial-gradient(circle, rgba(240,200,140,0.30), transparent 70%); }
	.portal-body { display: flex; flex-direction: column; gap: 4px; position: relative; }
	.portal-kicker { font-size: 0.66rem; letter-spacing: 0.32em; color: #c9a06a; }
	.portal-title {
		font-family: "Zen Antique", serif; font-size: 1.2rem; letter-spacing: 0.12em; color: #f3ece0;
	}
	.portal-desc { font-size: 0.76rem; color: #a99f8f; letter-spacing: 0.04em; }
	.portal-arrow { margin-left: auto; font-size: 1.3rem; color: #c9a06a; position: relative; }

	/* ── セクション見出し ── */
	.section-head { display: flex; align-items: center; gap: 14px; margin-bottom: 1.4rem; }
	.section-kicker {
		font-family: "Zen Antique", serif; font-size: 0.95rem; letter-spacing: 0.2em;
		color: var(--ink); white-space: nowrap;
	}
	.section-line { flex: 1; height: 1px; background: var(--line-strong); }

	/* ── 人の一覧（エディトリアル） ── */
	.people { list-style: none; margin: 0; padding: 0; }
	.people li { border-top: 1px solid var(--line); }
	.people li:last-child { border-bottom: 1px solid var(--line); }
	.person {
		display: flex; align-items: center; gap: 16px; padding: 18px 4px;
		text-decoration: none; color: inherit; transition: background 0.15s;
	}
	.person:hover { background: rgba(184, 92, 43, 0.04); }
	.face {
		width: 54px; height: 54px; border-radius: 50%; object-fit: cover;
		flex-shrink: 0; border: 1px solid var(--line);
	}
	.face.placeholder {
		display: flex; align-items: center; justify-content: center;
		background: var(--surface-sunk); color: var(--ink-3);
		font-family: "Zen Antique", serif; font-size: 1.4rem;
	}
	.person-body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
	.person-name {
		font-family: "Zen Antique", serif; font-size: 1.05rem; letter-spacing: 0.06em; color: var(--ink);
		display: inline-flex; align-items: center; gap: 5px;
	}
	.corp-badge { display: inline-flex; color: #b5892e; }
	.person-roles { display: flex; gap: 12px; flex-wrap: wrap; }
	.role { display: inline-flex; align-items: center; gap: 5px; font-size: 0.7rem; color: var(--ink-3); letter-spacing: 0.06em; }
	.role i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
	.person-quote {
		font-size: 0.86rem; color: var(--ink-2); font-style: italic; line-height: 1.5;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}

	/* ── 参加 ── */
	.join { text-align: center; margin-top: 3.4rem; }
	.join-lead { font-size: 0.9rem; color: var(--ink-2); letter-spacing: 0.06em; margin: 0 0 1rem; }
	.join-link {
		display: inline-block; font-family: "Zen Antique", serif; font-size: 0.92rem;
		letter-spacing: 0.14em; color: var(--accent-deep); text-decoration: none;
		padding: 10px 4px; border-bottom: 1px solid var(--accent); transition: color 0.15s;
	}
	.join-link:hover { color: var(--accent); }

	.muted { color: var(--ink-3); font-size: 0.88rem; text-align: center; }
</style>
