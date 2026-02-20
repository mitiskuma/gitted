// =============================================================================
// OBJECT POOLS — RING BUFFERS FOR BEAMS & PARTICLES
// =============================================================================
// Fixed-capacity pools backed by typed arrays. Zero allocations in steady state.
// Uses swap-remove instead of Array.filter() for O(1) removal.

/**
 * Fixed-capacity ring buffer pool for commit beams.
 *
 * Each beam occupies 8 floats in a contiguous Float32Array:
 *   [0] fromX  [1] fromY  [2] toX  [3] toY
 *   [4] progress  [5] opacity  [6] ttl  [7] reserved
 *
 * Color is stored separately in per-beam Uint8 arrays (r, g, b).
 * Zero allocations in steady state; dead beams are swap-removed in O(1).
 */
export class BeamPool {
  readonly capacity: number;
  count: number;

  // 8 floats per beam
  data: Float32Array;

  // Color per beam
  colorR: Uint8Array;
  colorG: Uint8Array;
  colorB: Uint8Array;

  // Stride
  static readonly STRIDE = 8;
  static readonly FROM_X = 0;
  static readonly FROM_Y = 1;
  static readonly TO_X = 2;
  static readonly TO_Y = 3;
  static readonly PROGRESS = 4;
  static readonly OPACITY = 5;
  static readonly TTL = 6;

  constructor(capacity: number = 512) {
    this.capacity = capacity;
    this.count = 0;
    this.data = new Float32Array(capacity * BeamPool.STRIDE);
    this.colorR = new Uint8Array(capacity);
    this.colorG = new Uint8Array(capacity);
    this.colorB = new Uint8Array(capacity);
  }

  /**
   * Add a beam. If at capacity, overwrites the oldest (ring behavior).
   * Returns the index of the added beam.
   */
  add(
    fromX: number, fromY: number,
    toX: number, toY: number,
    r: number, g: number, b: number,
    ttl: number = 50,
  ): number {
    let idx: number;
    if (this.count < this.capacity) {
      idx = this.count;
      this.count++;
    } else {
      // Find the beam with lowest TTL and replace it
      idx = 0;
      let minTtl = this.data[BeamPool.TTL];
      for (let i = 1; i < this.capacity; i++) {
        const t = this.data[i * BeamPool.STRIDE + BeamPool.TTL];
        if (t < minTtl) {
          minTtl = t;
          idx = i;
        }
      }
    }

    const off = idx * BeamPool.STRIDE;
    this.data[off + BeamPool.FROM_X] = fromX;
    this.data[off + BeamPool.FROM_Y] = fromY;
    this.data[off + BeamPool.TO_X] = toX;
    this.data[off + BeamPool.TO_Y] = toY;
    this.data[off + BeamPool.PROGRESS] = 0;
    this.data[off + BeamPool.OPACITY] = 1.0;
    this.data[off + BeamPool.TTL] = ttl;

    this.colorR[idx] = r;
    this.colorG[idx] = g;
    this.colorB[idx] = b;

    return idx;
  }

  /**
   * Update all beams: advance progress, decay opacity, decrement TTL.
   * Dead beams are swap-removed. Returns number of active beams after update.
   */
  update(): number {
    let i = 0;
    while (i < this.count) {
      const off = i * BeamPool.STRIDE;

      this.data[off + BeamPool.PROGRESS] += 0.05;
      this.data[off + BeamPool.TTL] -= 1;
      this.data[off + BeamPool.OPACITY] = Math.max(0, this.data[off + BeamPool.OPACITY] - 0.018);

      const dead = this.data[off + BeamPool.TTL] <= 0 || this.data[off + BeamPool.OPACITY] <= 0.01;

      if (dead) {
        // Swap-remove: move last beam into this slot
        this.count--;
        if (i < this.count) {
          const lastOff = this.count * BeamPool.STRIDE;
          for (let j = 0; j < BeamPool.STRIDE; j++) {
            this.data[off + j] = this.data[lastOff + j];
          }
          this.colorR[i] = this.colorR[this.count];
          this.colorG[i] = this.colorG[this.count];
          this.colorB[i] = this.colorB[this.count];
        }
        // Don't increment i — re-check this slot
      } else {
        i++;
      }
    }

    return this.count;
  }

  /** Read beam data at index. */
  getFromX(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.FROM_X]; }
  getFromY(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.FROM_Y]; }
  getToX(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.TO_X]; }
  getToY(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.TO_Y]; }
  getProgress(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.PROGRESS]; }
  getOpacity(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.OPACITY]; }
  getTtl(i: number): number { return this.data[i * BeamPool.STRIDE + BeamPool.TTL]; }

  clear(): void {
    this.count = 0;
  }
}

/**
 * Fixed-capacity ring buffer pool for particles.
 *
 * Each particle occupies 8 floats in a contiguous Float32Array:
 *   [0] x  [1] y  [2] vx  [3] vy
 *   [4] size  [5] opacity  [6] ttl  [7] maxTtl
 *
 * Color is stored separately in per-particle Uint8 arrays (r, g, b).
 * Zero allocations in steady state; dead particles are swap-removed in O(1).
 */
export class ParticlePool {
  readonly capacity: number;
  count: number;

  data: Float32Array;

  colorR: Uint8Array;
  colorG: Uint8Array;
  colorB: Uint8Array;

  static readonly STRIDE = 8;
  static readonly X = 0;
  static readonly Y = 1;
  static readonly VX = 2;
  static readonly VY = 3;
  static readonly SIZE = 4;
  static readonly OPACITY = 5;
  static readonly TTL = 6;
  static readonly MAX_TTL = 7;

  constructor(capacity: number = 2048) {
    this.capacity = capacity;
    this.count = 0;
    this.data = new Float32Array(capacity * ParticlePool.STRIDE);
    this.colorR = new Uint8Array(capacity);
    this.colorG = new Uint8Array(capacity);
    this.colorB = new Uint8Array(capacity);
  }

  /**
   * Emit a single particle. If at capacity, replaces the particle with lowest TTL.
   */
  emit(
    x: number, y: number,
    vx: number, vy: number,
    r: number, g: number, b: number,
    size: number,
    ttl: number,
  ): void {
    let idx: number;
    if (this.count < this.capacity) {
      idx = this.count;
      this.count++;
    } else {
      // Replace the particle with lowest TTL
      idx = 0;
      let minTtl = this.data[ParticlePool.TTL];
      for (let i = 1; i < this.capacity; i++) {
        const t = this.data[i * ParticlePool.STRIDE + ParticlePool.TTL];
        if (t < minTtl) {
          minTtl = t;
          idx = i;
        }
      }
    }

    const off = idx * ParticlePool.STRIDE;
    this.data[off + ParticlePool.X] = x;
    this.data[off + ParticlePool.Y] = y;
    this.data[off + ParticlePool.VX] = vx;
    this.data[off + ParticlePool.VY] = vy;
    this.data[off + ParticlePool.SIZE] = size;
    this.data[off + ParticlePool.OPACITY] = 1;
    this.data[off + ParticlePool.TTL] = ttl;
    this.data[off + ParticlePool.MAX_TTL] = ttl;

    this.colorR[idx] = r;
    this.colorG[idx] = g;
    this.colorB[idx] = b;
  }

  /**
   * Emit multiple particles in a burst pattern around a position.
   */
  emitBurst(
    x: number, y: number,
    r: number, g: number, b: number,
    count: number,
    speedMin: number, speedMax: number,
    sizeMin: number, sizeMax: number,
    ttlMin: number, ttlMax: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);
      const size = sizeMin + Math.random() * (sizeMax - sizeMin);
      const ttl = ttlMin + Math.floor(Math.random() * (ttlMax - ttlMin));

      this.emit(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        r, g, b,
        size, ttl,
      );
    }
  }

  /**
   * Update all particles: integrate velocity, apply damping, decrement TTL.
   * Dead particles are swap-removed.
   */
  update(): number {
    let i = 0;
    while (i < this.count) {
      const off = i * ParticlePool.STRIDE;

      // Integrate
      this.data[off + ParticlePool.X] += this.data[off + ParticlePool.VX];
      this.data[off + ParticlePool.Y] += this.data[off + ParticlePool.VY];

      // Damping
      this.data[off + ParticlePool.VX] *= 0.97;
      this.data[off + ParticlePool.VY] *= 0.97;

      // TTL & opacity
      this.data[off + ParticlePool.TTL] -= 1;
      const ttl = this.data[off + ParticlePool.TTL];
      const maxTtl = this.data[off + ParticlePool.MAX_TTL];
      this.data[off + ParticlePool.OPACITY] = (ttl / maxTtl) * 0.8;
      this.data[off + ParticlePool.SIZE] *= 0.995;

      if (ttl <= 0) {
        // Swap-remove
        this.count--;
        if (i < this.count) {
          const lastOff = this.count * ParticlePool.STRIDE;
          for (let j = 0; j < ParticlePool.STRIDE; j++) {
            this.data[off + j] = this.data[lastOff + j];
          }
          this.colorR[i] = this.colorR[this.count];
          this.colorG[i] = this.colorG[this.count];
          this.colorB[i] = this.colorB[this.count];
        }
      } else {
        i++;
      }
    }

    return this.count;
  }

  /** Read particle data at index. */
  getX(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.X]; }
  getY(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.Y]; }
  getSize(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.SIZE]; }
  getOpacity(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.OPACITY]; }
  getTtl(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.TTL]; }
  getMaxTtl(i: number): number { return this.data[i * ParticlePool.STRIDE + ParticlePool.MAX_TTL]; }

  clear(): void {
    this.count = 0;
  }
}
