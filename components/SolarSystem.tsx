import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import Planet from './solarsystem/Planet';
import OrbitPath from './solarsystem/OrbitPath';
import { PlanetData, planets } from '../data/planets';

interface SolarSystemProps {
  onPlanetClick?: (planetData: PlanetData) => void;
}

const SolarSystem: React.FC<SolarSystemProps> = ({ onPlanetClick }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationIdRef = useRef<number| null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunRadius = 3;

  useEffect(() => {
    if (!mountRef.current) return;

    const toolbarHeight = 64; // Adjust if your toolbar height changes
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight - toolbarHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, viewportWidth / viewportHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    const labelRenderer = new CSS2DRenderer();

    renderer.autoClear = false;
    renderer.domElement.className = 'solar-system-canvas';
    renderer.setSize(viewportWidth, viewportHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.appendChild(renderer.domElement);

    labelRenderer.setSize(viewportWidth, viewportHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';

    mountRef.current.appendChild(labelRenderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(viewportWidth, viewportHeight), 2, 0.5, 0);
    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.setSize(viewportWidth, viewportHeight);
    bloomComposer.renderToScreen = true;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const light = new THREE.PointLight(0xffcc00, 2, 1000, 2);
    light.position.set(0, 0, 0); 
    light.castShadow = true;
    light.shadow.mapSize.width = 128;
    light.shadow.mapSize.height = 128;
    scene.add(light);

    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    const textureLoader = new THREE.TextureLoader();

    const starGeometry = new THREE.SphereGeometry(120, 64, 64);
    const starTexture = textureLoader.load('textures/galaxy.png');
    const starMaterial = new THREE.MeshBasicMaterial({
      map: starTexture,
      side: THREE.BackSide,
      transparent: true,
    });

    const starMesh = new THREE.Mesh(starGeometry, starMaterial);
    starMesh.castShadow = false;
    starMesh.receiveShadow = false;
    scene.add(starMesh);

    const sunGeometry = new THREE.SphereGeometry(sunRadius, 64, 64);
    const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.1, depthTest: true, transparent: false, opacity: 1 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.castShadow = false;
    sun.receiveShadow = false;
    sun.layers.set(1);
    scene.add(sun);

    planets.forEach((planet) => {
      OrbitPath({ radius: planet.position[0], scene });
    });

    const planetObjects = planets.map((planet) =>
      Planet({ ...planet, size: sunRadius * planet.size, scene, planetData: planet, onPlanetClick: onPlanetClick })
    );

    camera.position.z = 30;

    const controls = new OrbitControls(camera, renderer.domElement);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);

      const time = Date.now() * 0.0001;

      starMesh.rotation.y += 0.0001;

      planetObjects.forEach(({ planet, label }) => {
        const { orbitSpeed, distance } = planet.userData;
        planet.position.x = distance * Math.cos(time * orbitSpeed);
        planet.position.z = distance * Math.sin(time * orbitSpeed);

        const distanceToCamera = camera.position.distanceTo(planet.position);
        const labelScale = THREE.MathUtils.clamp(1 / distanceToCamera * 20, 0.5, 2);
        label.element.style.transform = `translate(-50%, -50%) scale(${labelScale})`;
      });

      controls.update();
      renderer.clear();

      camera.layers.set(1);
      bloomComposer.render();

      renderer.clearDepth();

      camera.layers.enable(0);
      camera.layers.enable(1);
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const newViewportWidth = window.innerWidth;
      const newViewportHeight = window.innerHeight - toolbarHeight;
    
      camera.aspect = newViewportWidth / newViewportHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newViewportWidth, newViewportHeight);
      labelRenderer.setSize(newViewportWidth, newViewportHeight);
      bloomComposer.setSize(newViewportWidth, newViewportHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);

      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material.map) material.map.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.specularMap) material.specularMap.dispose();
                material.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              if (child.material.normalMap) child.material.normalMap.dispose();
              if (child.material.specularMap) child.material.specularMap.dispose();
              child.material.dispose();
            }
          }
        }
      });

      while(scene.children.length > 0) {
        scene.remove(scene.children[0]);
      }

      if (controlsRef.current) {
        controlsRef.current.dispose();
      }

      if (bloomComposer) {
        bloomComposer.dispose();
      }

      if (mountRef.current) {
        if (renderer.domElement && mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
        if (labelRenderer.domElement && mountRef.current.contains(labelRenderer.domElement)) {
          mountRef.current.removeChild(labelRenderer.domElement);
        }
      }

      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [onPlanetClick]);

  return <div ref={mountRef}></div>; 
};

export default SolarSystem;

// This component sets up a basic 3D solar system using Three.js. It creates a scene with a sun and three planets (Mercury, Venus, and Earth) that rotate and orbit around the sun. The OrbitControls allow the user to interact with the scene by rotating and zooming the camera. The animation loop updates the positions and rotations of the planets to simulate their movement in space.