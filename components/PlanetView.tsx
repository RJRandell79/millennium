import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Moon from './solarsystem/Moon';
import CelestialBody from './solarsystem/CelestialBody';
import OrbitPath from './solarsystem/OrbitPath';
import { PlanetData, MoonData } from '@/data/planets';

interface PlanetViewProps {
  planetData: PlanetData;
}

const PlanetView: React.FC<PlanetViewProps> = ({ planetData }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer| null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationIdRef = useRef<number| null>(null);
  const moonsRef = useRef<THREE.Mesh[]>([]);
  const mainPlanetRef = useRef<THREE.Mesh | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

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

    const controls = new OrbitControls(camera, renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const planetSize = Math.max(planetData.size * 100, 1);

    const { body: mainPlanet, label: mainLabel } = CelestialBody({
      name: planetData.name,
      size: planetSize,
      color: planetData.color,
      position: [0, 0, 0],
      scene,
      showClickCursor: false
    });
    
    mainPlanetRef.current = mainPlanet;

    const moons: THREE.Mesh[] = [];
    const moonLabels: CSS2DObject[] = [];
    
    if (planetData.moons && planetData.moons.length > 0) {
      planetData.moons.forEach((moonData: MoonData) => {
        const scaledDistance = moonData.distance * planetSize;
        OrbitPath({ radius: scaledDistance, scene });
      });

      planetData.moons.forEach((moonData: MoonData) => {
        const scaledDistance = moonData.distance * planetSize;
        const scaledSize = Math.max(moonData.size * 100, 0.1);
        
        const { moon, label } = Moon({
          moonData,
          scene,
          scaledDistance,
          scaledSize
        });

        moons.push(moon);
        moonLabels.push(label);
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

      controls.update();

      // Scale labels based on camera distance
      const distanceToCamera = camera.position.distanceTo(mainPlanet.position);
      const labelScale = THREE.MathUtils.clamp(1 / distanceToCamera * 15, 0.5, 2);
      mainLabel.element.style.transform = `translate(-50%, -50%) scale(${labelScale})`;

      // Scale moon labels
      moonsRef.current.forEach((moon) => {
        const moonDistance = camera.position.distanceTo(moon.position);
        const moonLabelScale = THREE.MathUtils.clamp(1 / moonDistance * 10, 0.3, 1.5);
        const moonLabel = moon.children.find(child => child instanceof CSS2DObject);
        if (moonLabel) {
          (moonLabel as CSS2DObject).element.style.transform = `translate(-50%, -50%) scale(${moonLabelScale})`;
        }
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

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  if (material.map) material.map.dispose();
                  material.dispose();
                });
              } else {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
              }
            }
          }
        });

        while(sceneRef.current.children.length > 0) {
          sceneRef.current.remove(sceneRef.current.children[0]);
        }
      }

      if (mountRef.current && rendererRef.current && labelRendererRef.current) {
        try {
          if (rendererRef.current.domElement) {
            mountRef.current.removeChild(rendererRef.current.domElement);
          }
          if (labelRendererRef.current.domElement) {
            mountRef.current.removeChild(labelRendererRef.current.domElement);
          }
        } catch (error) {
          console.warn('Error cleaning up renderers:', error);
        }
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
      } 

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