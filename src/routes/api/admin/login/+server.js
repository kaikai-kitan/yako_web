import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

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

	if (!secret || !password || password !== secret) {
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
