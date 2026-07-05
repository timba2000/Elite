// Keyboard + mouse input. Mouse is a Freelancer-style virtual stick:
// pointer-locked mouse movement accumulates into a clamped offset that maps
// to pitch/yaw rate. Arrow keys mirror the stick for keyboard-only play.
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseX = 0; // -1..1 virtual stick
    this.mouseY = 0;
    this.mouseDown = false;
    this.pointerLocked = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.justPressed.add(e.code);
      if (e.code === 'F5' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.dom;
      if (!this.pointerLocked) { this.mouseX = 0; this.mouseY = 0; }
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked || !this.enabled) return;
      this.mouseX = clamp(this.mouseX + e.movementX / 300, -1, 1);
      this.mouseY = clamp(this.mouseY + e.movementY / 300, -1, 1);
    });
    document.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouseDown = true; });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }

  requestPointerLock() {
    if (this.pointerLocked) return;
    try {
      const p = this.dom.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* pointer lock unavailable; keyboard flight still works */ }
  }
  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock?.();
  }

  // --- continuous axes ---
  get throttleUp() { return this.keys.has('KeyW'); }
  get throttleDown() { return this.keys.has('KeyS'); }
  get boost() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get firing() { return this.keys.has('Space') || this.mouseDown; }
  get roll() {
    return (this.keys.has('KeyQ') ? 1 : 0) - (this.keys.has('KeyE') ? 1 : 0);
  }
  get pitch() {
    let v = -this.mouseY;
    if (this.keys.has('ArrowUp')) v += 1;
    if (this.keys.has('ArrowDown')) v -= 1;
    return clamp(applyDeadzone(v), -1, 1);
  }
  get yaw() {
    let v = -this.mouseX;
    if (this.keys.has('ArrowLeft')) v += 1;
    if (this.keys.has('ArrowRight')) v -= 1;
    return clamp(applyDeadzone(v), -1, 1);
  }

  // --- edge-triggered actions; call consume() once per frame at frame end ---
  pressed(code) { return this.justPressed.has(code); }
  consume() { this.justPressed.clear(); }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function applyDeadzone(v, dz = 0.06) {
  return Math.abs(v) < dz ? 0 : v - Math.sign(v) * dz;
}
