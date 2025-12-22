import { MoonData } from '@/data/planets';
import CelestialBody from './CelestialBody';
import * as THREE from 'three';

interface MoonProps {
  moonData: MoonData;
  scene: THREE.Scene;
  scaledDistance: number;
  scaledSize: number;
}

const Moon = ({ moonData, scene, scaledDistance, scaledSize }: MoonProps) => {
  const { body, label } = CelestialBody({
    name: moonData.name,
    size: scaledSize,
    color: moonData.color,
    position: [scaledDistance, 0, 0],
    scene,
    showClickCursor: false
  });

  body.userData = { 
    ...moonData, 
    scaledDistance,
    orbitSpeed: moonData.orbitSpeed,
    distance: scaledDistance 
  };

  return { moon: body, label };
};

export default Moon;