import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import { Resend } from 'resend';

export const prerender = false;

const NOTIFY_EMAIL = 'delta10yako@gmail.com';
const FROM_EMAIL = 'no-reply@delta-yako.com';

export async function POST({ request }) {
	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { name, email, category, message } = body;
	if (!name || !email || !category || !message) {
		throw error(400, '必須項目が不足しています');
	}

	// Supabaseに保存
	const supabase = createClient(
		env.SUPABASE_URL ?? env.PUBLIC_SUPABASE_URL,
		env.SUPABASE_SERVICE_ROLE_KEY
	);

	const { error: dbErr } = await supabase.from('contact_inquiries').insert({
		name,
		email,
		category,
		message
	});

	if (dbErr) {
		throw error(500, 'DB保存に失敗しました: ' + dbErr.message);
	}

	// 管理者へメール通知
	if (env.RESEND_API_KEY) {
		try {
			const resend = new Resend(env.RESEND_API_KEY);
			await resend.emails.send({
				from: FROM_EMAIL,
				to: NOTIFY_EMAIL,
				subject: `【お問合せ】${category} — ${name}様より`,
				html: `
					<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
						<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
							新しいお問合せが届きました
						</h2>
						<div style="padding:20px;border:1px solid #e8e0d8;border-top:none">
							<table style="width:100%;border-collapse:collapse;font-size:0.9rem">
								<tr>
									<td style="padding:8px 0;color:#7a6f67;width:120px;vertical-align:top">お名前</td>
									<td style="padding:8px 0;font-weight:600">${name}</td>
								</tr>
								<tr>
									<td style="padding:8px 0;color:#7a6f67;vertical-align:top">メール</td>
									<td style="padding:8px 0"><a href="mailto:${email}" style="color:#d56d04">${email}</a></td>
								</tr>
								<tr>
									<td style="padding:8px 0;color:#7a6f67;vertical-align:top">種類</td>
									<td style="padding:8px 0">${category}</td>
								</tr>
								<tr>
									<td style="padding:8px 0;color:#7a6f67;vertical-align:top">内容</td>
									<td style="padding:8px 0;white-space:pre-wrap">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
								</tr>
							</table>
						</div>
						<p style="font-size:0.78rem;color:#9e9289;margin-top:16px">
							このメールは微小夜行電灯お問合せフォームから自動送信されました。
						</p>
					</div>
				`
			});

			// 送信者への自動返信
			await resend.emails.send({
				from: FROM_EMAIL,
				to: email,
				subject: '【微小夜行電灯】お問合せを受け付けました',
				html: `
					<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#26201a">
						<h2 style="background:#fbf3ea;padding:16px 20px;margin:0;font-size:1rem;border-left:4px solid #d56d04">
							お問合せありがとうございます
						</h2>
						<div style="padding:20px">
							<p>${name} 様</p>
							<p>以下の内容でお問合せを受け付けました。<br />
							通常3営業日以内にご返信いたします。</p>
							<div style="background:#faf8f5;border-radius:8px;padding:16px;font-size:0.88rem;color:#4a3f38">
								<p style="margin:0 0 6px"><strong>種類:</strong> ${category}</p>
								<p style="margin:0;white-space:pre-wrap"><strong>内容:</strong><br />${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
							</div>
							<p style="margin-top:20px;font-size:0.85rem;color:#7a6f67">
								微小夜行電灯<br />
								<a href="https://yako-web.vercel.app" style="color:#d56d04">yako-web.vercel.app</a>
							</p>
						</div>
					</div>
				`
			});
		} catch (mailErr) {
			// メール失敗はDB保存済みなので致命的エラーにしない
			console.error('Contact email error:', mailErr);
		}
	}

	return json({ ok: true });
}
