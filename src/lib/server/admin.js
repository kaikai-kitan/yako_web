import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { createClient } from '@supabase/supabase-js';

/** 管理者のログイン（Cookie の admin_session = ADMIN_SECRET）を確認する */
export function assertAdmin(cookies) {
	const token = cookies.get('admin_session');
	if (!env.ADMIN_SECRET || !token || token !== env.ADMIN_SECRET) error(403, 'Forbidden');
}

export function serviceClient() {
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-4]):[0-5]\d$/;

export function yen(value, label) {
	const n = Number(value);
	if (!Number.isInteger(n) || n < 0 || n > 1_000_000) error(400, `${label}は0以上の整数（円）で入力してください`);
	return n;
}
