import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

async function fetchCalendar(calendarId, apiKey, maxResults = 5) {
	const now = new Date().toISOString();
	const url =
		`https://www.googleapis.com/calendar/v3/calendars/` +
		`${encodeURIComponent(calendarId)}/events` +
		`?key=${apiKey}` +
		`&timeMin=${now}` +
		`&maxResults=${maxResults}` +
		`&singleEvents=true` +
		`&orderBy=startTime`;

	const res = await fetch(url);
	if (!res.ok) return [];

	const data = await res.json();
	return (data.items ?? []).map((e) => ({
		id:          e.id ?? '',
		title:       e.summary ?? '',
		start:       e.start?.dateTime ?? e.start?.date ?? '',
		end:         e.end?.dateTime   ?? e.end?.date   ?? '',
		location:    e.location    ?? '',
		description: e.description ?? '',
	}));
}

export async function GET() {
	const apiKey         = env.GOOGLE_CALENDAR_API_KEY;
	const calendarId     = env.GOOGLE_CALENDAR_ID;
	const eventCalendarId = env.GOOGLE_EVENT_CALENDAR_ID;

	if (!apiKey || !calendarId) {
		return json({ events: [], eventAppearances: [] });
	}

	try {
		const [events, eventAppearances] = await Promise.all([
			fetchCalendar(calendarId, apiKey, 3),
			eventCalendarId ? fetchCalendar(eventCalendarId, apiKey, 5) : Promise.resolve([])
		]);
		return json({ events, eventAppearances });
	} catch (e) {
		return json({ events: [], eventAppearances: [], _error: String(e) });
	}
}
