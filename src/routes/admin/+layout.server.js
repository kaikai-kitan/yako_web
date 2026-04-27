import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const prerender = false;

export async function load({ cookies, url }) {
	// ログインページ自体は通す
	if (url.pathname === '/admin/login') return {};

	const token = cookies.get('admin_session');
	const secret = env.ADMIN_SECRET;

	if (!secret || token !== secret) {
		throw redirect(302, '/admin/login');
	}
}
