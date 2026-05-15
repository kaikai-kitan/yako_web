/**
 * Cloudflare Cron Worker — YATAKARI ノーショー対策
 *
 * このファイルは Pages プロジェクトとは別の独立した Cloudflare Worker です。
 * `wrangler.cron.toml` の設定で 10〜15分おきに scheduled イベントが発火し、
 * Pages アプリの Cron API エンドポイントを叩きます。
 *
 * デプロイ:
 *   npx wrangler deploy --config wrangler.cron.toml
 */

export default {
	/**
	 * HTTP リクエスト用（手動テスト・ヘルスチェック）
	 */
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname === '/run/remind') {
			const result = await callCronEndpoint(env, '/api/cron/remind-rental');
			return Response.json(result);
		}
		if (url.pathname === '/run/auto-cancel') {
			const result = await callCronEndpoint(env, '/api/cron/auto-cancel');
			return Response.json(result);
		}

		return new Response('YATAKARI Cron Worker — OK', { status: 200 });
	},

	/**
	 * Cron スケジュール実行
	 * wrangler.cron.toml の [triggers] crons で発火
	 */
	async scheduled(event, env, ctx) {
		console.log('[cron] scheduled event cron:', event.cron);

		ctx.waitUntil(Promise.all([
			callCronEndpoint(env, '/api/cron/remind-rental').then((r) =>
				console.log('[cron] remind-rental:', JSON.stringify(r))
			),
			callCronEndpoint(env, '/api/cron/auto-cancel').then((r) =>
				console.log('[cron] auto-cancel:', JSON.stringify(r))
			)
		]));
	}
};

async function callCronEndpoint(env, path) {
	const url = `${env.PAGES_BASE_URL}${path}`;
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-cron-secret': env.CRON_SECRET
			}
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			return { ok: false, status: res.status, body: text };
		}
		return await res.json();
	} catch (e) {
		return { ok: false, error: String(e) };
	}
}
