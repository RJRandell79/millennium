import { PlanetData } from '@/data/planets';
import CelestialBody from './CelestialBody';
import * as THREE from 'three';

interface PlanetProps {
  name: string;
  size: number;
  color: string;
  position: [number, number, number];
  orbitSpeed: number;
  scene: THREE.Scene;
  onPlanetClick?: (planetName: PlanetData) => void;
  planetData: PlanetData;
}

const Planet = ({ 
  name, 
  size, 
  color, 
  position, 
  orbitSpeed, 
  scene, 
  onPlanetClick, 
  planetData 
}: PlanetProps) => {
  const handleClick = () => {
    if (onPlanetClick) {
      onPlanetClick(planetData);
    }
  };

  const { body: planet, label } = CelestialBody({
    name,
    size,
    color,
    position,
    scene,
    onClick: handleClick,
    showClickCursor: true
  });

  planet.userData = { orbitSpeed, distance: position[0] };

  return { planet, label };
};

export default Planet;