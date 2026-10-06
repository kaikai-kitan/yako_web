import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createConstellation } from './constellation.js';

describe('constellation background', () => {
	it('builds finite geometry with a bounded number of draw calls', () => {
		const background = createConstellation();
		expect(background.group.children.length).toBeLessThanOrEqual(3);
		for (const mesh of background.group.children) {
			expect(Boolean(mesh.isMesh || mesh.isPoints)).toBe(true);
			expect(mesh.geometry.attributes.position.count).toBeGreaterThan(0);
			mesh.geometry.computeBoundingSphere();
			expect(Number.isFinite(mesh.geometry.boundingSphere.radius)).toBe(true);
		}
		background.dispose();
	});

	it('does not intercept clicks intended for people in the network', () => {
		const background = createConstellation();
		background.group.updateMatrixWorld(true);
		const raycaster = new THREE.Raycaster(
			new THREE.Vector3(0, 100, 0),
			new THREE.Vector3(0, -1, 0)
		);
		expect(raycaster.intersectObject(background.group, true)).toEqual([]);
		background.dispose();
	});

	it('releases all shared GPU resources exactly once and detaches the scene', () => {
		const background = createConstellation();
		const scene = new THREE.Scene();
		scene.add(background.group);
		const resources = new Set();
		background.group.traverse((object) => {
			if (object.geometry) resources.add(object.geometry);
			if (object.material) {
				resources.add(object.material);
				if (object.material.map) resources.add(object.material.map);
			}
		});
		const listeners = [...resources].map((resource) => {
			const listener = vi.fn();
			resource.addEventListener('dispose', listener);
			return listener;
		});
		background.dispose();
		background.dispose();
		expect(scene.children).toHaveLength(0);
		for (const listener of listeners) expect(listener).toHaveBeenCalledTimes(1);
	});
});
