import { json, error } from '@sveltejs/kit';
import { assertAdmin, serviceClient, UUID_RE } from '$lib/server/admin.js';

export const prerender = false;

const STATUSES = ['new', 'contacted', 'visited', 'contracted', 'declined'];

export async function GET({ cookies }) {
	assertAdmin(cookies);
	const { data, error: e } = await serviceClient()
		.from('space_applications')
		.select('*')
		.order('created_at', { ascending: false });
	if (e) error(500, e.message);
	return json({ applications: data ?? [] });
}

/** 対応状況・メモの更新 */
export async function POST({ request, cookies }) {
	assertAdmin(cookies);
	const { id, status, adminNote } = await request.json().catch(() => ({}));
	if (typeof id !== 'string' || !UUID_RE.test(id)) error(400, '申請の指定が正しくありません');
	const update = {};
	if (status !== undefined) {
		if (!STATUSES.includes(status)) error(400, '対応状況の指定が正しくありません');
		update.status = status;
	}
	if (adminNote !== undefined) update.admin_note = typeof adminNote === 'string' ? adminNote.slice(0, 2000) : null;
	const { error: e } = await serviceClient().from('space_applications').update(update).eq('id', id);
	if (e) error(500, e.message);
	return json({ ok: true });
}
