import * as THREE from 'three';

export const CONSTELLATION_BACKGROUND = '#080e1b';

// Decorative, deterministic star field. No external textures or geographic data.
export function createConstellation() {
	const group = new THREE.Group();
	group.name = 'constellation-background';
	let seed = 20261006;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const positions = [],
		colors = [],
		sizes = [];
	const color = new THREE.Color();
	for (let i = 0; i < 2600; i++) {
		const y = random() * 2 - 1;
		const angle = random() * Math.PI * 2;
		const radius = 1400 + random() * 2300;
		const ring = Math.sqrt(1 - y * y);
		positions.push(radius * ring * Math.cos(angle), radius * y, radius * ring * Math.sin(angle));
		color.set(i % 7 === 0 ? '#f4d7ac' : i % 3 === 0 ? '#a9c9ee' : '#e7edf5');
		const brightness = 0.35 + random() * 0.6;
		colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
		sizes.push(i < 90 ? 3 + random() * 3 : 0.8 + random() * 1.7);
	}
	const starGeometry = new THREE.BufferGeometry();
	starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
	starGeometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
	const starMaterial = new THREE.ShaderMaterial({
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		vertexColors: true,
		vertexShader: `
			attribute float starSize;
			varying vec3 tint;
			void main() {
				tint = color;
				vec4 p = modelViewMatrix * vec4(position, 1.0);
				gl_Position = projectionMatrix * p;
				gl_PointSize = starSize * clamp(1900.0 / max(-p.z, 1.0), 0.7, 1.8);
			}`,
		fragmentShader: `
			varying vec3 tint;
			void main() {
				float r = length(gl_PointCoord - 0.5) * 2.0;
				float glow = exp(-r * r * 5.0) * (1.0 - smoothstep(0.75, 1.0, r));
				gl_FragColor = vec4(tint, glow);
				#include <colorspace_fragment>
			}`
	});
	group.add(new THREE.Points(starGeometry, starMaterial));

	const skyMaterial = new THREE.ShaderMaterial({
		side: THREE.BackSide,
		depthWrite: false,
		vertexShader: `
			varying vec3 direction;
			void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
		fragmentShader: `
			varying vec3 direction;
			float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
			float noise(vec3 p) {
				vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
				return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
					mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
			}
			float cloud(vec3 p) { return noise(p)*0.53 + noise(p*2.02)*0.27 + noise(p*4.04)*0.13 + noise(p*8.08)*0.07; }
			void main() {
				vec3 d = normalize(direction);
				float n = cloud(d * 5.0 + 3.0);
				float band = exp(-pow(dot(d, normalize(vec3(0.62, 0.75, 0.22))) * 3.8 + (n - 0.5), 2.0));
				float dust = smoothstep(0.35, 0.72, n) * band;
				vec3 color = vec3(0.0024, 0.0045, 0.009);
				vec3 nebula = mix(vec3(0.018,0.029,0.052),vec3(0.044,0.021,0.039),noise(d*3.0));
				color += nebula * dust * 0.85;
				color += vec3(0.006,0.012,0.016) * band * cloud(d*11.0);
				gl_FragColor = vec4(color, 1.0);
				#include <colorspace_fragment>
			}`
	});
	const sky = new THREE.Mesh(new THREE.SphereGeometry(6500, 32, 20), skyMaterial);
	sky.renderOrder = -100;
	group.add(sky);
	group.traverse((object) => {
		object.raycast = () => {};
	});
	let disposed = false;
	return {
		group,
		dispose() {
			if (disposed) return;
			disposed = true;
			group.removeFromParent();
			starGeometry.dispose();
			starMaterial.dispose();
			sky.geometry.dispose();
			skyMaterial.dispose();
		}
	};
}
