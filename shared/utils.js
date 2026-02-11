// Shared utility functions for kart racing game

const Utils = {
  // Clamp value between min and max
  clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  },

  // Linear interpolation
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  // Angle lerp (shortest path)
  lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  },

  // Distance between two 2D points
  dist2D(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return Math.sqrt(dx * dx + dz * dz);
  },

  // Distance squared (cheaper)
  dist2DSq(x1, z1, x2, z2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    return dx * dx + dz * dz;
  },

  // Normalize angle to [-PI, PI]
  normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  },

  // Angle from point A to point B
  angleTo(x1, z1, x2, z2) {
    return Math.atan2(x2 - x1, z2 - z1);
  },

  // Dot product of two 2D vectors
  dot2D(ax, az, bx, bz) {
    return ax * bx + az * bz;
  },

  // Generate unique ID
  generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  },

  // Weighted random selection based on position (for power-ups)
  weightedPowerup(position, totalRacers) {
    const ratio = position / totalRacers; // 0 = first, 1 = last
    // Front runners get weaker items, back runners get stronger ones
    const weights = {
      speed_boost: ratio < 0.5 ? 0.15 : 0.3,
      shield: 0.2,
      trap: ratio < 0.5 ? 0.3 : 0.1,
      spin: ratio < 0.5 ? 0.2 : 0.15,
      missile: ratio < 0.3 ? 0.05 : 0.25,
    };

    const total = Object.values(weights).reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (const [type, weight] of Object.entries(weights)) {
      r -= weight;
      if (r <= 0) return type;
    }
    return 'speed_boost';
  },

  // Check if point is within a forward cone
  isInCone(sourceX, sourceZ, sourceAngle, targetX, targetZ, coneAngle, maxRange) {
    const dx = targetX - sourceX;
    const dz = targetZ - sourceZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > maxRange || dist < 0.1) return false;

    const angleToTarget = Math.atan2(dx, dz);
    let angleDiff = angleToTarget - sourceAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    return Math.abs(angleDiff) < coneAngle / 2;
  },

  // Simple seeded random (for deterministic AI)
  seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  },

  // Catmull-Rom spline interpolation for smooth track
  catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
  },

  // Get point on spline track
  getSplinePoint(points, t) {
    const n = points.length;
    const i = Math.floor(t * n) % n;
    const frac = (t * n) % 1;
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    return {
      x: Utils.catmullRom(p0.x, p1.x, p2.x, p3.x, frac),
      z: Utils.catmullRom(p0.z, p1.z, p2.z, p3.z, frac),
    };
  },

  // Get tangent on spline track
  getSplineTangent(points, t) {
    const delta = 0.001;
    const a = Utils.getSplinePoint(points, t);
    const b = Utils.getSplinePoint(points, t + delta);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    return { x: dx / len, z: dz / len };
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
} else if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
