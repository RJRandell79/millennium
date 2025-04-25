declare module 'three/examples/jsm/controls/OrbitControls' {
    import { Camera, EventDispatcher, MOUSE, Vector3 } from 'three';
  
    export class OrbitControls extends EventDispatcher {
      constructor(object: Camera, domElement?: HTMLElement);
  
      object: Camera;
      domElement: HTMLElement;
  
      // API
      enabled: boolean;
      target: Vector3;
  
      // Methods
      update(): void;
      dispose(): void;
  
      // Events
      addEventListener(type: string, listener: (event: any) => void): void;
      removeEventListener(type: string, listener: (event: any) => void): void;
    }
  }