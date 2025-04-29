import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

interface PlanetProps {
  name: string;
  size: number;
  color: string;
  position: [number, number, number];
  orbitSpeed: number;
  scene: THREE.Scene
}

const Planet = ({ name, size, color, position, orbitSpeed, scene }: PlanetProps) => {
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(size, 32, 32),
    new THREE.MeshStandardMaterial({ color, depthTest: true, transparent: false, opacity: 1 })
  );
  planet.castShadow = false;
  planet.receiveShadow = true;
  planet.position.set(...position);
  scene.add(planet);

  const labelDiv = document.createElement('div');
  labelDiv.className = `${name.toLowerCase()}-label`;
  labelDiv.textContent = name;
  labelDiv.style.marginTop = '-1em';
  labelDiv.style.pointerEvents = 'none';
  const label = new CSS2DObject(labelDiv);
  label.position.set(0, size + 0.5, 0);
  planet.add(label);

  const linePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size + 0.5, 0)];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7bf1a8 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  planet.add(line);

  planet.userData = { orbitSpeed, distance: position[0] };

  return { planet, label };
};

export default Planet;