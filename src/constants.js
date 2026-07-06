// Every tuning number in the game lives here.
export const C = {
  // Rendering
  CAMERA_FOV: 60,
  CAMERA_FOV_BOOST: 70,
  CAMERA_FAR: 120000,
  BLOOM_STRENGTH: 0.9,
  BLOOM_RADIUS: 0.5,
  BLOOM_THRESHOLD: 0.85,
  // SSAO (photo tier). Distances are fractions of the near→far depth range
  // (far is 120000, so 0.0005 ≈ 60 world units); radius is in world units,
  // sized for cockpit/station geometry.
  SSAO_KERNEL_RADIUS: 3,
  SSAO_MIN_DISTANCE: 0.00001,
  SSAO_MAX_DISTANCE: 0.0005,

  // Flight
  BASE_SPEED: 40,
  BOOST_SPEED: 120,
  VELOCITY_EASE: 2.0,        // k in lerp(1 - exp(-k*dt))
  TURN_RATE: 1.5,            // rad/s at full stick
  ROLL_RATE: 2.0,
  CAM_OFFSET: { x: 0, y: 3.5, z: 12 },
  CAM_EASE: 5,

  // Supercruise
  SUPER_SPEED: 2500,
  SUPER_ACCEL: 900,          // u/s^2 ramp
  SUPER_DROP_MARGIN: 400,    // drop out this far from target surface
  SUPER_MIN_PIRATE_DIST: 400,
  SUPER_REENGAGE_DELAY: 5,   // s with no pirate nearby before re-engage allowed
  TIME_SCALE_SUPER: 20,      // economy time multiplier during supercruise

  // Energy / weapons
  ENERGY_MAX: 100,
  ENERGY_REGEN: 18,          // per second
  BOOST_DRAIN: 25,           // per second
  LASER_SPEED: 600,
  LASER_LIFE: 1.6,
  LASER_RANGE_HINT: 260,     // AI fire range

  // Combat
  SHIELD_REGEN_DELAY: 4,
  INTERDICTION_CHANCE: 0.02, // per supercruise second, base
  ENCOUNTER_COOLDOWN: 60,
  PIRATE_BOUNTY_MIN: 300,
  PIRATE_BOUNTY_MAX: 800,
  POD_DROP_CHANCE: 0.3,
  POD_SCOOP_DIST: 15,
  CARGO_EJECT_CHANCE: 0.25,  // per hull hit below 50%
  DEATH_CREDIT_TAX: 0.10,

  // Docking
  DOCK_RANGE: 130,
  DOCK_DURATION: 4.0,          // autodock glide (docking computer)
  DOCK_TRACTOR_DURATION: 1.6,  // short tractor pull after a manual capture
  DOCK_CLEARANCE_RANGE: 260,   // clearance expires beyond this distance
  DOCK_MAX_SPEED: 16,          // contact above this bounces you off the hub
  DOCK_FACE_DIST: 3,           // axial distance from hub face that triggers capture
  DOCK_FACE_RADIUS: 12,        // lateral radius of the hub face contact zone
  DOCK_LATERAL_TOL: 6,         // must be this close to the aperture axis to enter
  DOCK_ALIGN_DOT: 0.5,         // nose must point this much into the port
  DOCK_INWARD_DOT: 0.6,        // velocity must head this much into the port
  DOCK_SAFE_SPEED: 6,          // failed contact below this speed does no damage
  DOCK_BOUNCE_DAMAGE: 1.2,     // hull damage per m/s above safe speed

  // Economy
  START_CREDITS: 500,
  START_CARGO: { food: 4 },
  REPAIR_COST_PER_POINT: 2,
  EXPORT_BIAS: 0.5,
  IMPORT_BIAS: 1.6,
  DRIFT_REVERT: 0.02,
  DRIFT_MIN: 0.5,
  DRIFT_MAX: 2.0,
  TRADE_PRICE_IMPACT: 0.002, // drift nudge per unit traded

  // Buyable hulls. Multipliers apply over upgrade-tier stats; slots limit
  // utility modules; crew seats gate the crew system. Trade-in pays 70%.
  SHIPS: {
    courier: {
      name: 'Swift Courier', price: 9000,
      desc: 'Fast, agile, and tiny. Outruns trouble it cannot fight.',
      speedMult: 1.25, turnMult: 1.2, hullMult: 0.7, cargoMult: 0.5,
      shieldMult: 0.85, damageMult: 1.0, slots: 1, crew: 0,
    },
    trader: {
      name: 'Cobra Trader', price: 15000,
      desc: 'The beat-up all-rounder you started with. Honest work.',
      speedMult: 1.0, turnMult: 1.0, hullMult: 1.0, cargoMult: 1.0,
      shieldMult: 1.0, damageMult: 1.0, slots: 2, crew: 1,
    },
    freighter: {
      name: 'Bulk Freighter', price: 90000,
      desc: 'A warehouse with engines. Slow, tough, and very profitable.',
      speedMult: 0.8, turnMult: 0.72, hullMult: 1.5, cargoMult: 2.2,
      shieldMult: 1.2, damageMult: 1.0, slots: 3, crew: 2,
    },
    interceptor: {
      name: 'Fer-de-Lance', price: 140000,
      desc: 'A bounty hunter\'s blade. Guns and speed, no room for freight.',
      speedMult: 1.15, turnMult: 1.35, hullMult: 1.1, cargoMult: 0.6,
      shieldMult: 1.4, damageMult: 1.3, slots: 2, crew: 1,
    },
  },
  SHIP_TRADE_IN: 0.7,        // fraction of hull price credited when swapping
  INSURANCE_RATE: 0.06,      // death rebuy = rate * (hull + modules value)

  // Utility modules — one slot each, sell back at 60%
  MODULES: {
    shieldCell: { name: 'Shield Cell Bank', price: 5200, desc: '+40% shield capacity' },
    cargoRacks: { name: 'Expanded Racks', price: 3800, desc: '+8 cargo units' },
    afterburner: { name: 'Afterburner', price: 4600, desc: '+15% boost speed' },
    ecm: { name: 'ECM Suite', price: 7400, desc: 'Deflects incoming missiles 50% of the time' },
    chaff: { name: 'Chaff Launcher', price: 6200, desc: 'Active countermeasure (Press X to break missile locks)' },
    salvageScoop: { name: 'Salvage Scoop', price: 2900, desc: 'Double cargo scoop radius' },
  },
  MODULE_SELL_RATE: 0.6,

  // Upgrades: index by tier (tier 0 unused where noted)
  UPGRADES: {
    engine: {
      name: 'Engine',
      tiers: [null,
        { price: 0, maxSpeed: 40, boost: 120, turnMult: 1.0 },
        { price: 1200, maxSpeed: 50, boost: 145, turnMult: 1.15 },
        { price: 3000, maxSpeed: 60, boost: 170, turnMult: 1.3 },
        { price: 7500, maxSpeed: 70, boost: 200, turnMult: 1.45 },
      ],
    },
    weapons: {
      name: 'Laser Cannon',
      tiers: [null,
        { price: 0, damage: 8, energy: 4, interval: 0.22, twin: false },
        { price: 1500, damage: 12, energy: 4.5, interval: 0.2, twin: false },
        { price: 3800, damage: 16, energy: 5, interval: 0.18, twin: true },
        { price: 9500, damage: 22, energy: 5.5, interval: 0.16, twin: true },
      ],
    },
    shield: {
      name: 'Shield Generator',
      tiers: [
        { price: 0, max: 0, regen: 0 },
        { price: 1000, max: 60, regen: 6 },
        { price: 2600, max: 100, regen: 9 },
        { price: 6500, max: 150, regen: 13 },
      ],
    },
    hull: {
      name: 'Hull Plating',
      tiers: [null,
        { price: 0, max: 100 },
        { price: 1400, max: 160 },
        { price: 3600, max: 250 },
      ],
    },
    cargo: {
      name: 'Cargo Hold',
      tiers: [null,
        { price: 0, max: 20 },
        { price: 900, max: 32 },
        { price: 2400, max: 45 },
        { price: 6000, max: 60 },
      ],
    },
    dockingComputer: {
      name: 'Docking Computer',
      tiers: [
        { price: 0, fitted: false },
        { price: 12000, fitted: true },
      ],
    },
    missiles: {
      name: 'Missile Launcher',
      tiers: [
        { price: 0, maxAmmo: 0, damage: 0 },
        { price: 1800, maxAmmo: 4, damage: 150 },
        { price: 4200, maxAmmo: 8, damage: 250 },
        { price: 9500, maxAmmo: 12, damage: 400 },
      ],
    },
    galacticHyperdrive: {
      name: 'Galactic Hyperdrive',
      tiers: [
        { price: 0, fitted: false },
        { price: 15000, fitted: true },
      ],
    },
  },

  // Pirates
  PIRATE: {
    SPEED: 46,
    TURN: 1.2,
    HULL: 60,
    SHIELD: 20,
    DAMAGE: 6,
    FIRE_INTERVAL: 0.5,
    AIM_CONE: 0.14,       // rad
    AIM_JITTER: 0.026,    // rad
    ATTACK_DIST: 250,
    BREAK_DIST: 60,
    FLEE_HULL: 0.25,
    DESPAWN_DIST: 2200,
  },
};
