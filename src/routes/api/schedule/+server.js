import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/** Google Calendar から直近の出店予定を取得する */
export async function GET() {
	const apiKey    = env.GOOGLE_CALENDAR_API_KEY;
	const calendarId = env.GOOGLE_CALENDAR_ID;

	if (!apiKey || !calendarId) {
		return json({ events: [] });
	}

	const now = new Date().toISOString();
	const url =
		`https://www.googleapis.com/calendar/v3/calendars/` +
		`${encodeURIComponent(calendarId)}/events` +
		`?key=${apiKey}` +
		`&timeMin=${now}` +
		`&maxResults=3` +
		`&singleEvents=true` +
		`&orderBy=startTime`;

	try {
		const res = await fetch(url);
		if (!res.ok) return json({ events: [] });

		const data = await res.json();
		const events = (data.items ?? []).map((e) => ({
			id:          e.id ?? '',
			title:       e.summary ?? '',
			start:       e.start?.dateTime ?? e.start?.date ?? '',
			end:         e.end?.dateTime   ?? e.end?.date   ?? '',
			location:    e.location    ?? '',
			description: e.description ?? '',
		}));

		return json({ events });
	} catch {
		return json({ events: [] });
	}
}
