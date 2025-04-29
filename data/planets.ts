export interface PlanetData {
    name: string;
    size: number;
    color: string;
    position: [number, number, number];
    orbitSpeed: number;
}
  
export const planets: PlanetData[] = [
    { name: 'Mercury', size: 0.0035, color: '0x888888', position: [5, 0, 0], orbitSpeed: 4.15 },
    { name: 'Venus', size: 0.0087, color: '0xffcc00', position: [8, 0, 0], orbitSpeed: 1.62 },
    { name: 'Earth', size: 0.0091, color: '0x0000ff', position: [12, 0, 0], orbitSpeed: 1 },
    { name: 'Mars', size: 0.0048, color: '0xff0000', position: [16, 0, 0], orbitSpeed: 0.53 },
];