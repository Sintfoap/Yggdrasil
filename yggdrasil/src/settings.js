import * as THREE from 'three';

// Centralized application settings and shared mutable camera targets
export const orbitSpeed = 0.0001;
export const realmRadius = 0.36;
export const clockOffsetX = 3.6;

export const cameraBase = new THREE.Vector3(9, 0, 10);
export const cameraTarget = new THREE.Vector3(-1.4, 0, 0);

// default follow offset used when switching camera focus
export const cameraFollowOffset = new THREE.Vector3(0, 1.2, 2.8);

export default { orbitSpeed, realmRadius, clockOffsetX, cameraBase, cameraTarget, cameraFollowOffset };
