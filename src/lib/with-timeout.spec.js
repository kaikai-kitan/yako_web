import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './with-timeout.js';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
	it('returns service data and clears the deadline', async () => {
		vi.useFakeTimers();
		await expect(withTimeout(Promise.resolve(['stall']))).resolves.toEqual(['stall']);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('preserves service errors and clears the deadline', async () => {
		vi.useFakeTimers();
		const error = new Error('Service unavailable');
		await expect(withTimeout(Promise.reject(error))).rejects.toBe(error);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('stops waiting for an unresponsive service after 15 seconds', async () => {
		vi.useFakeTimers();
		const result = withTimeout(new Promise(() => {}));
		const assertion = expect(result).rejects.toThrow('読み込みがタイムアウトしました');
		await vi.advanceTimersByTimeAsync(15000);
		await assertion;
		expect(vi.getTimerCount()).toBe(0);
	});
});
