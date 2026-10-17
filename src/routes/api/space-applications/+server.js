import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** 場所提供者の申請（ログイン不要）。運営が現地ヒアリング・契約したあとにアプリへ登録する */
export async function POST({ request }) {
	const body = await request.json().catch(() => ({}));
	// 機械的な送信よけ（画面に表示しない入力欄に値が入っていたら受け付けたふりをする）
	if (body.website) return json({ ok: true });

	const app = {
		applicant_name: text(body.applicantName, 80),
		organization: text(body.organization, 120) || null,
		email: text(body.email, 200),
		phone: text(body.phone, 40) || null,
		address: text(body.address, 300),
		description: text(body.description, 2000) || null,
		unavailable_times: text(body.unavailableTimes, 1000) || null
	};
	if (!app.applicant_name) error(400, 'お名前を入力してください');
	if (!EMAIL_RE.test(app.email)) error(400, 'メールアドレスを正しく入力してください');
	if (!app.address) error(400, '場所の住所・所在地を入力してください');

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
	const { error: e } = await supabase.from('space_applications').insert(app);
	if (e) error(500, '送信できませんでした。時間をおいて再度お試しください');

	// 運営へ通知（設定されている場合のみ）
	const adminEmails = (env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
	if (env.RESEND_API_KEY && adminEmails.length) {
		try {
			const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
			await new Resend(env.RESEND_API_KEY).emails.send({
				from: 'no-reply@delta-yako.com',
				to: adminEmails,
				subject: '【微小夜行電灯】場所提供の申請が届きました',
				html: `<p>場所提供の申請が届きました。管理画面の「場所提供の申請」から確認してください。</p>
					<p>お名前：${esc(app.applicant_name)}<br>所在地：${esc(app.address)}</p>`
			});
		} catch (mailErr) {
			console.error('[space-applications] notify failed:', mailErr?.message);
		}
	}
	return json({ ok: true });
}
