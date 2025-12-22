import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { PlanetData, MoonData } from '@/data/planets';

interface PlanetViewProps {
  planetData: PlanetData;
  onBack?: () => void;
}

const PlanetView: React.FC<PlanetViewProps> = ({ planetData, onBack }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer| null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number| null>(null);
  const moonsRef = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none';
    labelRendererRef.current = labelRenderer;

    mountRef.current.appendChild(renderer.domElement);
    mountRef.current.appendChild(labelRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const planetSize = Math.max(planetData.size * 100, 1);
    const mainPlanet = new THREE.Mesh(
      new THREE.SphereGeometry(planetSize, 32, 32),
      new THREE.MeshStandardMaterial({ color: planetData.color })
    );
    mainPlanet.position.set(0, 0, 0);
    scene.add(mainPlanet);

    const mainLabelDiv = document.createElement('div');
    mainLabelDiv.textContent = planetData.name;
    mainLabelDiv.style.color = 'white';
    mainLabelDiv.style.fontSize = '20px';
    mainLabelDiv.style.fontWeight = 'bold';
    const mainLabel = new CSS2DObject(mainLabelDiv);
    mainLabel.position.set(0, planetSize + 0.8, 0);
    mainPlanet.add(mainLabel);

    const moons: THREE.Mesh[] = [];
    if (planetData.moons && planetData.moons.length > 0) {
      planetData.moons.forEach((moonData: MoonData) => {
        const moonSize = Math.max(moonData.size * 100, 0.1);
        const moon = new THREE.Mesh(
          new THREE.SphereGeometry(moonSize, 16, 16),
          new THREE.MeshStandardMaterial({ color: moonData.color })
        );
        
        const scaledDistance = moonData.distance * planetSize;
        moon.position.set(scaledDistance, 0, 0);
        scene.add(moon);

        // Add moon label
        const moonLabelDiv = document.createElement('div');
        moonLabelDiv.textContent = moonData.name;
        moonLabelDiv.style.color = 'white';
        moonLabelDiv.style.fontSize = '14px';
        const moonLabel = new CSS2DObject(moonLabelDiv);
        moonLabel.position.set(0, moonSize + 0.3, 0);
        moon.add(moonLabel);

        const orbitGeometry = new THREE.RingGeometry(
          scaledDistance - 0.05, 
          scaledDistance + 0.05, 
          64
        );
        const orbitMaterial = new THREE.MeshBasicMaterial({
          color: 0x444444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.3
        });
        const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
        orbit.rotation.x = Math.PI / 2;
        scene.add(orbit);

        moon.userData = { ...moonData, scaledDistance };
        moons.push(moon);
      });
    }

    moonsRef.current = moons;

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      moonsRef.current.forEach((moon) => {
        const { orbitSpeed, scaledDistance } = moon.userData;
        const time = Date.now() * 0.001;
        moon.position.x = Math.cos(time * orbitSpeed) * scaledDistance;
        moon.position.z = Math.sin(time * orbitSpeed) * scaledDistance;
      });

      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      labelRenderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        if (renderer.domElement) mountRef.current.removeChild(renderer.domElement);
        if (labelRenderer.domElement) mountRef.current.removeChild(labelRenderer.domElement);
      }
      renderer.dispose();
    };
  }, [planetData]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div ref={mountRef} />
      {onBack && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            padding: '10px 20px',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            border: '1px solid white',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 1000
          }}
        >
          ← Back to Solar System
        </button>
      )}
      {(!planetData.moons || planetData.moons.length === 0) && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          color: 'white',
          fontSize: '16px',
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '10px',
          borderRadius: '5px'
        }}>
          {planetData.name} has no known moons
        </div>
      )}
    </div>
  );
};

export default PlanetView;