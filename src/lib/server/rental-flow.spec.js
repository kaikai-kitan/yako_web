import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	db: null,
	capture: vi.fn(),
	cancelIntent: vi.fn(),
	retrieve: vi.fn(),
	create: vi.fn(),
	createIntent: vi.fn(),
	setupRetrieve: vi.fn(),
	event: null
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => mocks.db }));
vi.mock('$lib/supabase.js', () => ({
	supabase: { from: (...args) => mocks.db.from(...args) },
	isSupabaseConfigured: true
}));
vi.mock('$env/dynamic/private', () => ({
	env: {
		SUPABASE_URL: 'https://example.invalid',
		SUPABASE_SERVICE_ROLE_KEY: 'test',
		STRIPE_SECRET_KEY: 'test',
		STRIPE_WEBHOOK_SECRET: 'test',
		CRON_SECRET: 'test'
	}
}));
vi.mock('stripe', () => ({
	default: function StripeMock() {
		this.paymentIntents = {
			capture: mocks.capture,
			retrieve: mocks.retrieve,
			cancel: mocks.cancelIntent,
			create: mocks.createIntent
		};
		this.setupIntents = { retrieve: mocks.setupRetrieve };
		this.customers = { create: vi.fn(async () => ({ id: 'cus_new' })) };
		this.checkout = { sessions: { create: mocks.create } };
		this.webhooks = { constructEventAsync: async () => mocks.event };
	}
}));

import { confirmRentalAuthorization } from './rental-authorization.js';
import { POST as checkin } from '../../routes/api/checkin-rental/+server.js';
import { POST as scan } from '../../routes/api/scan-action/+server.js';
import { POST as autoCancel } from '../../routes/api/cron/auto-cancel/+server.js';
import { POST as cancel } from '../../routes/api/cancel-rental/+server.js';
import { POST as checkout } from '../../routes/api/create-rental-checkout/+server.js';
import { POST as webhook } from '../../routes/api/stripe-webhook/+server.js';
import { POST as completeReturn } from '../../routes/api/complete-rental/+server.js';
import { POST as extendRentalApi } from '../../routes/api/extend-rental/+server.js';
import { finalizeRentalReturn, secureRentalAtCheckIn, chargeNoShow } from './rental-billing.js';
import {
	getMyReservations,
	getUserReservations,
	getBookedStallIds
} from '../db.js';

const unpaid = {
	id: 'reservation',
	user_id: 'user',
	status: 'pending',
	stall_id: 'stall',
	start_datetime: '2026-10-20T10:00:00+09:00',
	end_datetime: '2026-10-20T12:00:00+09:00',
	locked_space_fee: 0,
	locked_stall_fee: 1000,
	stripe_payment_intent_id: null
};
const pi = { id: 'pi_authorized', status: 'requires_capture', currency: 'jpy', amount: 1000 };
const session = {
	mode: 'payment',
	status: 'complete',
	payment_status: 'unpaid',
	metadata: { type: 'rental', reservationId: 'reservation', userId: 'user' },
	payment_intent: pi
};

// The queued responses emulate Supabase's query boundary; no database or Stripe writes occur.
function database(responses) {
	const writes = [];
	const db = {
		writes,
		auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user' } } })) },
		from: vi.fn((table) => {
			const result = responses.shift();
			if (result === undefined) throw new Error(`Unexpected query: ${table}`);
			const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
			for (const method of [
				'select',
				'eq',
				'neq',
				'is',
				'in',
				'or',
				'not',
				'gte',
				'lt',
				'order',
				'limit'
			])
				query[method] = vi.fn(() => query);
			for (const method of ['update', 'insert'])
				query[method] = vi.fn((value) => {
					writes.push({ table, method, value });
					return query;
				});
			query.single = query.maybeSingle = () => Promise.resolve(result);
			return query;
		})
	};
	mocks.db = db;
	return db;
}
const row = (data) => ({ data, error: null });
function request(body, headers = {}) {
	return new Request('https://example.invalid/api/test', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test', ...headers },
		body: JSON.stringify(body)
	});
}
const confirm = (db, overrides = {}) =>
	confirmRentalAuthorization({
		supabase: db,
		stripe: { paymentIntents: { retrieve: mocks.retrieve, cancel: mocks.cancelIntent }, setupIntents: { retrieve: mocks.setupRetrieve } },
		session,
		reservationId: 'reservation',
		userId: 'user',
		...overrides
	});

beforeEach(() => {
	vi.clearAllMocks();
	mocks.capture.mockResolvedValue({ status: 'succeeded' });
});

describe('rental authorization', () => {
	it('rejects returning from an unfinished Checkout before writing anything', async () => {
		const db = database([]);
		await expect(confirm(db, { session: { ...session, status: 'open' } })).rejects.toMatchObject({
			status: 402
		});
		expect(db.writes).toEqual([]);
	});
	it('stores manual authorization, keeping the reservation pending', async () => {
		const db = database([row(unpaid), row([]), row([{ id: 'reservation' }])]);
		await expect(confirm(db)).resolves.toBe('pi_authorized');
		expect(db.writes).toEqual([
			{
				table: 'reservations',
				method: 'update',
				value: { stripe_payment_intent_id: 'pi_authorized' }
			}
		]);
	});
	it.each(['requires_payment_method', 'requires_action', 'canceled'])(
		'rejects a %s payment',
		async (status) => {
			await expect(
				confirm(database([]), { session: { ...session, payment_intent: { ...pi, status } } })
			).rejects.toMatchObject({ status: 402 });
		}
	);
	it('rejects a different user or different amount', async () => {
		await expect(confirm(database([]), { userId: 'other' })).rejects.toMatchObject({ status: 400 });
		await expect(
			confirm(database([row(unpaid)]), {
				session: { ...session, payment_intent: { ...pi, amount: 1 } }
			})
		).rejects.toMatchObject({ status: 400 });
	});
	it('releases authorization if another booking finished during Checkout', async () => {
		const db = database([row(unpaid), row([{ ...unpaid, stripe_payment_intent_id: 'pi_other' }])]);
		await expect(confirm(db)).rejects.toMatchObject({ status: 409 });
		expect(mocks.cancelIntent).toHaveBeenCalledExactlyOnceWith(pi.id);
		expect(db.writes).toEqual([]);
	});

	it('does not revive cancelled reservations', async () => {
		const db = database([row({ ...unpaid, status: 'cancelled' })]);
		await expect(confirm(db)).rejects.toMatchObject({ status: 409 });
		expect(db.writes).toEqual([]);
	});
	it('handles duplicate and concurrent webhook/return confirmations', async () => {
		const authorized = { ...unpaid, stripe_payment_intent_id: pi.id };
		const db = database([row(authorized)]);
		await expect(confirm(db)).resolves.toBe(pi.id);
		expect(db.writes).toEqual([]);
		await expect(confirm(database([row(unpaid), row([]), row([]), row(authorized)]))).resolves.toBe(
			pi.id
		);
	});
	it('does not report success on a DB error', async () => {
		await expect(
			confirm(database([row(unpaid), row([]), { error: { message: 'offline' } }]))
		).rejects.toMatchObject({ status: 500 });
	});
	it('webhook confirms payment but never starts rental use', async () => {
		mocks.event = { type: 'checkout.session.completed', data: { object: session } };
		const db = database([row(unpaid), row([]), row([{ id: 'reservation' }])]);
		const result = await webhook({ request: request({}) });
		expect(result.status).toBe(200);
		expect(db.writes[0].value).toEqual({ stripe_payment_intent_id: pi.id });
	});
});

describe('unfinished checkout across the application', () => {
	it('does not appear in history, ongoing bookings or booked map pins', async () => {
		const authorized = {
			...unpaid,
			id: 'confirmed',
			stall_id: 'booked',
			stripe_payment_intent_id: pi.id
		};
		const rows = [unpaid, authorized];
		database([row(rows), row(rows), row(rows)]);
		expect(await getMyReservations('user')).toEqual([authorized]);
		expect(await getUserReservations('user')).toEqual([authorized]);
		expect(await getBookedStallIds()).toEqual(new Set(['booked']));
	});
	it('keeps the map readable before v13 without confirming unpaid legacy rows', async () => {
		const legacy = { ...unpaid };
		delete legacy.stripe_payment_intent_id;
		database([
			{
				error: {
					code: '42703',
					message: 'column reservations.stripe_payment_intent_id does not exist'
				}
			},
			row([legacy])
		]);
		expect(await getBookedStallIds()).toEqual(new Set());
	});

	it('requires authentication before opening a checkout session', async () => {
		const db = database([]);
		const req = request({ reservationId: unpaid.id });
		req.headers.delete('Authorization');
		await expect(checkout({ request: req })).rejects.toMatchObject({ status: 401 });
		expect(db.writes).toEqual([]);
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('stops before Stripe when the payment column has not been installed', async () => {
		database([row({ is_suspended: false }), { error: { code: '42703', message: 'missing payment column' } }]);
		await expect(
			checkout({ request: request({ reservationId: unpaid.id }) })
		).rejects.toMatchObject({ status: 503 });
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it('opens paid Checkout without confirming the booking', async () => {
		const db = database([
			row({ is_suspended: false }),
			row(unpaid),
			row({ id: 'stall', stall_name: '屋台', rental_fee: 1000, extension_fee: 0, space_id: null }),
			row(null),
			row({ stripe_customer_id: 'cus_test' })
		]);
		mocks.create.mockResolvedValueOnce({
			id: 'checkout',
			url: 'https://checkout.stripe.com/example'
		});
		const result = await checkout({
			request: request({ reservationId: unpaid.id, userId: 'untrusted' })
		});
		expect(await result.json()).toHaveProperty('sessionId', 'checkout');
		// 予約時はカード登録だけ（setup モード）。請求も与信もしない
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: 'setup',
				customer: 'cus_test',
				metadata: { type: 'rental', reservationId: unpaid.id, userId: 'user' }
			})
		);
		expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('payment_intent_data');
		expect(db.writes.every(({ value }) => !value.status && !value.stripe_payment_intent_id)).toBe(
			true
		);
	});

	// 予約は14日先までなので、テストの日付は「今日から2日後」（日本時間）にする
	const day = new Date(Date.now() + 2 * 86400000 + 9 * 3600000).toISOString().slice(0, 10);
	const at = (hhmm) => `${day}T${hhmm}:00`;
	const stallRow = { id: 'stall', stall_name: '屋台', rental_fee: 1000, extension_fee: 200, space_id: null };
	const draft = {
		stallId: 'stall',
		startDatetime: at('10:00'),
		endDatetime: at('14:00'),
		plannedItems: null,
		selectedUseCases: ['retail'],
		// ブラウザが料金を送ってきても無視されること
		lockedStallFee: 0,
		lockedSpaceFee: 0
	};
	const confirmedAt = (from, to) => ({
		...unpaid,
		id: 'other',
		start_datetime: `${day}T${from}:00+09:00`,
		end_datetime: `${day}T${to}:00+09:00`,
		stripe_payment_intent_id: 'pi_other'
	});
	const newBooking = (reservations, blackouts = []) => [
		row({ is_suspended: false }),
		row(stallRow),
		row(reservations),
		row(blackouts),
		row({ id: 'new-draft' }),
		row({ ...unpaid, id: 'new-draft', start_datetime: `${draft.startDatetime}+09:00`, end_datetime: `${draft.endDatetime}+09:00` }),
		row(stallRow),
		row(null),
		row({ stripe_customer_id: 'cus_test' })
	];
	it('creates the booking on the server with server-side prices, ignoring client fees', async () => {
		const db = database(newBooking([]));
		mocks.create.mockResolvedValueOnce({ id: 'checkout', url: 'https://checkout.stripe.com/example' });
		const result = await checkout({ request: request({ reservation: draft }) });
		expect(await result.json()).toMatchObject({ reservationId: 'new-draft', sessionId: 'checkout' });
		const insert = db.writes.find((w) => w.method === 'insert');
		expect(insert.value).toMatchObject({
			user_id: 'user',
			stall_id: 'stall',
			status: 'pending',
			locked_stall_fee: 1000,
			locked_stall_ext_fee: 200,
			locked_space_fee: 0,
			// タイムゾーンの無い日時は日本時間として保存する
			start_datetime: `${draft.startDatetime}+09:00`
		});
		expect(insert.value).not.toHaveProperty('stripe_payment_intent_id');
		// 4時間 = 基本1,000円 + 延長2枠 × 200円（目安として表示。予約時は請求しない）
		expect(mocks.create.mock.calls[0][0]).toMatchObject({ mode: 'setup' });
		expect(mocks.create.mock.calls[0][0].setup_intent_data.description).toContain('1,400');
	});
	it('lets the user book again after abandoning payment (unpaid drafts do not block)', async () => {
		const db = database(newBooking([{ ...unpaid, start_datetime: `${day}T10:00:00+09:00`, end_datetime: `${day}T14:00:00+09:00` }]));
		mocks.create.mockResolvedValueOnce({ id: 'checkout', url: 'https://checkout.stripe.com/example' });
		await checkout({ request: request({ reservation: draft }) });
		expect(db.writes.some((w) => w.method === 'insert')).toBe(true);
	});
	it('lets several people use the same stall on one day, keeping a 30-minute gap', async () => {
		// 他の人が 06:00〜09:30 → 10:00 開始は 30分空いているので予約できる
		const db = database(newBooking([confirmedAt('06:00', '09:30')]));
		mocks.create.mockResolvedValueOnce({ id: 'checkout', url: 'https://checkout.stripe.com/example' });
		await checkout({ request: request({ reservation: draft }) });
		expect(db.writes.some((w) => w.method === 'insert')).toBe(true);
	});
	it.each([
		['overlapping', '12:00', '16:00'],
		['ending right before (no gap)', '07:00', '10:00'],
		['starting right after (no gap)', '14:00', '17:00']
	])('refuses a stall with a confirmed booking %s', async (_label, from, to) => {
		const db = database(newBooking([confirmedAt(from, to)]).slice(0, 4));
		await expect(checkout({ request: request({ reservation: draft }) })).rejects.toMatchObject({ status: 409 });
		expect(db.writes).toEqual([]);
		expect(mocks.create).not.toHaveBeenCalled();
	});
	it('refuses times the place does not lend out', async () => {
		const db = database(newBooking([], [{ weekday: null, on_date: day, start_time: '13:00', end_time: '24:00' }]).slice(0, 4));
		await expect(checkout({ request: request({ reservation: draft }) })).rejects.toMatchObject({ status: 400 });
		expect(db.writes).toEqual([]);
	});
	it('rejects invalid or past booking dates before touching the database', async () => {
		for (const bad of [
			{ ...draft, endDatetime: draft.startDatetime },
			{ ...draft, startDatetime: '2000-01-01T10:00:00', endDatetime: '2000-01-01T12:00:00' },
			{ ...draft, startDatetime: 'not-a-date' },
			{ ...draft, startDatetime: at('10:15') },
			{ ...draft, startDatetime: '2099-01-01T10:00:00', endDatetime: '2099-01-01T13:00:00' },
			{ ...draft, stallId: null }
		]) {
			const db = database([row({ is_suspended: false })]);
			await expect(checkout({ request: request({ reservation: bad }) })).rejects.toMatchObject({ status: 400 });
			expect(db.writes).toEqual([]);
		}
	});
	it('does not let a suspended account create a booking', async () => {
		const db = database([row({ is_suspended: true })]);
		await expect(checkout({ request: request({ reservation: draft }) })).rejects.toMatchObject({ status: 403 });
		expect(db.writes).toEqual([]);
	});
	it('cannot check in an unpaid rental through the API', async () => {
		const db = database([row(unpaid)]);
		await expect(checkin({ request: request({ reservationId: unpaid.id }) })).rejects.toMatchObject(
			{ status: 402 }
		);
		expect(mocks.capture).not.toHaveBeenCalled();
		expect(db.writes).toEqual([]);
	});
	it('QR scan ignores abandoned checkout and finds the authorized booking', async () => {
		const db = database([
			row({ stall_name: 'Test' }),
			row([unpaid, { ...unpaid, id: 'confirmed', stripe_payment_intent_id: pi.id }]),
			row(null)
		]);
		const result = await scan({ request: request({ type: 'yatai', id: 'stall' }) });
		expect(await result.json()).toMatchObject({ action: 'checkin' });
		expect(mocks.capture).toHaveBeenCalledExactlyOnceWith(pi.id);
		expect(db.writes[0].value).toEqual({ status: 'active' });
	});
	it('does not charge or penalize an abandoned checkout as a no-show', async () => {
		const db = database([row([unpaid])]);
		const result = await autoCancel({ request: request({}, { 'x-cron-secret': 'test' }) });
		expect(await result.json()).toMatchObject({ cancelled: 0 });
		expect(db.writes).toEqual([]);
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('charges only the base fee (3 hours) for a no-show and releases the rest', async () => {
		const noShow = {
			...unpaid,
			start_datetime: '2026-10-20T10:00:00+09:00',
			end_datetime: '2026-10-20T16:00:00+09:00', // 6時間で与信 1,000 + 6×200 + 500 + 6×100 = 3,300
			locked_stall_fee: 1000,
			locked_stall_ext_fee: 200,
			locked_space_fee: 500,
			locked_space_ext_fee: 100,
			stripe_payment_intent_id: pi.id
		};
		database([row([noShow]), row([{ id: noShow.id }]), row({ credit_score: 100 }), row(null)]);
		mocks.retrieve.mockResolvedValueOnce({ ...pi, amount: 3300 });
		mocks.capture.mockResolvedValueOnce({ status: 'succeeded', amount_received: 1500 });
		const result = await autoCancel({ request: request({}, { 'x-cron-secret': 'test' }) });
		expect(await result.json()).toMatchObject({ cancelled: 1 });
		expect(mocks.capture).toHaveBeenCalledExactlyOnceWith(pi.id, { amount_to_capture: 1500 });
	});
	it('releases the card authorization right away when the user cancels', async () => {
		const confirmed = { ...unpaid, start_datetime: '2099-01-01T10:00:00+09:00', stripe_payment_intent_id: pi.id };
		database([row(confirmed), row(null)]);
		mocks.retrieve.mockResolvedValueOnce(pi);
		const result = await cancel({ request: request({ reservationId: unpaid.id }) });
		expect(await result.json()).toMatchObject({ ok: true, penalty: 0 });
		expect(mocks.cancelIntent).toHaveBeenCalledExactlyOnceWith(pi.id);
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('cancels an unfinished checkout without a credit-score penalty', async () => {
		const db = database([row({ ...unpaid, start_datetime: new Date().toISOString() }), row(null)]);
		const result = await cancel({ request: request({ reservationId: unpaid.id }) });
		expect(await result.json()).toMatchObject({ penalty: 0 });
		expect(db.writes).toHaveLength(1);
	});
	it('keeps a free booking pending until on-site check-in', async () => {
		const db = database([
			row({ is_suspended: false }),
			row(unpaid),
			row({ id: 'stall', stall_name: '屋台', rental_fee: 0, extension_fee: 0, space_id: null }),
			row(null)
		]);
		const result = await checkout({ request: request({ reservationId: unpaid.id }) });
		expect(await result.json()).toEqual({ free: true, reservationId: unpaid.id });
		expect(db.writes.some((write) => write.value.status === 'active')).toBe(false);
		expect(mocks.create).not.toHaveBeenCalled();
	});
});

describe('rental return (complete-rental)', () => {
	const active = {
		id: 'reservation',
		user_id: 'user',
		status: 'active',
		start_datetime: '2026-10-20T10:00:00+09:00',
		end_datetime: '2026-10-20T14:00:00+09:00', // 4時間 = 基本3時間 + 延長2枠
		locked_space_fee: 500,
		locked_stall_fee: 1000,
		locked_space_ext_fee: 100,
		locked_stall_ext_fee: 200,
		stall_id: 'stall',
		rental_space_id: 'space',
		stripe_customer_id: 'cus_test',
		stripe_payment_method_id: 'pm_card',
		stripe_hold_intent_id: 'pi_hold',
		stall_specs: { user_id: 'stall-owner', operators: { business_name: '屋台屋' } },
		rental_spaces: { user_id: 'space-owner', owners: { owner_name: '場所主' } }
	};
	it('records sales and server-computed payments once, ignoring amounts sent by the browser', async () => {
		const db = database([row(active), row([{ id: 'reservation' }]), row(null), row(null), row(null)]);
		mocks.createIntent.mockResolvedValueOnce({ id: 'pi_final', status: 'succeeded' });
		const result = await completeReturn({
			request: request({
				reservationId: 'reservation',
				salesItems: { beer: 3 },
				payments: [{ recipient_id: 'attacker', total_amount: 999999 }]
			})
		});
		expect(await result.json()).toMatchObject({ completed: true, charged: 2100, chargeStatus: 'paid', charge: { total: 2100 } });
		expect(db.writes.map((w) => `${w.table}.${w.method}`)).toEqual([
			'reservations.update',
			'sales.insert',
			'reservations.update',
			'payment_history.insert'
		]);
		// 返却時に登録カードへ一括請求し、仮押さえは解放
		expect(mocks.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 2100, customer: 'cus_test', payment_method: 'pm_card', off_session: true, confirm: true }),
			expect.anything()
		);
		expect(mocks.cancelIntent).toHaveBeenCalledWith('pi_hold');
		expect(db.writes[2].value).toEqual({ charged_amount: 2100, charge_status: 'paid', stripe_charge_intent_id: 'pi_final' });
		expect(db.writes[0].value).toMatchObject({ status: 'completed' });
		expect(db.writes[0].value.returned_at).toEqual(expect.any(String));
		expect(db.writes[3].value).toEqual([
			expect.objectContaining({ payer_id: 'user', recipient_id: 'stall-owner', total_amount: 1400 }),
			expect.objectContaining({ payer_id: 'user', recipient_id: 'space-owner', total_amount: 700 })
		]);
	});
	it("refuses to complete someone else's reservation", async () => {
		const db = database([row({ ...active, user_id: 'someone-else' })]);
		await expect(
			completeReturn({ request: request({ reservationId: 'reservation' }) })
		).rejects.toMatchObject({ status: 403 });
		expect(db.writes).toEqual([]);
	});
	it('cannot complete a booking that has not been checked in', async () => {
		const db = database([row({ ...active, status: 'pending' })]);
		await expect(
			completeReturn({ request: request({ reservationId: 'reservation' }) })
		).rejects.toMatchObject({ status: 409 });
		expect(db.writes).toEqual([]);
	});
	it('does not record payments twice when returned again', async () => {
		const done = database([row({ ...active, status: 'completed' })]);
		expect(await (await completeReturn({ request: request({ reservationId: 'reservation' }) })).json()).toEqual({ completed: true, already: true });
		expect(done.writes).toEqual([]);
		const raced = database([row(active), row([])]);
		expect(await (await completeReturn({ request: request({ reservationId: 'reservation' }) })).json()).toEqual({ completed: true, already: true });
		expect(raced.writes.map((w) => w.table)).toEqual(['reservations']);
	});
	it('rejects malformed sales counts before writing', async () => {
		for (const salesItems of [{ beer: -1 }, { beer: 1.5 }, { beer: 'many' }, ['beer']]) {
			const db = database([]);
			await expect(
				completeReturn({ request: request({ reservationId: 'reservation', salesItems }) })
			).rejects.toMatchObject({ status: 400 });
			expect(db.writes).toEqual([]);
		}
	});
	it('requires login', async () => {
		const db = database([]);
		const req = request({ reservationId: 'reservation' });
		req.headers.delete('Authorization');
		await expect(completeReturn({ request: req })).rejects.toMatchObject({ status: 401 });
		expect(db.writes).toEqual([]);
	});
});

describe('new payment flow (card on booking, hold at check-in, one charge on return)', () => {
	const booked = {
		id: 'reservation',
		user_id: 'user',
		status: 'pending',
		stall_id: 'stall',
		rental_space_id: null,
		start_datetime: '2026-10-20T10:00:00+09:00',
		end_datetime: '2026-10-20T14:00:00+09:00',
		locked_stall_fee: 1000,
		locked_stall_ext_fee: 200,
		locked_space_fee: 500,
		locked_space_ext_fee: 100,
		stripe_payment_intent_id: null,
		stripe_customer_id: 'cus_test',
		stripe_payment_method_id: 'pm_card',
		stripe_hold_intent_id: null
	};
	it('confirms a booking when the card is registered (no charge)', async () => {
		const db = database([row({ ...booked, stripe_payment_method_id: null, stripe_customer_id: null }), row([]), row([{ id: 'reservation' }])]);
		mocks.setupRetrieve.mockResolvedValueOnce({ status: 'succeeded', payment_method: 'pm_card' });
		const setupSession = { mode: 'setup', status: 'complete', setup_intent: 'seti_1', customer: 'cus_test', metadata: { type: 'rental', reservationId: 'reservation', userId: 'user' } };
		await expect(confirm(db, { session: setupSession })).resolves.toBe('pm_card');
		expect(db.writes[0].value).toEqual({ stripe_payment_method_id: 'pm_card', stripe_customer_id: 'cus_test' });
		expect(mocks.createIntent).not.toHaveBeenCalled();
		expect(mocks.capture).not.toHaveBeenCalled();
	});
	it('places a hold for the reserved time at check-in', async () => {
		const db = database([row(null)]);
		mocks.createIntent.mockResolvedValueOnce({ id: 'pi_hold', status: 'requires_capture' });
		await secureRentalAtCheckIn({ stripe: new (await import('stripe')).default(), supabase: db, reservation: booked });
		expect(mocks.createIntent).toHaveBeenCalledWith(
			expect.objectContaining({ amount: 2100, capture_method: 'manual', off_session: true, payment_method: 'pm_card' }),
			expect.anything()
		);
		expect(db.writes[0].value).toEqual({ stripe_hold_intent_id: 'pi_hold' });
	});
	it('does not check in when the card cannot be held, and asks to re-check the card', async () => {
		const db = database([row(booked)]);
		mocks.createIntent.mockRejectedValueOnce(Object.assign(new Error('declined'), { code: 'card_declined' }));
		await expect(checkin({ request: request({ reservationId: 'reservation' }) })).rejects.toMatchObject({
			status: 402,
			body: { code: 'card_check_required' }
		});
		expect(db.writes).toEqual([]);
	});
	it('charges overtime in 30-minute units on a late return', async () => {
		const db = database([row({ ...booked, status: 'active', stripe_hold_intent_id: 'pi_hold' }), row([{ id: 'reservation' }]), row(null)]);
		mocks.createIntent.mockResolvedValueOnce({ id: 'pi_final', status: 'succeeded' });
		const r = await finalizeRentalReturn({
			stripe: new (await import('stripe')).default(),
			supabase: db,
			reservationId: 'reservation',
			userId: 'user',
			now: Date.parse('2026-10-20T14:10:00+09:00')
		});
		// 14:10 返却 → 14:30 まで = 延長3枠 → 1,500 + 3 × 300
		expect(r).toMatchObject({ charged: 2400, chargeStatus: 'paid' });
	});
	it('captures only the hold when the final charge fails', async () => {
		const db = database([row({ ...booked, status: 'active', stripe_hold_intent_id: 'pi_hold' }), row([{ id: 'reservation' }]), row(null)]);
		mocks.createIntent.mockRejectedValueOnce(new Error('declined'));
		mocks.retrieve.mockResolvedValueOnce({ id: 'pi_hold', status: 'requires_capture', amount: 2100 });
		mocks.capture.mockResolvedValueOnce({ status: 'succeeded', amount_received: 2100 });
		const r = await finalizeRentalReturn({
			stripe: new (await import('stripe')).default(),
			supabase: db,
			reservationId: 'reservation',
			userId: 'user',
			now: Date.parse('2026-10-20T15:00:00+09:00')
		});
		expect(mocks.capture).toHaveBeenCalledWith('pi_hold', { amount_to_capture: 2100 });
		expect(r).toMatchObject({ charged: 2100, chargeStatus: 'partial', charge: { total: 2700 } });
	});
	it('charges the base fee to the registered card for a no-show', async () => {
		mocks.createIntent.mockResolvedValueOnce({ id: 'pi_noshow', status: 'succeeded' });
		const r = await chargeNoShow({ stripe: new (await import('stripe')).default(), reservation: booked });
		expect(mocks.createIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 1500, off_session: true }), expect.anything());
		expect(r).toEqual({ charged: 1500, chargeStatus: 'paid', chargeIntentId: 'pi_noshow' });
	});
	it('extends an active rental when the next slots are free', async () => {
		const active = { ...booked, status: 'active' };
		const db = database([row(active), row([active]), row([]), row([{ id: 'reservation' }])]);
		const res = await extendRentalApi({ request: request({ reservationId: 'reservation', slots: 2 }) });
		const body = await res.json();
		expect(Date.parse(body.endDatetime)).toBe(Date.parse('2026-10-20T15:00:00+09:00'));
		expect(body.charge.total).toBe(1500 + 4 * 300);
		expect(db.writes[0].value).toEqual({ end_datetime: body.endDatetime });
	});
	it('refuses an extension that would run into the next booking (with the 30-minute gap)', async () => {
		const active = { ...booked, status: 'active' };
		const next = { ...booked, id: 'next', start_datetime: '2026-10-20T15:00:00+09:00', end_datetime: '2026-10-20T18:00:00+09:00' };
		// 14:30 までなら次の予約（15:00〜）との間に30分空くので延長できる。15:00 までは不可
		const db = database([row(active), row([active, next]), row([])]);
		await expect(extendRentalApi({ request: request({ reservationId: 'reservation', slots: 2 }) })).rejects.toMatchObject({ status: 409 });
		expect(db.writes).toEqual([]);
	});
});
