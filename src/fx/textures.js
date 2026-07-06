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
// Returns { map, roughnessMap, normalMap }.
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

  // Normal map: treat the painted grunge as a height field (dark panel lines
  // etch inward, rivets and scorch dip, patches stand proud) and Sobel it.
  const normalMap = normalMapFromCanvas(c, 2.2);

  return { map, roughnessMap: rough, normalMap };
}

// Derive a tangent-space normal map from a canvas, reading luminance as height.
// One-time CPU cost per texture; gives PBR hulls real surface relief.
export function normalMapFromCanvas(srcCanvas, strength = 2.0) {
  const size = srcCanvas.width;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, size, size).data;
  const height = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    height[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  }

  // 3×3 box blur first: single-pixel speckle in the paint would otherwise
  // become per-pixel normals and read as glitter under specular light.
  const raw = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  const blurred = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) sum += raw(x + dx, y + dy);
      }
      blurred[y * size + x] = sum / 9;
    }
  }

  const nc = document.createElement('canvas');
  nc.width = nc.height = size;
  const nctx = nc.getContext('2d');
  const out = nctx.createImageData(size, size);
  const at = (x, y) => blurred[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gradients (wrapping edges — textures repeat)
      const gx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        at(x + 1, y - 1) - 2 * at(x + 1, y) - at(x + 1, y + 1);
      const gy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        at(x - 1, y + 1) - 2 * at(x, y + 1) - at(x + 1, y + 1);
      const nx = gx * strength;
      const ny = gy * strength;
      const nz = 1.0;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const o = (y * size + x) * 4;
      out.data[o] = Math.round((nx * inv * 0.5 + 0.5) * 255);
      out.data[o + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255);
      out.data[o + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255);
      out.data[o + 3] = 255;
    }
  }
  nctx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(nc);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
