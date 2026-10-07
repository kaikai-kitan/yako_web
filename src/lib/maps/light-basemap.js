import { createLightStyle, GSI_ATTRIBUTION } from './light-style.js';

// Keep Leaflet's existing pins and booking interactions; only replace the backdrop.
export async function addLightBasemap(L, map, isDestroyed) {
	let vector;
	let deadline;
	let fallbackUsed = false;
	const clearDeadline = () => clearTimeout(deadline);
	const fallback = () => {
		if (fallbackUsed || isDestroyed()) return;
		fallbackUsed = true;
		clearDeadline();
		if (vector && map.hasLayer(vector)) map.removeLayer(vector);
		L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png', {
			minZoom: 5,
			maxNativeZoom: 18,
			maxZoom: 19,
			attribution: GSI_ATTRIBUTION
		}).addTo(map);
	};
	map.once('unload', clearDeadline);
	try {
		const [gl, { maplibreGL }, { Protocol }, { default: workerUrl }] = await Promise.all([
			import('maplibre-gl'),
			import('@maplibre/maplibre-gl-leaflet'),
			import('pmtiles'),
			import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
			import('maplibre-gl/dist/maplibre-gl.css')
		]);
		if (isDestroyed()) return;
		gl.setWorkerUrl(workerUrl);
		gl.addProtocol('pmtiles', new Protocol().tile);
		vector = maplibreGL({ style: createLightStyle(), attributionControl: false });
		vector.addTo(map);
		map.attributionControl.addAttribution(GSI_ATTRIBUTION);
		const renderer = vector.getMaplibreMap();
		renderer.once('load', clearDeadline);
		let failures = 0;
		renderer.on('error', () => {
			if (++failures >= 3) fallback();
		});
		deadline = setTimeout(fallback, 15000);
	} catch {
		fallback();
	}
}
