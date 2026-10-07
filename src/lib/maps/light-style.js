// Source schema: https://github.com/gsi-cyberjapan/optimal_bvmap
// Deliberately omit contours, utility lines and POI symbols.
export const GSI_ATTRIBUTION =
	'<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer">地理院タイル</a>';
export function createLightStyle() {
	const layer = (id, sourceLayer, type, paint, extra = {}) => ({
		id,
		source: 'gsi',
		'source-layer': sourceLayer,
		type,
		paint,
		...extra
	});
	return {
		version: 8,
		glyphs: 'https://gsi-cyberjapan.github.io/optimal_bvmap/glyphs/{fontstack}/{range}.pbf',
		sources: {
			gsi: {
				type: 'vector',
				minzoom: 4,
				maxzoom: 16,
				tiles: [
					'pmtiles://https://cyberjapandata.gsi.go.jp/xyz/optimal_bvmap-v1/optimal_bvmap-v1.pmtiles/{z}/{x}/{y}'
				],
				attribution: GSI_ATTRIBUTION
			}
		},
		layers: [
			{ id: 'paper', type: 'background', paint: { 'background-color': '#f7f8f5' } },
			layer('water', 'WA', 'fill', { 'fill-color': '#d0e4eb' }),
			layer('rivers', 'RvrCL', 'line', {
				'line-color': '#c4dfe8',
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 4]
			}),
			layer(
				'buildings',
				'BldA',
				'fill',
				{ 'fill-color': '#e6e8e2', 'fill-opacity': 0.75 },
				{ minzoom: 14 }
			),
			layer('roads-edge', 'RdCL', 'line', {
				'line-color': '#d8ddd7',
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 3, 18, 10]
			}),
			layer('roads', 'RdCL', 'line', {
				'line-color': '#ffffff',
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.8, 18, 8]
			}),
			layer('railways', 'RailCL', 'line', {
				'line-color': '#bfc7c2',
				'line-width': 1,
				'line-dasharray': [3, 3]
			}),
			layer(
				'place-names',
				'Anno',
				'symbol',
				{ 'text-color': '#738178', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
				{
					minzoom: 14,
					filter: [
						'all',
						['==', ['geometry-type'], 'Point'],
						[
							'any',
							['in', '駅', ['get', 'vt_text']],
							['in', '川', ['get', 'vt_text']],
							['in', '町', ['get', 'vt_text']]
						]
					],
					layout: {
						'text-field': ['get', 'vt_text'],
						'text-font': ['NotoSansJP-Regular'],
						'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 12],
						'text-padding': 50,
						'text-max-width': 10
					}
				}
			)
		]
	};
}
