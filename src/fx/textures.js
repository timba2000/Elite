import * as THREE from 'three';

// Shared procedural CanvasTexture generators.

// Soft radial glow (for sun sprites, engine glows, muzzle flashes).
export function radialGlowTexture(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Grungy hull texture: base color, panel lines, rust streaks, scorch blotches.
// `wear` 0..1 controls how beat-up it looks (1 = rust bucket, 0 = fresh paint).
// Returns { map, roughnessMap }.
export function grungeHullTexture(baseColor = '#8a8d92', accentColor = '#b3552e', wear = 1, seed = 1) {
  const size = 512;
  const rnd = mulberry32(seed);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Large tonal patches (mismatched replacement panels)
  for (let i = 0; i < 14; i++) {
    const w = 40 + rnd() * 140, h = 30 + rnd() * 100;
    const x = rnd() * size, y = rnd() * size;
    ctx.fillStyle = `rgba(${Math.floor(rnd() * 60 + 90)},${Math.floor(rnd() * 60 + 90)},${Math.floor(rnd() * 60 + 95)},${0.12 + rnd() * 0.2})`;
    ctx.fillRect(x, y, w, h);
  }

  // Panel lines
  ctx.strokeStyle = 'rgba(20,22,26,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const y = rnd() * size;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  for (let i = 0; i < 10; i++) {
    const x = rnd() * size;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  // Rivets along some lines
  ctx.fillStyle = 'rgba(30,32,36,0.7)';
  for (let i = 0; i < 160; i++) {
    ctx.fillRect(rnd() * size, rnd() * size, 2, 2);
  }

  // Rust streaks (drip downward)
  const rust = hexToRgb(accentColor);
  for (let i = 0; i < Math.floor(60 * wear); i++) {
    const x = rnd() * size, y = rnd() * size;
    const len = 10 + rnd() * 70;
    const g = ctx.createLinearGradient(x, y, x, y + len);
    g.addColorStop(0, `rgba(${rust.r},${rust.g},${rust.b},${0.35 + rnd() * 0.35})`);
    g.addColorStop(1, `rgba(${rust.r},${rust.g},${rust.b},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 2 + rnd() * 5, len);
  }

  // Scorch blotches
  for (let i = 0; i < Math.floor(18 * wear); i++) {
    const x = rnd() * size, y = rnd() * size, r = 8 + rnd() * 36;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(10,8,6,${0.25 + rnd() * 0.3})`);
    g.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Fine noise speckle
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  // Roughness map: rusty/scorched areas rougher — reuse luminance inverted-ish
  const rc = document.createElement('canvas');
  rc.width = rc.height = size;
  const rctx = rc.getContext('2d');
  rctx.drawImage(c, 0, 0);
  rctx.globalCompositeOperation = 'saturation';
  rctx.fillStyle = '#808080';
  rctx.fillRect(0, 0, size, size);
  const rough = new THREE.CanvasTexture(rc);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;

  return { map, roughnessMap: rough };
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
