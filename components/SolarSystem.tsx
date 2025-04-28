import { useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const SolarSystem = () => {

  useEffect(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();

    renderer.autoClear = false;
    renderer.domElement.className = 'solar-system-canvas';
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2, 0.5, 0);
    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.setSize(window.innerWidth, window.innerHeight);
    bloomComposer.renderToScreen = true;
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const light = new THREE.PointLight(0xffcc00, 1, 1000);
    light.position.set(0, 0, 0); 
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
    scene.add(starMesh);

    const sunGeometry = new THREE.SphereGeometry(3, 64, 64);
    const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 1.1, depthTest: true, transparent: false, opacity: 1 });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.layers.set(1);
    scene.add(sun);

    const mercuryGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const mercuryMaterial = new THREE.MeshBasicMaterial({ color: 0x888888, depthTest: true, transparent: false, opacity: 1 });
    const mercury = new THREE.Mesh(mercuryGeometry, mercuryMaterial);
    mercury.position.set(5, 0, 0);
    scene.add(mercury);

    const venusGeometry = new THREE.SphereGeometry(0.7, 32, 32);
    const venusMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00, depthTest: true, transparent: false, opacity: 1 });
    const venus = new THREE.Mesh(venusGeometry, venusMaterial);
    venus.position.set(8, 0, 0); 
    scene.add(venus);

    const earthGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const earthMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: true, transparent: false, opacity: 1 });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earth.position.set(12, 0, 0);
    scene.add(earth);

    const marsGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    const marsMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, depthTest: true, transparent: false, opacity: 1 });
    const mars = new THREE.Mesh(marsGeometry, marsMaterial);
    mars.position.set(16, 0, 0);
    scene.add(mars);

    camera.position.z = 30;

    const controls = new OrbitControls(camera, renderer.domElement);

    const animate = () => {
      requestAnimationFrame(animate);

      starMesh.rotation.y += 0.0001;
      mercury.rotation.y += 0.01;
      venus.rotation.y += 0.005;
      earth.rotation.y += 0.004;
      mars.rotation.y += 0.003;

      mercury.position.x = 5 * Math.cos(Date.now() * 0.001);
      mercury.position.z = 5 * Math.sin(Date.now() * 0.001);

      venus.position.x = 8 * Math.cos(Date.now() * 0.0005);
      venus.position.z = 8 * Math.sin(Date.now() * 0.0005);

      earth.position.x = 12 * Math.cos(Date.now() * 0.0003);
      earth.position.z = 12 * Math.sin(Date.now() * 0.0003);

      mars.position.x = 16 * Math.cos(Date.now() * 0.0002);
      mars.position.z = 16 * Math.sin(Date.now() * 0.0002);

      controls.update();
      renderer.clear();

      camera.layers.set(1);
      bloomComposer.render();

      renderer.clearDepth();

      camera.layers.enable(0);
      camera.layers.enable(1);
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.dispose();
    };
  }, []);

  return <div></div>; 
};

export default SolarSystem;

// This component sets up a basic 3D solar system using Three.js. It creates a scene with a sun and three planets (Mercury, Venus, and Earth) that rotate and orbit around the sun. The OrbitControls allow the user to interact with the scene by rotating and zooming the camera. The animation loop updates the positions and rotations of the planets to simulate their movement in space.