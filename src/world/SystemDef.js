import * as THREE from 'three';

// The Sol system: 1 sun + 9 worlds, each with a station.
// economy: 'exports' pay less here, 'imports' pay more here.
function pos(orbitRadius, angleDeg, y = 0) {
  const a = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(a) * orbitRadius, y, Math.sin(a) * orbitRadius);
}

// Radii are true to scale: real radius in km x 0.0173 (Earth = 110).
// Jupiter genuinely dwarfs everything and Pluto is smaller than the Moon.
const SOL_PLANETS = [
  {
    id: 'mercury', name: 'MERCURY', type: 'Mining Colony',
    flavor: 'Sun-blasted rock and shadowed craters hiding the richest ore veins in the system.',
    radius: 42, position: pos(2200, 20), seed: 3,
    palette: ['#5a5148', '#8a7a68', '#b0a090'], atmosphere: '#887766',
    inhabited: true, gas: false, clouds: false,
    exports: ['ore'], imports: ['food', 'medicine', 'fuel', 'machinery', 'water', 'narcotics'],
  },
  {
    id: 'venus', name: 'VENUS', type: 'Refinery World',
    flavor: 'Cloud-city refineries ride the acid winds above a furnace world.',
    radius: 105, position: pos(3400, 110), seed: 7,
    palette: ['#8a6a2a', '#c9a05a', '#f0d8a0'], atmosphere: '#ffcc66',
    inhabited: true, gas: false,
    exports: ['fuel', 'machinery'], imports: ['ore', 'electronics', 'water'],
  },
  {
    id: 'earth', name: 'EARTH', type: 'Hi-Tech World',
    flavor: 'The cradle of humanity. Blue oceans, old cities, and the busiest docks in known space.',
    radius: 110, position: pos(4600, 200), seed: 11,
    palette: ['#1a4d8f', '#3d8f3d', '#c8b96a'], atmosphere: '#6fb7ff',
    inhabited: true, gas: false, oceanLevel: 0.58,
    exports: ['electronics', 'medicine', 'luxuries'], imports: ['food', 'narcotics'],
    moons: [
      { radius: 30, orbitRadius: 250, orbitSpeed: 0.05, spinSpeed: 0.05, color: '#aaaaaa' }
    ]
  },
  {
    id: 'mars', name: 'MARS', type: 'Agricultural World',
    flavor: 'Terraformed valleys and dome farms feed half the system from the old red world.',
    radius: 59, position: pos(5800, 290), seed: 17,
    palette: ['#8f2c2c', '#c75c5c', '#3d8f3d'], atmosphere: '#ff8888',
    inhabited: true, gas: false,
    exports: ['food', 'water'], imports: ['machinery', 'electronics', 'medicine'],
    moons: [
      { radius: 5, orbitRadius: 130, orbitSpeed: 0.09, spinSpeed: 0.1, color: '#887766' },
      { radius: 4, orbitRadius: 165, orbitSpeed: 0.06, spinSpeed: 0.12, color: '#998877' }
    ]
  },
  {
    id: 'jupiter', name: 'JUPITER', type: 'Tourist Orbital (Gas Giant)',
    flavor: 'The Great Red Spot has raged for centuries. Orbital resorts charge accordingly.',
    radius: 1210, position: pos(7800, 45, 200), seed: 23,
    palette: ['#a0764f', '#d9b08a', '#f5e6c8'], atmosphere: '#d9a05a',
    inhabited: false, gas: true,
    stormSpot: { color: '#c0392b', lat: -0.38, lon: 0.6, size: 0.3 },
    exports: [], imports: ['luxuries', 'food', 'fuel', 'narcotics'],
    moons: [
      { radius: 31, orbitRadius: 1550, orbitSpeed: 0.05, spinSpeed: 0.08, color: '#bbaa99' },
      { radius: 45, orbitRadius: 1850, orbitSpeed: 0.035, spinSpeed: 0.1, color: '#99aabb' }
    ]
  },
  {
    id: 'saturn', name: 'SATURN', type: 'Tourist Orbital (Gas Giant)',
    flavor: 'Honeymoon suites with a view of the rings. Book decades ahead.',
    radius: 1005, position: pos(9600, 150, -200), seed: 29,
    palette: ['#b09a6a', '#d9c08a', '#f0e0b0'], atmosphere: '#e8d090',
    inhabited: false, gas: true,
    rings: { inner: 1.35, outer: 2.4, color: '#d9c08a', opacity: 0.85, tilt: 0.47 },
    exports: [], imports: ['luxuries', 'food', 'fuel', 'narcotics'],
    moons: [
      { radius: 44, orbitRadius: 2600, orbitSpeed: 0.04, spinSpeed: 0.09, color: '#c0b090' }
    ]
  },
  {
    id: 'uranus', name: 'URANUS', type: 'Refinery World',
    flavor: 'The sideways ice giant. Skimmer fleets harvest fuel from its calm cyan clouds.',
    radius: 438, position: pos(11400, 250, 300), seed: 31,
    palette: ['#4a8a9a', '#7ac0d0', '#c0e8f0'], atmosphere: '#88e0e8',
    inhabited: false, gas: true,
    // Uranus rolls on its side: thin, faint rings standing nearly vertical
    rings: { inner: 1.55, outer: 1.85, color: '#a8d8e0', opacity: 0.25, tilt: 1.71 },
    exports: ['fuel', 'machinery'], imports: ['ore', 'electronics', 'water'],
  },
  {
    id: 'neptune', name: 'NEPTUNE', type: 'Industrial Core',
    flavor: 'Deep-blue storm world ringed by automated shipyards, lit like a second star.',
    radius: 425, position: pos(13000, 330, -300), seed: 37,
    palette: ['#1a3a8f', '#3a5ac0', '#8aa0e0'], atmosphere: '#5a80ff',
    inhabited: false, gas: true,
    stormSpot: { color: '#0e2050', lat: 0.3, lon: 2.1, size: 0.18 },
    exports: ['machinery', 'electronics'], imports: ['ore', 'fuel', 'water', 'luxuries'],
  },
  {
    id: 'pluto', name: 'PLUTO', type: 'Frontier Outpost',
    flavor: 'Still a planet to the people who live here. Last stop before the long dark.',
    radius: 21, position: pos(14500, 75, -500), seed: 41,
    palette: ['#8a7a6a', '#c0b0a0', '#e8e0d8'], atmosphere: '#99aabb',
    inhabited: true, gas: false, clouds: false,
    exports: ['fuel', 'narcotics'], imports: ['food', 'water', 'medicine', 'electronics', 'luxuries', 'machinery'],
  },
];

export const SYSTEM = {
  name: 'SOL',
  systemIndex: 0,
  character: 'Core Worlds',
  sunRadius: 300,
  planets: SOL_PLANETS,
};

function makeRnd(seed) {
  let h = seed;
  return function() {
    h = Math.sin(h) * 10000;
    return h - Math.floor(h);
  };
}

const NAME_PREFIX = ['VER', 'FER', 'CRU', 'LUM', 'ACH', 'ZON', 'TAR', 'XEN', 'VAL', 'SOL', 'ALPH', 'BET', 'GAM', 'DRA', 'OR', 'SI', 'AN', 'COR', 'KAI', 'HELI', 'CYG', 'VEC', 'LYR', 'PEG', 'VEG', 'ANDR'];
const NAME_SUFFIX = ['IDIA', 'OX', 'CIBLE', 'EN', 'ON', 'IA', 'OS', 'US', 'AR', 'AX', 'ERA', 'AURA', 'ETIS', 'ION', 'ORE', 'OCTO', 'IS', 'UX', 'YON', 'ITE', 'ATIS', 'OPIA', 'ALIS', 'URUS', 'OOM', 'USIA'];

// Every system beyond a galaxy's first leans toward one economy: its planet
// mix over-represents the favoured type, so goods it exports are cheap there
// and cross-system trade routes pay.
const SYSTEM_CHARACTERS = [
  { name: 'Agrarian Belt', favor: 'Agricultural World' },
  { name: 'Mining Cluster', favor: 'Mining Colony' },
  { name: 'Refinery Complex', favor: 'Refinery World' },
  { name: 'Tech Corridor', favor: 'Hi-Tech World' },
  { name: 'Frontier Reach', favor: 'Frontier Outpost' },
  { name: 'Industrial Heartland', favor: 'Industrial Core' },
];

function systemSeed(galaxyIndex, systemIndex) {
  return galaxyIndex * 987.654 + systemIndex * 131.7 + 3.21;
}

// Name + economy character for any system WITHOUT generating it — the nav
// computer lists jump destinations before the player commits fuel. Draws the
// same leading rnd values generateSystem does, so the two always agree.
export function systemInfo(galaxyIndex, systemIndex) {
  if (galaxyIndex === 0 && systemIndex === 0) {
    return { name: 'SOL', character: 'Core Worlds' };
  }
  const rnd = makeRnd(systemSeed(galaxyIndex, systemIndex));
  const draw = () => NAME_PREFIX[Math.floor(rnd() * NAME_PREFIX.length)]
    + NAME_SUFFIX[Math.floor(rnd() * NAME_SUFFIX.length)];
  if (systemIndex === 0) {
    // a galaxy's arrival system keeps the legacy name and a balanced economy
    return { name: draw() + ' ' + (galaxyIndex + 1), character: 'Balanced Economy' };
  }
  const name = draw();
  const character = SYSTEM_CHARACTERS[Math.floor(rnd() * SYSTEM_CHARACTERS.length)];
  return { name, character: character.name, favor: character.favor };
}

// Back-compat wrapper: a galaxy's arrival system is system 0.
export function generateGalaxy(galaxyIndex) {
  generateSystem(galaxyIndex, 0);
}

export function generateSystem(galaxyIndex, systemIndex = 0) {
  SYSTEM.systemIndex = systemIndex;

  if (galaxyIndex === 0 && systemIndex === 0) {
    SYSTEM.name = 'SOL';
    SYSTEM.character = 'Core Worlds';
    SYSTEM.sunRadius = 300;
    SYSTEM.suns = [
      { radius: 300, position: new THREE.Vector3(0, 0, 0), color: '#ffeedd' }
    ];
    SYSTEM.planets = SOL_PLANETS;
    return;
  }

  // system 0 of each galaxy draws the exact rnd sequence the old
  // generateGalaxy did, so pre-jump saves rebuild the same planets
  const rnd = makeRnd(systemSeed(galaxyIndex, systemIndex));

  const getRandName = () => {
    const p = NAME_PREFIX[Math.floor(rnd() * NAME_PREFIX.length)];
    const s = NAME_SUFFIX[Math.floor(rnd() * NAME_SUFFIX.length)];
    return p + s;
  };

  // 1. System name + economy character (must mirror systemInfo's draws)
  let favor = null;
  if (systemIndex === 0) {
    SYSTEM.name = getRandName() + ' ' + (galaxyIndex + 1);
    SYSTEM.character = 'Balanced Economy';
  } else {
    SYSTEM.name = getRandName();
    const character = SYSTEM_CHARACTERS[Math.floor(rnd() * SYSTEM_CHARACTERS.length)];
    SYSTEM.character = character.name;
    favor = character.favor;
  }

  // 2. Suns (potentially multiple)
  const isBinary = (galaxyIndex > 0 || systemIndex > 0) && rnd() < 0.45;
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

  // a favoured character triples its planet type's odds; system 0 stays flat
  const typePool = favor
    ? types.concat(types.filter((t) => t.type === favor), types.filter((t) => t.type === favor))
    : types;

  for (let i = 0; i < numPlanets; i++) {
    const name = getRandName() + (rnd() < 0.2 ? ' PRIME' : rnd() < 0.1 ? ' B' : '');
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '');

    const tSpec = typePool[Math.floor(rnd() * typePool.length)];
    const dist = 2400 + i * 1800 + rnd() * 700;
    const angle = rnd() * 360;
    const yOffset = (rnd() - 0.5) * 600;

    const palIdx = Math.floor(rnd() * basePalettes.length);
    const palette = basePalettes[palIdx];
    const atmosphere = baseAtmospheres[Math.floor(rnd() * baseAtmospheres.length)];

    // gas + final radius decided before moons so moon orbits clear the surface
    const gas = rnd() < 0.2;
    const pRadius = 70 + Math.floor(rnd() * 90);
    const radius = gas ? Math.round(pRadius * (2.0 + rnd() * 1.2)) : pRadius;

    const moons = [];
    const numMoons = rnd() < 0.3 ? 2 : rnd() < 0.7 ? 1 : 0;
    for (let m = 0; m < numMoons; m++) {
      moons.push({
        radius: 12 + Math.floor(rnd() * 12),
        orbitRadius: radius * 1.8 + m * 55 + rnd() * 20,
        orbitSpeed: 0.05 + rnd() * 0.12,
        spinSpeed: 0.05 + rnd() * 0.15,
        color: ['#888888', '#aaaaaa', '#555555', '#bbaa99', '#99aabb'][Math.floor(rnd() * 5)]
      });
    }

    const flavor = flavors[Math.floor(rnd() * flavors.length)];

    // Sol-style visual features, rolled procedurally: ring systems and giant
    // storms on gas giants, varied sea levels and airless worlds on rocky ones
    const oceanLevel = 0.36 + rnd() * 0.22;
    const airless = !gas && rnd() < 0.22;
    let rings = null;
    let stormSpot = null;
    if (gas) {
      if (rnd() < 0.4) {
        rings = {
          inner: 1.3 + rnd() * 0.2,
          outer: 1.7 + rnd() * 0.7,
          color: palette[2],
          opacity: 0.25 + rnd() * 0.6,
          tilt: (rnd() - 0.5) * 1.2,
        };
      }
      if (rnd() < 0.45) {
        stormSpot = {
          color: ['#c0392b', '#7a1f14', '#0e2050', '#f0ead8'][Math.floor(rnd() * 4)],
          lat: (rnd() - 0.5) * 1.6,
          lon: rnd() * 6.283,
          size: 0.12 + rnd() * 0.2,
        };
      }
    }

    SYSTEM.planets.push({
      id,
      name,
      type: tSpec.type,
      flavor,
      radius,
      position: pos(dist, angle, yOffset),
      seed: Math.floor(rnd() * 100),
      palette,
      atmosphere,
      inhabited: tSpec.type !== 'Frontier Outpost' && !gas,
      gas,
      oceanLevel,
      clouds: !airless,
      rings,
      stormSpot,
      exports: tSpec.exports,
      imports: tSpec.imports,
      moons: moons.length > 0 ? moons : null
    });
  }
}
