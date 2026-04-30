import { json, error } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

export async function POST({ request }) {
	const body = await request.json();
	const { name, email, category, message } = body;

	if (!name || !email || !category || !message) {
		throw error(400, '必須項目が不足しています');
	}

	const supabase = createClient(
		env.PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL,
		env.SUPABASE_SERVICE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
	);

	const { error: dbErr } = await supabase.from('contact_inquiries').insert({
		name,
		email,
		category,
		message
	});

	if (dbErr) {
		throw error(500, dbErr.message);
	}

	return json({ ok: true });
}
