import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { createLightStyle } from './light-style.js';
import { addLightBasemap } from './light-basemap.js';

const mock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('maplibre-gl', () => ({ setWorkerUrl: vi.fn(), addProtocol: vi.fn() }));
vi.mock('@maplibre/maplibre-gl-leaflet', () => ({ maplibreGL: mock.create }));
vi.mock('pmtiles', () => ({
	Protocol: class {
		tile() {}
	}
}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?url', () => ({ default: '/worker.mjs' }));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
afterEach(() => {
	vi.useRealTimers();
	vi.clearAllMocks();
});
function setup() {
	vi.useFakeTimers();
	const events = {};
	const renderer = {
		once: (event, fn) => {
			events[event] = fn;
		},
		on: (event, fn) => {
			events[event] = fn;
		}
	};
	const vector = { addTo: vi.fn(), getMaplibreMap: () => renderer };
	mock.create.mockReturnValue(vector);
	const map = {
		once: (event, fn) => {
			events[event] = fn;
		},
		hasLayer: () => true,
		removeLayer: vi.fn(),
		attributionControl: { addAttribution: vi.fn() }
	};
	const L = { tileLayer: vi.fn(() => ({ addTo: vi.fn() })) };
	return { events, vector, map, L };
}
describe('light basemap', () => {
	it('uses a valid MapLibre style, including the zoom and label expressions', () => {
		expect(validateStyleMin(createLightStyle())).toEqual([]);
	});
	it('keeps the loaded vector map and cancels its fallback deadline', async () => {
		const { events, map, L } = setup();
		await addLightBasemap(L, map, () => false);
		events.load();
		vi.advanceTimersByTime(20000);
		expect(L.tileLayer).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
	it('falls back exactly once after repeated source errors', async () => {
		const { events, map, L, vector } = setup();
		await addLightBasemap(L, map, () => false);
		for (let i = 0; i < 5; i++) events.error();
		vi.advanceTimersByTime(20000);
		expect(map.removeLayer).toHaveBeenCalledWith(vector);
		expect(L.tileLayer).toHaveBeenCalledTimes(1);
	});
	it('falls back if map loading never finishes', async () => {
		const { map, L } = setup();
		await addLightBasemap(L, map, () => false);
		vi.advanceTimersByTime(15000);
		expect(L.tileLayer).toHaveBeenCalledTimes(1);
	});
	it('does not add layers after the page is destroyed', async () => {
		const { map, L, vector } = setup();
		await addLightBasemap(L, map, () => true);
		expect(vector.addTo).not.toHaveBeenCalled();
		expect(L.tileLayer).not.toHaveBeenCalled();
	});
	it('cancels pending fallback when the map is removed', async () => {
		const { events, map, L } = setup();
		await addLightBasemap(L, map, () => false);
		events.unload();
		vi.advanceTimersByTime(20000);
		expect(L.tileLayer).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});
