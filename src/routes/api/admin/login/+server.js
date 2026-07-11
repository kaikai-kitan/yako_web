import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { timingSafeEqual } from 'node:crypto';

export const prerender = false;

export async function POST({ request, cookies }) {
	let body;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const { password } = body;
	const secret = env.ADMIN_SECRET;

	// 貼り付け時に末尾へ改行/空白が混入しても弾かないよう、前後の空白を除去してから比較する
	const passwordStr = (typeof password === 'string' ? password : '').trim();
	const secretStr   = (typeof secret   === 'string' ? secret   : '').trim();

	// timingSafeEqual でタイミング攻撃を防ぐ。長さが異なる場合も即時拒否ではなくdummyで比較
	const passwordBuf = Buffer.from(passwordStr);
	const secretBuf   = Buffer.from(secretStr);
	const valid = secret && password &&
		passwordBuf.length === secretBuf.length &&
		timingSafeEqual(passwordBuf, secretBuf);

	if (!valid) {
		throw error(401, 'Unauthorized');
	}

	cookies.set('admin_session', secret, {
		path: '/',
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: 60 * 60 * 24 * 7 // 7 days
	});

	return json({ ok: true });
}
