import Stripe from 'stripe';
import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { Resend } from 'resend';

export const prerender = false;

const FROM_EMAIL = 'no-reply@delta-yako.com';
const NOSHOW_PENALTY = 3;

function requireCronSecret(request) {
	const secret = request.headers.get('x-cron-secret');
	if (!secret || secret !== env.CRON_SECRET) throw error(401, 'Unauthorized');
}

function fmtJST(iso) {
	return new Date(iso).toLocaleString('ja-JP', {
		timeZone: 'Asia/Tokyo',
		year: 'numeric', month: 'long', day: 'numeric',
		hour: '2-digit', minute: '2-digit'
	});
}

export async function POST({ request }) {
	requireCronSecret(request);

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

	// 開始から35分以上経過して、まだ pending（チェックイン未完了）の予約
	const cutoff = new Date(Date.now() - 35 * 60 * 1000);

	const { data: reservations, error: dbErr } = await supabase
		.from('reservations')
		.select(`
			id, user_id, start_datetime, stripe_payment_intent_id,
			rental_spaces ( name ),
			stall_specs ( stall_name ),
			user_profiles ( name )
		`)
		.eq('status', 'pending')
		.lt('start_datetime', cutoff.toISOString());

	if (dbErr) throw error(500, dbErr.message);
	if (!reservations || reservations.length === 0) {
		return json({ ok: true, cancelled: 0 });
	}

	const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
	const stripe = env.STRIPE_SECRET_KEY
		? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
		: null;
	let cancelled = 0;
	const errors = [];

	for (const res of reservations) {
		try {
			// 1. 予約を auto_cancelled に更新（pending との競合防止: チェックインと同時実行時にどちらか一方だけ成功）
			const { data: updated, error: cancelErr } = await supabase
				.from('reservations')
				.update({ status: 'auto_cancelled' })
				.eq('id', res.id)
				.eq('status', 'pending') // 競合防止
				.select('id');

			if (cancelErr || !updated?.length) {
				// すでにチェックイン済み or 別の処理が先行 → スキップ
				errors.push({ id: res.id, reason: cancelErr?.message ?? 'already processed' });
				continue;
			}

			// 2. 与信確保済みの場合は Stripe Capture（ノーショー料 = 返金なし）
			if (res.stripe_payment_intent_id && stripe) {
				try {
					const pi = await stripe.paymentIntents.capture(res.stripe_payment_intent_id);
					if (pi.status !== 'succeeded') {
						console.error('[auto-cancel] capture not succeeded:', res.id, pi.status);
					}
				} catch (stripeErr) {
					// capture 失敗（期限切れ等）はログのみ。キャンセルは確定済みなので継続。
					console.error('[auto-cancel] Stripe capture error:', res.id, stripeErr?.message);
				}
			}

			// 3. credit_score -3、停止判定
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('credit_score')
				.eq('user_id', res.user_id)
				.single();

			if (profile) {
				const newScore    = Math.max(0, (profile.credit_score ?? 300) - NOSHOW_PENALTY);
				const isSuspended = newScore <= 0;
				await supabase
					.from('user_profiles')
					.update({ credit_score: newScore, is_suspended: isSuspended })
					.eq('user_id', res.user_id);

				// 3. ユーザーに通知メール
				if (resend) {
					try {
						const { data: { user } } = await supabase.auth.admin.getUserById(res.user_id);
						if (user?.email) {
							const userName  = res.user_profiles?.name ?? 'お客様';
							const placeName = res.rental_spaces?.name ?? res.stall_specs?.stall_name ?? '予約場所';
							const startStr  = fmtJST(res.start_datetime);
							const suspendMsg = isSuspended
								? `<p style="margin-top:14px;background:#fef2f2;border-radius:8px;padding:14px;font-size:0.82rem;color:#7f1d1d;border-left:3px solid #fca5a5">
										🚫 信用スコアが0になったため、<strong>アカウントが停止</strong>されました。<br />
										新規予約・購入はご利用いただけません。解除には運営へのお問い合わせが必要です。
									</p>`
								: '';
							await resend.emails.send({
								from: FROM_EMAIL,
								to: user.email,
								subject: '【微小夜行電灯】予約が自動キャンセルされました',
								html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a;background:#fff">
  <div style="background:#fef2f2;padding:20px 24px;border-left:4px solid #ef4444">
    <h2 style="margin:0;font-size:1rem;font-weight:700">予約が自動キャンセルされました</h2>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 12px">${userName} 様</p>
    <p style="margin:0 0 20px;line-height:1.7">
      以下の予約について、開始時間から30分以上チェックインが確認されなかったため、<strong>自動キャンセル</strong>となりました。
    </p>
    <div style="background:#faf8f5;border-radius:8px;padding:16px;font-size:0.9rem;margin-bottom:16px">
      <p style="margin:0 0 6px"><strong>場所：</strong>${placeName}</p>
      <p style="margin:0"><strong>予定開始：</strong>${startStr}</p>
    </div>
    <div style="background:#fff7ed;border-radius:8px;padding:14px;font-size:0.82rem;color:#7c2d12;border-left:3px solid #fed7aa">
      ⚠️ 自動キャンセルのため<strong>返金は行われません</strong>。<br />
      信用スコアが <strong>-${NOSHOW_PENALTY}ポイント</strong> 減算されました（残り: ${newScore}）。
    </div>
    ${suspendMsg}
    <p style="margin-top:24px;font-size:0.8rem;color:#9e9289">
      ご不明な点は<a href="https://delta-yako.com/contact" style="color:#d56d04">お問い合わせフォーム</a>よりご連絡ください。<br />
      微小夜行電灯
    </p>
  </div>
</div>`
							});
						}
					} catch (mailErr) {
						console.error('[auto-cancel] mail error for', res.id, mailErr);
					}
				}
			}

			cancelled++;
		} catch (e) {
			console.error('[auto-cancel] error for reservation', res.id, e);
			errors.push({ id: res.id, reason: String(e) });
		}
	}

	return json({ ok: true, cancelled, errors: errors.length > 0 ? errors : undefined });
}

// Cloudflare Cron Worker から GET でも叩けるように両メソッドを公開
export const GET = POST;
