export interface MoonData {
    name: string;
    size: number;
    color: string;
    distance: number;
    orbitSpeed: number;
}

export interface PlanetData {
    name: string;
    size: number;
    color: string;
    position: [number, number, number];
    orbitSpeed: number;
    moons?: MoonData[];
}
  
export const planets: PlanetData[] = [
    { name: 'Mercury', size: 0.0035, color: '0x888888', position: [5, 0, 0], orbitSpeed: 4.15, moons: [] },
    { name: 'Venus', size: 0.0087, color: '0xffcc00', position: [8, 0, 0], orbitSpeed: 1.62, moons: [] },
    { name: 'Earth', size: 0.0091, color: '0x0000ff', position: [12, 0, 0], orbitSpeed: 1, moons: [
        { name: 'Moon', size: 0.0025, color: '0xaaaaaa', distance: 1.5, orbitSpeed: 0.05 },
    ] },
    { name: 'Mars', size: 0.0048, color: '0xff0000', position: [16, 0, 0], orbitSpeed: 0.53, moons: [
        { name: 'Phobos', size: 0.0012, color: '0x999999', distance: 1.0, orbitSpeed: 0.1 },
        { name: 'Deimos', size: 0.0008, color: '0x777777', distance: 1.5, orbitSpeed: 0.08 },
    ] },
];