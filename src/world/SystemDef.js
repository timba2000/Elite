import * as THREE from 'three';

// The Achenar system: 1 sun + 6 worlds, each with a station.
// economy: 'exports' pay less here, 'imports' pay more here.
function pos(orbitRadius, angleDeg, y = 0) {
  const a = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * orbitRadius, y, Math.sin(a) * orbitRadius);
}

export const SYSTEM = {
  name: 'ACHENAR',
  sunRadius: 300,
  planets: [
    {
      id: 'veridia', name: 'VERIDIA', type: 'Agricultural World',
      flavor: 'Endless grain oceans under twin moons. Smells of rain and diesel.',
      radius: 130, position: pos(2600, 15), seed: 3,
      palette: ['#1a4d8f', '#3d8f3d', '#c8b96a'], atmosphere: '#6fb7ff',
      inhabited: true, gas: false,
      exports: ['food', 'water'], imports: ['machinery', 'electronics'],
    },
    {
      id: 'ferrox', name: 'FERROX', type: 'Mining Colony',
      flavor: 'Strip-mined crust, dust storms, and the best ore this side of the core.',
      radius: 95, position: pos(4200, 105), seed: 7,
      palette: ['#4a2f22', '#8a5a3a', '#c9987a'], atmosphere: '#d98a5a',
      inhabited: true, gas: false,
      exports: ['ore'], imports: ['food', 'medicine'],
    },
    {
      id: 'crucible', name: 'CRUCIBLE', type: 'Refinery World',
      flavor: 'The forges never sleep. Neither do the dock inspectors.',
      radius: 110, position: pos(6100, 200), seed: 11,
      palette: ['#3a3a42', '#6a5a4a', '#b87a3a'], atmosphere: '#ffaa55',
      inhabited: true, gas: false,
      exports: ['fuel', 'machinery'], imports: ['ore'],
    },
    {
      id: 'lumen', name: 'LUMEN PRIME', type: 'Hi-Tech World',
      flavor: 'Chrome towers, clean streets, and prices to match.',
      radius: 140, position: pos(8300, 300), seed: 17,
      palette: ['#1a3a6f', '#4a6a8a', '#e8e8f0'], atmosphere: '#8fd0ff',
      inhabited: true, gas: false,
      exports: ['electronics', 'medicine'], imports: ['food', 'luxuries'],
    },
    {
      id: 'thalassa', name: 'THALASSA', type: 'Tourist Orbital (Gas Giant)',
      flavor: 'Honeymoon suites with a view of the eternal storm.',
      radius: 260, position: pos(10800, 40, 300), seed: 23,
      palette: ['#7a4a8f', '#c98ab0', '#f0d8b0'], atmosphere: '#d0a0ff',
      inhabited: false, gas: true,
      exports: [], imports: ['luxuries', 'food'],
    },
    {
      id: 'drift', name: "KELLER'S DRIFT", type: 'Frontier Outpost',
      flavor: 'Last stop before the dark. Watch your cargo and your back.',
      radius: 70, position: pos(12600, 250, -400), seed: 29,
      palette: ['#3a3a3a', '#5a5a6a', '#8a8a9a'], atmosphere: '#667788',
      inhabited: true, gas: false,
      exports: ['fuel'], imports: ['food', 'water', 'medicine', 'electronics', 'luxuries', 'machinery'],
    },
  ],
};
