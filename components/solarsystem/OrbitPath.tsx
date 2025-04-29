import * as THREE from 'three';

interface OrbitProps {
  radius: number;
  scene: THREE.Scene;
}

const OrbitPath = ({ radius, scene }: OrbitProps) => {
    const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineDashedMaterial({
      color: 0x888888,
      dashSize: 0.25,
      gapSize: 0.2
    });

    const orbitPath = new THREE.Line(geometry, material);
    orbitPath.computeLineDistances();
    orbitPath.rotation.x = Math.PI / 2;
    scene.add(orbitPath);
    
    return orbitPath;
  };

  export default OrbitPath;
  
// This component creates a dashed orbit path for a planet in a solar system simulation.