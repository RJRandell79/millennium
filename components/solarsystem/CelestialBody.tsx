import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

interface CelestialBodyProps {
  name: string;
  size: number;
  color: string;
  position: [number, number, number];
  scene: THREE.Scene;
  onClick?: () => void;
  showClickCursor?: boolean;
}

const CelestialBody = ({ 
  name, 
  size, 
  color, 
  position, 
  scene, 
  onClick,
  showClickCursor = false 
}: CelestialBodyProps) => {
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(size, 32, 32),
    new THREE.MeshStandardMaterial({ color, depthTest: true, transparent: false, opacity: 1 })
  );
  body.castShadow = false;
  body.receiveShadow = true;
  body.position.set(...position);
  scene.add(body);

  const labelDiv = document.createElement('div');
  labelDiv.className = `${name.toLowerCase()}-label`;
  labelDiv.textContent = name;
  labelDiv.style.marginTop = '-1em';
  labelDiv.style.pointerEvents = showClickCursor ? 'auto' : 'none';
  labelDiv.style.cursor = showClickCursor ? 'pointer' : 'default';
  labelDiv.style.color = 'white';
  labelDiv.style.fontSize = showClickCursor ? '16px' : '14px';
  labelDiv.style.fontWeight = showClickCursor ? 'normal' : '300';
  
  if (onClick && showClickCursor) {
    labelDiv.onclick = onClick;
  }
  
  const label = new CSS2DObject(labelDiv);
  label.position.set(0, size + 0.5, 0);
  body.add(label);

  const linePoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, size + 0.5, 0)];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7bf1a8 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  body.add(line);

  return { body, label };
};

export default CelestialBody;