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
      exports: ['food', 'water'], imports: ['machinery', 'electronics', 'medicine'],
    },
    {
      id: 'ferrox', name: 'FERROX', type: 'Mining Colony',
      flavor: 'Strip-mined crust, dust storms, and the best ore this side of the core.',
      radius: 95, position: pos(4200, 105), seed: 7,
      palette: ['#4a2f22', '#8a5a3a', '#c9987a'], atmosphere: '#d98a5a',
      inhabited: true, gas: false,
      exports: ['ore'], imports: ['food', 'medicine', 'fuel', 'machinery', 'water', 'narcotics'],
    },
    {
      id: 'crucible', name: 'CRUCIBLE', type: 'Refinery World',
      flavor: 'The forges never sleep. Neither do the dock inspectors.',
      radius: 110, position: pos(6100, 200), seed: 11,
      palette: ['#3a3a42', '#6a5a4a', '#b87a3a'], atmosphere: '#ffaa55',
      inhabited: true, gas: false,
      exports: ['fuel', 'machinery'], imports: ['ore', 'electronics', 'water'],
    },
    {
      id: 'lumen', name: 'LUMEN PRIME', type: 'Hi-Tech World',
      flavor: 'Chrome towers, clean streets, and prices to match.',
      radius: 140, position: pos(8300, 300), seed: 17,
      palette: ['#1a3a6f', '#4a6a8a', '#e8e8f0'], atmosphere: '#8fd0ff',
      inhabited: true, gas: false,
      exports: ['electronics', 'medicine', 'luxuries'], imports: ['food', 'narcotics'],
    },
    {
      id: 'thalassa', name: 'THALASSA', type: 'Tourist Orbital (Gas Giant)',
      flavor: 'Honeymoon suites with a view of the eternal storm.',
      radius: 260, position: pos(10800, 40, 300), seed: 23,
      palette: ['#7a4a8f', '#c98ab0', '#f0d8b0'], atmosphere: '#d0a0ff',
      inhabited: false, gas: true,
      exports: [], imports: ['luxuries', 'food', 'fuel', 'narcotics'],
    },
    {
      id: 'drift', name: "KELLER'S DRIFT", type: 'Frontier Outpost',
      flavor: 'Last stop before the dark. Watch your cargo and your back.',
      radius: 70, position: pos(12600, 250, -400), seed: 29,
      palette: ['#3a3a3a', '#5a5a6a', '#8a8a9a'], atmosphere: '#667788',
      inhabited: true, gas: false,
      exports: ['fuel', 'narcotics'], imports: ['food', 'water', 'medicine', 'electronics', 'luxuries', 'machinery'],
    },
  ],
};

function makeRnd(seed) {
  let h = seed;
  return function() {
    h = Math.sin(h) * 10000;
    return h - Math.floor(h);
  };
}

const ORIGINAL_SYSTEM_PLANETS = [
  {
    id: 'veridia', name: 'VERIDIA', type: 'Agricultural World',
    flavor: 'Endless grain oceans under twin moons. Smells of rain and diesel.',
    radius: 130, position: pos(2600, 15), seed: 3,
    palette: ['#1a4d8f', '#3d8f3d', '#c8b96a'], atmosphere: '#6fb7ff',
    inhabited: true, gas: false,
    exports: ['food', 'water'], imports: ['machinery', 'electronics', 'medicine'],
    moons: [
      { radius: 15, orbitRadius: 220, orbitSpeed: 0.06, spinSpeed: 0.08, color: '#888888' },
      { radius: 10, orbitRadius: 290, orbitSpeed: 0.04, spinSpeed: 0.12, color: '#aaaaaa' }
    ]
  },
  {
    id: 'ferrox', name: 'FERROX', type: 'Mining Colony',
    flavor: 'Strip-mined crust, dust storms, and the best ore this side of the core.',
    radius: 95, position: pos(4200, 105), seed: 7,
    palette: ['#4a2f22', '#8a5a3a', '#c9987a'], atmosphere: '#d98a5a',
    inhabited: true, gas: false,
    exports: ['ore'], imports: ['food', 'medicine', 'fuel', 'machinery', 'water', 'narcotics'],
  },
  {
    id: 'crucible', name: 'CRUCIBLE', type: 'Refinery World',
    flavor: 'The forges never sleep. Neither do the dock inspectors.',
    radius: 110, position: pos(6100, 200), seed: 11,
    palette: ['#3a3a42', '#6a5a4a', '#b87a3a'], atmosphere: '#ffaa55',
    inhabited: true, gas: false,
    exports: ['fuel', 'machinery'], imports: ['ore', 'electronics', 'water'],
  },
  {
    id: 'lumen', name: 'LUMEN PRIME', type: 'Hi-Tech World',
    flavor: 'Chrome towers, clean streets, and prices to match.',
    radius: 140, position: pos(8300, 300), seed: 17,
    palette: ['#1a3a6f', '#4a6a8a', '#e8e8f0'], atmosphere: '#8fd0ff',
    inhabited: true, gas: false,
    exports: ['electronics', 'medicine', 'luxuries'], imports: ['food', 'narcotics'],
  },
  {
    id: 'thalassa', name: 'THALASSA', type: 'Tourist Orbital (Gas Giant)',
    flavor: 'Honeymoon suites with a view of the eternal storm.',
    radius: 260, position: pos(10800, 40, 300), seed: 23,
    palette: ['#7a4a8f', '#c98ab0', '#f0d8b0'], atmosphere: '#d0a0ff',
    inhabited: false, gas: true,
    exports: [], imports: ['luxuries', 'food', 'fuel', 'narcotics'],
  },
  {
    id: 'drift', name: "KELLER'S DRIFT", type: 'Frontier Outpost',
    flavor: 'Last stop before the dark. Watch your cargo and your back.',
    radius: 70, position: pos(12600, 250, -400), seed: 29,
    palette: ['#3a3a3a', '#5a5a6a', '#8a8a9a'], atmosphere: '#667788',
    inhabited: true, gas: false,
    exports: ['fuel', 'narcotics'], imports: ['food', 'water', 'medicine', 'electronics', 'luxuries', 'machinery'],
  },
];

export function generateGalaxy(galaxyIndex) {
  if (galaxyIndex === 0) {
    SYSTEM.name = 'ACHENAR';
    SYSTEM.sunRadius = 300;
    SYSTEM.suns = [
      { radius: 300, position: new THREE.Vector3(0, 0, 0), color: '#ffeedd' }
    ];
    SYSTEM.planets = ORIGINAL_SYSTEM_PLANETS;
    return;
  }

  const rnd = makeRnd(galaxyIndex * 987.654 + 3.21);

  const prefix = ['VER', 'FER', 'CRU', 'LUM', 'ACH', 'ZON', 'TAR', 'XEN', 'VAL', 'SOL', 'ALPH', 'BET', 'GAM', 'DRA', 'OR', 'SI', 'AN', 'COR', 'KAI', 'HELI', 'CYG', 'VEC', 'LYR', 'PEG', 'VEG', 'ANDR'];
  const suffix = ['IDIA', 'OX', 'CIBLE', 'EN', 'ON', 'IA', 'OS', 'US', 'AR', 'AX', 'ERA', 'AURA', 'ETIS', 'ION', 'ORE', 'OCTO', 'IS', 'UX', 'YON', 'ITE', 'ATIS', 'OPIA', 'ALIS', 'URUS', 'OOM', 'USIA'];
  
  const getRandName = () => {
    const p = prefix[Math.floor(rnd() * prefix.length)];
    const s = suffix[Math.floor(rnd() * suffix.length)];
    return p + s;
  };

  // 1. Galaxy name
  SYSTEM.name = getRandName() + ' ' + (galaxyIndex + 1);

  // 2. Suns (potentially multiple)
  const isBinary = galaxyIndex > 0 && rnd() < 0.45;
  if (isBinary) {
    const color1 = ['#ffa54f', '#ff7f24', '#ff4500', '#ffd27a'][Math.floor(rnd() * 4)];
    const color2 = ['#87cefa', '#00bfff', '#1e90ff', '#e0ffff'][Math.floor(rnd() * 4)];
    SYSTEM.suns = [
      { radius: 200 + rnd() * 60, position: new THREE.Vector3(-1400, 0, -800), color: color1 },
      { radius: 130 + rnd() * 40, position: new THREE.Vector3(1400, 0, 800), color: color2 },
    ];
    SYSTEM.sunRadius = 240;
  } else {
    const mainColors = ['#ffeedd', '#ffdfa0', '#ffcc88', '#a0c0ff', '#e0f0ff', '#ffa0a0'];
    const chosenColor = mainColors[Math.floor(rnd() * mainColors.length)];
    SYSTEM.suns = [
      { radius: 280 + rnd() * 60, position: new THREE.Vector3(0, 0, 0), color: chosenColor }
    ];
    SYSTEM.sunRadius = SYSTEM.suns[0].radius;
  }

  // 3. Planets
  const numPlanets = 5 + Math.floor(rnd() * 4); // 5 to 8 planets
  SYSTEM.planets = [];
  
  const types = [
    { type: 'Agricultural World', exports: ['food', 'water'], imports: ['machinery', 'electronics', 'medicine'] },
    { type: 'Mining Colony', exports: ['ore'], imports: ['food', 'medicine', 'fuel', 'machinery', 'water', 'narcotics'] },
    { type: 'Refinery World', exports: ['fuel', 'machinery'], imports: ['ore', 'electronics', 'water'] },
    { type: 'Hi-Tech World', exports: ['electronics', 'medicine', 'luxuries'], imports: ['food', 'narcotics'] },
    { type: 'Frontier Outpost', exports: ['fuel', 'narcotics'], imports: ['food', 'water', 'medicine', 'electronics', 'luxuries', 'machinery'] },
    { type: 'Industrial Core', exports: ['machinery', 'electronics'], imports: ['ore', 'fuel', 'water', 'luxuries'] }
  ];

  const basePalettes = [
    ['#1a4d8f', '#3d8f3d', '#c8b96a'], // Earthy
    ['#4a2f22', '#8a5a3a', '#c9987a'], // Rocky
    ['#3a3a42', '#6a5a4a', '#b87a3a'], // Metallic
    ['#1a3a6f', '#4a6a8a', '#e8e8f0'], // Hi-tech ice
    ['#7a4a8f', '#c98ab0', '#f0d8b0'], // Gas giant
    ['#8f2c2c', '#c75c5c', '#e6a1a1'], // Rust
    ['#1a6f5e', '#3d8f85', '#b3d9d3']  // Teal
  ];

  const baseAtmospheres = ['#6fb7ff', '#d98a5a', '#ffaa55', '#8fd0ff', '#d0a0ff', '#ff8888', '#66ffcc'];

  const flavors = [
    'A majestic world wrapped in swirling storms.',
    'Scattered cities cling to high volcanic plateaus.',
    'Deep subterranean tunnels hum with massive operations.',
    'Endless oceans of blue dotted by floating metropolises.',
    'Rich in valuable gases, highly active space ports.',
    'Icy craters house the galaxy\'s most isolated research labs.',
    'The air smells of ozone and corporate greed.',
    'Vast silicate sands that glow under the twin stars.'
  ];

  for (let i = 0; i < numPlanets; i++) {
    const name = getRandName() + (rnd() < 0.2 ? ' PRIME' : rnd() < 0.1 ? ' B' : '');
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const tSpec = types[Math.floor(rnd() * types.length)];
    const dist = 2400 + i * 1800 + rnd() * 700;
    const angle = rnd() * 360;
    const yOffset = (rnd() - 0.5) * 600;
    
    const palIdx = Math.floor(rnd() * basePalettes.length);
    const palette = basePalettes[palIdx];
    const atmosphere = baseAtmospheres[Math.floor(rnd() * baseAtmospheres.length)];
    
    const moons = [];
    const numMoons = rnd() < 0.3 ? 2 : rnd() < 0.7 ? 1 : 0;
    const pRadius = 70 + Math.floor(rnd() * 90);
    
    for (let m = 0; m < numMoons; m++) {
      moons.push({
        radius: 12 + Math.floor(rnd() * 12),
        orbitRadius: pRadius * 1.8 + m * 55 + rnd() * 20,
        orbitSpeed: 0.05 + rnd() * 0.12,
        spinSpeed: 0.05 + rnd() * 0.15,
        color: ['#888888', '#aaaaaa', '#555555', '#bbaa99', '#99aabb'][Math.floor(rnd() * 5)]
      });
    }

    const gas = rnd() < 0.2;
    const flavor = flavors[Math.floor(rnd() * flavors.length)];

    SYSTEM.planets.push({
      id,
      name,
      type: tSpec.type,
      flavor,
      radius: gas ? pRadius * 1.6 : pRadius,
      position: pos(dist, angle, yOffset),
      seed: Math.floor(rnd() * 100),
      palette,
      atmosphere,
      inhabited: tSpec.type !== 'Frontier Outpost' && !gas,
      gas,
      exports: tSpec.exports,
      imports: tSpec.imports,
      moons: moons.length > 0 ? moons : null
    });
  }
}
