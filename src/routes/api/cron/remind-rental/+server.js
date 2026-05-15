import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { Resend } from 'resend';

export const prerender = false;

const FROM_EMAIL = 'no-reply@delta-yako.com';

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

	// 25〜35分後に開始する pending かつ未送信の予約を抽出
	const now = new Date();
	const windowStart = new Date(now.getTime() + 25 * 60 * 1000);
	const windowEnd   = new Date(now.getTime() + 35 * 60 * 1000);

	const { data: reservations, error: dbErr } = await supabase
		.from('reservations')
		.select(`
			id, user_id, start_datetime,
			rental_spaces ( name ),
			stall_specs ( stall_name ),
			user_profiles ( name )
		`)
		.eq('status', 'pending')
		.eq('remind_mail_sent', false)
		.gte('start_datetime', windowStart.toISOString())
		.lte('start_datetime', windowEnd.toISOString());

	if (dbErr) throw error(500, dbErr.message);
	if (!reservations || reservations.length === 0) {
		return json({ ok: true, sent: 0 });
	}

	const resend = new Resend(env.RESEND_API_KEY);
	let sent = 0;
	const errors = [];

	for (const res of reservations) {
		try {
			// Supabase Auth からメールアドレスを取得
			const { data: { user }, error: authErr } = await supabase.auth.admin.getUserById(res.user_id);
			if (authErr || !user?.email) {
				errors.push({ id: res.id, reason: 'no email' });
				continue;
			}

			const userName  = res.user_profiles?.name ?? 'お客様';
			const placeName = res.rental_spaces?.name ?? res.stall_specs?.stall_name ?? '予約場所';
			const startStr  = fmtJST(res.start_datetime);

			await resend.emails.send({
				from: FROM_EMAIL,
				to: user.email,
				subject: '【微小夜行電灯】まもなく屋台予約の開始時間です',
				html: `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a;background:#fff">
  <div style="background:#fbf3ea;padding:20px 24px;border-left:4px solid #d56d04">
    <h2 style="margin:0;font-size:1rem;font-weight:700">🏮 まもなく予約開始時間です</h2>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 12px">${userName} 様</p>
    <p style="margin:0 0 20px;line-height:1.7">
      以下の予約の開始時間が<strong>約30分後</strong>に迫っています。<br />
      スペースに到着次第、アプリのQRスキャンでチェックインをお願いします。
    </p>
    <div style="background:#faf8f5;border-radius:8px;padding:16px;font-size:0.9rem;margin-bottom:20px">
      <p style="margin:0 0 6px"><strong>場所：</strong>${placeName}</p>
      <p style="margin:0"><strong>開始：</strong>${startStr}</p>
    </div>
    <div style="background:#fef2f2;border-radius:8px;padding:14px;font-size:0.82rem;color:#7f1d1d;border-left:3px solid #fca5a5">
      ⚠️ 開始時間から<strong>30分を超えてもチェックインがない場合</strong>、自動キャンセルとなります。<br />
      返金は行われず、信用スコアが低下します。
    </div>
    <p style="margin-top:24px;font-size:0.8rem;color:#9e9289">
      微小夜行電灯<br />
      <a href="https://delta-yako.com/map" style="color:#d56d04">アプリを開く</a>
    </p>
  </div>
</div>`
			});

			// 送信済みフラグを立てる
			await supabase
				.from('reservations')
				.update({ remind_mail_sent: true })
				.eq('id', res.id);

			sent++;
		} catch (e) {
			console.error('[remind-rental] error for reservation', res.id, e);
			errors.push({ id: res.id, reason: String(e) });
		}
	}

	return json({ ok: true, sent, errors: errors.length > 0 ? errors : undefined });
}

// Cloudflare Cron Worker から GET でも叩けるように両メソッドを公開
export const GET = POST;
